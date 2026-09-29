"use server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAdmin } from "./guard";
import { detectImageType, MAX_IMAGE_SIZE, IMAGE_TYPE_EXTENSION } from "@/lib/fileValidation";

export async function uploadImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "فایلی انتخاب نشده است" };
  if (file.size > MAX_IMAGE_SIZE) return { error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" };

  // Verify the real file type from its bytes, not the browser-reported
  // file.type or the filename extension.
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected) return { error: "فقط فایل تصویری معتبر (jpg, png, webp, gif) مجاز است" };

  const ext = IMAGE_TYPE_EXTENSION[detected];
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Saved directly on the server's disk under public/uploads, so it's served
  // as a normal static file at /uploads/<filename> with no extra service or
  // API key needed. On a VPS this persists as long as the folder isn't wiped;
  // back it up along with the database.
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return { url: `/uploads/${filename}` };
}
