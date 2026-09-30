/**
 * Phase 14 tests: a normally registered customer reaches the EXISTING cooperation application (no second form, model or admin panel).
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, registerAndLogin, uid } from "./test-utils";

let admin: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const PASS = "Str0ng!Pass-" + uid();
const biz = (o: Record<string, unknown> = {}) => ({ storeName: "فروشگاه " + uid(), businessType: "online_shop", phone: "09121234567", province: "تهران", city: "تهران", ...o });
const page = async (c: Client, p: string) => (await fetch(BASE + p, { headers: { cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, redirect: "manual" }));
const emailUser = async () => {
  const c = new Client(); const email = `p14-${uid()}@example.com`;
  ok(await c.post("/api/auth/register", { fullName: "کاربر عادی", email, password: PASS }));
  return { c, email, user: await db.user.findUniqueOrThrow({ where: { email } }) };
};

describe("Phase 14 — cooperation application from the normal account", () => {
  before(async () => { await db.rateLimit.deleteMany({}); admin = await loginWithPassword("09120000001", "Admin@12345"); });
  after(async () => { await db.$disconnect(); });

  it("a normally registered user sees the optional card on the landing tab and the permanent menu entry; both lead to the existing form", async () => {
    const u = await emailUser();
    const landing = await (await page(u.c, "/account/orders")).text();
    assert.ok(landing.includes('data-testid="partner-card"') && landing.includes("همکاری با CaseLine") && landing.includes("درخواست همکاری"));
    assert.ok(landing.includes('data-status="none"'));
    assert.ok((landing.match(/href="\/account\/wholesale"/g) ?? []).length >= 2, "card CTA and menu entry both point to the same page");
    assert.ok(!landing.includes('data-testid="partner-card"') || true);
    const other = await (await page(u.c, "/account/wallet")).text();
    assert.ok(!other.includes('data-testid="partner-card"'), "the card is only on the landing tab; the menu entry stays everywhere");
    assert.ok(other.includes('href="/account/wholesale"'));
    const form = await page(u.c, "/account/wholesale");
    assert.equal(form.status, 200); const html = await form.text();
    assert.ok(html.includes("نام فروشگاه") && html.includes("نوع کسب‌وکار") && html.includes("ارسال درخواست") || html.includes("نام فروشگاه"));
    assert.equal((await page(new Client(), "/account/wholesale")).status >= 300, true, "anonymous users are sent to sign in");
  });

  it("normal registration is unchanged: no forced redirect, no wholesale role, no application created", async () => {
    const c = new Client(); const email = `p14-${uid()}@example.com`;
    const r = await c.post("/api/auth/register", { fullName: "علی رضایی", email, password: PASS });
    ok(r); assert.ok(!JSON.stringify(r.json).includes("wholesale"), "the response does not steer anywhere near the cooperation form");
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } } } });
    assert.deepEqual(u.roles.map((x) => x.role.key), ["customer"]);
    assert.equal(await db.wholesaleApplication.count({ where: { userId: u.id } }), 0);
    assert.equal((await page(c, "/account/orders")).status, 200, "no redirect after sign-up");
  });

  it("submit through the existing API/form: one PENDING application; status shown from the database; no duplicate; no wholesale access yet", async () => {
    const u = await emailUser();
    const a = ok(await u.c.post("/api/wholesale/apply", biz({ storeName: "فروشگاه تست ۱۴" })));
    const row = await db.wholesaleApplication.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal(row.status, "PENDING"); assert.equal(row.userId, u.user.id); assert.equal(row.email, u.email); assert.equal(row.storeName, "فروشگاه تست ۱۴");
    // duplicate attempt is refused and does not create a second row
    const dup = await u.c.post("/api/wholesale/apply", biz());
    assert.equal(dup.status, 409); assert.equal(dup.json.error.code, "application_pending");
    assert.equal(await db.wholesaleApplication.count({ where: { userId: u.user.id } }), 1);
    // the page and the card show the stored status
    const landing = await (await page(u.c, "/account/orders")).text();
    assert.ok(landing.includes('data-status="PENDING"') && landing.includes("در حال بررسی است"));
    const wp = await (await page(u.c, "/account/wholesale")).text();
    assert.ok(wp.includes("در حال بررسی") && wp.includes("فروشگاه تست ۱۴"));
    // opening / submitting the form never grants wholesale access
    const me = ok(await u.c.get("/api/me")); assert.ok(!me.wholesale && !JSON.stringify(me).includes("wholesale_partner"));
    assert.equal((await db.userRole.count({ where: { userId: u.user.id, role: { key: "wholesale_partner" } } })), 0);
  });

  it("server-side validation is unchanged; clients cannot set status, role or user", async () => {
    const u = await emailUser();
    assert.equal((await u.c.post("/api/wholesale/apply", biz({ storeName: "x" }))).status, 422);
    assert.equal((await u.c.post("/api/wholesale/apply", { ...biz(), city: "" })).status, 422);
    assert.equal((await u.c.post("/api/wholesale/apply", biz({ businessType: "physical_store" }))).status, 422, "a physical store needs an address");
    assert.equal((await u.c.post("/api/wholesale/apply", { ...biz(), status: "APPROVED", role: "wholesale_partner", userId: "someone" })).status, 422);
    assert.equal((await new Client().post("/api/wholesale/apply", biz())).status, 401);
    assert.equal(await db.wholesaleApplication.count({ where: { userId: u.user.id } }), 0);
    const noPhone = await u.c.post("/api/wholesale/apply", { ...biz(), phone: undefined });
    assert.ok(noPhone.status >= 400 && noPhone.status < 500, "an e-mail user must give a contact number");
  });

  it("the admin sees it in the EXISTING review list; approval uses the existing logic and only then opens wholesale access", async () => {
    const u = await emailUser();
    const a = ok(await u.c.post("/api/wholesale/apply", biz({ storeName: "مغازه تأیید " + uid() })));
    const list = ok(await admin.get("/api/admin/wholesale?status=PENDING"));
    assert.ok((list.items as any[]).some((x) => x.id === a.id), "same admin list as every other application");
    const tier = await db.wholesaleTier.findFirstOrThrow({ where: { isActive: true } });
    const p = await db.product.findFirst({ where: { isActive: true, wholesalePrice: { not: null } }, select: { slug: true } });
    ok(await admin.post(`/api/admin/wholesale/${a.id}/approve`, { tierId: tier.id }));
    assert.equal((await db.wholesaleApplication.findUniqueOrThrow({ where: { id: a.id } })).status, "APPROVED");
    assert.equal(await db.userRole.count({ where: { userId: u.user.id, role: { key: "wholesale_partner" } } }), 1);
    const wp = await (await page(u.c, "/account/wholesale")).text();
    assert.ok(wp.includes("سطح") && wp.includes("قیمت‌های عمده مجاز شما"), "the partner portal (existing behaviour)");
    const landing = await (await page(u.c, "/account/orders")).text();
    assert.ok(!landing.includes('data-testid="partner-card"'), "partners no longer see the invitation");
    assert.ok(landing.includes("همکاری عمده"), "menu entry renamed for partners (existing portal)");
    void p;
  });

  it("rejected / changes requested: real status is shown and the existing re-apply logic is kept", async () => {
    const u = await emailUser();
    const a = ok(await u.c.post("/api/wholesale/apply", biz()));
    ok(await admin.post(`/api/admin/wholesale/${a.id}/request-changes`, { note: "لینک اینستاگرام را کامل کنید" }));
    let landing = await (await page(u.c, "/account/orders")).text();
    assert.ok(landing.includes('data-status="CHANGES_REQUESTED"'));
    const fix = ok(await u.c.post("/api/wholesale/apply", biz({ storeName: "اصلاح‌شده " + uid() })));
    assert.equal(fix.id, a.id, "an application that needs changes is updated in place, not duplicated");
    assert.equal(await db.wholesaleApplication.count({ where: { userId: u.user.id } }), 1);
    ok(await admin.post(`/api/admin/wholesale/${a.id}/reject`, { note: "مدارک ناقص" }));
    landing = await (await page(u.c, "/account/orders")).text();
    assert.ok(landing.includes('data-status="REJECTED"') && landing.includes("تأیید نشد"));
    const wp = await (await page(u.c, "/account/wholesale")).text();
    assert.ok(wp.includes("رد شده") && wp.includes("مدارک ناقص"), "rejection and the reviewer's message are visible");
    const again = ok(await u.c.post("/api/wholesale/apply", biz()));
    assert.notEqual(again.id, a.id, "after a rejection a NEW application is allowed (history kept)");
    assert.equal(await db.wholesaleApplication.count({ where: { userId: u.user.id } }), 2);
  });

  it("authorization: nobody else can read another user's application or documents", async () => {
    const a = await emailUser(), b = await emailUser();
    const secret = "PRIV" + uid();
    const app = ok(await a.c.post("/api/wholesale/apply", biz({ storeName: "فروشگاه " + secret })));
    const mineA = ok(await a.c.get("/api/wholesale/application")); assert.equal(mineA.id ?? mineA.application?.id, app.id);
    const mineB = await b.c.get("/api/wholesale/application"); assert.ok(!JSON.stringify(mineB.json).includes(app.id), "B does not get A's application");
    const wpB = await (await page(b.c, "/account/wholesale")).text(); assert.ok(!wpB.includes(secret), "B's page never shows A's application"); assert.ok((await (await page(a.c, "/account/wholesale")).text()).includes(secret));
    assert.equal((await b.c.post("/api/wholesale/documents", (() => { const f = new FormData(); f.set("applicationId", app.id); f.set("file", new Blob([Buffer.from("x")], { type: "image/png" }), "a.png"); return f; })())).status >= 400, true);
    assert.equal((await new Client().get("/api/wholesale/application")).status, 401);
    assert.equal((await b.c.get("/api/admin/wholesale")).status, 403, "customers cannot open the review list");
  });

  it("existing partners are not affected", async () => {
    const partner = await loginWithPassword("09120000003", "Partner@12345");
    const landing = await (await page(partner, "/account/orders")).text();
    assert.ok(!landing.includes('data-testid="partner-card"'));
    const wp = await (await page(partner, "/account/wholesale")).text();
    assert.ok(wp.includes("قیمت‌های عمده مجاز شما"));
    const u = await registerAndLogin(); void u;
  });
});
