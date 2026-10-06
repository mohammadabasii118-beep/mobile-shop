import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { cookieSecure } from "@/lib/server/env";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import type { PriceType } from "@/lib/server/pricing";
import { priceLines } from "@/lib/server/price-engine/line";
import { loadActiveDiscounts, userDiscountUses } from "@/lib/server/price-engine/discounts";
import { getWholesalePolicy } from "@/lib/server/price-engine/wholesale";
import { evaluateCoupon } from "@/lib/server/coupons";
import type { SessionUser } from "@/lib/server/auth/session";

export const GUEST_COOKIE = "cl_guest";
const MAX_LINE_QTY = 99;

const cartInclude = {
  items: {
    orderBy: { id: "asc" as const },
    include: {
      variant: {
        include: {
          inventory: true, image: { select: { url: true } }, colorRef: { select: { name: true } }, phoneModel: { select: { name: true, brandId: true } },
          product: { include: { extraCategories: { select: { categoryId: true, category: { select: { parentId: true } } } }, extraBrands: { select: { brandId: true } }, category: { select: { parentId: true } }, images: { where: { type: "IMAGE" as const }, orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }], take: 1 }, brand: { select: { name: true } } } },
        },
      },
    },
  },
};

export interface CartLine {
  id: string;
  slug: string;
  productId: string;
  variantId: string;
  name: string;
  image: string | null;
  hue: number;
  option: string | null;
  phoneModelId: string | null;
  unitPrice: number;
  listPrice: number;
  priceType: PriceType;
  quantity: number;
  lineTotal: number;
  stock: number;
  available: boolean;
  minWholesaleQty: number | null;
  /** Price transparency (Phase 6): what one unit cost before discounts, and the discount taken. */
  originalPrice: number;
  discountAmount: number;
  discountLabel: string | null;
}

export interface CartView {
  lines: CartLine[];
  count: number;
  subtotal: number;
  retailSubtotal: number;
  wholesaleSubtotal: number;
  couponCode: string | null;
  discount: number;
  couponError: string | null;
  issues: string[];
  isWholesale: boolean;
}

async function guestKey(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{20,64}$/.test(existing)) return existing;
  if (!create) return null;
  const key = randomBytes(24).toString("base64url");
  jar.set(GUEST_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: 60 * 60 * 24 * 30 });
  return key;
}

/** Moves a guest cart into the user's cart (quantities add up, capped by stock) and clears the guest cookie. */
export async function mergeGuestCart(userId: string) {
  const key = await guestKey(false);
  if (!key) return;
  const guest = await db.cart.findUnique({ where: { guestKey: key }, include: { items: true } });
  if (guest && guest.items.length) {
    const target = (await db.cart.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } })) ?? (await db.cart.create({ data: { userId } }));
    for (const it of guest.items) {
      const existing = await db.cartItem.findFirst({ where: { cartId: target.id, variantId: it.variantId, phoneModelId: it.phoneModelId } });
      const inv = await db.inventory.findUnique({ where: { variantId: it.variantId } });
      const cap = Math.min(MAX_LINE_QTY, inv?.quantity ?? 0);
      const qty = Math.min((existing?.quantity ?? 0) + it.quantity, cap);
      if (qty <= 0) continue;
      if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: qty } });
      else await db.cartItem.create({ data: { cartId: target.id, variantId: it.variantId, phoneModelId: it.phoneModelId, quantity: qty } });
    }
  }
  if (guest) await db.cart.delete({ where: { id: guest.id } });
  // Server Components cannot write cookies; the route handlers that run at login clear it.
  try { (await cookies()).set(GUEST_COOKIE, "", { path: "/", maxAge: 0 }); } catch {}
}

/** The cart for this request: the user's cart when signed in, otherwise the guest cart. */
async function findCart(user: SessionUser | null, create: boolean) {
  if (user) {
    await mergeGuestCart(user.id);
    return (await db.cart.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })) ?? (create ? await db.cart.create({ data: { userId: user.id } }) : null);
  }
  const key = await guestKey(create);
  if (!key) return null;
  return (await db.cart.findUnique({ where: { guestKey: key } })) ?? (create ? await db.cart.create({ data: { guestKey: key } }) : null);
}

/** Human label of a cart/order line's option: "iPhone 12 · سفید یخی" for modelled variants, else the legacy phone-model / variant name. */
export function variantOption(v: { name: string; phoneModel?: { name: string } | null; colorRef?: { name: string } | null }, legacyModelName?: string | null): string | null {
  const parts = [v.phoneModel?.name ?? legacyModelName ?? null, v.colorRef?.name ?? null].filter((x): x is string => !!x);
  if (parts.length) return parts.join(" · ");
  return v.name !== "استاندارد" && v.name !== "پیش‌فرض" ? v.name : null;
}

export const emptyCart = (): CartView => ({ lines: [], count: 0, subtotal: 0, retailSubtotal: 0, wholesaleSubtotal: 0, couponCode: null, discount: 0, couponError: null, issues: [], isWholesale: false });

/** Builds the priced cart view. Every number here is computed on the server from current DB prices. */
export async function getCartView(user: SessionUser | null): Promise<CartView> {
  const cart = await findCart(user, false);
  if (!cart) return emptyCart();
  const full = await db.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
  const discounts = await loadActiveDiscounts();
  const userUses = user ? await userDiscountUses(db, user.id, discounts.map((d) => d.id)) : undefined;
  const priced = priceLines(full.items.map((i) => ({ qty: i.quantity, product: i.variant.product, variant: i.variant })), user, discounts, userUses, await getWholesalePolicy());
  const pmIds = full.items.map((i) => i.phoneModelId).filter((x): x is string => !!x);
  const pms = pmIds.length ? await db.phoneModel.findMany({ where: { id: { in: pmIds } }, select: { id: true, name: true } }) : [];
  const issues: string[] = [];
  const lines: CartLine[] = full.items.map((i, k) => {
    const p = i.variant.product;
    const stock = i.variant.inventory?.quantity ?? 0;
    const price = priced[k]!;
    const pm = pms.find((m) => m.id === i.phoneModelId);
    const option = variantOption(i.variant, pm?.name);
    const available = p.isActive && i.variant.isActive && stock >= i.quantity;
    if (!available) issues.push(`موجودی «${p.name}» کافی نیست (موجودی: ${stock}).`);
    return {
      id: i.id, slug: p.slug, productId: p.id, variantId: i.variantId, name: p.name, image: i.variant.image?.url ?? p.images[0]?.url ?? null, hue: p.visualHue ?? 210,
      option, phoneModelId: i.phoneModelId, unitPrice: price.unitPrice, listPrice: price.listPrice, priceType: price.priceType, quantity: i.quantity,
      lineTotal: price.unitPrice * i.quantity, stock, available, minWholesaleQty: user?.wholesale && p.wholesalePrice != null ? p.minWholesaleQty : null,
      originalPrice: price.originalPrice, discountAmount: price.discountAmount, discountLabel: price.discountLabel,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const retailSubtotal = lines.filter((l) => l.priceType === "retail").reduce((a, l) => a + l.lineTotal, 0);
  const wholesaleSubtotal = subtotal - retailSubtotal;
  let discount = 0;
  let couponError: string | null = null;
  if (cart.couponCode && user) {
    try { discount = (await evaluateCoupon(db, cart.couponCode, { userId: user.id, retailSubtotal })).discount; }
    catch (e) { couponError = e instanceof Error ? e.message : "کد تخفیف معتبر نیست."; }
  }
  return { lines, count: lines.reduce((a, l) => a + l.quantity, 0), subtotal, retailSubtotal, wholesaleSubtotal, couponCode: cart.couponCode, discount, couponError, issues, isWholesale: wholesaleSubtotal > 0 };
}

export async function addToCart(user: SessionUser | null, input: { productSlug: string; variantId?: string; phoneModelId?: string | null; quantity: number }) {
  const product = await db.product.findFirst({ where: { slug: input.productSlug, isActive: true }, include: { variants: { where: { isActive: true }, include: { inventory: true }, orderBy: { sortOrder: "asc" } }, phoneModels: true } });
  if (!product) throw notFound("محصول پیدا نشد.");
  const variant = input.variantId ? product.variants.find((v) => v.id === input.variantId) : product.variants[0];
  if (!variant) throw badRequest("گزینه انتخابی معتبر نیست.");
  let phoneModelId: string | null = null;
  if (variant.phoneModelId) {
    // The variant already IS a specific phone model; the legacy per-product compatibility pick does not apply.
    if (input.phoneModelId && input.phoneModelId !== variant.phoneModelId) throw badRequest("مدل گوشی با گزینهٔ انتخابی هم‌خوانی ندارد.");
  } else if (input.phoneModelId) {
    if (!product.phoneModels.some((m) => m.phoneModelId === input.phoneModelId)) throw badRequest("این محصول با مدل گوشی انتخاب‌شده سازگار نیست.");
    phoneModelId = input.phoneModelId;
  } else if (product.phoneModels.length > 0 && !product.variants.some((v) => v.phoneModelId)) {
    throw badRequest("ابتدا مدل گوشی خود را انتخاب کنید.", "phone_model_required");
  }
  if (!input.variantId && product.variants.some((v) => v.phoneModelId || v.colorId)) throw badRequest("ابتدا مدل و رنگ را انتخاب کنید.", "variant_required");
  const stock = variant.inventory?.quantity ?? 0;
  const cart = (await findCart(user, true))!;
  const existing = await db.cartItem.findFirst({ where: { cartId: cart.id, variantId: variant.id, phoneModelId } });
  const wanted = Math.min(MAX_LINE_QTY, (existing?.quantity ?? 0) + input.quantity);
  if (wanted > stock) throw conflict(stock > 0 ? `فقط ${stock} عدد از این محصول موجود است.` : "این محصول ناموجود است.", "out_of_stock", { available: stock });
  if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: wanted } });
  else await db.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, phoneModelId, quantity: wanted } });
  return getCartView(user);
}

async function ownedItem(user: SessionUser | null, itemId: string) {
  const cart = await findCart(user, false);
  if (!cart) throw notFound();
  const item = await db.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, include: { variant: { include: { inventory: true } } } });
  if (!item) throw notFound("این مورد در سبد خرید شما نیست.");
  return item;
}

export async function setCartQuantity(user: SessionUser | null, itemId: string, quantity: number) {
  const item = await ownedItem(user, itemId);
  if (quantity <= 0) await db.cartItem.delete({ where: { id: item.id } });
  else {
    const stock = item.variant.inventory?.quantity ?? 0;
    if (quantity > stock) throw conflict(stock > 0 ? `فقط ${stock} عدد از این محصول موجود است.` : "این محصول ناموجود است.", "out_of_stock", { available: stock });
    await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  }
  return getCartView(user);
}

export async function removeCartItem(user: SessionUser | null, itemId: string) {
  return setCartQuantity(user, itemId, 0);
}

export async function applyCoupon(user: SessionUser, code: string) {
  const view = await getCartView(user);
  const res = await evaluateCoupon(db, code, { userId: user.id, retailSubtotal: view.retailSubtotal });
  const cart = (await findCart(user, true))!;
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: res.code } });
  return getCartView(user);
}

export async function removeCoupon(user: SessionUser) {
  const cart = await findCart(user, false);
  if (cart) await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  return getCartView(user);
}

export const userCartId = async (user: SessionUser) => (await findCart(user, false))?.id ?? null;
