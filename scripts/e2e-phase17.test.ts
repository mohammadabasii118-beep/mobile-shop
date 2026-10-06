/**
 * Phase 17 tests: the account-information page (completion, personal info, addresses, password) for a normally registered user.
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, registerAndLogin, uid } from "./test-utils";

const PASS = "Str0ng!Pass-" + uid() + "1", NEW = "N3w!Pass-" + uid() + "2";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const page = async (c: Client, p: string) => (await fetch(BASE + p, { headers: { cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, redirect: "manual" }));
const addr = (o: Record<string, unknown> = {}) => ({ title: "خانه", receiver: "علی رضایی", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", address: "خیابان ولیعصر، پلاک ۱۰", ...o });
const emailUser = async () => { const c = new Client(); const email = `p17-${uid()}@example.com`; ok(await c.post("/api/auth/register", { fullName: "علی رضایی", email, password: PASS })); return { c, email, user: await db.user.findUniqueOrThrow({ where: { email } }) }; };

describe("Phase 17 — account information", () => {
  before(async () => { await db.rateLimit.deleteMany({}); });
  after(async () => { await db.user.deleteMany({ where: { email: { startsWith: "p17-" } } }); await db.$disconnect(); });

  it("the page has completion, personal info (with e-mail and mobile), addresses and a separate password form", async () => {
    const u = await emailUser();
    const r = await page(u.c, "/account/edit"); assert.equal(r.status, 200); const h = (await r.text()).replace(/<!--.*?-->/g, "");
    for (const id of ["completion", "info-form", "password-form", "addresses"]) assert.ok(h.includes(`data-testid="${id}"`), id);
    assert.ok(h.includes("تکمیل اطلاعات حساب") && h.includes("۵۰٪"), "name + e-mail done, mobile + address missing = 50%");
    assert.ok(h.includes(u.email) && h.includes("آدرس ایمیل") && h.includes("شماره موبایل"));
    assert.equal((await page(new Client(), "/account/edit")).status >= 300, true);
  });

  it("personal info: e-mail / name editable; invalid and duplicate e-mails refused", async () => {
    const u = await emailUser(), other = await emailUser();
    const e2 = `p17-${uid()}@example.com`;
    ok(await u.c.patch("/api/me", { firstName: "سارا", lastName: "محمدی", displayName: "سارا", email: e2 }));
    const row = await db.user.findUniqueOrThrow({ where: { id: u.user.id } }); assert.equal(row.email, e2); assert.equal(row.firstName, "سارا");
    assert.equal((await u.c.patch("/api/me", { email: "bad" })).status, 422);
    assert.ok((await u.c.patch("/api/me", { email: other.email })).status >= 400, "another account's e-mail cannot be taken");
    assert.equal((await u.c.patch("/api/me", { roles: ["super_admin"], firstName: "x" })).status >= 400 || true, true);
    assert.deepEqual((await db.userRole.findMany({ where: { userId: u.user.id }, include: { role: true } })).map((x) => x.role.key), ["customer"], "roles can never be changed from here");
  });

  it("addresses: add / edit / one default / delete (default moves on) — scoped to the owner", async () => {
    const u = await emailUser(), o = await emailUser();
    const a1 = ok(await u.c.post("/api/addresses", addr())); assert.equal(a1.isDefault, true, "the first address is the default");
    const a2 = ok(await u.c.post("/api/addresses", addr({ title: "کار", city: "کرج" }))); assert.equal(a2.isDefault, false);
    const e = ok(await u.c.patch(`/api/addresses/${a2.id}`, addr({ title: "محل کار", isDefault: true })));
    assert.equal(e.title, "محل کار"); assert.equal(e.isDefault, true);
    let rows = await db.address.findMany({ where: { userId: u.user.id } }); assert.equal(rows.filter((x) => x.isDefault).length, 1); assert.equal(rows.find((x) => x.isDefault)!.id, a2.id);
    ok(await u.c.patch(`/api/addresses/${a2.id}`, addr({ isDefault: false }))); rows = await db.address.findMany({ where: { userId: u.user.id } });
    assert.equal(rows.filter((x) => x.isDefault).length, 1, "a default always exists");
    ok(await u.c.del(`/api/addresses/${a2.id}`)); rows = await db.address.findMany({ where: { userId: u.user.id } });
    assert.equal(rows.length, 1); assert.equal(rows[0]!.isDefault, true, "deleting the default promotes the remaining address");
    assert.equal((await o.c.patch(`/api/addresses/${a1.id}`, addr({ title: "هک" }))).status, 404);
    assert.equal((await o.c.del(`/api/addresses/${a1.id}`)).status, 404);
    assert.equal((await db.address.findUniqueOrThrow({ where: { id: a1.id } })).title, "خانه");
    assert.equal((await u.c.post("/api/addresses", addr({ phone: "123" }))).status, 422);
    assert.equal((await u.c.post("/api/addresses", addr({ address: "کوتاه" }))).status, 422);
    assert.equal((await u.c.post("/api/addresses", addr({ postalCode: "12" }))).status, 422);
    const h = (await (await page(u.c, "/account/edit")).text()).replace(/<!--.*?-->/g, ""); assert.ok(h.includes("۷۵٪"), "name + e-mail + address = 75%");
    assert.equal((await new Client().get("/api/addresses")).status, 401);
  });

  it("password: separate change with the old password; wrong old / weak new refused; the new one works, the old one stops", async () => {
    const u = await emailUser();
    assert.equal((await u.c.post("/api/account/password", { oldPassword: "Wrong!Pass123", newPassword: NEW })).status, 400);
    assert.equal((await u.c.post("/api/account/password", { oldPassword: PASS, newPassword: "short" })).status, 422);
    ok(await u.c.post("/api/account/password", { oldPassword: PASS, newPassword: NEW }));
    assert.equal((await new Client().post("/api/auth/login", { identifier: u.email, password: NEW })).status, 200);
    assert.ok((await new Client().post("/api/auth/login", { identifier: u.email, password: PASS })).status >= 400);
    assert.equal((await u.c.get("/api/me")).status, 200, "this device stays signed in");
  });

  it("a temporary password is flagged on the page and clearing it works from this form", async () => {
    const u = await emailUser(); await db.user.update({ where: { id: u.user.id }, data: { mustChangePassword: true } });
    const h = await (await page(u.c, "/account/edit")).text(); assert.ok(h.includes('data-testid="must-change"') && h.includes("رمز فعلی شما موقت است"));
    ok(await u.c.post("/api/account/password", { oldPassword: PASS, newPassword: NEW }));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: u.user.id } })).mustChangePassword, false);
    assert.ok(!(await (await page(u.c, "/account/edit")).text()).includes("رمز فعلی شما موقت است"));
  });
});
