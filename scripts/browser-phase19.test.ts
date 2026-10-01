/** Playwright: admin dialogs are portalled to the admin root — the overlay covers the whole viewport and a tall dialog stays reachable (desktop + phone). SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, admin: Client;

describe("Phase 19 — admin modal layout", () => {
  before(async () => {
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    admin = await loginWithPassword("09120000001", "Admin@12345");
  });
  after(async () => { await browser?.close(); await db.$disconnect(); });

  for (const [name, vp] of [["desktop", { width: 1300, height: 700 }], ["phone", { width: 390, height: 700 }]] as const) {
    it(`${name}: add-admin dialog — overlay covers the viewport, title and submit are reachable`, async () => {
      const ctx = await browser.newContext({ viewport: vp, locale: "fa-IR" });
      await ctx.addCookies([...admin.jar].map(([n, value]) => ({ name: n, value, url: BASE })));
      const pg = await ctx.newPage();
      await pg.goto(`${BASE}/admin/customers`, { waitUntil: "networkidle" });
      await pg.getByRole("button", { name: /افزودن مدیر/ }).first().click().catch(async () => { await pg.getByRole("button", { name: /افزودن/ }).first().click(); await pg.getByRole("menuitem", { name: /مدیر/ }).click(); });
      const dlg = pg.getByRole("dialog"); await dlg.waitFor();
      await pg.waitForTimeout(600);
      const ov = await pg.locator(".fx-overlay").boundingBox();
      assert.ok(ov && ov.x <= 0 && ov.y <= 0 && ov.width >= vp.width - 1 && ov.height >= vp.height - 1, `overlay covers the viewport ${JSON.stringify(ov)}`);
      const b = await dlg.boundingBox();
      assert.ok(b!.y >= 0 && b!.y + b!.height <= vp.height + 1, `dialog inside the viewport ${JSON.stringify(b)}`);
      assert.equal(await dlg.getByRole("heading").first().isVisible(), true);
      await dlg.evaluate((e: HTMLElement) => { e.scrollTop = e.scrollHeight; });
      assert.equal(await dlg.getByRole("button", { name: /ساخت مدیر/ }).isVisible(), true);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `modal-${name}.png`) }); }
      await pg.keyboard.press("Escape"); await dlg.waitFor({ state: "detached" });
      await ctx.close();
    });
  }
});
