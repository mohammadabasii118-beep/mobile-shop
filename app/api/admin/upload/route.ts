import { randomUUID } from "node:crypto";
import { adminRoute, audit } from "@/lib/server/admin/core";
import { badRequest } from "@/lib/server/errors";
import { getPublicStorage } from "@/lib/server/storage/public";
import { MAX_IMAGE_BYTES, validateImage } from "@/lib/server/upload";

// Any staff role that manages something with images may upload; the file itself is validated by content.
const PERMS = ["product.write", "brand.write", "category.write", "phone.write", "banner.write", "settings.write", "blog.write", "homepage.write"];

export const POST = adminRoute(PERMS, async (req, _p, a) => {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 200_000) throw badRequest("حجم تصویر نباید بیشتر از ۴ مگابایت باشد.", "upload_too_large");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw badRequest("فایل را انتخاب کنید.");
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateImage(file, buf);
  const key = `images/${randomUUID()}.${v.ext}`;
  await getPublicStorage().put(key, buf);
  await audit(a, "image.upload", "image", key, undefined, { size: buf.length, mime: v.mime });
  return { url: `/media/${key}` };
});
