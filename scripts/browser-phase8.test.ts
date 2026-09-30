/**
 * Phase 8 browser tests (Playwright/Chromium): e-mail registration on the existing login card, duplicate e-mail, partner sign-up form,
 * admin approval in the panel. Same prerequisites as browser-phase7. SHOTS=/dir writes screenshots.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";
import { linkOf, startSmtp, stopSmtp, waitMail } from "./fake-smtp";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
const ok = (r: { status: number; json: any }) => { assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json?.data; };
let browser: any, admin: Client;
const shot = async (page: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }); } };

describe("Phase 8 — browser flows", () => {
  before(async () => {
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
    await startSmtp();
  });
  after(async () => { await browser?.close(); await stopSmtp(); await db.$disconnect(); });

  it("customer registers from the login card with name + e-mail + password (no code step), lands signed in; duplicate e-mail is explained", async () => {
    const ctx = await browser.newContext({ locale: "fa-IR", viewport: { width: 420, height: 800 } }); const page = await ctx.newPage();
    await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
    await shot(page, "01-login-card");
    await page.getByText("حساب ندارید؟ ثبت‌نام").click();
    const email = `b-${uid()}@example.com`;
    await page.getByLabel("نام و نام خانوادگی").fill("نیلوفر احمدی"); await page.getByLabel("ایمیل").fill(email); await page.getByLabel("رمز عبور").fill("Secret123x");
    await shot(page, "02-register-card");
    const done = page.waitForResponse((r: any) => r.url().endsWith("/api/auth/register"));
    await page.getByRole("button", { name: "ثبت‌نام", exact: true }).click();
    assert.equal((await done).status(), 200); await page.waitForTimeout(500);
    assert.ok(await db.user.findUnique({ where: { email } }));
    assert.equal((await ctx.request.get(`${BASE}/api/me`)).status(), 200);
    // duplicate from a fresh visitor
    const ctx2 = await browser.newContext({ locale: "fa-IR", viewport: { width: 420, height: 800 } }); const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/account`, { waitUntil: "networkidle" }); await p2.getByText("حساب ندارید؟ ثبت‌نام").click();
    await p2.getByLabel("نام و نام خانوادگی").fill("نیلوفر احمدی"); await p2.getByLabel("ایمیل").fill(email); await p2.getByLabel("رمز عبور").fill("Secret123x");
    await p2.getByRole("button", { name: "ثبت‌نام", exact: true }).click();
    await p2.getByText("این ایمیل قبلاً ثبت شده است").waitFor(); await shot(p2, "03-duplicate-email");
    await p2.getByRole("button", { name: "ورود به حساب" }).click();
    assert.equal(await p2.getByLabel("ایمیل یا شماره موبایل").inputValue(), email);
    await p2.getByLabel("رمز عبور").fill("Secret123x");
    const li = p2.waitForResponse((r: any) => r.url().endsWith("/api/auth/login")); await p2.getByRole("button", { name: "ورود", exact: true }).click();
    assert.equal((await li).status(), 200); await p2.waitForTimeout(500);
    assert.equal((await ctx2.request.get(`${BASE}/api/me`)).status(), 200);
    await ctx.close(); await ctx2.close();
  });

  it("partner registers on /partner/register (no OTP) → PENDING; admin approves it in the panel → partner access", async () => {
    const ctx = await browser.newContext({ locale: "fa-IR", viewport: { width: 480, height: 900 } }); const page = await ctx.newPage();
    await page.goto(`${BASE}/partner/register`, { waitUntil: "networkidle" });
    const email = `p-${uid()}@example.com`, store = "فروشگاه مرورگر " + uid();
    await page.getByLabel("نام و نام خانوادگی").fill("مریم کریمی"); await page.getByLabel("ایمیل").fill(email); await page.getByLabel("رمز عبور").fill("Secret123x");
    await page.getByLabel("نام فروشگاه / کسب‌وکار").fill(store); await page.getByLabel(/شماره موبایل/).fill("09121112233");
    await page.getByLabel("نوع کسب‌وکار").selectOption("physical_store");
    await page.getByLabel("استان").fill("تهران"); await page.getByLabel("شهر").fill("تهران"); await page.getByLabel("آدرس فروشگاه").fill("تهران، خیابان ولیعصر، پلاک ۱۰");
    await shot(page, "04-partner-register");
    await page.getByRole("button", { name: "ثبت درخواست همکاری" }).click();
    await page.waitForURL(/\/account\/wholesale/, { timeout: 10000 });
    await page.getByText("در حال بررسی").first().waitFor(); await shot(page, "05-partner-pending");
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } } } });
    assert.ok(!u.roles.some((r) => r.role.key === "wholesale_partner"));

    const actx = await browser.newContext({ locale: "fa-IR", viewport: { width: 1280, height: 900 } });
    await actx.addCookies([...admin.jar].map(([name, value]) => ({ name, value, url: BASE })));
    const ap = await actx.newPage(); await ap.goto(`${BASE}/admin/wholesale`, { waitUntil: "networkidle" });
    const card = ap.locator("div", { hasText: store }).filter({ has: ap.getByRole("button", { name: "تأیید", exact: true }) }).last();
    await card.waitFor(); assert.ok((await card.innerText()).includes(email)); await shot(ap, "06-admin-partner-requests");
    await card.getByRole("button", { name: "تأیید", exact: true }).click(); await ap.getByRole("button", { name: "ثبت", exact: true }).click(); await ap.waitForTimeout(1000);
    const u2 = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } } } });
    assert.ok(u2.roles.some((r) => r.role.key === "wholesale_partner"));
    await page.goto(`${BASE}/account/wholesale`, { waitUntil: "networkidle" }); await page.getByText("همکار عمده").first().waitFor(); await shot(page, "07-partner-approved");
    await ctx.close(); await actx.close();
  });

  it("forgot password from the login card → e-mail link → new password form (same card) → login with the new password", async () => {
    const email = `f-${uid()}@example.com`; const OLD = "Secret123x", NEW = "Fresh4567yz";
    ok(await new Client().post("/api/auth/register", { fullName: "رضا قاسمی", email, password: OLD }));
    const ctx = await browser.newContext({ locale: "fa-IR", viewport: { width: 420, height: 800 } }); const page = await ctx.newPage();
    await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
    await page.getByLabel("ایمیل یا شماره موبایل").fill(email);
    await page.getByRole("button", { name: "فراموشی رمز عبور" }).click();
    await page.getByText("اگر این ایمیل ثبت شده باشد").waitFor(); await shot(page, "08-forgot-sent");
    const m = await waitMail(email); assert.ok(m); const token = linkOf(m!); assert.ok(token);
    await page.goto(`${BASE}/account?reset=${token}`, { waitUntil: "networkidle" }); await shot(page, "09-reset-form");
    await page.getByLabel("رمز عبور جدید").fill(NEW); await page.getByLabel("تکرار رمز عبور").fill(NEW);
    const done = page.waitForResponse((r: any) => r.url().endsWith("/api/auth/reset")); await page.getByRole("button", { name: "تغییر رمز عبور" }).click();
    assert.equal((await done).status(), 200);
    await page.getByText("رمز عبور تغییر کرد").waitFor(); assert.equal(new URL(page.url()).search, "");
    await page.getByLabel("ایمیل یا شماره موبایل").fill(email); await page.getByLabel("رمز عبور", { exact: true }).fill(NEW);
    const li = page.waitForResponse((r: any) => r.url().endsWith("/api/auth/login")); await page.getByRole("button", { name: "ورود", exact: true }).click();
    assert.equal((await li).status(), 200);
    // the used link is dead
    const p2 = await ctx.newPage(); await p2.goto(`${BASE}/account?reset=${token}`, { waitUntil: "networkidle" });
    await p2.getByLabel("رمز عبور جدید").fill("Other1234abc"); await p2.getByLabel("تکرار رمز عبور").fill("Other1234abc"); await p2.getByRole("button", { name: "تغییر رمز عبور" }).click();
    await p2.getByText("لینک بازیابی نامعتبر است").waitFor();
    await ctx.close();
  });

  it("mobile bottom bar: the night item is a real toggle (tap → on/highlighted, tap again → off) and stays in sync with the menu switch", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fa-IR", colorScheme: "light" });
    const p = await ctx.newPage(); await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const tab = p.locator("nav.md\\:hidden [data-night]"); const dark = () => p.evaluate(() => document.documentElement.classList.contains("dark"));
    assert.equal(await tab.getAttribute("aria-pressed"), "false"); assert.equal(await dark(), false);
    await tab.tap(); await p.waitForTimeout(300);
    assert.equal(await tab.getAttribute("aria-pressed"), "true"); assert.equal(await dark(), true);
    assert.ok((await tab.evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor)) !== "rgba(0, 0, 0, 0)", "highlighted tile when on");
    await p.getByLabel("منو", { exact: true }).first().tap();
    assert.equal(await p.locator("[data-mobile-menu] [data-night]").getAttribute("aria-pressed"), "true");
    await p.locator("[data-mobile-menu] [data-night]").tap(); await p.waitForTimeout(300);
    assert.equal(await dark(), false);
    await ctx.close();
  });

  it("mobile menu rows come from the admin menu «موبایل» (defaults present; admin can add/rename/remove), divider sits under the categories, login shows «حساب کاربری» when signed in", async () => {
    const dflt = await db.menuItem.findMany({ where: { menu: "mobile" }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(dflt.slice(0, 4).map((m) => m.link), ["/account", "/shop", "/blog", "/support"]);
    const label = "تخفیف‌ها " + uid();
    const made = ok(await admin.post("/api/admin/r/menus", { menu: "mobile", label, link: "/shop?sale=1", sortOrder: 50 }));
    try {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fa-IR" });
      const p = await ctx.newPage(); await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await p.getByLabel("منو", { exact: true }).first().tap();
      const aside = p.locator("[data-mobile-menu] aside"); await aside.waitFor();
      const texts = await aside.locator("li").allInnerTexts();
      assert.ok(texts.some((t: string) => t.includes(label)), "admin-added row is shown");
      const iAccount = texts.findIndex((t: string) => t.includes("ورود / ثبت‌نام")), iLast = texts.findIndex((t: string) => t.includes("پشتیبانی"));
      assert.ok(iAccount >= 0 && iAccount < iLast, "login first, then the rest");
      assert.ok(await aside.locator("div.border-t").count() >= 1, "divider between categories and the rows");
      await ctx.close();
      // signed-in users see «حساب کاربری»
      const c = new Client(); ok(await c.post("/api/auth/register", { fullName: "کاربر منو", email: `m-${uid()}@example.com`, password: "Secret123x" }));
      const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fa-IR" });
      await ctx2.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE })));
      const p2 = await ctx2.newPage(); await p2.goto(`${BASE}/`, { waitUntil: "networkidle" }); await p2.getByLabel("منو", { exact: true }).first().tap();
      const t2 = await p2.locator("[data-mobile-menu] aside li").allInnerTexts(); assert.ok(t2.some((t: string) => t.includes("حساب کاربری")) && !t2.some((t: string) => t.includes("ورود / ثبت‌نام")));
      await ctx2.close();
    } finally { await admin.del(`/api/admin/r/menus/${made.id}`); }
  });
});
