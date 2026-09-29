import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/server/errors";
import { audit, diff, type AdminCtx } from "@/lib/server/admin/core";
import { loyaltySchema } from "@/lib/server/admin/loyalty-rules";

const t = (max: number) => z.string().trim().max(max).default("");
const url = z.string().trim().max(300).refine((v) => v === "" || /^(https?:\/\/|\/(?!\/)|#)/.test(v), "آدرس نامعتبر است.").default("");
const img = z.string().trim().max(300).refine((v) => v === "" || /^(https:\/\/|\/(?!\/))/.test(v), "آدرس تصویر نامعتبر است.").default("");

export const SETTING_SCHEMAS = {
  site: z.object({ name: t(60).pipe(z.string().min(1, "نام سایت لازم است.")), tagline: t(120), logo: img, favicon: img, phone: t(40), email: z.string().trim().max(120).refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "ایمیل نامعتبر است.").default(""), address: t(300), hours: t(120), telegram: url, instagram: url, whatsapp: url, aparat: url, youtube: url, topBar: t(200), footerText: t(600) }),
  payment: z.object({
    bankName: t(60), accountHolder: t(80),
    cardNumber: z.string().trim().max(30).refine((v) => v === "" || /^[\d\-\s۰-۹]{16,25}$/.test(v), "شماره کارت ۱۶ رقمی وارد کنید.").default(""),
    accountNumber: t(40), iban: z.string().trim().toUpperCase().max(34).refine((v) => v === "" || /^IR[0-9A-Z]{22,26}$/.test(v), "شماره شبا با IR شروع می‌شود.").default(""), description: t(400),
  }),
  shipping: z.object({ freeThreshold: z.coerce.number().int().min(0).max(2_000_000_000).default(0) }),
  loyalty: loyaltySchema,
  general: z.object({ currency: t(20), lowStockNotify: z.boolean().default(true) }),
} as const;
export type SettingKey = keyof typeof SETTING_SCHEMAS;
export const SETTING_PERM = "settings.write";

export async function getAllSettings() {
  const rows = await db.siteSetting.findMany();
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(SETTING_SCHEMAS) as SettingKey[]) out[k] = SETTING_SCHEMAS[k].parse(rows.find((r) => r.key === k)?.value ?? {});
  return out;
}

export async function updateSetting(key: string, body: unknown, a: AdminCtx) {
  const schema = SETTING_SCHEMAS[key as SettingKey];
  if (!schema) throw notFound("تنظیم پیدا نشد.");
  const value = schema.parse(body) as Record<string, unknown>;
  return db.$transaction(async (tx) => {
    const cur = (await tx.siteSetting.findUnique({ where: { key } }))?.value as Record<string, unknown> | undefined;
    const d = diff(cur ?? {}, value);
    // Preserve unknown keys that older code may have stored.
    await tx.siteSetting.upsert({ where: { key }, update: { value: { ...(cur ?? {}), ...value } as object }, create: { key, value: value as object } });
    if (d.changed) await audit(a, "settings.update", "setting", key, d.old, d.next, tx);
    return value;
  });
}
