import { NextResponse, type NextRequest } from "next/server";
import { searchSuggestions } from "@/lib/catalog";

/** Live-search endpoint: keeps the catalogue on the server instead of shipping it in the JS bundle. */
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  return NextResponse.json(searchSuggestions(q), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600", "X-Robots-Tag": "noindex" },
  });
}
