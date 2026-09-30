/** Playwright: the optional cooperation card after a normal sign-up, the permanent menu entry, the existing form, status display, dismiss. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, admin: Client;
const shot = async (pg: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png") }); } };
const signUp = async () => {
  const c = new Client(); const email = `b14-${uid()}@example.com`;
  const r = await c.post("/api/auth/register", { fullName: "کاربر جدید", email, password: "Str0ng!Pass-" + uid() }); assert.equal(r.status, 200, JSON.stringify(r.json));
  return { c, email, user: await db.user.findUniqueOrThrow({ where: { email } }) };
};
const ctxFor = async (c: Client, vp = { width: 1200, height: 900 }) => { const ctx = await browser.newContext({ viewport: vp, locale: "fa-IR" }); await ctx.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE }))); return ctx; };

describe("Phase 14 — cooperation card in the account", () => {
  before(async () => { await db.rateLimit.deleteMany({}); const { chromium } = await import(PW); browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }); admin = await loginWithPassword("09120000001", "Admin@12345"); });
  after(async () => { await browser?.close(); await db.$disconnect(); });

  it("new user: card is optional (dismiss is remembered), the menu entry stays; CTA opens the existing form; submit → status", async () => {
    const u = await signUp(); const ctx = await ctxFor(u.c); const pg = await ctx.newPage();
    await pg.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
    assert.match(pg.url(), /\/account\/orders$/, "no forced redirect after sign-up");
    const card = pg.getByTestId("partner-card"); await card.waitFor();
    assert.ok((await card.innerText()).includes("همکاری با CaseLine")); await shot(pg, "p14-1-card-desktop");
    await pg.getByTestId("partner-dismiss").click(); assert.equal(await card.count(), 0, "can be ignored");
    await pg.reload({ waitUntil: "networkidle" }); assert.equal(await pg.getByTestId("partner-card").count(), 0, "stays dismissed");
    const menu = pg.getByRole("navigation", { name: "پنل کاربری" }).getByRole("link", { name: "درخواست همکاری" });
    assert.ok(await menu.isVisible(), "permanent menu entry");
    await menu.click(); await pg.waitForURL(/\/account\/wholesale/);
    // the existing form (same fields as before)
    await pg.getByLabel("نام فروشگاه / برند").fill("فروشگاه مرورگر " + uid());
    await pg.getByLabel("شماره موبایل (برای تماس)").fill("09121234567");
    await pg.getByLabel("استان").fill("تهران"); await pg.getByLabel("شهر").fill("تهران");
    await shot(pg, "p14-2-form");
    await pg.getByRole("button", { name: "ثبت درخواست همکاری" }).click();
    await pg.getByText("در حال بررسی").first().waitFor();
    assert.equal(await db.wholesaleApplication.count({ where: { userId: u.user.id } }), 1);
    // a dismissed card comes back as a STATUS card once an application exists
    await pg.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
    const st = pg.getByTestId("partner-card"); await st.waitFor(); assert.equal(await st.getAttribute("data-status"), "PENDING");
    assert.equal(await pg.getByTestId("partner-dismiss").count(), 0);
    assert.ok((await st.innerText()).includes("در حال بررسی است"));
    await ctx.close();
  });

  it("mobile layout and rejected state with re-apply", async () => {
    const u = await signUp(); const ctx = await ctxFor(u.c, { width: 400, height: 860 }); const pg = await ctx.newPage();
    await pg.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
    await pg.getByTestId("partner-card").waitFor(); await shot(pg, "p14-3-card-mobile");
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "no horizontal scroll");
    const app = await db.wholesaleApplication.create({ data: { userId: u.user.id, name: "x", phone: "09121234567", storeName: "فروشگاه رد", businessType: "online_shop", city: "تهران", province: "تهران", address: "", status: "PENDING" } });
    ok(await admin.post(`/api/admin/wholesale/${app.id}/reject`, { note: "مدارک ناقص" }));
    await pg.reload({ waitUntil: "networkidle" });
    assert.equal(await pg.getByTestId("partner-card").getAttribute("data-status"), "REJECTED");
    await pg.getByTestId("partner-cta").click(); await pg.waitForURL(/\/account\/wholesale/);
    assert.ok(await pg.getByText("رد شده").first().isVisible()); assert.ok(await pg.getByText("مدارک ناقص").first().isVisible());
    assert.ok(await pg.getByLabel("نام فروشگاه / برند").isVisible(), "the existing form is available again");
    await ctx.close();
  });

  it("an approved partner sees the portal entry, not the invitation", async () => {
    const partner = await loginWithPassword("09120000003", "Partner@12345");
    const ctx = await ctxFor(partner); const pg = await ctx.newPage();
    await pg.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
    assert.equal(await pg.getByTestId("partner-card").count(), 0);
    assert.ok(await pg.getByRole("navigation", { name: "پنل کاربری" }).getByRole("link", { name: "همکاری عمده" }).isVisible());
    await ctx.close();
  });
});
function ok(r: { status: number; json: any }) { assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json?.data; }
