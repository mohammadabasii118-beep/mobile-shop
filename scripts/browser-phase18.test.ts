/** Playwright: the account menu is a tile grid — every section visible, no horizontal scroll, 5 columns on desktop / 3 on a phone. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, registerAndLogin } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, c: Client, userId = "";
const shot = async (pg: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png"), clip: { x: 0, y: 0, width: pg.viewportSize().width, height: 520 } }); } };
const LABELS = ["سفارش ها", "کیف پول", "امتیاز باشگاه", "اعلان‌ها", "چت آنلاین", "تیکت‌های من", "نظرات من", "اطلاعات حساب کاربری", "درخواست همکاری"];

describe("Phase 18 — account menu tiles", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    const { chromium } = await import(PW); browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    const u = await registerAndLogin(); c = u.c; userId = u.userId;
    await db.notification.create({ data: { userId, type: "order_status", event: "order_status", title: "x" } });
    await db.chatConversation.create({ data: { userId, status: "active", unreadUser: 2, lastMessagePreview: "سلام" } });
  });
  after(async () => { await db.user.deleteMany({ where: { id: userId } }); await browser?.close(); await db.$disconnect(); });
  const open = async (vp: { width: number; height: number }, p = "/account/orders") => { const ctx = await browser.newContext({ viewport: vp, locale: "fa-IR" }); await ctx.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE }))); const pg = await ctx.newPage(); await pg.goto(`${BASE}${p}`, { waitUntil: "networkidle" }); return { ctx, pg }; };

  for (const [name, vp, cols] of [["desktop", { width: 1200, height: 800 }, 5], ["phone", { width: 390, height: 800 }, 3]] as const) {
    it(`${name}: all nine sections are visible tiles in ${cols} columns, nothing cut off`, async () => {
      const { ctx, pg } = await open(vp); const nav = pg.getByTestId("account-tiles");
      for (const l of LABELS) { const t = nav.getByRole("link", { name: new RegExp(l) }); assert.equal(await t.isVisible(), true, l); const b = await t.boundingBox(); assert.ok(b!.x >= 0 && b!.x + b!.width <= vp.width + 1, `${l} inside the screen`); }
      const columns = await nav.evaluate((e: HTMLElement) => getComputedStyle(e).gridTemplateColumns.split(" ").length); assert.equal(columns, cols);
      assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "no horizontal scroll");
      assert.equal(await nav.evaluate((e: HTMLElement) => e.scrollWidth <= e.clientWidth + 1), true, "the menu itself does not scroll");
      assert.equal(await nav.getByRole("link", { name: /سفارش ها/ }).getAttribute("aria-current"), "page");
      assert.equal(await pg.getByTestId("badge-notifications").innerText(), "۱"); assert.equal(await pg.getByTestId("badge-chat").innerText(), "۲");
      await shot(pg, `p18-${name}`); await ctx.close();
    });
  }

  it("each tile opens its own page and becomes the active one", async () => {
    const { ctx, pg } = await open({ width: 390, height: 800 });
    for (const [label, url] of [["اطلاعات حساب کاربری", /\/account\/edit/], ["چت آنلاین", /\/account\/chat/], ["تیکت‌های من", /\/account\/tickets/]] as const) {
      await pg.getByTestId("account-tiles").getByRole("link", { name: new RegExp(label) }).click(); await pg.waitForURL(url);
      assert.equal(await pg.getByTestId("account-tiles").getByRole("link", { name: new RegExp(label) }).getAttribute("aria-current"), "page");
    }
    await ctx.close();
  });
});
