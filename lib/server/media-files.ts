import sharp from "sharp";
import { badRequest } from "@/lib/server/errors";

export const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2000;
const MAX_INPUT_PIXELS = 40_000_000;

const IMAGE = {
  jpg: { mime: "image/jpeg", exts: ["jpg", "jpeg"] },
  png: { mime: "image/png", exts: ["png"] },
  webp: { mime: "image/webp", exts: ["webp"] },
} as const;

function sniffImage(b: Buffer): keyof typeof IMAGE | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

export interface ProcessedImage { data: Buffer; ext: string; mime: string; width: number; height: number; size: number }

/**
 * Admin product photo: size, extension, declared MIME and magic bytes must agree (SVG/GIF/PDF/executables are rejected),
 * then the image is decoded and re-encoded: EXIF/metadata stripped, orientation applied, longest edge capped at 2000 px.
 * A file that claims to be an image but cannot be decoded is rejected.
 */
export async function processImage(file: { name: string; type: string }, buf: Buffer): Promise<ProcessedImage> {
  if (buf.length === 0) throw badRequest("فایل خالی است.", "upload_empty");
  if (buf.length > MAX_IMAGE_INPUT_BYTES) throw badRequest("حجم تصویر نباید بیشتر از ۸ مگابایت باشد.", "upload_too_large");
  const kind = sniffImage(buf);
  if (!kind) throw badRequest("فقط تصویر JPG، PNG یا WebP مجاز است.", "upload_type");
  if (!(IMAGE[kind].exts as readonly string[]).includes(extOf(file.name))) throw badRequest("پسوند فایل با محتوای آن نمی‌خواند.", "upload_ext");
  if (file.type && file.type !== IMAGE[kind].mime && !(kind === "jpg" && file.type === "image/jpg")) throw badRequest("نوع فایل نامعتبر است.", "upload_mime");
  try {
    let pipe = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate().resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true });
    pipe = kind === "jpg" ? pipe.jpeg({ quality: 85, mozjpeg: true }) : kind === "png" ? pipe.png({ compressionLevel: 9 }) : pipe.webp({ quality: 85 });
    const { data, info } = await pipe.toBuffer({ resolveWithObject: true });
    return { data, ext: IMAGE[kind].exts[0], mime: IMAGE[kind].mime, width: info.width, height: info.height, size: data.length };
  } catch {
    throw badRequest("تصویر معتبر نیست یا قابل پردازش نیست.", "upload_corrupt");
  }
}

const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "MSNV", "f4v "]);

function sniffVideo(b: Buffer): "mp4" | "webm" | null {
  if (b.length < 32) return null;
  if (b.subarray(4, 8).toString("latin1") === "ftyp" && MP4_BRANDS.has(b.subarray(8, 12).toString("latin1"))) return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 && b.subarray(0, 64).includes(Buffer.from("webm"))) return "webm";
  return null;
}

export interface ValidVideo { ext: "mp4" | "webm"; mime: string; size: number }

/** Short product video: MP4 or WebM only; content signature, extension and declared MIME must agree; size-capped. Stored as-is (no transcoding). */
export function validateVideo(file: { name: string; type: string }, buf: Buffer): ValidVideo {
  if (buf.length === 0) throw badRequest("فایل خالی است.", "upload_empty");
  if (buf.length > MAX_VIDEO_BYTES) throw badRequest("حجم ویدیو نباید بیشتر از ۲۵ مگابایت باشد.", "upload_too_large");
  const kind = sniffVideo(buf);
  if (!kind) throw badRequest("فقط ویدیوی MP4 یا WebM مجاز است.", "upload_type");
  if (extOf(file.name) !== kind) throw badRequest("پسوند فایل با محتوای آن نمی‌خواند.", "upload_ext");
  const mime = kind === "mp4" ? "video/mp4" : "video/webm";
  if (file.type && file.type !== mime) throw badRequest("نوع فایل نامعتبر است.", "upload_mime");
  return { ext: kind, mime, size: buf.length };
}
