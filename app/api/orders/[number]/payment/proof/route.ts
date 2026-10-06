import { route } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth/guard";
import { submitReceipt } from "@/lib/server/payments/service";
import { MAX_RECEIPT_BYTES } from "@/lib/server/upload";
import { referenceSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ number: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const n = Number((await params).number);
  if (!Number.isInteger(n)) throw badRequest("شماره سفارش نامعتبر است.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_RECEIPT_BYTES + 200_000) throw badRequest("حجم فایل نباید بیشتر از ۵ مگابایت باشد.", "upload_too_large");
  const form = await req.formData();
  const file = form.get("receipt");
  if (!(file instanceof File)) throw badRequest("فایل رسید را انتخاب کنید.");
  const reference = referenceSchema.parse(String(form.get("referenceNumber") ?? ""));
  const buffer = Buffer.from(await file.arrayBuffer());
  return submitReceipt(user, n, reference, { name: file.name, type: file.type, size: file.size, buffer });
});
