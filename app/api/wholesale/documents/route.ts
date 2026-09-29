import { badRequest } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { readForm } from "@/lib/server/support";
import { uploadDocument } from "@/lib/server/wholesale-portal";

// multipart: applicationId + one file
export const POST = route(async (req) => {
  const user = await requireUser();
  const { fields, files } = await readForm(req);
  if (!fields.applicationId || files.length !== 1) throw badRequest("یک فایل و شناسه درخواست لازم است.");
  return uploadDocument(user, fields.applicationId, files[0]!);
});
