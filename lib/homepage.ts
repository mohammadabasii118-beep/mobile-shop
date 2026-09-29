import { db } from "@/lib/db";

export async function getActiveCategories() {
  return db.category.findMany({ where: { parentId: null, isActive: true }, orderBy: { order: "asc" } });
}

export async function getHomepageSections() {
  return db.homepageSection.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
}

export async function getActiveBanner() {
  return db.banner.findFirst({ where: { isActive: true }, orderBy: { order: "asc" } });
}

export async function getProductsFor(flag: "isBestSeller" | "isNew" | "isTrending") {
  return db.product.findMany({ where: { isActive: true, [flag]: true } as any, take: 10, orderBy: { createdAt: "desc" } });
}

export async function getDiscountedProducts() {
  return db.product.findMany({ where: { isActive: true, oldPrice: { not: null } }, take: 10, orderBy: { createdAt: "desc" } });
}
