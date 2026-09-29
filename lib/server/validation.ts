import { z } from "zod";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";
export function toLatinDigits(s: string) {
  return s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}
export function normalizePhone(raw: string): string {
  let s = toLatinDigits(raw).replace(/[\s\-()]/g, "");
  if (s.startsWith("+98")) s = "0" + s.slice(3);
  else if (s.startsWith("0098")) s = "0" + s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = "0" + s.slice(2);
  else if (s.startsWith("9") && s.length === 10) s = "0" + s;
  return s;
}

export const phoneSchema = z.string().transform(normalizePhone).refine((v) => /^09\d{9}$/.test(v), "شماره موبایل را به‌صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");
export const otpSchema = z.string().transform((v) => toLatinDigits(v).trim()).refine((v) => /^\d{4}$/.test(v), "کد تایید ۴ رقمی است.");
export const passwordSchema = z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.").max(72, "رمز عبور بیش از حد طولانی است.").refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /\d/.test(v), "رمز عبور باید شامل حرف و عدد باشد.");
const name = z.string().trim().min(2, "حداقل ۲ کاراکتر وارد کنید.").max(60, "متن بیش از حد طولانی است.");

export const otpRequestSchema = z.object({ phone: phoneSchema, purpose: z.enum(["login", "reset"]).default("login") });
export const otpVerifySchema = z.object({ phone: phoneSchema, code: otpSchema, purpose: z.enum(["login", "reset"]).default("login") });
export const passwordLoginSchema = z.object({ phone: phoneSchema, password: z.string().min(1, "رمز عبور را وارد کنید.").max(72) });
export const resetSchema = z.object({ ticket: z.string().min(10), password: passwordSchema });
export const profileSchema = z.object({
  firstName: name, lastName: name,
  displayName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email("ایمیل نامعتبر است.").max(120).optional().or(z.literal("").transform(() => undefined)),
});
export const changePasswordSchema = z.object({ oldPassword: z.string().max(72).optional(), newPassword: passwordSchema });

export const cartAddSchema = z.object({
  productSlug: z.string().min(1).max(200),
  variantId: z.string().min(1).max(40).optional(),
  phoneModelId: z.string().min(1).max(40).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});
export const cartUpdateSchema = z.object({ quantity: z.coerce.number().int().min(0).max(99) });
export const couponSchema = z.object({ code: z.string().trim().min(1).max(40) });

export const addressSchema = z.object({
  title: z.string().trim().max(40).optional(),
  receiver: name,
  phone: phoneSchema,
  province: z.string().trim().min(2).max(40),
  city: z.string().trim().min(2).max(40),
  postalCode: z.string().transform(toLatinDigits).refine((v) => v === "" || /^\d{10}$/.test(v), "کد پستی ۱۰ رقمی است.").optional(),
  address: z.string().trim().min(8, "آدرس را کامل وارد کنید.").max(400),
  isDefault: z.boolean().optional(),
});

export const quoteQuerySchema = z.object({ shippingMethodId: z.string().max(40).optional(), couponCode: z.string().trim().max(40).optional() });
export const createOrderSchema = z.object({
  addressId: z.string().min(1).max(40),
  shippingMethodId: z.string().min(1).max(40),
  couponCode: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.string().min(1).max(40).default("card_to_card"),
  note: z.string().trim().max(300).optional(),
});
export const referenceSchema = z.string().transform(toLatinDigits).transform((v) => v.trim()).refine((v) => /^[A-Za-z0-9\-_/.]{4,40}$/.test(v), "شماره پیگیری را درست وارد کنید (۴ تا ۴۰ حرف یا عدد).");
export const rejectSchema = z.object({ reason: z.string().trim().min(3, "دلیل رد را بنویسید.").max(300) });
