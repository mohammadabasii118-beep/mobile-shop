import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { closeMyChat, getMyChat } from "@/lib/server/chat";

type Ctx = { params: Promise<{ id: string }> };
export const GET = route<Ctx>(async (req, { params }) => getMyChat(await requireUser(), (await params).id, new URL(req.url).searchParams.get("after")));
export const DELETE = route<Ctx>(async (_r, { params }) => closeMyChat(await requireUser(), (await params).id)); // "end the conversation"
