/**
 * Phase 8 browser tests (Playwright/Chromium): e-mail registration on the existing login card, duplicate e-mail, partner sign-up form,
 * admin approval in the panel. Same prerequisites as browser-phase7. SHOTS=/dir writes screenshots.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, admin: Client;
const shot = async (page: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }); } };

describe("Phase 8 — browser flows", () => {
  before(async () => {
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345");
  });
  after(async () => { await browser?.close(); await db.$disconnect(); });

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
});
