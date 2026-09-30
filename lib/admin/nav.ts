import { MessageCircle, Ticket, Award, BadgePercent, Calculator, Palette, Undo2, BarChart3, BookOpen, Boxes, CreditCard, Crown, FileText, Home, Image as ImageIcon, LayoutGrid, ListTree, Megaphone, Package, Percent, Receipt, ScrollText, Search, Settings, ShoppingCart, Smartphone, Star, Store, Tag, Truck, Users, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; perms: string[]; group?: string }

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: BarChart3, perms: ["dashboard.view"] },
  { href: "/admin/orders", label: "سفارش‌ها", icon: ShoppingCart, perms: ["order.read"] },
  { href: "/admin/payments", label: "بررسی پرداخت‌ها", icon: CreditCard, perms: ["payment.review"] },
  { href: "/admin/refunds", label: "بازگشت وجه", icon: Undo2, perms: ["refund.manage", "refund.approve"] },
  { href: "/admin/products", label: "محصولات", icon: Package, perms: ["product.read"] },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: ListTree, perms: ["category.write"] },
  { href: "/admin/brands", label: "برندها", icon: Tag, perms: ["brand.write"] },
  { href: "/admin/phone-models", label: "مدل‌های گوشی", icon: Smartphone, perms: ["phone.write"] },
  { href: "/admin/phone-series", label: "سری‌های گوشی", icon: Smartphone, perms: ["phone.write"] },
  { href: "/admin/colors", label: "رنگ‌ها", icon: Palette, perms: ["product.write"] },
  { href: "/admin/attributes", label: "Attributeها", icon: ListTree, perms: ["product.write"] },
  { href: "/admin/inventory", label: "موجودی انبار", icon: Boxes, perms: ["inventory.write"] },
  { href: "/admin/pricing", label: "قیمت‌گذاری", icon: Calculator, perms: ["pricing.read", "pricing.write"] },
  { href: "/admin/discounts", label: "تخفیف‌ها", icon: BadgePercent, perms: ["discount.write"] },
  { href: "/admin/customers", label: "مشتریان", icon: Users, perms: ["customer.read"] },
  { href: "/admin/wholesale", label: "همکاران عمده", icon: Store, perms: ["wholesale.review"] },
  { href: "/admin/coupons", label: "کوپن‌ها", icon: Percent, perms: ["coupon.write"] },
  { href: "/admin/shipping", label: "روش‌های ارسال", icon: Truck, perms: ["shipping.write"] },
  { href: "/admin/banners", label: "بنرها", icon: ImageIcon, perms: ["banner.write"] },
  { href: "/admin/homepage", label: "صفحه اصلی", icon: Home, perms: ["homepage.write"] },
  { href: "/admin/menus", label: "منوها", icon: LayoutGrid, perms: ["menu.write"] },
  { href: "/admin/blog", label: "وبلاگ", icon: BookOpen, perms: ["blog.write"] },
  { href: "/admin/reviews", label: "نظرات", icon: Star, perms: ["review.moderate"] },
  { href: "/admin/support/chat", label: "چت آنلاین", icon: MessageCircle, perms: ["chat.read", "chat.reply"], group: "پشتیبانی" },
  { href: "/admin/support/tickets", label: "تیکت‌ها", icon: Ticket, perms: ["support.read", "support.reply"], group: "پشتیبانی" },
  { href: "/admin/wallet", label: "کیف پول", icon: Wallet, perms: ["wallet.read"] },
  { href: "/admin/loyalty", label: "باشگاه مشتریان", icon: Award, perms: ["loyalty.read"] },
  { href: "/admin/seo", label: "سئو", icon: Search, perms: ["seo.write"] },
  { href: "/admin/settings", label: "تنظیمات", icon: Settings, perms: ["settings.write"] },
  { href: "/admin/audit", label: "لاگ عملیات", icon: ScrollText, perms: ["audit.read"] },
];
export const ICON_FALLBACK = { Receipt, Crown, Megaphone, FileText };

export const canSee = (perms: string[], item: NavItem) => item.perms.some((p) => perms.includes(p));
export const BREADCRUMB: Record<string, string> = { ...Object.fromEntries(ADMIN_NAV.map((n) => [n.href, n.label])), "/admin/support": "پشتیبانی" };
