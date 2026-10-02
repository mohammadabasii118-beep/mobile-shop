import { z } from "zod";
import { api, notFound, parseBody } from "@/lib/api";
import { replyToComment, setCommentStatus } from "@/services/instagram";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), text: z.string().min(1).max(1000) }),
  z.object({ action: z.literal("ignore") }),
  z.object({ action: z.literal("resolve") }),
]);

export const PATCH = api<{ id: string }>(async ({ request, params }) => {
  const body = await parseBody(request, schema);
  const c = body.action === "reply" ? await replyToComment(params.id, body.text) : setCommentStatus(params.id, body.action === "ignore" ? "ignored" : "resolved");
  if (!c) throw notFound("Comment");
  return c;
}, { role: "editor" });
