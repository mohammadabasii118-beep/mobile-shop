import { z } from "zod";
import { api, notFound, parseBody } from "@/lib/api";
import { runAutomation } from "@/services/automation";

export const POST = api(async ({ request }) => {
  const { id } = await parseBody(request, z.object({ id: z.string() }));
  const run = await runAutomation(id);
  if (!run) throw notFound("Automation");
  return run;
}, { role: "editor", limit: 30 });
