import { z } from "zod";
import { instagramMode } from "@/config/instagram";
import { api, HttpError, parseBody } from "@/lib/api";
import { logActivity } from "@/services/activity";
import { sidecarLogin } from "@/services/instagram/sidecar";

export const POST = api(async ({ request }) => {
  if (instagramMode() !== "unofficial") throw new HttpError(400, "Instagram publishing is not enabled");
  const { code } = await parseBody(request, z.object({ code: z.string().max(10).optional() }));
  await sidecarLogin(code);
  logActivity("instagram.connect", "success", "Instagram account connected");
  return { ok: true };
}, { role: "admin", limit: 10 });
