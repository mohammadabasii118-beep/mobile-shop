import { z } from "zod";
import { api, notFound, parseBody } from "@/lib/api";
import { getAutomation, listExecutions, setAutomationStatus } from "@/services/automation";

export const GET = api<{ id: string }>(({ params }) => {
  const a = getAutomation(params.id);
  if (!a) throw notFound("Automation");
  return { automation: a, executions: listExecutions(a.id).slice(0, 10) };
});

export const PATCH = api<{ id: string }>(async ({ request, params }) => {
  const { status } = await parseBody(request, z.object({ status: z.enum(["active", "paused"]) }));
  const a = setAutomationStatus(params.id, status);
  if (!a) throw notFound("Automation");
  return a;
}, { role: "editor" });
