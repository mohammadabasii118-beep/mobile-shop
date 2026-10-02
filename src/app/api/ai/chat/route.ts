import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { aiReply } from "@/services/ai";

export const POST = api(async ({ request }) => {
  const { text } = await parseBody(request, z.object({ text: z.string().min(1).max(1000) }));
  return aiReply(text);
}, { limit: 30 });
