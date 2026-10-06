import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, conflict } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { hashPassword } from "@/lib/server/auth/password";
import { createSession, type SessionUser } from "@/lib/server/auth/session";
import { mergeGuestCart } from "@/lib/server/cart";
import { emailSchema, fullNameSchema, passwordSchema, phoneSchema, splitFullName } from "@/lib/server/validation";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
export const BUSINESS_TYPES = ["instagram_shop", "online_shop", "physical_store", "other"] as const;

/** Business part of the form (shared by "new visitor" and "already signed in"). `.strict()`: unknown keys (roles, status, userId…) are refused. */
const business = {
  storeName: z.string().trim().min(2, "نام فروشگاه / کسب‌وکار را وارد کنید.").max(100),
  phone: phoneSchema, // contact number only — never used for OTP
  businessType: z.enum(BUSINESS_TYPES),
  instagram: optional(80),
  website: optional(200).refine((v) => !v || /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(v), "آدرس سایت نامعتبر است."),
  province: z.string().trim().min(2, "استان را وارد کنید.").max(60),
  city: z.string().trim().min(2, "شهر را وارد کنید.").max(60),
  address: optional(400),
  description: optional(600),
};
const needsAddress = (v: { businessType: string; address?: string }, ctx: z.RefinementCtx) => {
  if (v.businessType === "physical_store" && (v.address?.length ?? 0) < 8) ctx.addIssue({ code: "custom", path: ["address"], message: "آدرس فروشگاه را کامل وارد کنید." });
};
export const partnerRegisterSchema = z.object({ fullName: fullNameSchema, email: emailSchema, password: passwordSchema, ...business }).strict().superRefine(needsAddress);
/** Signed-in variant: phone and province default to what the account already has (`name` is accepted as an alias of `fullName`). */
export const partnerApplySchema = z.object({ fullName: z.string().trim().min(2).max(80).optional(), name: z.string().trim().min(2).max(80).optional(), ...business, phone: phoneSchema.optional(), province: business.province.optional() }).strict().superRefine(needsAddress);
type Business = Omit<z.infer<typeof partnerApplySchema>, "phone" | "province"> & { phone: string; province?: string };

const appData = (d: Business, name: string, email: string | null) => ({
  name, email, phone: d.phone, storeName: d.storeName, businessType: d.businessType, instagram: d.instagram ?? null, website: d.website ?? null,
  province: d.province ?? null, city: d.city, address: d.address ?? "", description: d.description ?? null,
});

/**
 * Creates or refreshes the user's application (status PENDING). It never grants any wholesale role: only an admin approval does
 * (`approveApplication`). One open application per user; an application that needs changes is updated in place.
 */
async function upsertApplication(userId: string, d: Business, name: string, email: string | null) {
  const open = await db.wholesaleApplication.findFirst({ where: { userId, status: { in: ["PENDING", "CHANGES_REQUESTED"] } } });
  if (open?.status === "PENDING") throw conflict("درخواست قبلی شما در حال بررسی است.", "application_pending");
  if (open) { await db.wholesaleApplication.update({ where: { id: open.id }, data: { ...appData(d, name, email), status: "PENDING", adminNote: null } }); return open.id; }
  return (await db.wholesaleApplication.create({ data: { ...appData(d, name, email), userId, status: "PENDING" } })).id;
}

/** Signed-in customer applies (no account fields needed). */
export async function applyAsUser(user: SessionUser, raw: z.infer<typeof partnerApplySchema>) {
  const d = raw;
  await rateLimit(`wholesale-apply:${user.id}`, 5, 86400);
  if (user.wholesale) throw conflict("شما همکار عمده هستید.");
  const phone = d.phone ?? user.phone;
  if (!phone) throw badRequest("شماره تماس را وارد کنید.", "validation");
  const name = d.fullName ?? d.name ?? user.displayName ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || d.storeName);
  return { id: await upsertApplication(user.id, { ...d, phone }, name, user.email), createdAccount: false };
}

/**
 * Public sign-up as a partner: creates the customer account (e-mail + password, no OTP), the PENDING application and a session.
 * An e-mail that already exists is never re-created and never hijacked: the visitor is asked to sign in first (then `applyAsUser`
 * links the application to that same user).
 */
export async function registerPartner(d: z.infer<typeof partnerRegisterSchema>, ip: string) {
  await rateLimit(`wholesale-register:ip:${ip}`, 8, 3600);
  await rateLimit(`wholesale-register:email:${d.email}`, 5, 3600);
  if (await db.user.findUnique({ where: { email: d.email }, select: { id: true } })) throw conflict("این ایمیل قبلاً ثبت شده است. لطفاً وارد حساب خود شوید و درخواست همکاری را از پنل کاربری ثبت کنید.", "email_taken");
  const role = await db.role.findUniqueOrThrow({ where: { key: "customer" } });
  const { firstName, lastName } = splitFullName(d.fullName);
  const passwordHash = await hashPassword(d.password);
  let userId: string, applicationId: string;
  try {
    ({ userId, applicationId } = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: d.email, passwordHash, firstName, lastName, displayName: d.fullName, roles: { create: { roleId: role.id } } } });
      const a = await tx.wholesaleApplication.create({ data: { ...appData(d, d.fullName, d.email), userId: u.id, status: "PENDING" } });
      return { userId: u.id, applicationId: a.id };
    }));
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("این ایمیل قبلاً ثبت شده است. لطفاً وارد حساب خود شوید.", "email_taken");
    throw e;
  }
  await createSession(userId);
  await mergeGuestCart(userId);
  return { id: applicationId, createdAccount: true };
}
