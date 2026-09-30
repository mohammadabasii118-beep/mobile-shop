/* Roles & permissions: the single source of truth, shared by the demo seed and scripts/bootstrap-production.ts. */
import type { PrismaClient } from "../lib/generated/prisma/client";

export const PERMISSIONS: [string, string][] = [
  ["dashboard.view", "مشاهده داشبورد"], ["product.read", "مشاهده محصولات"], ["product.write", "ویرایش محصولات"], ["product.delete", "حذف محصولات"],
  ["category.write", "مدیریت دسته‌بندی"], ["brand.write", "مدیریت برند"], ["phone.write", "مدیریت مدل گوشی"], ["inventory.write", "مدیریت موجودی"],
  ["order.read", "مشاهده سفارش‌ها"], ["order.write", "مدیریت سفارش‌ها"], ["payment.review", "بررسی پرداخت‌ها"], ["customer.read", "مشاهده مشتریان"],
  ["customer.write", "مدیریت مشتریان"], ["wholesale.review", "بررسی درخواست عمده"], ["coupon.write", "مدیریت کوپن"], ["review.moderate", "مدیریت نظرات"],
  ["banner.write", "مدیریت بنر"], ["homepage.write", "مدیریت صفحه اصلی"], ["menu.write", "مدیریت منو"], ["blog.write", "مدیریت وبلاگ"],
  ["support.reply", "پاسخ به پشتیبانی"], ["wallet.adjust", "مدیریت کیف پول"], ["loyalty.adjust", "مدیریت امتیاز"], ["shipping.write", "مدیریت ارسال"],
  ["refund.manage", "ثبت درخواست بازگشت وجه"], ["refund.approve", "تأیید و تکمیل بازگشت وجه بانکی"], ["wallet.read", "مشاهده کیف پول"], ["loyalty.read", "مشاهده امتیاز وفاداری"], ["support.read", "مشاهده پشتیبانی"],
  ["seo.write", "مدیریت سئو"], ["settings.write", "تنظیمات سایت"], ["audit.read", "مشاهده لاگ‌ها"], ["role.manage", "مدیریت نقش‌ها"],
];
export const ROLES: { key: string; name: string; staff: boolean; perms: string[] | "all" | "all-but-roles" }[] = [
  { key: "super_admin", name: "مدیر ارشد", staff: true, perms: "all" },
  { key: "admin", name: "مدیر", staff: true, perms: "all-but-roles" },
  { key: "product_manager", name: "مدیر محصول", staff: true, perms: ["dashboard.view", "product.read", "product.write", "product.delete", "category.write", "brand.write", "phone.write", "inventory.write"] },
  { key: "order_manager", name: "مدیر سفارش", staff: true, perms: ["dashboard.view", "order.read", "order.write", "payment.review", "refund.manage", "shipping.write", "customer.read"] },
  { key: "content_manager", name: "مدیر محتوا", staff: true, perms: ["dashboard.view", "blog.write", "banner.write", "homepage.write", "menu.write", "seo.write"] },
  { key: "support", name: "پشتیبان", staff: true, perms: ["dashboard.view", "support.reply", "support.read", "customer.read", "review.moderate", "order.read"] },
  { key: "wholesale_manager", name: "مدیر همکاران عمده", staff: true, perms: ["dashboard.view", "wholesale.review", "customer.read", "order.read"] },
  { key: "customer", name: "مشتری", staff: false, perms: [] },
  { key: "wholesale_partner", name: "همکار عمده", staff: false, perms: [] },
];

/** Idempotent: creates/updates permissions and roles and resets each role's permission set to the definition above. */
export async function syncRbac(db: PrismaClient) {
  for (const [key, label] of PERMISSIONS) await db.permission.upsert({ where: { key }, update: { label }, create: { key, label } });
  const perms = await db.permission.findMany();
  for (const r of ROLES) {
    const role = await db.role.upsert({ where: { key: r.key }, update: { name: r.name, isStaff: r.staff }, create: { key: r.key, name: r.name, isStaff: r.staff } });
    const keys = r.perms === "all" ? perms.map((p) => p.key) : r.perms === "all-but-roles" ? perms.filter((p) => p.key !== "role.manage").map((p) => p.key) : r.perms;
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.filter((p) => keys.includes(p.key)).map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
}
