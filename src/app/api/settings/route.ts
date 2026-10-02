import { z } from "zod";
import { getDb } from "@/database/store";
import { api, parseBody } from "@/lib/api";
import { maskSecret } from "@/lib/security/secrets";

function view() {
  const s = getDb().settings;
  // Tokens never leave the server in full.
  return {
    ...s,
    instagram: { ...s.instagram, accessToken: maskSecret(s.instagram.accessToken) },
    telegram: { ...s.telegram, botToken: maskSecret(s.telegram.botToken) },
  };
}

const schema = z.object({
  appName: z.string().min(1).max(40), demoMode: z.boolean(), language: z.string(), timezone: z.string(),
  notifyEmail: z.boolean(), notifyPush: z.boolean(), twoFactor: z.boolean(),
}).partial();

export const GET = api(() => view());
export const PATCH = api(async ({ request }) => {
  Object.assign(getDb().settings, await parseBody(request, schema));
  return view();
}, { role: "admin" });
