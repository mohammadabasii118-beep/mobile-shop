import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
});

export const loginSchema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

export const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(5, "پیام خیلی کوتاه است"),
});

export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string(), variantId: z.string().optional(), quantity: z.number().int().min(1) })).min(1, "سبد خرید خالی است"),
  shippingName: z.string().min(2),
  shippingPhone: z.string().min(10),
  shippingAddress: z.string().min(5),
  shippingCity: z.string().min(2),
  shippingPostal: z.string().optional(),
  discountCode: z.string().optional(),
  paymentMethod: z.enum(["ZARINPAL", "CARD_TRANSFER", "WALLET"]).optional().default("ZARINPAL"),
  // Optional partial wallet contribution, usable alongside ZARINPAL/CARD_TRANSFER
  // (not alongside paymentMethod "WALLET", which already means "100% wallet").
  // The server re-clamps this to the real balance and the real order total —
  // never trusts this number as-is.
  useWalletAmount: z.coerce.number().int().min(0).optional().default(0),
  // Optional loyalty points to redeem as a discount — re-clamped server-side
  // to the user's real balance and a maximum share of the order (see
  // lib/loyalty.ts's redeemable-points logic in app/api/checkout/route.ts).
  redeemPoints: z.coerce.number().int().min(0).optional().default(0),
});

export const bankSettingsSchema = z.object({
  cardNumber: z.string().min(8, "شماره کارت معتبر نیست"),
  cardHolderName: z.string().min(2, "نام صاحب کارت را وارد کنید"),
  bankName: z.string().min(2, "نام بانک را وارد کنید"),
});

export const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی کوچک و خط تیره"),
  description: z.string().min(5),
  price: z.coerce.number().int().min(0),
  oldPrice: z.coerce.number().int().min(0).optional().or(z.literal("")),
  costPrice: z.coerce.number().int().min(0).optional().or(z.literal("")),
  // Price shown/charged only to approved wholesale partners — see
  // lib/wholesalePricing.ts. Optional: left blank, partners simply pay the
  // normal retail price for this product.
  wholesalePrice: z.coerce.number().int().min(0).optional().or(z.literal("")),
  stock: z.coerce.number().int().min(0),
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید"),
  brandId: z.string().optional(),
  phoneModelId: z.string().optional(),
  images: z.string().optional(), // newline separated URLs from the form
  // Free-form "key: value" lines from the admin form, one spec per line —
  // parsed into the Product.specs JSON column. Used by the real product
  // comparison table (/compare); left blank, a product simply has no rows
  // there beyond price/category/brand/stock.
  specsText: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  isBestSeller: z.coerce.boolean().optional(),
  isNew: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isTrending: z.coerce.boolean().optional(),
  hasVariants: z.coerce.boolean().optional(),
});

// Real shipment tracking entered by an admin. Both optional: a carrier
// name without a tracking number is still shown to the customer (e.g.
// "پست پیشتاز" while the number is being generated), but the pair is what
// lets the customer actually look the shipment up on the carrier's site.
export const trackingSchema = z.object({
  trackingCarrier: z.string().max(60).optional().or(z.literal("")),
  trackingNumber: z.string().max(60).optional().or(z.literal("")),
});

// A free-form marketing block for the homepage "page builder" (see
// lib/actions/homepage.ts). Everything but the title is optional — an
// admin can publish just a heading and body text with no image/button.
export const customBlockSchema = z.object({
  title: z.string().min(1, "عنوان را وارد کنید"),
  body: z.string().optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
  linkUrl: z.string().optional().or(z.literal("")),
  linkLabel: z.string().optional().or(z.literal("")),
});

export const pageSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی کوچک و خط تیره"),
  title: z.string().min(1, "عنوان را وارد کنید"),
  body: z.string().min(1, "متن صفحه را وارد کنید"),
  isPublished: z.coerce.boolean().optional(),
});

export const ticketSchema = z.object({
  subject: z.string().min(3, "موضوع را کامل‌تر بنویسید"),
  body: z.string().min(5, "پیام خیلی کوتاه است"),
});

export const ticketReplySchema = z.object({
  body: z.string().min(1, "پیام نمی‌تواند خالی باشد"),
});

export const brandSchema = z.object({
  name: z.string().min(1, "نام برند را وارد کنید"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی کوچک و خط تیره"),
});

export const phoneModelSchema = z.object({
  name: z.string().min(1, "نام مدل را وارد کنید"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی کوچک و خط تیره"),
  brandId: z.string().min(1, "برند را انتخاب کنید"),
});

export const colorSchema = z.object({
  name: z.string().min(1, "نام رنگ را وارد کنید"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی کوچک و خط تیره"),
  hexCode: z.string().optional().or(z.literal("")),
});

export const variantSchema = z.object({
  brandId: z.string().optional().or(z.literal("")),
  phoneModelId: z.string().optional().or(z.literal("")),
  colorId: z.string().optional().or(z.literal("")),
  sku: z.string().optional().or(z.literal("")),
  price: z.coerce.number().int().min(0),
  oldPrice: z.coerce.number().int().min(0).optional().or(z.literal("")),
  wholesalePrice: z.coerce.number().int().min(0).optional().or(z.literal("")),
  stock: z.coerce.number().int().min(0),
  imageUrl: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  parentId: z.string().optional(),
  imageUrl: z.string().optional(),
  order: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().optional(),
});

export const discountSchema = z.object({
  code: z.string().min(3).toUpperCase(),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().int().min(1),
  minOrderAmount: z.coerce.number().int().min(0).optional().or(z.literal("")),
  usageLimit: z.coerce.number().int().min(1).optional().or(z.literal("")),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional(),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "امتیاز را انتخاب کنید").max(5),
  comment: z.string().trim().min(5, "نظر باید حداقل ۵ حرف باشد").max(2000, "نظر خیلی طولانی است"),
});

export const partnerApplicationSchema = z.object({
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().min(8, "شماره تماس معتبر نیست"),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  message: z.string().trim().min(10, "توضیحات باید حداقل ۱۰ حرف باشد").max(3000),
});

export const pricingRuleSchema = z.object({
  minPrice: z.coerce.number().int().min(0),
  maxPrice: z.coerce.number().int().min(0),
  sellPrice: z.coerce.number().int().min(0),
  isActive: z.coerce.boolean().optional(),
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, "نام را کامل وارد کنید"),
  email: z.string().trim().email("ایمیل معتبر نیست"),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  permissions: z.array(z.string()).optional().default([]),
});

export const staffPermissionsSchema = z.object({
  permissions: z.array(z.string()).optional().default([]),
});

export const automationRuleSchema = z.object({
  name: z.string().trim().min(3, "نام قانون را کامل‌تر بنویسید"),
  trigger: z.enum(["ORDER_DELIVERED", "NEW_SUPPORT_TICKET", "NEW_CONTACT_MESSAGE", "LOW_STOCK"]),
  action: z.enum(["CREATE_ADMIN_ALERT", "GRANT_LOYALTY_BONUS"]),
  points: z.coerce.number().int().min(0).max(10000).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const twoFactorConfirmSchema = z.object({
  code: z.string().trim().min(6, "کد را کامل وارد کنید").max(6),
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

export const questionSchema = z.object({
  question: z.string().trim().min(5, "سوال باید حداقل ۵ حرف باشد").max(1000, "سوال خیلی طولانی است"),
});

export const questionAnswerSchema = z.object({
  answer: z.string().trim().min(2, "پاسخ خیلی کوتاه است").max(2000, "پاسخ خیلی طولانی است"),
});

export const siteSettingsSchema = z.object({
  siteTitle: z.string().trim().max(120).optional().or(z.literal("")),
  siteDescription: z.string().trim().max(300).optional().or(z.literal("")),
  metaKeywords: z.string().trim().max(500).optional().or(z.literal("")),
  instagramUrl: z.string().trim().url("آدرس معتبر نیست").max(300).optional().or(z.literal("")),
  telegramUrl: z.string().trim().url("آدرس معتبر نیست").max(300).optional().or(z.literal("")),
  whatsappUrl: z.string().trim().url("آدرس معتبر نیست").max(300).optional().or(z.literal("")),
  lowStockThreshold: z.coerce.number().int().min(0, "آستانه نمی‌تواند منفی باشد").max(1000),
});

export const wholesaleTierSchema = z.object({
  minQuantity: z.coerce.number().int().min(2, "حداقل تعداد باید ۲ یا بیشتر باشد"),
  discountPercent: z.coerce.number().int().min(1, "درصد تخفیف باید بین ۱ تا ۹۰ باشد").max(90),
  isActive: z.coerce.boolean().optional(),
});
