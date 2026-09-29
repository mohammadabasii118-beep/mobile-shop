import { getPublicStorage } from "@/lib/server/storage/public";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/** Serves only files from the public upload area (images). Receipts live in a different, private store. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const key = (await params).path.join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext] || !key.startsWith("images/")) return new Response("Not found", { status: 404 });
  try {
    const obj = await getPublicStorage().get(key);
    return new Response(obj.stream, { headers: { "content-type": TYPES[ext]!, "content-length": String(obj.size), "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
