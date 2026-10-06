/**
 * Phase 16 tests: manual creation of customers and admins (permissions, validation, temporary password, forced change, audit).
 * Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, db, loginWithPassword, newPhone, plantOtp, registerAndLogin, seedUser, uid } from "./test-utils";

let admin: Client, manager: Client, support: Client;
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const ADMIN_PASS = "Admin@12345";
const TEMP = "Temp#Pass-" + uid() + "9";
const made: string[] = [];
const email = () => `p16-${uid()}@example.com`;
const create = (c: Client, o: Record<string, unknown>) => c.post("/api/admin/customers", { kind: "customer", fullName: "کاربر دستی", password: TEMP, ...o });
const loginIdent = (identifier: string, password: string) => new Client().post("/api/auth/login", { identifier, password });
const track = <T extends { json: any }>(r: T): T => { if (r.json?.data?.id) made.push(r.json.data.id); return r; };

describe("Phase 16 — manual users and admins", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    await db.user.deleteMany({ where: { mustChangePassword: true } }); // leftovers of earlier (failed) runs of this suite
    admin = await loginWithPassword("09120000001", ADMIN_PASS); manager = await loginWithPassword("09120000006", "Manager@12345");
    const phone = newPhone(); const u = await seedUser(phone); made.push(u.id);
    await db.userRole.create({ data: { userId: u.id, roleId: (await db.role.findUniqueOrThrow({ where: { key: "support" } })).id } });
    support = new Client(); ok(await support.post("/api/auth/otp/verify", { phone, code: await plantOtp(phone, "login") }));
  });
  after(async () => { await db.user.deleteMany({ where: { id: { in: made } } }).catch(() => {}); await db.$disconnect(); });

  it("a customer is created by e-mail or phone: customer role only, hashed password, audited without the password", async () => {
    const e = email();
    const r = track(await create(admin, { email: e })); const id = ok(r).id;
    const u = await db.user.findUniqueOrThrow({ where: { id }, include: { roles: { include: { role: true } } } });
    assert.deepEqual(u.roles.map((x) => x.role.key), ["customer"]); assert.equal(u.email, e); assert.ok(u.passwordHash && u.passwordHash !== TEMP && u.passwordHash.startsWith("$2")); assert.equal(u.mustChangePassword, true); assert.equal(u.isActive, true);
    assert.ok(!JSON.stringify(r.json).includes(TEMP) && !JSON.stringify(r.json).includes("passwordHash"));
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "customer.create", entityId: id } });
    assert.ok(!JSON.stringify(log).includes(TEMP) && !JSON.stringify(log).includes("$2"), "no password material in the audit log");
    const ph = newPhone(); const r2 = track(await create(admin, { phone: ph, fullName: "علی تلفنی", isActive: false, mustChange: false })); const u2 = await db.user.findUniqueOrThrow({ where: { id: ok(r2).id } });
    assert.equal(u2.phone, ph); assert.equal(u2.isActive, false); assert.equal(u2.mustChangePassword, false);
    assert.equal((await loginIdent(e, TEMP)).status, 200, "the customer can sign in with the temporary password");
    assert.equal((await loginIdent(ph, TEMP)).status >= 400, true, "an inactive account cannot sign in");
  });

  it("validation and duplicates are enforced on the server", async () => {
    assert.equal((await create(admin, {})).status, 400, "needs e-mail or phone");
    assert.equal((await create(admin, { email: email(), password: "weak" })).status, 422);
    assert.equal((await create(admin, { email: "not-an-email" })).status, 422);
    assert.equal((await create(admin, { phone: "123" })).status, 422);
    assert.equal((await create(admin, { email: email(), fullName: "x" })).status, 422);
    assert.equal((await create(admin, { email: email(), role: "super_admin", roleKey: "super_admin" })).status, 422, "unknown keys are refused");
    const e = email(); track(await create(admin, { email: e }));
    const dup = await create(admin, { email: e.toUpperCase() }); assert.equal(dup.status, 409); assert.equal(dup.json.error.code, "email_taken");
    const ph = newPhone(); track(await create(admin, { phone: ph }));
    const dp = await create(admin, { phone: ph }); assert.equal(dp.status, 409); assert.equal(dp.json.error.code, "phone_taken");
  });

  it("authorization: only staff with the right permission; a customer kind can never take a staff role", async () => {
    assert.equal((await new Client().post("/api/admin/customers", { kind: "customer", fullName: "کاربر دستی", password: TEMP, email: email() })).status, 401);
    const c = await registerAndLogin(); made.push(c.userId);
    assert.equal((await create(c.c, { email: email() })).status, 403);
    assert.equal((await create(manager, { email: email() })).status, 403, "product manager has no customer.write");
    assert.equal((await create(support, { email: email() })).status, 403, "support can read customers, not create them");
    const sneaky = track(await create(admin, { email: email(), roleKey: "super_admin" }));
    const roles = await db.userRole.findMany({ where: { userId: ok(sneaky).id }, include: { role: true } });
    assert.deepEqual(roles.map((x) => x.role.key), ["customer"], "roleKey is ignored for customers");
  });

  it("an admin is created only by someone with role.manage, with e-mail, a staff role and the creator's own password", async () => {
    await db.rateLimit.deleteMany({});
    const e = email();
    const base = { kind: "admin", email: e, roleKey: "support", currentPassword: ADMIN_PASS };
    assert.equal((await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base, currentPassword: "wrong-Pass1" })).status, 400, "wrong confirmation password");
    assert.equal((await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base, currentPassword: undefined })).status, 400);
    assert.equal((await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base, email: undefined, phone: newPhone() })).status, 400, "admins need an e-mail");
    assert.equal((await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base, roleKey: undefined })).status, 400, "role required");
    assert.equal((await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base, roleKey: "customer" })).status, 409, "must be a staff role");
    assert.equal((await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base, roleKey: "nope" })).status, 409);
    for (const c of [manager, support]) assert.equal((await c.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base })).status, 403, "without role.manage");
    const r = track(await admin.post("/api/admin/customers", { fullName: "مدیر جدید", password: TEMP, ...base })); const id = ok(r).id;
    const u = await db.user.findUniqueOrThrow({ where: { id }, include: { roles: { include: { role: true } } } });
    assert.deepEqual(u.roles.map((x) => x.role.key), ["support"]); assert.equal(u.mustChangePassword, true);
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "admin.create", entityId: id } }); assert.ok(!JSON.stringify(log).includes(TEMP));
    // the role list the form shows carries permission labels
    const roles = ok(await admin.get("/api/admin/customers?roles=1")).roles as any[]; assert.ok(roles.find((x) => x.key === "support").permissions.length > 0);
  });

  it("an admin with a temporary password is locked out of the panel until the password is changed", async () => {
    const e = email();
    ok(track(await admin.post("/api/admin/customers", { kind: "admin", fullName: "مدیر موقت", password: TEMP, email: e, roleKey: "support", currentPassword: ADMIN_PASS })));
    const c = new Client(); ok(await c.post("/api/auth/login", { identifier: e, password: TEMP }));
    const blocked = await c.get("/api/admin/support/chat"); assert.equal(blocked.status, 403); assert.equal(blocked.json.error.code, "password_change_required");
    assert.equal((await c.get("/api/admin/customers")).status, 403);
    const nofollow = await fetch(BASE + "/admin", { redirect: "manual", headers: { cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
    assert.ok([307, 308].includes(nofollow.status) && (nofollow.headers.get("location") ?? "").includes("/account/edit"), "the panel page redirects to the password page");
    const acct = await (await fetch(BASE + "/account/edit", { headers: { cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") } })).text();
    assert.ok(acct.includes('data-testid="must-change"'), "the account page explains why");
    // the new password must differ in effect: change it → access opens
    assert.equal((await c.post("/api/account/password", { oldPassword: TEMP, newPassword: "short" })).status, 422);
    ok(await c.post("/api/account/password", { oldPassword: TEMP, newPassword: "Brand#New-Pass" + uid() + "7" }));
    assert.equal((await db.user.findUniqueOrThrow({ where: { email: e } })).mustChangePassword, false);
    assert.equal((await c.get("/api/admin/support/chat")).status, 200, "chat.read comes with the support role");
    assert.equal((await c.get("/api/admin/products")).status, 403, "and nothing beyond the role");
  });

  it("existing admins and customers are unaffected (flag defaults to false)", async () => {
    assert.equal((await admin.get("/api/admin/customers")).status, 200);
    assert.equal(await db.user.count({ where: { mustChangePassword: true, id: { notIn: made } } }), 0, "no pre-existing account was flagged");
    const c = await registerAndLogin(); made.push(c.userId); assert.equal((await c.c.get("/api/me")).status, 200);
  });
});
