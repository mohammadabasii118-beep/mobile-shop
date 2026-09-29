// Real, server-side image-type detection by file signature ("magic bytes"),
// independent of the browser-reported `file.type` or filename extension —
// both of which are trivially spoofable by a malicious client. Used for
// both the private bank-transfer receipts and general product/category
// image uploads.

export type DetectedImageType = "jpeg" | "png" | "webp" | "gif";

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // GIF: "GIF87a" or "GIF89a"
  const gifHeader = buffer.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return "gif";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const IMAGE_TYPE_EXTENSION: Record<DetectedImageType, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};
