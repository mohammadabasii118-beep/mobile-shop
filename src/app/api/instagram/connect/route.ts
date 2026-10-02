import { z } from "zod";
import { instagramMode } from "@/config/instagram";
import { api, HttpError, parseBody } from "@/lib/api";
import { logActivity } from "@/services/activity";
import { sidecarLogin } from "@/services/instagram/sidecar";

export const POST = api(async ({ request }) => {
  if (instagramMode() !== "unofficial") throw new HttpError(400, "Instagram publishing is not enabled");
  const { code } = await parseBody(request, z.object({ code: z.string().max(10).optional() }));
  const r = await sidecarLogin(code);
  logActivity("instagram.connect", "success", "Instagram account connected", String(r.username ?? ""));
  return { ok: true, username: r.username ?? null, followers: r.followers ?? null, posts: r.posts ?? null, dryRun: Boolean(r.dryRun) };
}, { role: "admin", limit: 10 });
