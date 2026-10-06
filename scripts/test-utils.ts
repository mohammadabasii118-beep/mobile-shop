import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { __hashOtpForTests } from "../lib/server/auth/otp";

export const BASE = process.env.BASE_URL ?? "http://localhost:3300";
export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let ipCounter = 10;
const nextIp = () => `10.8.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
export const rnd = () => String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
export const newPhone = () => `0918${rnd()}`;
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Minimal browser: keeps cookies, sends a unique client IP so rate limits are per test. */
export class Client {
  jar = new Map<string, string>();
  ip = nextIp();
  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...extra };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";"); const i = pair.indexOf("=");
      const name = pair.slice(0, i), val = pair.slice(i + 1);
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || val === "") this.jar.delete(name); else this.jar.set(name, val);
    }
    const text = await res.text();
    let json: any = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, headers: res.headers, text };
  }
  get = (p: string, h?: Record<string, string>) => this.req("GET", p, undefined, h);
  post = (p: string, b?: unknown, h?: Record<string, string>) => this.req("POST", p, b ?? {}, h);
  put = (p: string, b: unknown) => this.req("PUT", p, b);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  del = (p: string) => this.req("DELETE", p);
}

export async function plantOtp(phone: string, purpose: "login" | "reset", code = "4321") {
  await db.otpCode.updateMany({ where: { phone, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await db.otpCode.create({ data: { phone, purpose, codeHash: __hashOtpForTests(phone, purpose, code), expiresAt: new Date(Date.now() + 120_000) } });
  return code;
}
/** Creates a plain customer with a phone number directly (public sign-up is e-mail + password; phone-code login only serves existing accounts). */
export async function seedUser(phone = newPhone()) {
  const role = await db.role.findUniqueOrThrow({ where: { key: "customer" } });
  return db.user.create({ data: { phone, phoneVerifiedAt: new Date(), roles: { create: { roleId: role.id } } } });
}
export async function registerAndLogin(c = new Client()) {
  const phone = newPhone();
  await seedUser(phone);
  const r = await c.post("/api/auth/otp/verify", { phone, code: await plantOtp(phone, "login") });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return { c, phone, userId: (await db.user.findUniqueOrThrow({ where: { phone } })).id };
}
export async function loginWithPassword(phone: string, password: string) {
  const c = new Client();
  const r = await c.post("/api/auth/login", { phone, password });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return c;
}
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
export const fileForm = (buf: Buffer, name: string, type: string, field = "file", extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.set(field, new Blob([new Uint8Array(buf)], { type }), name);
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
};

/** A real order through the public flow (address → cart → checkout → receipt), returning its number. */
export async function placeOrder(withReceipt = false) {
  const { c, userId } = await registerAndLogin();
  const addr = await c.post("/api/addresses", { receiver: "تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰" });
  assert.equal(addr.status, 200, JSON.stringify(addr.json));
  const inv = await db.inventory.findFirstOrThrow({ where: { quantity: { gte: 10 }, variant: { product: { isActive: true, phoneModels: { none: {} } } } }, include: { variant: { include: { product: true } } } });
  const add = await c.post("/api/cart/items", { productSlug: inv.variant.product.slug, variantId: inv.variantId, quantity: 1 });
  assert.equal(add.status, 200, JSON.stringify(add.json));
  const ship = await db.shippingMethod.findFirstOrThrow({ where: { key: "post" } });
  const o = await c.post("/api/checkout/orders", { addressId: addr.json.data.id, shippingMethodId: ship.id, paymentMethod: "card_to_card" });
  assert.equal(o.status, 200, JSON.stringify(o.json));
  const number = o.json.data.number as number;
  if (withReceipt) {
    const f = fileForm(PNG, "receipt.png", "image/png", "receipt", { referenceNumber: "REF-" + uid() });
    const r = await c.post(`/api/orders/${number}/payment/proof`, f);
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  return { c, number, userId, variantId: inv.variantId, productId: inv.variant.productId };
}
