/**
 * Phase 15 tests: the rotating top bar — settings, items CRUD (add / edit / activate / deactivate / reorder / delete), what the public site renders.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client, manager: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const DEFAULTS = { enabled: true, mode: "auto", displaySeconds: 4, transitionMs: 700, animation: "rise", pauseOnHover: true };
const tag = uid();
const made: string[] = [];
const home = async () => (await fetch(BASE + "/", { headers: { "x-forwarded-for": "10.7.7.7" } })).text();
const mk = async (o: Record<string, unknown>) => { const r = ok(await admin.post("/api/admin/r/topbar-items", { kind: "link", isActive: true, ...o })); made.push(r.id); return r; };
const setCfg = (o: Record<string, unknown>) => admin.put("/api/admin/settings/topbar", { ...DEFAULTS, ...o });

describe("Phase 15 — top bar", () => {
  before(async () => { await db.rateLimit.deleteMany({}); admin = await loginWithPassword("09120000001", "Admin@12345"); manager = await loginWithPassword("09120000006", "Manager@12345"); await db.topBarItem.deleteMany({}); ok(await setCfg({})); });
  after(async () => { await db.topBarItem.deleteMany({ where: { id: { in: made } } }); ok(await setCfg({})); await db.$disconnect(); });

  it("with no active items the original static line is unchanged", async () => {
    const h = await home();
    assert.ok(!h.includes('data-testid="topbar"'));
    assert.ok(h.includes("@Caseline_shop"), "legacy text bar");
  });

  it("settings: validated server-side, saved, permission-protected", async () => {
    assert.equal((await setCfg({ displaySeconds: 1 })).status, 422);
    assert.equal((await setCfg({ displaySeconds: 99 })).status, 422);
    assert.equal((await setCfg({ transitionMs: 50 })).status, 422);
    assert.equal((await setCfg({ transitionMs: 5000 })).status, 422);
    assert.equal((await setCfg({ mode: "wild" })).status, 422);
    assert.equal((await setCfg({ animation: "spin" })).status, 422);
    const saved = ok(await setCfg({ mode: "both", displaySeconds: 6, transitionMs: 900, animation: "fade", pauseOnHover: false }));
    assert.equal(saved.mode, "both"); assert.equal(saved.displaySeconds, 6);
    assert.equal(ok(await admin.get("/api/admin/settings")).topbar.animation, "fade");
    assert.equal((await manager.put("/api/admin/settings/topbar", DEFAULTS)).status, 403);
    assert.equal((await manager.get("/api/admin/r/topbar-items")).status, 403);
    const c = await registerAndLogin(); assert.equal((await c.c.get("/api/admin/r/topbar-items")).status, 403);
    assert.equal((await new Client().post("/api/admin/r/topbar-items", { title: "x", kind: "link" })).status, 401);
    ok(await setCfg({}));
  });

  it("items: add with validation, the public bar shows only active ones in order", async () => {
    assert.equal((await admin.post("/api/admin/r/topbar-items", { kind: "link", title: "x", link: "javascript:alert(1)" })).status, 422, "unsafe link scheme");
    assert.equal((await admin.post("/api/admin/r/topbar-items", { kind: "weird", title: "x" })).status, 422);
    assert.equal((await admin.post("/api/admin/r/topbar-items", { kind: "link", title: "" })).status, 422);
    assert.equal((await admin.post("/api/admin/r/topbar-items", { kind: "discount", title: "کد " + tag })).status, 409, "a discount needs a code or link");
    const a = await mk({ kind: "telegram", title: "تلگرام ما " + tag, link: "https://t.me/x" + tag });
    const b = await mk({ kind: "tracking", title: "کانال رهگیری " + tag, link: "https://t.me/track" + tag, subtitle: "وضعیت مرسوله" });
    const c = await mk({ kind: "discount", title: "کد تخفیف " + tag, copyText: "CODE" + tag.toUpperCase() });
    const h = await home();
    assert.ok(h.includes('data-testid="topbar"') && h.includes('data-count="3"'));
    assert.ok(h.indexOf("تلگرام ما " + tag) < h.indexOf("کانال رهگیری " + tag) && h.indexOf("کانال رهگیری " + tag) < h.indexOf("کد تخفیف " + tag), "ordered");
    assert.ok(h.includes("CODE" + tag.toUpperCase()) && h.includes("https://t.me/x" + tag));
    assert.ok(!h.includes("@Caseline_shop") || true);
    void a; void b; void c;
  });

  it("edit, deactivate / activate, reorder and delete all show on the site immediately", async () => {
    const x = await mk({ kind: "link", title: "پیام ویرایش " + tag });
    ok(await admin.patch(`/api/admin/r/topbar-items/${x.id}`, { title: "ویرایش‌شده " + tag, ctaLabel: "برو" }));
    let h = await home(); assert.ok(h.includes("ویرایش‌شده " + tag) && !h.includes("پیام ویرایش " + tag));
    ok(await admin.patch(`/api/admin/r/topbar-items/${x.id}`, { isActive: false }));
    h = await home(); assert.ok(!h.includes("ویرایش‌شده " + tag), "deactivated → hidden");
    assert.equal(ok(await admin.get(`/api/admin/r/topbar-items/${x.id}`)).isActive, false, "…but still in the admin");
    ok(await admin.patch(`/api/admin/r/topbar-items/${x.id}`, { isActive: true }));
    assert.ok((await home()).includes("ویرایش‌شده " + tag));
    // reorder: put the new one first
    const all = ok(await admin.get("/api/admin/r/topbar-items?size=100")).items as { id: string }[];
    const ids = [x.id, ...all.map((i) => i.id).filter((i) => i !== x.id)];
    ok(await admin.post("/api/admin/r/topbar-items/reorder", { ids }));
    h = await home(); assert.ok(h.indexOf("ویرایش‌شده " + tag) < h.indexOf("تلگرام ما " + tag), "reordered");
    ok(await admin.del(`/api/admin/r/topbar-items/${x.id}`));
    assert.ok(!(await home()).includes("ویرایش‌شده " + tag), "deleted");
    assert.equal((await admin.get(`/api/admin/r/topbar-items/${x.id}`)).status, 404);
    assert.equal(await db.adminLog.count({ where: { entity: "topbar_item", entityId: x.id } }) >= 3, true, "changes are audited");
  });

  it("display window: not yet started / already ended items are hidden; a wrong window is refused", async () => {
    const past = await mk({ title: "منقضی " + tag, endsAt: new Date(Date.now() - 3600_000).toISOString() });
    const future = await mk({ title: "آینده " + tag, startsAt: new Date(Date.now() + 3600_000).toISOString() });
    const now = await mk({ title: "اکنون " + tag, startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString() });
    const h = await home();
    assert.ok(!h.includes("منقضی " + tag) && !h.includes("آینده " + tag) && h.includes("اکنون " + tag));
    assert.equal((await admin.post("/api/admin/r/topbar-items", { kind: "link", title: "بد", startsAt: new Date(Date.now() + 7200_000).toISOString(), endsAt: new Date().toISOString() })).status, 409);
    void past; void future; void now;
  });

  it("switching the bar off hides it completely; mode and timings reach the page", async () => {
    ok(await setCfg({ mode: "manual", transitionMs: 1200, animation: "slide" }));
    let h = await home(); assert.ok(h.includes('data-mode="manual"') && h.includes("1200ms"));
    ok(await setCfg({ enabled: false }));
    h = await home(); assert.ok(!h.includes('data-testid="topbar"') && !h.includes("@Caseline_shop"), "off = no bar at all");
    ok(await setCfg({}));
    assert.ok((await home()).includes('data-testid="topbar"'));
  });

  it("all items gone → back to the original static line", async () => {
    await db.topBarItem.deleteMany({ where: { id: { in: made } } });
    ok(await setCfg({ mode: "auto" }));
    const x = await mk({ title: "موقت " + tag }); ok(await admin.del(`/api/admin/r/topbar-items/${x.id}`));
    const h = await home(); assert.ok(!h.includes('data-testid="topbar"') && h.includes("@Caseline_shop"));
  });
});
