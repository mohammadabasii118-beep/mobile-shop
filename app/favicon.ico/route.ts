import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSiteInfo } from "@/lib/queries";

/** Browsers ask for /favicon.ico by default: send them to the icon set in admin (هویت سایت), else the built-in CaseLine icon. */
export async function GET() {
  const info = await getSiteInfo().catch(() => null);
  if (info?.favicon) return new Response(null, { status: 302, headers: { location: info.favicon, "cache-control": "public, max-age=300" } }); // relative Location: correct behind any reverse proxy
  const body = await readFile(path.join(process.cwd(), "public", "favicon-default.ico"));
  return new Response(body, { headers: { "content-type": "image/x-icon", "cache-control": "public, max-age=3600" } });
}
