import {
  BarChart3, Boxes, CreditCard, FolderTree, Image as ImageIcon, LayoutDashboard, Package, Percent,
  Settings, ShoppingCart, Tag, Ticket, Users,
} from "lucide-react";

export const ADMIN_NAV = [
  { slug: "", label: "داشبورد", icon: LayoutDashboard },
  { slug: "products", label: "محصولات", icon: Package },
  { slug: "categories", label: "دسته‌بندی‌ها", icon: FolderTree },
  { slug: "orders", label: "سفارش‌ها", icon: ShoppingCart },
  { slug: "customers", label: "مشتریان", icon: Users },
  { slug: "inventory", label: "انبار", icon: Boxes },
  { slug: "discounts", label: "تخفیف‌ها", icon: Percent },
  { slug: "coupons", label: "کدهای تخفیف", icon: Ticket },
  { slug: "banners", label: "بنرها", icon: ImageIcon },
  { slug: "brands", label: "برندها", icon: Tag },
  { slug: "payments", label: "پرداخت‌ها", icon: CreditCard },
  { slug: "reports", label: "گزارش‌ها", icon: BarChart3 },
  { slug: "settings", label: "تنظیمات", icon: Settings },
];
