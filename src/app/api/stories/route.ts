import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { createManualStory, listStories } from "@/services/instagram";

export const GET = api(() => listStories());
export const POST = api(async ({ request }) => {
  const { label } = await parseBody(request, z.object({ label: z.string().min(1).max(40) }));
  return createManualStory(label);
}, { role: "editor" });
