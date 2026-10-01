/** Playwright: the account information page — complete profile, add/edit address, change password — desktop and phone. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
const PASS = "Str0ng!Pass-" + uid() + "1", NEW = "N3w!Pass-" + uid() + "2";
let browser: any, c: Client, email = "", userId = "";
const shot = async (pg: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true }); } };

describe("Phase 17 — account information in the browser", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    c = new Client(); email = `p17b-${uid()}@example.com`;
    const r = await c.post("/api/auth/register", { fullName: "علی رضایی", email, password: PASS }); assert.equal(r.status, 200, JSON.stringify(r.json));
    userId = (await db.user.findUniqueOrThrow({ where: { email } })).id;
  });
  after(async () => { await db.user.deleteMany({ where: { email: { startsWith: "p17b-" } } }); await browser?.close(); await db.$disconnect(); });

  it("fill in the address, edit it, change the password — and see the completion grow", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: "fa-IR" }); await ctx.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE })));
    const pg = await ctx.newPage(); await pg.goto(`${BASE}/account/edit`, { waitUntil: "networkidle" });
    assert.ok((await pg.getByTestId("completion").innerText()).includes("۵۰٪")); await shot(pg, "p17-1-before");
    // personal info
    await pg.getByTestId("info-form").getByLabel("نام نمایشی").fill("علی"); await pg.getByTestId("info-form").getByRole("button", { name: "ذخیره اطلاعات" }).click();
    await pg.getByText("اطلاعات شما ذخیره شد.").waitFor();
    // address
    await pg.getByTestId("add-address").click(); const f = pg.getByTestId("address-form");
    await f.getByLabel("نام گیرنده").fill("علی رضایی"); await f.getByLabel("موبایل گیرنده").fill("09121234567"); await f.getByLabel("کد پستی (۱۰ رقم)").fill("1234567890");
    await f.getByLabel("استان").fill("تهران"); await f.getByLabel("شهر").fill("تهران"); await f.getByLabel("آدرس کامل").fill("خیابان ولیعصر، پلاک ۱۰، واحد ۳");
    await f.getByTestId("address-save").click(); await pg.getByTestId("address-row").waitFor();
    assert.equal(await db.address.count({ where: { userId } }), 1);
    await pg.waitForFunction(() => document.querySelector('[data-testid="completion"]')?.textContent?.includes("۷۵٪"), null, { timeout: 8000 });
    // edit
    await pg.getByRole("button", { name: "ویرایش آدرس" }).click(); await pg.getByTestId("address-form").getByLabel("شهر").fill("کرج"); await pg.getByTestId("address-save").click();
    await pg.getByText(/کرج/).first().waitFor(); assert.equal((await db.address.findFirstOrThrow({ where: { userId } })).city, "کرج");
    // password: mismatch is caught, then change
    const pf = pg.getByTestId("password-form");
    await pf.getByLabel("رمز عبور فعلی").fill(PASS); await pf.getByLabel("رمز عبور جدید (حداقل ۸ کاراکتر، شامل حرف و عدد)").fill(NEW); await pf.getByLabel("تکرار رمز عبور جدید").fill(NEW + "x");
    await pf.getByRole("button", { name: "تغییر رمز عبور" }).click(); assert.ok((await pg.getByTestId("pw-msg").innerText()).includes("یکسان نیست"));
    await pf.getByLabel("تکرار رمز عبور جدید").fill(NEW); await pf.getByRole("button", { name: "تغییر رمز عبور" }).click(); await pg.getByText("رمز عبور شما تغییر کرد.").waitFor();
    assert.equal((await new Client().post("/api/auth/login", { identifier: email, password: NEW })).status, 200);
    await shot(pg, "p17-2-after"); await ctx.close();
  });

  it("works on a phone without horizontal scroll", async () => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, locale: "fa-IR" }); await ctx.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE })));
    const pg = await ctx.newPage(); await pg.goto(`${BASE}/account/edit`, { waitUntil: "networkidle" });
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await pg.getByTestId("add-address").click(); assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await shot(pg, "p17-3-mobile"); await ctx.close();
  });
});
