import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { getAiSettings, updateAiSettings } from "@/services/ai";

const schema = z.object({
  enabled: z.boolean(), autoReply: z.boolean(),
  tones: z.array(z.enum(["friendly", "professional", "short", "sales", "persian"])).min(1),
  businessName: z.string().min(1), businessType: z.string().min(1), workingHours: z.string().min(1),
  rules: z.array(z.string().min(1)).max(30),
}).partial();

export const GET = api(() => getAiSettings());
export const PUT = api(async ({ request }) => updateAiSettings(await parseBody(request, schema)), { role: "admin" });
