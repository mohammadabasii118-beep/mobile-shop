/** Playwright: the top bar in its three modes (auto, manual swipe, both), copy button, mobile fit. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, uid } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
const tag = uid();
let browser: any, admin: Client;
const made: string[] = [];
const ok = (r: { status: number; json: any }) => { assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json?.data; };
const cfg = (o: Record<string, unknown>) => admin.put("/api/admin/settings/topbar", { enabled: true, mode: "auto", displaySeconds: 2, transitionMs: 300, animation: "rise", pauseOnHover: true, ...o }).then(ok);
const shot = async (pg: any, name: string) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png"), clip: { x: 0, y: 0, width: pg.viewportSize().width, height: 140 } }); } };
const open = async (vp = { width: 1100, height: 700 }) => { const ctx = await browser.newContext({ viewport: vp, locale: "fa-IR", permissions: ["clipboard-read", "clipboard-write"] }); const pg = await ctx.newPage(); await pg.goto(`${BASE}/`, { waitUntil: "networkidle" }); await pg.getByTestId("topbar").waitFor(); return { ctx, pg }; };
const activeTitle = (pg: any) => pg.locator('[data-testid="topbar-stage"] [data-active="true"]').innerText();

describe("Phase 15 — top bar in the browser", () => {
  before(async () => {
    await db.rateLimit.deleteMany({}); await db.topBarItem.deleteMany({});
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    admin = await loginWithPassword("09120000001", "Admin@12345");
    for (const [kind, title, extra] of [["telegram", "تلگرام ما", { link: "https://t.me/x" }], ["tracking", "کانال رهگیری سفارشات", { link: "https://t.me/track" }], ["discount", "کد تخفیف", { copyText: "CASE10" }]] as const) made.push(ok(await admin.post("/api/admin/r/topbar-items", { kind, title: `${title} ${tag}`, isActive: true, ...extra })).id);
  });
  after(async () => { await db.topBarItem.deleteMany({ where: { id: { in: made } } }); await cfg({}); await browser?.close(); await db.$disconnect(); });

  it("auto mode: rotates by itself with the chosen animation, stops while hovered", async () => {
    await cfg({ mode: "auto", animation: "rise" });
    const { ctx, pg } = await open(); const first = await activeTitle(pg);
    assert.ok(first.includes("تلگرام ما"));
    await pg.waitForFunction((t: string) => !document.querySelector('[data-testid="topbar-stage"] [data-active="true"]')?.textContent?.includes(t), "تلگرام ما", { timeout: 6000 });
    assert.ok((await activeTitle(pg)).includes("کانال رهگیری"), "moved to the next message");
    await shot(pg, "p15-1-auto");
    await pg.getByTestId("topbar").hover(); const held = await activeTitle(pg); await pg.waitForTimeout(3000);
    assert.equal(await activeTitle(pg), held, "paused on hover");
    await pg.mouse.move(5, 400);
    for (const animation of ["fade", "slide"]) { await cfg({ animation }); await pg.reload({ waitUntil: "networkidle" }); assert.ok((await pg.getByTestId("topbar-stage").locator('[data-active="true"]').count()) === 1, animation); }
    await ctx.close();
  });

  it("copy button copies the discount code", async () => {
    await cfg({ mode: "auto" });
    const { ctx, pg } = await open();
    await pg.waitForFunction(() => document.querySelector('[data-testid="topbar-stage"] [data-active="true"]')?.textContent?.includes("CASE10"), null, { timeout: 9000 });
    await pg.locator('[data-active="true"] button').click();
    assert.equal(await pg.evaluate(() => navigator.clipboard.readText()), "CASE10");
    assert.ok((await pg.locator('[data-active="true"] button').innerText()).includes("کپی شد"));
    await ctx.close();
  });

  it("manual mode: no auto rotation; swipe/drag, arrows and keys move between messages", async () => {
    await cfg({ mode: "manual" });
    const { ctx, pg } = await open();
    const sc = pg.getByTestId("topbar-scroller"); const idx = () => sc.evaluate((e: HTMLElement) => Math.round(Math.abs(e.scrollLeft) / e.clientWidth));
    assert.equal(await idx(), 0); await pg.waitForTimeout(3000); assert.equal(await idx(), 0, "does not rotate by itself");
    await pg.getByRole("button", { name: "بعدی" }).click(); await pg.waitForTimeout(700); assert.equal(await idx(), 1);
    await pg.getByRole("button", { name: "قبلی" }).click(); await pg.waitForTimeout(700); assert.equal(await idx(), 0);
    const b = await sc.boundingBox();
    await pg.mouse.move(b!.x + b!.width * 0.2, b!.y + 12); await pg.mouse.down(); await pg.mouse.move(b!.x + b!.width * 0.8, b!.y + 12, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(800);
    assert.equal(await idx(), 1, "dragging to the right brings the next message (right-to-left site)");
    await sc.focus(); await pg.keyboard.press("ArrowLeft"); await pg.waitForTimeout(700); assert.equal(await idx(), 2);
    await shot(pg, "p15-2-manual"); await ctx.close();
  });

  it("both: rotates by itself AND can be swiped; fits a phone without horizontal scroll", async () => {
    await cfg({ mode: "both" });
    const { ctx, pg } = await open({ width: 400, height: 800 });
    const sc = pg.getByTestId("topbar-scroller"); const idx = () => sc.evaluate((e: HTMLElement) => Math.round(Math.abs(e.scrollLeft) / e.clientWidth));
    await pg.waitForFunction(() => { const e = document.querySelector('[data-testid="topbar-scroller"]') as HTMLElement; return Math.abs(e.scrollLeft) > e.clientWidth * 0.9; }, null, { timeout: 8000 });
    assert.ok((await idx()) >= 1, "moved on its own");
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await pg.getByTestId("topbar").evaluate((e: HTMLElement) => e.getBoundingClientRect().height <= 38), true, "fixed slim height");
    await shot(pg, "p15-3-both-mobile"); await ctx.close();
  });

  it("a single message is static (no controls); bar off = hidden", async () => {
    await db.topBarItem.updateMany({ where: { id: { in: made.slice(1) } }, data: { isActive: false } });
    await cfg({ mode: "both" }); const { ctx, pg } = await open();
    assert.equal(await pg.getByTestId("topbar").getAttribute("data-count"), "1"); assert.equal(await pg.getByTestId("topbar-scroller").count(), 0);
    await ctx.close();
    await cfg({ enabled: false }); const c2 = await browser.newContext(); const p2 = await c2.newPage(); await p2.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert.equal(await p2.getByTestId("topbar").count(), 0); await c2.close();
  });
});
