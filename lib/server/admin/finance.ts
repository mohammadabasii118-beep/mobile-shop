import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { notFound } from "@/lib/server/errors";
import { audit, pageParams, type AdminCtx } from "@/lib/server/admin/core";
import { walletApply, walletHistory } from "@/lib/server/finance/wallet";
import { getLoyaltyRules, pointsApply } from "@/lib/server/finance/loyalty";
import { notify } from "@/lib/server/notify";
import { toLatinDigits } from "@/lib/server/validation";

const userSelect = { id: true, phone: true, displayName: true, firstName: true, lastName: true, isActive: true } as const;

/** Users with their wallet balance / points (search by name or phone). `view=transactions` lists ledger rows instead. */
async function listBalances(req: NextRequest, kind: "wallet" | "loyalty") {
  const { take, skip, q, page, sp } = pageParams(req, 30);
  if (sp.get("view") === "transactions") {
    const where: Prisma.WalletTransactionWhereInput = q ? { OR: [{ reference: { contains: q } }, { description: { contains: q, mode: "insensitive" } }, { wallet: { user: { phone: { contains: toLatinDigits(q) } } } }] } : {};
    if (kind === "wallet") {
      const [items, total] = await Promise.all([
        db.walletTransaction.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { wallet: { select: { user: { select: userSelect } } } } }),
        db.walletTransaction.count({ where }),
      ]);
      return { view: "transactions", items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
    }
    const lw: Prisma.LoyaltyTransactionWhereInput = q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { account: { user: { phone: { contains: toLatinDigits(q) } } } }] } : {};
    const [items, total] = await Promise.all([
      db.loyaltyTransaction.findMany({ where: lw, orderBy: { createdAt: "desc" }, take, skip, include: { account: { select: { user: { select: userSelect } } } } }),
      db.loyaltyTransaction.count({ where: lw }),
    ]);
    return { view: "transactions", items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
  }
  const qn = toLatinDigits(q);
  const where: Prisma.UserWhereInput = q ? { OR: [{ phone: { contains: qn } }, { displayName: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : kind === "wallet" ? { wallet: { is: {} } } : { loyalty: { is: {} } };
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: kind === "wallet" ? { wallet: { balance: "desc" } } : { loyalty: { points: "desc" } }, take, skip, select: { ...userSelect, wallet: { select: { balance: true } }, loyalty: { select: { points: true } } } }),
    db.user.count({ where }),
  ]);
  const sums = kind === "wallet" ? (await db.wallet.aggregate({ _sum: { balance: true } }))._sum.balance ?? 0 : (await db.loyaltyAccount.aggregate({ _sum: { points: true } }))._sum.points ?? 0;
  return { view: "balances", items: rows.map((u) => ({ ...u, balance: u.wallet?.balance ?? 0, points: u.loyalty?.points ?? 0 })), total, page, pages: Math.max(1, Math.ceil(total / take)), sum: sums };
}
export const listWallets = (req: NextRequest) => listBalances(req, "wallet");
export const listLoyalty = async (req: NextRequest) => ({ ...(await listBalances(req, "loyalty")), rules: await getLoyaltyRules() });

export async function walletOf(userId: string, req: NextRequest) {
  const user = await db.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw notFound("کاربر پیدا نشد.");
  const { take, skip } = pageParams(req, 30);
  return { user, ...(await walletHistory(userId, take, skip)) };
}
export async function loyaltyOf(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw notFound("کاربر پیدا نشد.");
  const acc = await db.loyaltyAccount.findUnique({ where: { userId }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } } });
  return { user, points: acc?.points ?? 0, items: acc?.transactions ?? [] };
}

const adjustSchema = z.object({
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().int("عدد صحیح وارد کنید.").min(1).max(2_000_000_000),
  reason: z.string().trim().min(3, "دلیل را بنویسید.").max(300),
  /** Client-generated unique key: resubmitting the same request (double click, retry) applies it only once. */
  key: z.string().trim().min(8).max(80),
});

export async function adjustWallet(userId: string, body: unknown, a: AdminCtx) {
  const d = adjustSchema.parse(body);
  return db.$transaction(async (tx) => {
    if (!(await tx.user.findUnique({ where: { id: userId } }))) throw notFound("کاربر پیدا نشد.");
    const r = await walletApply(tx, { userId, direction: d.direction, amount: d.amount, type: d.direction === "in" ? "admin_credit" : "admin_debit", reference: `admin:${d.key}`, description: d.reason, byId: a.admin.id });
    if (!r.replay) {
      await audit(a, d.direction === "in" ? "wallet.credit" : "wallet.debit", "wallet", userId, { balance: r.transaction.balanceBefore }, { balance: r.balance, amount: d.amount, reason: d.reason, reference: r.transaction.reference }, tx);
      await notify(tx, userId, "wallet_change", { title: d.direction === "in" ? "اعتبار کیف پول شما افزایش یافت" : "از کیف پول شما کسر شد", body: `${d.amount.toLocaleString("fa-IR")} تومان — ${d.reason}`, link: "/account/wallet" });
    }
    return { balance: r.balance, replay: r.replay };
  });
}

export async function adjustLoyalty(userId: string, body: unknown, a: AdminCtx) {
  const d = adjustSchema.parse(body);
  return db.$transaction(async (tx) => {
    if (!(await tx.user.findUnique({ where: { id: userId } }))) throw notFound("کاربر پیدا نشد.");
    const r = await pointsApply(tx, { userId, points: d.direction === "in" ? d.amount : -d.amount, type: "admin_adjustment", reference: `admin:${d.key}`, description: d.reason, byId: a.admin.id });
    if (!r.replay && r.transaction) {
      await audit(a, d.direction === "in" ? "loyalty.credit" : "loyalty.debit", "loyalty", userId, { points: r.transaction.pointsBefore }, { points: r.balance, delta: r.transaction.points, reason: d.reason }, tx);
      await notify(tx, userId, "loyalty_change", { title: "امتیاز باشگاه شما تغییر کرد", body: `${d.direction === "in" ? "+" : "−"}${d.amount.toLocaleString("fa-IR")} امتیاز — ${d.reason}`, link: "/account/points" });
    }
    return { points: r.balance, replay: r.replay };
  });
}
