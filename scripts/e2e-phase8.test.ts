/**
 * Phase 8 integration tests: e-mail registration (no SMS/OTP) and partner sign-up. Server must be running (see e2e-phase4 header).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client, db, loginWithPassword, newPhone, plantOtp, seedUser, uid } from "./test-utils";

let admin: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const code = (r: { json: any }) => r.json?.error?.code as string | undefined;
const mail = () => `t-${uid()}${uid()}@example.com`;
const PASS = "Secret123x";
const reg = (c: Client, o: Record<string, unknown> = {}) => c.post("/api/auth/register", { fullName: "علی رضایی", email: mail(), password: PASS, ...o });
const biz = (o: Record<string, unknown> = {}) => ({ storeName: "فروشگاه تست " + uid(), phone: newPhone(), businessType: "online_shop", province: "تهران", city: "تهران", ...o });
const preg = (c: Client, o: Record<string, unknown> = {}) => c.post("/api/wholesale/register", { fullName: "سارا محمدی", email: mail(), password: PASS, ...biz(), ...o });

describe("Phase 8 — e-mail registration", () => {
  before(async () => { await db.rateLimit.deleteMany({}); admin = await loginWithPassword("09120000001", "Admin@12345"); });
  after(async () => { await db.$disconnect(); });

  it("registers with full name + e-mail + password only — no SMS/OTP, no phone — and signs in with a session cookie", async () => {
    const c = new Client(); const email = mail(); const otpBefore = await db.otpCode.count();
    const d = ok(await reg(c, { email }));
    assert.equal(d.registered, true); assert.equal(d.needsProfile, false);
    assert.ok(c.jar.has("cl_session"));
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } } } });
    assert.equal(u.phone, null); assert.equal(u.firstName, "علی"); assert.equal(u.lastName, "رضایی"); assert.equal(u.displayName, "علی رضایی");
    assert.deepEqual(u.roles.map((r) => r.role.key), ["customer"]);
    assert.match(u.passwordHash!, /^\$2[aby]\$12\$/, "bcrypt hash, cost 12"); assert.notEqual(u.passwordHash, PASS);
    assert.equal(await db.otpCode.count(), otpBefore, "no OTP was issued");
    const me = ok(await c.get("/api/me")); assert.equal(me.email, email); assert.equal(me.phone, null); assert.deepEqual(me.roles, ["customer"]); assert.equal(me.wholesale ?? null, null);
    const sc = (await fetch(`${process.env.BASE_URL ?? "http://localhost:3300"}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify({ fullName: "کاربر دو", email: mail(), password: PASS }) })).headers.getSetCookie().find((x) => x.startsWith("cl_session="))!;
    assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=lax/i);
  });

  it("login works afterwards by e-mail (any case) and legacy phone+password still works; wrong password / unknown e-mail give the same error", async () => {
    const email = mail(); ok(await reg(new Client(), { email }));
    const c = new Client(); const r = await c.post("/api/auth/login", { identifier: email.toUpperCase(), password: PASS }); ok(r); assert.ok(c.jar.has("cl_session"));
    assert.equal((await new Client().post("/api/auth/login", { email, password: PASS })).status, 422); // unknown key shape is not a login
    const bad = await new Client().post("/api/auth/login", { identifier: email, password: "wrong-pass1" }), none = await new Client().post("/api/auth/login", { identifier: mail(), password: "wrong-pass1" });
    assert.equal(bad.status, 400); assert.equal(none.status, 400); assert.equal(code(bad), code(none)); assert.equal(bad.json.error.message, none.json.error.message);
    const phone = newPhone(); await db.user.create({ data: { phone, passwordHash: (await db.user.findUniqueOrThrow({ where: { email } })).passwordHash } });
    ok(await new Client().post("/api/auth/login", { phone, password: PASS }));
  });

  it("duplicate e-mail is refused (409 email_taken, also case-insensitive and under a double submit) and creates no second user", async () => {
    const email = mail(); ok(await reg(new Client(), { email }));
    const r = await reg(new Client(), { email: email.toUpperCase() });
    assert.equal(r.status, 409); assert.equal(code(r), "email_taken"); assert.match(r.json.error.message, /قبلاً ثبت شده/);
    const e2 = mail(); const [a, b] = await Promise.all([reg(new Client(), { email: e2 }), reg(new Client(), { email: e2 })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(await db.user.count({ where: { email: { in: [email, e2] } } }), 2);
  });

  it("validation + mass assignment: weak password, bad e-mail, one-word name, unknown keys (roles, phone, status, isActive) are refused", async () => {
    for (const bad of [{ password: "short1" }, { password: "onlyletters" }, { email: "not-an-email" }, { fullName: "علی" }, { fullName: "" }, { roles: ["super_admin"] }, { role: "admin" }, { phone: "09120000009" }, { isActive: true }, { userId: "x" }])
      assert.equal((await reg(new Client(), bad)).status, 422, JSON.stringify(bad));
    assert.equal((await new Client().post("/api/auth/register", { email: mail(), password: PASS })).status, 422);
    const email = mail(); ok(await reg(new Client(), { email }));
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } }, wholesaleProfile: true } });
    assert.ok(!u.roles.some((r) => r.role.isStaff || r.role.key === "wholesale_partner")); assert.equal(u.wholesaleProfile, null);
  });

  it("security: CSRF (cross-origin) is refused and registration is rate limited per IP", async () => {
    assert.equal((await new Client().post("/api/auth/register", { fullName: "علی رضایی", email: mail(), password: PASS }, { origin: "https://evil.example" })).status, 403);
    const c = new Client(); let last = 0;
    for (let i = 0; i < 11; i++) last = (await reg(c)).status;
    assert.equal(last, 429);
  });

  it("phone-code sign-in no longer creates accounts: unknown numbers get no SMS and cannot log in; existing accounts still can", async () => {
    const ghost = newPhone(); const before = await db.otpCode.count({ where: { phone: ghost } });
    assert.equal((await new Client().post("/api/auth/otp/request", { phone: ghost })).status, 200); // same answer as for a real number
    assert.equal(await db.otpCode.count({ where: { phone: ghost } }), before);
    await plantOtp(ghost, "login", "4321");
    assert.equal((await new Client().post("/api/auth/otp/verify", { phone: ghost, code: "4321" })).status, 400);
    assert.equal(await db.user.count({ where: { phone: ghost } }), 0);
    const real = await seedUser(); await plantOtp(real.phone!, "login", "4321");
    ok(await new Client().post("/api/auth/otp/verify", { phone: real.phone, code: "4321" }));
  });

  it("e-mail accounts have no phone: orders/notifications/admin lists keep working (sms delivery is skipped, not failed)", async () => {
    const c = new Client(); const email = mail(); ok(await reg(c, { email }));
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    const list = ok(await admin.get(`/api/admin/customers?q=${encodeURIComponent(email)}`)); assert.ok(list.items.some((i: any) => i.id === u.id && i.phone === null));
    assert.equal((await admin.get(`/admin/customers/${u.id}`)).status, 200);
    assert.equal((await c.get("/account/orders")).status, 200);
  });
});

describe("Phase 8 — partner registration", () => {
  before(async () => { await db.rateLimit.deleteMany({}); });

  it("visitor registers as partner with no OTP: user + PENDING application are created, session starts, NO wholesale access yet", async () => {
    const c = new Client(); const email = mail(); const b = biz({ instagram: "shop_ig", website: "shop.ir", businessType: "instagram_shop", description: "معرفی" });
    const otpBefore = await db.otpCode.count();
    const r = ok(await preg(c, { email, ...b })); assert.equal(r.createdAccount, true);
    assert.ok(c.jar.has("cl_session")); assert.equal(await db.otpCode.count(), otpBefore);
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } }, wholesaleProfile: true } });
    assert.equal(u.phone, null, "the contact number is stored on the application only"); assert.equal(u.wholesaleProfile, null); assert.deepEqual(u.roles.map((x) => x.role.key), ["customer"]);
    const a = await db.wholesaleApplication.findFirstOrThrow({ where: { userId: u.id } });
    assert.equal(a.status, "PENDING"); assert.equal(a.email, email); assert.equal(a.phone, b.phone); assert.equal(a.province, "تهران"); assert.equal(a.businessType, "instagram_shop"); assert.equal(a.instagram, "shop_ig"); assert.equal(a.storeName, b.storeName);
    const me = ok(await c.get("/api/me")); assert.equal(me.wholesale ?? null, null); assert.ok(!me.roles.includes("wholesale_partner"));
    assert.ok((await c.get("/account/wholesale")).text.includes("در حال بررسی"));
  });

  it("wholesale prices stay hidden until approval (partner overview is empty, server-side)", async () => {
    const c = new Client(); ok(await preg(c));
    const ov = ok(await c.get("/api/wholesale/overview")); assert.equal(ov.tier, null); assert.equal(ov.prices, undefined);
  });

  it("validation: required fields, physical store needs an address, bad phone/website, unknown keys (status, roles, userId) refused", async () => {
    const c = () => new Client();
    for (const bad of [{ storeName: "" }, { phone: "123" }, { province: "" }, { city: "" }, { businessType: "bank" }, { businessType: "physical_store" }, { website: "not a url" }, { status: "APPROVED" }, { roles: ["wholesale_partner"] }, { userId: "x" }, { tierId: "x" }, { password: "abc" }, { fullName: "سارا" }])
      assert.equal((await preg(c(), bad)).status, 422, JSON.stringify(bad));
    ok(await preg(c(), { businessType: "physical_store", address: "تهران، خیابان ولیعصر، پلاک ۱۰" }));
    const noAddr = await preg(c(), { businessType: "physical_store", address: "" }); assert.equal(noAddr.status, 422); assert.ok(noAddr.json.error.fields.address);
  });

  it("existing e-mail: no new user, clear message with a sign-in hint; nothing is attached to someone else's account", async () => {
    const email = mail(); ok(await reg(new Client(), { email }));
    const users = await db.user.count(), apps = await db.wholesaleApplication.count();
    const r = await preg(new Client(), { email }); assert.equal(r.status, 409); assert.equal(code(r), "email_taken");
    assert.equal(await db.user.count(), users); assert.equal(await db.wholesaleApplication.count(), apps);
  });

  it("an existing customer applies from the account: SAME user, no new account, PENDING; a second open application is refused; user cannot self-activate wholesale", async () => {
    const c = new Client(); const email = mail(); ok(await reg(c, { email }));
    const u = await db.user.findUniqueOrThrow({ where: { email } }); const users = await db.user.count();
    const b = biz(); const r = ok(await c.post("/api/wholesale/apply", b)); assert.equal(r.createdAccount, false);
    assert.equal(await db.user.count(), users);
    const a = await db.wholesaleApplication.findUniqueOrThrow({ where: { id: r.id } }); assert.equal(a.userId, u.id); assert.equal(a.status, "PENDING"); assert.equal(a.email, email); assert.equal(a.phone, b.phone);
    assert.equal((await c.post("/api/wholesale/apply", biz())).status, 409);
    for (const evil of [{ status: "APPROVED" }, { roles: ["wholesale_partner"] }, { userId: "someone" }]) assert.equal((await c.post("/api/wholesale/apply", { ...biz(), ...evil })).status, 422);
    assert.ok([401, 403].includes((await c.post(`/api/admin/wholesale/${r.id}/approve`, { tierId: "x" })).status));
    assert.ok([401, 403, 404, 405].includes((await c.patch(`/api/admin/wholesale/${r.id}`, { status: "APPROVED" })).status));
    assert.equal(await db.wholesaleProfile.count({ where: { userId: u.id } }), 0);
    const me = ok(await c.get("/api/me")); assert.ok(!me.roles.includes("wholesale_partner"));
    assert.equal((await new Client().post("/api/wholesale/apply", biz())).status, 401);
  });

  it("a legacy customer with a phone applies without re-typing it (falls back to the account phone)", async () => {
    const u = await seedUser(); await db.user.update({ where: { id: u.id }, data: { passwordHash: (await db.user.findFirstOrThrow({ where: { email: { not: null }, passwordHash: { not: null } } })).passwordHash } });
    const c = new Client(); await plantOtp(u.phone!, "login"); ok(await c.post("/api/auth/otp/verify", { phone: u.phone, code: "4321" }));
    const { phone, ...rest } = biz(); void phone;
    const r = ok(await c.post("/api/wholesale/apply", rest)); assert.equal((await db.wholesaleApplication.findUniqueOrThrow({ where: { id: r.id } })).phone, u.phone);
  });

  it("admin sees the applicant's details, approves (tier) → user becomes wholesale partner; reject leaves them a customer", async () => {
    const admin = await loginWithPassword("09120000001", "Admin@12345");
    const c = new Client(); const email = mail(); const b = biz({ storeName: "فروشگاه تأیید " + uid() });
    const reg1 = ok(await preg(c, { email, ...b })); 
    const list = ok(await admin.get(`/api/admin/wholesale?status=PENDING&q=${encodeURIComponent(email)}`));
    const row = list.items.find((i: any) => i.id === reg1.id); assert.ok(row); assert.equal(row.email, email); assert.equal(row.province, "تهران"); assert.equal(row.phone, b.phone);
    const tier = await db.wholesaleTier.findFirstOrThrow({ where: { isActive: true } });
    ok(await admin.post(`/api/admin/wholesale/${reg1.id}/approve`, { tierId: tier.id, note: "خوش آمدید" }));
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } }, wholesaleProfile: true } });
    assert.ok(u.roles.some((r) => r.role.key === "wholesale_partner")); assert.equal(u.wholesaleProfile?.tierId, tier.id); assert.equal(u.wholesaleProfile?.storeName, b.storeName);
    assert.equal((await db.wholesaleApplication.findUniqueOrThrow({ where: { id: reg1.id } })).status, "APPROVED");
    const me = ok(await c.get("/api/me")); assert.ok(me.roles.includes("wholesale_partner")); assert.ok(me.wholesale);
    assert.ok((await db.notification.findMany({ where: { userId: u.id } })).some((n) => n.event === "wholesale_approved"));
    assert.equal((await admin.post(`/api/admin/wholesale/${reg1.id}/approve`, { tierId: tier.id })).status, 409);
    // reject
    const c2 = new Client(); const e2 = mail(); const r2 = ok(await preg(c2, { email: e2 }));
    ok(await admin.post(`/api/admin/wholesale/${r2.id}/reject`, { note: "مدارک ناکافی" }));
    const u2 = await db.user.findUniqueOrThrow({ where: { email: e2 }, include: { roles: { include: { role: true } } } });
    assert.ok(!u2.roles.some((r) => r.role.key === "wholesale_partner")); assert.equal((await db.wholesaleApplication.findUniqueOrThrow({ where: { id: r2.id } })).status, "REJECTED");
    assert.ok((await c2.get("/account/wholesale")).text.includes("رد شده"));
  });

  it("pages: /account offers e-mail registration (no OTP boxes by default) and /partner/register renders; signed-in users are redirected", async () => {
    const html = (await new Client().get("/account")).text;
    assert.ok(html.includes("ایمیل یا شماره موبایل")); assert.ok(html.includes("حساب ندارید؟ ثبت‌نام")); assert.ok(!html.includes("رقم 1"));
    const p = await new Client().get("/partner/register"); assert.equal(p.status, 200); assert.ok(p.text.includes("ثبت‌نام و درخواست همکاری"));
    const c = new Client(); ok(await reg(c)); const red = await c.get("/partner/register"); assert.equal(red.status, 307); assert.match(red.headers.get("location")!, /\/account\/wholesale/);
  });
});
