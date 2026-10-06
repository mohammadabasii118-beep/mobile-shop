import { badRequest } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { customerReply, readForm } from "@/lib/server/support";

export const POST = route<{ params: Promise<{ number: string }> }>(async (req, { params }) => {
  const user = await requireUser();
  const n = Number((await params).number);
  if (!Number.isInteger(n)) throw badRequest("شماره تیکت نامعتبر است.");
  const { fields, files } = await readForm(req);
  return customerReply(user, n, fields, files);
});
