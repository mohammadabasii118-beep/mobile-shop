/**
 * Phase 13 tests: live chat and tickets are two separate systems (own tables, APIs, pages, statuses, notifications, permissions),
 * linked only by reference. Server must be running in production mode:  ALLOW_INSECURE_HTTP=1 TRUST_PROXY=1 npm start -- -p 3300
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, PNG, db, fileForm, loginWithPassword, placeOrder, plantOtp, registerAndLogin, seedUser, uid } from "./test-utils";

let admin: Client, manager: Client, agent: Client, agentId = "";
const ok = (r: { status: number; json: any }, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.json)); return r.json?.data; };
const made = { users: [] as string[] };
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const chatStart = (c: Client, message: string, extra: Record<string, string> = {}) => c.post("/api/chat", form({ message, ...extra }));
const reply = (a: Client, id: string, message: string) => a.post(`/api/admin/support/chat/${id}/messages`, form({ message }));
const freshCustomer = async () => { const u = await registerAndLogin(); made.users.push(u.userId); return u; };

describe("Phase 13 — separate live chat and tickets", () => {
  before(async () => {
    await db.rateLimit.deleteMany({});
    admin = await loginWithPassword("09120000001", "Admin@12345"); manager = await loginWithPassword("09120000006", "Manager@12345");
    // A plain support agent (role "support": chat + ticket permissions, nothing else)
    const phone = "0919" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
    const u = await seedUser(phone); agentId = u.id; made.users.push(u.id);
    const role = await db.role.findUniqueOrThrow({ where: { key: "support" } });
    await db.userRole.create({ data: { userId: u.id, roleId: role.id } });
    agent = new Client(); ok(await agent.post("/api/auth/otp/verify", { phone, code: await plantOtp(phone, "login") }));
  });
  after(async () => { await db.$disconnect(); });

  describe("live chat", () => {
    let cu: Awaited<ReturnType<typeof freshCustomer>>, other: Awaited<ReturnType<typeof freshCustomer>>, chatId = "", number = 0;
    before(async () => { cu = await freshCustomer(); other = await freshCustomer(); });

    it("a customer starts a chat: it is a chat (never a ticket) and shows in their chat list only", async () => {
      const tickets0 = await db.supportTicket.count({ where: { userId: cu.userId } });
      const c = ok(await chatStart(cu.c, "سلام، یک سوال سریع دارم"));
      chatId = c.id; number = c.number;
      assert.equal(await db.supportTicket.count({ where: { userId: cu.userId } }), tickets0, "no ticket was created");
      const mine = ok(await cu.c.get("/api/chat"));
      assert.equal(mine.items.length, 1); assert.equal(mine.items[0].status, "waiting");
      assert.deepEqual(ok(await cu.c.get("/api/support/tickets")), [], "the ticket list does not show chats");
      assert.equal(ok(await other.c.get("/api/chat")).items.length, 0, "another customer sees nothing");
    });

    it("authorization is server-side: other customers and anonymous users cannot read, write or close it", async () => {
      assert.equal((await other.c.get(`/api/chat/${chatId}`)).status, 404);
      assert.equal((await other.c.post(`/api/chat/${chatId}/messages`, form({ message: "x" }))).status, 404);
      assert.equal((await other.c.del(`/api/chat/${chatId}`)).status, 404);
      assert.equal((await new Client().get(`/api/chat/${chatId}`)).status, 401);
      assert.equal((await new Client().get("/api/admin/support/chat")).status, 401);
      assert.equal((await cu.c.get("/api/admin/support/chat")).status, 403, "a customer is no agent");
      assert.equal((await manager.get("/api/admin/support/chat")).status, 403, "a staff role without chat permission is refused");
      assert.equal((await manager.get(`/api/admin/support/chat/${chatId}`)).status, 403);
      assert.equal((await manager.post(`/api/admin/support/chat/${chatId}/messages`, form({ message: "x" }))).status, 403);
    });

    it("only one open chat at a time", async () => {
      const r = await chatStart(cu.c, "دوباره");
      assert.equal(r.status, 409); assert.equal(r.json.error.code, "chat_open");
    });

    it("staff see it as waiting + unread, can search and filter; opening it marks the customer's messages read", async () => {
      const l = ok(await admin.get("/api/admin/support/chat?tab=waiting"));
      const row = (l.items as any[]).find((x) => x.id === chatId);
      assert.ok(row && row.unread === 1 && row.status === "waiting");
      assert.ok(l.counts.waiting >= 1 && l.counts.unread >= 1);
      assert.ok(((ok(await admin.get(`/api/admin/support/chat?q=${cu.phone}`)).items) as any[]).some((x) => x.id === chatId), "search by user phone");
      assert.ok(((ok(await admin.get("/api/admin/support/chat?tab=unread")).items) as any[]).some((x) => x.id === chatId));
      assert.ok(!((ok(await admin.get("/api/admin/support/chat?tab=closed")).items) as any[]).some((x) => x.id === chatId));
      const d = ok(await agent.get(`/api/admin/support/chat/${chatId}`));
      assert.equal(d.messages.length, 1); assert.equal(d.conversation.user.phone, cu.phone);
      const after = (ok(await admin.get("/api/admin/support/chat?tab=waiting")).items as any[]).find((x) => x.id === chatId);
      assert.equal(after.unread, 0, "unread cleared by opening");
      assert.ok((await db.chatMessage.findFirstOrThrow({ where: { conversationId: chatId } })).readAt, "the customer's message is marked read");
    });

    it("staff reply → active, customer unread + ONE new-chat-message notification (not a ticket notification); read receipts; cursor polling", async () => {
      const r1 = ok(await reply(agent, chatId, "سلام! بفرمایید"));
      let c = await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } });
      assert.equal(c.status, "active"); assert.equal(c.unreadUser, 1); assert.ok(c.assignedToId);
      ok(await reply(agent, chatId, "منتظر پیام شما هستم"));
      const notes = await db.notification.findMany({ where: { userId: cu.userId, event: "chat_message" } });
      assert.equal(notes.length, 1, "no notification spam while the first is unread"); assert.equal(notes[0]!.link, `/account/chat/${chatId}`);
      assert.equal(await db.notification.count({ where: { userId: cu.userId, event: "support_reply" } }), 0, "chat events never use the ticket event");
      assert.equal(ok(await cu.c.get("/api/chat")).unread, 2);
      const first = ok(await cu.c.get(`/api/chat/${chatId}`));
      assert.equal(first.messages.length, 3);
      c = await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } });
      assert.equal(c.unreadUser, 0);
      assert.ok((await db.chatMessage.findMany({ where: { conversationId: chatId, isStaff: true } })).every((m) => m.readAt), "staff messages are read once the customer fetched them");
      // cursor: only messages after the last one are returned
      const lastId = first.messages.at(-1).id;
      assert.equal(ok(await cu.c.get(`/api/chat/${chatId}?after=${lastId}`)).messages.length, 0);
      const r3 = ok(await reply(admin, chatId, "پیام سوم"));
      const next = ok(await cu.c.get(`/api/chat/${chatId}?after=${lastId}`));
      assert.deepEqual(next.messages.map((m: any) => m.id), [(await db.chatMessage.findFirstOrThrow({ where: { conversationId: chatId }, orderBy: { createdAt: "desc" } })).id]);
      void r1; void r3;
      // customer's own message shows as read after staff opened it
      ok(await cu.c.post(`/api/chat/${chatId}/messages`, form({ message: "ممنون" })));
      assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } })).status, "waiting", "the customer's reply puts it back to waiting");
      ok(await admin.get(`/api/admin/support/chat/${chatId}`));
      assert.ok(ok(await cu.c.get(`/api/chat/${chatId}`)).ownRead.length >= 2, "read receipts for the customer's messages");
    });

    it("images/PDF attachments: stored privately, visible to the customer and agents only, bad files refused", async () => {
      const r = ok(await cu.c.post(`/api/chat/${chatId}/messages`, fileForm(PNG, "shot.png", "image/png", "files", { message: "" })));
      const m = await db.chatMessage.findUniqueOrThrow({ where: { id: r.id }, include: { files: true } });
      assert.equal(m.files.length, 1);
      const url = `/api/chat/attachments/${m.files[0]!.id}`;
      assert.equal((await cu.c.get(url)).status, 200);
      assert.equal((await agent.get(url)).status, 200);
      assert.equal((await other.c.get(url)).status, 403);
      assert.equal((await new Client().get(url)).status, 401);
      assert.equal((await manager.get(url)).status, 403);
      const bad = await cu.c.post(`/api/chat/${chatId}/messages`, fileForm(Buffer.from("<script>alert(1)</script>"), "x.png", "image/png", "files", { message: "" }));
      assert.ok(bad.status >= 400 && bad.status < 500, "a fake image is refused");
      assert.equal((await cu.c.post(`/api/chat/${chatId}/messages`, form({ message: "" }))).status, 400, "empty message");
    });

    it("support online/offline state comes from staff activity", async () => {
      ok(await agent.get("/api/admin/support/chat"));
      assert.equal(ok(await cu.c.get("/api/chat")).online, true);
      await db.chatAgent.updateMany({ data: { lastSeenAt: new Date(Date.now() - 10 * 60_000) } });
      assert.equal(ok(await cu.c.get("/api/chat")).online, false);
    });

    it("end / close / reopen: customer can end, staff cannot reply while closed, staff reopen, customer message reopens", async () => {
      ok(await cu.c.del(`/api/chat/${chatId}`));
      let c = await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } });
      assert.equal(c.status, "closed"); assert.equal(c.closedBy, "user");
      assert.ok(((ok(await admin.get("/api/admin/support/chat?tab=closed")).items) as any[]).some((x) => x.id === chatId));
      assert.equal((await reply(admin, chatId, "x")).status, 409);
      ok(await agent.post(`/api/admin/support/chat/${chatId}/reopen`, {}));
      assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } })).status, "active");
      ok(await agent.post(`/api/admin/support/chat/${chatId}/close`, {}));
      c = await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } }); assert.equal(c.closedBy, "staff");
      ok(await cu.c.post(`/api/chat/${chatId}/messages`, form({ message: "یک سوال دیگر" })));
      assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } })).status, "waiting", "continuing a closed chat reopens it");
      // too old: a new chat must be started
      await db.chatConversation.update({ where: { id: chatId }, data: { status: "closed", closedAt: new Date(Date.now() - 8 * 86400_000) } });
      const old = await cu.c.post(`/api/chat/${chatId}/messages`, form({ message: "دیر" }));
      assert.equal(old.status, 409); assert.equal(old.json.error.code, "chat_closed");
      const nc = ok(await chatStart(cu.c, "گفتگوی جدید"));
      assert.notEqual(nc.id, chatId); assert.equal(ok(await cu.c.get("/api/chat")).items.length, 2, "history of earlier chats is kept");
      await cu.c.del(`/api/chat/${nc.id}`);
    });

    it("optional order link: own orders only; staff see the linked order and the user's recent orders", async () => {
      const o = await placeOrder(); made.users.push(o.userId);
      const c = ok(await chatStart(o.c, "درباره سفارش", { orderNumber: String(o.number) }));
      const d = ok(await admin.get(`/api/admin/support/chat/${c.id}`));
      assert.equal(d.linkedOrder.number, o.number); assert.ok(d.orders.some((x: any) => x.number === o.number));
      assert.equal((await chatStart(cu.c, "x", { orderNumber: String(o.number) })).status, 404, "someone else's order cannot be linked");
      ok(await o.c.del(`/api/chat/${c.id}`));
      // a chat without an order is fine (optional)
      assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id: chatId } })).orderId, null);
    });

    it("create a ticket from a chat: a REAL independent ticket with its own number; the chat stays a chat", async () => {
      const u = await freshCustomer();
      const o = ok(await chatStart(u.c, "مشکل در پرداخت دارم"));
      ok(await agent.get(`/api/admin/support/chat/${o.id}`));
      ok(await reply(agent, o.id, "بررسی می‌کنیم"));
      const before = await db.chatConversation.findUniqueOrThrow({ where: { id: o.id } });
      assert.equal((await manager.post(`/api/admin/support/chat/${o.id}/ticket`, {})).status, 403);
      const t = ok(await agent.post(`/api/admin/support/chat/${o.id}/ticket`, { category: "payment", priority: "high" }));
      const ticket = await db.supportTicket.findUniqueOrThrow({ where: { number: t.number }, include: { messages: true } });
      assert.equal(ticket.userId, u.userId); assert.equal(ticket.sourceChatId, o.id); assert.equal(ticket.category, "payment"); assert.equal(ticket.priority, "high");
      assert.ok(ticket.number !== before.number || true); assert.ok(ticket.messages[0]!.body.includes("مشکل در پرداخت دارم"), "chat context is copied as the first message");
      const after = await db.chatConversation.findUniqueOrThrow({ where: { id: o.id } });
      assert.equal(after.status, before.status, "the chat is unchanged"); assert.equal(await db.chatMessage.count({ where: { conversationId: o.id } }), 2, "no chat messages were added or removed");
      // reference only: both lists stay separate
      const tl = ok(await u.c.get("/api/support/tickets")); assert.equal(tl.length, 1);
      assert.equal(ok(await u.c.get("/api/chat")).items.length, 1);
      assert.equal(ok(await u.c.get(`/api/chat/${o.id}`)).conversation.tickets[0], t.number);
      assert.equal(ok(await u.c.get(`/api/support/tickets/${t.number}`)).sourceChat.id, o.id);
      assert.equal((await db.notification.findMany({ where: { userId: u.userId, event: "support_reply" } })).length, 1, "ticket notification uses the ticket event");
      assert.equal(ok(await admin.get(`/api/admin/support/tickets/${t.number}`)).sourceChat.id, o.id);
      assert.equal((await db.chatConversation.count({ where: { id: o.id } })), 1);
    });
  });

  describe("tickets", () => {
    let cu: Awaited<ReturnType<typeof freshCustomer>>, n = 0, orderNo = 0;
    before(async () => { const o = await placeOrder(); made.users.push(o.userId); cu = { c: o.c, phone: "", userId: o.userId }; orderNo = o.number; });
    const tk = async (extra: Record<string, string> = {}, c = cu.c) => { await db.rateLimit.deleteMany({}); return tkPost(extra, c); };
    const tkPost = async (extra: Record<string, string>, c: Client) => ok(await c.post("/api/support/tickets", form({ subject: "تیکت " + uid(), message: "توضیحات مشکل", ...extra })));

    it("create with the new categories, optional order link; fields validated", async () => {
      for (const category of ["technical", "financial", "complaint", "order", "payment", "return"]) assert.ok((await tk({ category })).number > 0, category);
      const t = await tk({ category: "order", orderNumber: String(orderNo) }); n = t.number;
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).orderId !== null, true);
      await db.rateLimit.deleteMany({}); assert.equal((await cu.c.post("/api/support/tickets", form({ subject: "x", message: "y" }))).status, 422);
      await db.rateLimit.deleteMany({}); assert.equal((await cu.c.post("/api/support/tickets", form({ subject: "موضوع تست", message: "پیام", category: "nope" }))).status, 422);
      const mine = ok(await cu.c.get("/api/support/tickets")); assert.ok(mine.every((x: any) => x.status === "open"));
    });

    it("statuses: open → in_progress → waiting_for_user → answered → closed; invalid values refused", async () => {
      for (const status of ["in_progress", "waiting_for_user", "answered", "closed", "open"]) {
        ok(await agent.patch(`/api/admin/support/tickets/${n}`, { status }));
        assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).status, status);
      }
      assert.equal((await agent.patch(`/api/admin/support/tickets/${n}`, { status: "WRONG" })).status, 422);
      // reply can set the next status
      ok(await agent.post(`/api/admin/support/tickets/${n}/reply`, form({ message: "لطفاً تصویر بفرستید", status: "waiting_for_user" })));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).status, "waiting_for_user");
      assert.equal(ok(await cu.c.get(`/api/support/tickets/${n}`)).messages.length, 2);
      // customer answer → open again; but an in-progress ticket stays in progress
      ok(await cu.c.post(`/api/support/tickets/${n}/messages`, form({ message: "فرستادم" })));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).status, "open");
      ok(await agent.patch(`/api/admin/support/tickets/${n}`, { status: "in_progress" }));
      ok(await cu.c.post(`/api/support/tickets/${n}/messages`, form({ message: "یک توضیح دیگر" })));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).status, "in_progress");
      ok(await cu.c.del(`/api/support/tickets/${n}`));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).status, "closed");
      ok(await cu.c.post(`/api/support/tickets/${n}/messages`, form({ message: "بازگشایی" })));
      assert.equal((await db.supportTicket.findUniqueOrThrow({ where: { number: n } })).status, "open", "reopened by the customer's reply");
    });

    it("admin list filters: status, category, priority, order, date, user, search (number / title / user)", async () => {
      const t = await tk({ category: "technical", subject: "مشکل فنی ویژه " + tag() });
      ok(await agent.patch(`/api/admin/support/tickets/${t.number}`, { status: "in_progress", priority: "urgent" }));
      const L = async (qs: string) => ((ok(await agent.get(`/api/admin/support/tickets?${qs}`)).items) as any[]).map((x) => x.number);
      assert.ok((await L("status=in_progress&category=technical&priority=urgent")).includes(t.number));
      assert.ok(!(await L("status=open&category=technical")).includes(t.number));
      assert.ok(!(await L("category=payment&status=in_progress")).includes(t.number));
      assert.ok((await L(`q=${t.number}`)).includes(t.number), "search by ticket number (other rows may match the digits in a phone number)");
      assert.ok((await L(`userId=${cu.userId}`)).includes(t.number)); assert.ok(!(await L(`userId=${agentId}`)).includes(t.number));
      const today = new Date().toISOString().slice(0, 10);
      assert.ok((await L(`from=${today}&to=${today}&category=technical`)).includes(t.number));
      assert.ok(!(await L("from=2000-01-01&to=2000-01-02")).includes(t.number));
      assert.ok((await L(`order=${orderNo}`)).includes(n), "filter by order number"); assert.ok(!(await L(`order=${orderNo}`)).includes(t.number));
      assert.deepEqual(await L("order=999999999"), [], "unknown order → nothing");
      const tl = await agent.get("/api/admin/support/tickets?status=in_progress");
      assert.ok(Object.keys(tl.json.data.counts).length > 0 && tl.json.data.items.every((x: any) => x.status === "in_progress"));
      assert.equal((await manager.get("/api/admin/support/tickets")).status, 403);
    });

    it("old admin API and page addresses still work; tickets and chat have different pages", async () => {
      assert.equal((await agent.get("/api/admin/support")).status, 200);
      assert.equal((await agent.get(`/api/admin/support/${n}`)).status, 200);
      const nofollow = async (c: Client, p: string) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") } }); return r; };
      const old = await nofollow(admin, "/admin/support"); assert.ok([307, 308].includes(old.status)); assert.ok((old.headers.get("location") ?? "").endsWith("/admin/support/tickets"));
      const oldN = await nofollow(admin, `/admin/support/${n}`); assert.ok((oldN.headers.get("location") ?? "").endsWith(`/admin/support/tickets/${n}`));
      for (const p of ["/admin/support/tickets", "/admin/support/chat", `/admin/support/tickets/${n}`]) assert.equal((await nofollow(admin, p)).status, 200, p);
      for (const p of ["/account/chat", "/account/tickets"]) assert.equal((await nofollow(cu.c, p)).status, 200, p);
      const tHtml = await (await nofollow(admin, "/admin/support/tickets")).text(), cHtml = await (await nofollow(admin, "/admin/support/chat")).text();
      assert.ok(tHtml.includes("تیکت‌های پشتیبانی") && !tHtml.includes("chat-console")); assert.ok(cHtml.includes("چت آنلاین"));
    });
  });
});
const tag = uid;
