import { adminRoute } from "@/lib/server/admin/core";
import { listRules, saveRule } from "@/lib/server/admin/pricing";

export const GET = adminRoute("pricing.read", () => listRules());
export const POST = adminRoute("pricing.write", async (req, _p, a) => saveRule(await req.json().catch(() => ({})), a));
