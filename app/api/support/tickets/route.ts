import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { createTicket, listMyTickets, readForm } from "@/lib/server/support";

export const GET = route(async () => listMyTickets((await requireUser()).id));
export const POST = route(async (req) => {
  const user = await requireUser();
  const { fields, files } = await readForm(req);
  return createTicket(user, fields, files);
});
