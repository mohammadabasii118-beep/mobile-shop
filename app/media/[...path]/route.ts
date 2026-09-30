import { getPublicStorage } from "@/lib/server/storage/public";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" };
const HEADERS = { "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'", "cache-control": "public, max-age=31536000, immutable", "accept-ranges": "bytes" };

/** Serves only the public upload area (images/ and videos/). Receipts live in a different, private store. Video supports Range requests. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const key = (await params).path.join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const video = key.startsWith("videos/");
  if (!TYPES[ext] || !(key.startsWith("images/") || video)) return new Response("Not found", { status: 404 });
  const type = TYPES[ext]!;
  try {
    const range = req.headers.get("range");
    if (video && range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!m || (m[1] === "" && m[2] === "")) return new Response(null, { status: 416, headers: { ...HEADERS, "content-range": "bytes */0" } });
      const probe = await getPublicStorage().getRange(key, 0, 0);
      await probe.stream.cancel();
      const size = probe.size;
      const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
      const end = m[1] === "" ? size - 1 : m[2] === "" ? size - 1 : Number(m[2]);
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...HEADERS, "content-range": `bytes */${size}` } });
      const part = await getPublicStorage().getRange(key, start, end);
      return new Response(part.stream, { status: 206, headers: { ...HEADERS, "content-type": type, "content-length": String(part.end - part.start + 1), "content-range": `bytes ${part.start}-${part.end}/${part.size}` } });
    }
    const obj = video ? await getPublicStorage().getRange(key, 0) : await getPublicStorage().get(key); // videos stream from disk instead of being buffered
    return new Response(obj.stream, { headers: { ...HEADERS, "content-type": type, "content-length": String(obj.size) } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
