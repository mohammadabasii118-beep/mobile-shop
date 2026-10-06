/** Playwright: live chat (no refresh needed) and tickets are separate in the customer account and the admin sidebar; mobile chat. SHOTS=/dir writes screenshots. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, registerAndLogin } from "./test-utils";

const PW = process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const SHOTS = process.env.SHOTS;
let browser: any, admin: Client, cust: Awaited<ReturnType<typeof registerAndLogin>>;
const shot = async (pg: any, name: string, full = false) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: full }); } };
const ctxFor = async (c: Client, vp = { width: 1300, height: 900 }) => { const ctx = await browser.newContext({ viewport: vp, locale: "fa-IR" }); await ctx.addCookies([...c.jar].map(([name, value]) => ({ name, value, url: BASE }))); return ctx; };

describe("Phase 13 — chat and tickets in the UI", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    const { chromium } = await import(PW);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
    admin = await loginWithPassword("09120000001", "Admin@12345");
    cust = await registerAndLogin();
  });
  after(async () => { await browser?.close(); await db.$disconnect(); });

  it("customer account: two separate entries (online chat / my tickets), each with its own page", async () => {
    const ctx = await ctxFor(cust.c); const pg = await ctx.newPage();
    await pg.goto(`${BASE}/account/chat`, { waitUntil: "networkidle" });
    const nav = pg.getByRole("navigation", { name: "پنل کاربری" });
    assert.ok(await nav.getByRole("link", { name: /چت آنلاین/ }).isVisible()); assert.ok(await nav.getByRole("link", { name: /تیکت‌های من/ }).isVisible());
    await pg.getByTestId("chat-home").waitFor();
    assert.equal(await pg.getByText("تیکت‌های من").first().isVisible(), true);
    await shot(pg, "p13-1-account-chat");
    await nav.getByRole("link", { name: /تیکت‌های من/ }).click(); await pg.waitForURL(/\/account\/tickets/);
    assert.equal(await pg.getByTestId("chat-home").count(), 0, "the tickets page is not the chat page");
    await ctx.close();
  });

  it("live conversation: start in the browser, the agent answers, the customer sees it without refreshing; read state; end", async () => {
    const uctx = await ctxFor(cust.c, { width: 420, height: 860 }); const u = await uctx.newPage();
    await u.goto(`${BASE}/account/chat`, { waitUntil: "networkidle" });
    await u.getByTestId("start-text").fill("سلام، این قاب برای آیفون ۱۵ موجود است؟");
    await u.getByTestId("start-send").click();
    await u.waitForURL(/\/account\/chat\/.+/); await u.getByTestId("chat-thread").waitFor();
    const id = u.url().split("/").pop()!;
    assert.equal(await u.getByTestId("msg-mine").count(), 1);
    assert.equal(await u.getByTestId("chat-status").innerText(), "منتظر پاسخ");

    const actx = await ctxFor(admin); const a = await actx.newPage();
    await a.goto(`${BASE}/admin/support/chat`, { waitUntil: "networkidle" });
    // sidebar: a group with two separate entries
    const side = a.getByRole("navigation", { name: "منوی مدیریت" });
    assert.ok(await side.getByRole("link", { name: /چت آنلاین/ }).isVisible()); assert.ok(await side.getByRole("link", { name: /^تیکت‌ها/ }).isVisible());
    assert.ok(await side.getByText("پشتیبانی", { exact: true }).isVisible(), "group heading");
    assert.notEqual(await side.getByRole("link", { name: /چت آنلاین/ }).getAttribute("href"), await side.getByRole("link", { name: /^تیکت‌ها/ }).getAttribute("href"));
    await a.getByTestId("tab-waiting").click();
    const row = a.getByTestId("chat-row").filter({ hasText: cust.phone });
    await row.waitFor(); assert.equal(await row.getByTestId("row-unread").innerText(), "۱");
    await row.click(); await a.getByTestId("chat-pane").waitFor();
    await shot(a, "p13-2-admin-console");
    await a.getByTestId("a-input").fill("سلام، بله موجود است. کدام رنگ را می‌خواهید؟"); await a.getByTestId("a-send").click();
    // the customer's open page receives the reply by itself (polling), no reload
    await u.getByTestId("msg-staff").waitFor({ timeout: 10000 });
    assert.ok((await u.getByTestId("msg-staff").innerText()).includes("کدام رنگ"));
    assert.equal(await u.getByTestId("chat-status").innerText(), "در جریان");
    await u.getByTestId("chat-input").fill("مشکی"); await u.getByTestId("chat-send").click();
    await u.getByTestId("msg-mine").nth(1).waitFor();
    // the agent page receives it by itself too, and the customer's message shows "read"
    await a.locator('[data-testid="a-msg-user"]').nth(1).waitFor({ timeout: 10000 });
    await u.waitForFunction(() => document.querySelectorAll('[data-testid="msg-state"]')[1]?.textContent?.includes("خوانده"), null, { timeout: 12000 });
    await shot(u, "p13-3-mobile-thread");
    // agent creates a ticket from the chat: a ticket appears in the ticket system, the chat stays a chat
    await a.getByTestId("make-ticket").click(); await a.getByTestId("ticket-go").click();
    await a.getByText("تیکت‌های ثبت‌شده از این گفتگو").waitFor();
    assert.equal(await db.supportTicket.count({ where: { sourceChatId: id } }), 1);
    assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id } })).status, "waiting");
    await u.getByText("از این گفتگو تیکت ثبت شده").waitFor({ timeout: 10000 });
    // customer ends the conversation
    await u.getByTestId("end-chat").click(); await u.getByTestId("end-confirm").click();
    await u.getByTestId("closed-note").waitFor();
    assert.equal(await u.getByTestId("chat-status").innerText(), "بسته");
    await a.getByTestId("reopen").waitFor({ timeout: 10000 });
    await actx.close(); await uctx.close();
  });

  it("notifications are labelled separately (chat vs ticket)", async () => {
    await db.notification.create({ data: { userId: cust.userId, type: "chat_message", event: "chat_message", title: "پیام جدید در چت آنلاین", link: "/account/chat" } });
    const ctx = await ctxFor(cust.c); const pg = await ctx.newPage();
    await pg.goto(`${BASE}/account/notifications`, { waitUntil: "networkidle" });
    const kinds = await pg.getByTestId("n-kind").allInnerTexts();
    assert.ok(kinds.includes("چت آنلاین") && kinds.includes("تیکت"), kinds.join(","));
    await ctx.close();
  });

  it("admin ticket page has the extended filters and five statuses", async () => {
    const ctx = await ctxFor(admin); const pg = await ctx.newPage();
    await pg.goto(`${BASE}/admin/support/tickets`, { waitUntil: "networkidle" });
    for (const l of ["باز (در انتظار پشتیبانی)", "در حال بررسی", "در انتظار پاسخ شما", "پاسخ داده شد"]) assert.ok(await pg.getByRole("button", { name: l }).isVisible(), l);
    for (const l of ["دسته", "اولویت", "شماره سفارش", "از تاریخ", "تا تاریخ", "جستجو"]) assert.ok(await pg.getByLabel(l, { exact: true }).isVisible(), l);
    await shot(pg, "p13-4-admin-tickets");
    await ctx.close();
  });
});
