import { resetDb } from "@/database/store";
import { api } from "@/lib/api";

export const POST = api(() => { resetDb(); return { ok: true }; }, { role: "admin", limit: 10 });
