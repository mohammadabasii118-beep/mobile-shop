/** Playwright: add customer / add admin in the admin UI, the animated admin shell (and its on/off switch), dashboard count-up. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, admin: Client, ctx: any, pg: any;
const tag = uid();
const shot = async (name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png") }); } };

describe("Phase 16 — admin UI: add users/admins and motion", () => {
  before(async () => {
    await db.rateLimit.deleteMany({}); await db.user.deleteMany({ where: { email: { startsWith: "b16-" } } });
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    admin = await loginWithPassword("09120000001", "Admin@12345");
    ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, locale: "fa-IR" });
    await ctx.addCookies([...admin.jar].map(([name, value]) => ({ name, value, url: BASE })));
    pg = await ctx.newPage();
  });
  after(async () => { await db.user.deleteMany({ where: { email: { startsWith: "b16-" } } }); await browser?.close(); await db.$disconnect(); });

  it("shell motion: page-enter + animated elements are on by default; the switch turns them off and the choice is remembered", async () => {
    await pg.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    assert.equal(await pg.locator("[data-admin-fx]").first().getAttribute("data-admin-fx"), "on");
    assert.equal(await pg.locator(".fx-page").count(), 1);
    const anim = await pg.locator(".fx-page").evaluate((e: HTMLElement) => getComputedStyle(e).animationName);
    assert.match(anim, /fx-page-in/);
    assert.ok(await pg.locator(".fx-bar").count() > 0, "chart bars grow");
    await shot("p16-1-dashboard");
    await pg.getByTestId("fx-toggle").click();
    assert.equal(await pg.locator("[data-admin-fx]").first().getAttribute("data-admin-fx"), "off");
    assert.equal(await pg.locator(".fx-page").evaluate((e: HTMLElement) => getComputedStyle(e).animationName), "none", "no animation when off");
    await pg.reload({ waitUntil: "networkidle" });
    assert.equal(await pg.locator("[data-admin-fx]").first().getAttribute("data-admin-fx"), "off", "remembered");
    await pg.getByTestId("fx-toggle").click(); assert.equal(await pg.locator("[data-admin-fx]").first().getAttribute("data-admin-fx"), "on");
  });

  it("dashboard numbers end at the real values (count-up never changes the data)", async () => {
    await pg.goto(`${BASE}/admin`, { waitUntil: "networkidle" }); await pg.waitForTimeout(1600);
    const server = (await admin.get("/api/admin/dashboard")).json.data.totalOrders;
    const first = await pg.getByText("کل سفارش‌ها", { exact: true }).locator("xpath=following-sibling::div[1]").innerText();
    assert.equal(first.replace(/[^۰-۹0-9]/g, "").replace(/[۰-۹]/g, (d: string) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))), String(server));
  });

  it("add customer: opens the form, validates, creates, the list refreshes", async () => {
    await pg.goto(`${BASE}/admin/customers`, { waitUntil: "networkidle" });
    await pg.getByTestId("add-user").click(); const f = pg.getByTestId("add-user-form"); await f.waitFor();
    await f.getByRole("button", { name: "ساخت کاربر" }).click();
    assert.ok(await pg.getByText(/ایمیل یا موبایل|نام و نام خانوادگی/).first().isVisible(), "server-side validation messages appear");
    await f.getByLabel("نام و نام خانوادگی *").fill("کاربر مرورگر " + tag); await f.getByLabel("ایمیل", { exact: true }).fill(`b16-${tag}@example.com`);
    await shot("p16-2-add-user");
    await f.getByRole("button", { name: "ساخت کاربر" }).click(); await pg.getByText("کاربر ساخته شد.").waitFor();
    await pg.getByPlaceholder("نام، موبایل یا ایمیل…").fill(`b16-${tag}`);
    await pg.getByText(`b16-${tag}@example.com`).first().waitFor();
    assert.equal((await db.user.findUniqueOrThrow({ where: { email: `b16-${tag}@example.com` }, include: { roles: { include: { role: true } } } })).roles[0]!.role.key, "customer");
  });

  it("add admin: role cards show the permissions, the creator's password is required, the new admin is locked until the password is changed", async () => {
    await pg.goto(`${BASE}/admin/customers`, { waitUntil: "networkidle" });
    await pg.getByTestId("add-admin").click(); const f = pg.getByTestId("add-admin-form"); await f.waitFor();
    await f.getByLabel("نام و نام خانوادگی *").fill("مدیر مرورگر " + tag); await f.getByLabel("ایمیل *").fill(`b16-adm-${tag}@example.com`);
    await f.getByTestId("role-support").check();
    assert.ok((await pg.getByTestId("role-perms").innerText()).includes("چت آنلاین"), "permission chips of the chosen role");
    await f.getByTestId("role-order_manager").check(); assert.ok((await pg.getByTestId("role-perms").innerText()).includes("سفارش"));
    await f.getByTestId("role-support").check();
    await shot("p16-3-add-admin");
    await f.getByTestId("create-submit").click(); await pg.getByText("رمز شما (تأیید) *").locator("xpath=..").getByText(/.+/).first().waitFor();
    assert.equal(await db.user.count({ where: { email: `b16-adm-${tag}@example.com` } }), 0, "nothing is created without the confirmation password");
    await f.getByTestId("confirm-pw").fill("Admin@12345"); await f.getByTestId("create-submit").click(); await pg.getByText("مدیر جدید ساخته شد.").waitFor();
    const u = await db.user.findUniqueOrThrow({ where: { email: `b16-adm-${tag}@example.com` }, include: { roles: { include: { role: true } } } });
    assert.equal(u.roles[0]!.role.key, "support"); assert.equal(u.mustChangePassword, true);
  });

  it("the customer list page keeps working on a phone", async () => {
    const c2 = await browser.newContext({ viewport: { width: 400, height: 800 } }); await c2.addCookies([...admin.jar].map(([name, value]) => ({ name, value, url: BASE })));
    const p2 = await c2.newPage(); await p2.goto(`${BASE}/admin/customers`, { waitUntil: "networkidle" });
    await p2.getByTestId("add-admin").click(); await p2.getByTestId("add-admin-form").waitFor();
    assert.equal(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); await c2.close();
  });
});
