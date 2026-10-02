import { z } from "zod";
import { getDb } from "@/database/store";
import { api, notFound, parseBody } from "@/lib/api";
import { aiReply } from "@/services/ai";
import { sendMessage } from "@/services/instagram";

const schema = z.object({ mode: z.enum(["manual", "ai"]), text: z.string().max(1000).optional() });

export const POST = api<{ id: string }>(async ({ request, params }) => {
  const body = await parseBody(request, schema);
  let conv;
  if (body.mode === "ai") {
    const c = getDb().conversations.find((x) => x.id === params.id);
    if (!c) throw notFound("Conversation");
    const last = [...c.messages].reverse().find((m) => m.from === "customer");
    conv = await sendMessage(params.id, "bot", (await aiReply(last?.text ?? "سلام")).text);
  } else {
    if (!body.text?.trim()) throw notFound("Message text");
    conv = await sendMessage(params.id, "admin", body.text.trim());
  }
  if (!conv) throw notFound("Conversation");
  return conv;
}, { role: "editor" });

export const PATCH = api<{ id: string }>(async ({ request, params }) => {
  const body = await parseBody(request, z.object({ important: z.boolean().optional(), read: z.boolean().optional() }));
  const c = getDb().conversations.find((x) => x.id === params.id);
  if (!c) throw notFound("Conversation");
  if (body.important !== undefined) c.important = body.important;
  if (body.read) c.unread = 0;
  return c;
}, { role: "editor" });
