import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/config/app";
import { verifySessionToken } from "@/lib/security/session";

// Next 16 "proxy" (formerly middleware): gate the whole panel behind the session cookie.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session && !pathname.startsWith("/login")) return NextResponse.redirect(new URL("/login", req.url));
  if (session && pathname.startsWith("/login")) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = {
  // API routes do their own auth (JSON 401); webhooks are verified by signature.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
