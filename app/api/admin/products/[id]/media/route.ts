import { adminRoute } from "@/lib/server/admin/core";
import { listMedia, uploadMedia } from "@/lib/server/admin/media";
import { badRequest } from "@/lib/server/errors";
import { MAX_VIDEO_BYTES } from "@/lib/server/media-files";

type P = { id: string };
export const GET = adminRoute<P>("product.read", (_r, p) => listMedia(p.id));
export const POST = adminRoute<P>("product.write", async (req, p, a) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("فایل را انتخاب کنید.");
  const kind = form.get("type") === "VIDEO" ? "VIDEO" : "IMAGE";
  if (file.size > (kind === "VIDEO" ? MAX_VIDEO_BYTES : 8 * 1024 * 1024)) throw badRequest(kind === "VIDEO" ? "حجم ویدیو نباید بیشتر از ۲۵ مگابایت باشد." : "حجم تصویر نباید بیشتر از ۸ مگابایت باشد.", "upload_too_large");
  const str = (k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim().slice(0, 200) : null; };
  return uploadMedia(p.id, kind, file, { alt: str("alt"), caption: str("caption") }, a);
}, { maxBody: 28 * 1024 * 1024 });
