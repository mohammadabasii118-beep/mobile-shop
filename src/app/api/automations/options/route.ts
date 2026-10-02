import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { updateOptions } from "@/services/automation";

const schema = z.object({
  publishPost: z.boolean(), publishStory: z.boolean(), publishReel: z.boolean(), copyCaption: z.boolean(),
  aiCaption: z.boolean(), addHashtags: z.boolean(), notifyAdmin: z.boolean(),
}).partial();

export const PATCH = api(async ({ request }) => updateOptions(await parseBody(request, schema)), { role: "editor" });
