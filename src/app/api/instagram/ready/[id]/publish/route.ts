import { z } from "zod";
import { instagramMode } from "@/config/instagram";
import { api, HttpError, parseBody } from "@/lib/api";
import { publishReadyPost } from "@/services/instagram/publish-ready";

export const POST = api<{ id: string }>(async ({ request, params }) => {
  if (instagramMode() !== "unofficial") throw new HttpError(400, "Instagram publishing is not enabled");
  const { kinds } = await parseBody(request, z.object({ kinds: z.array(z.enum(["photo", "story"])).min(1) }));
  return publishReadyPost(params.id, kinds);
}, { role: "editor", limit: 10 });
