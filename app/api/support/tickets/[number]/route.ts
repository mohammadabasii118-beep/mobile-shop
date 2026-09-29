import { badRequest } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { customerClose, getMyTicket } from "@/lib/server/support";

type Ctx = { params: Promise<{ number: string }> };
const num = async (p: Ctx["params"]) => { const n = Number((await p).number); if (!Number.isInteger(n)) throw badRequest("شماره تیکت نامعتبر است."); return n; };
export const GET = route<Ctx>(async (_r, { params }) => getMyTicket(await requireUser(), await num(params)));
export const DELETE = route<Ctx>(async (_r, { params }) => customerClose(await requireUser(), await num(params))); // "close"
