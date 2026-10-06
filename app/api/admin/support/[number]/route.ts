import { adminRoute } from "@/lib/server/admin/core";
import { badRequest } from "@/lib/server/errors";
import { adminGetTicket, adminUpdateTicket } from "@/lib/server/support";

type P = { number: string };
const n = (p: P) => { if (!/^\d{1,9}$/.test(p.number)) throw badRequest("شماره تیکت نامعتبر است."); return Number(p.number); };
export const GET = adminRoute<P>(["support.read", "support.reply"], (_r, p) => adminGetTicket(n(p)));
export const PATCH = adminRoute<P>("support.reply", async (req, p, a) => adminUpdateTicket(n(p), await req.json().catch(() => ({})), a));
