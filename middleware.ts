import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Paths a STAFF account may reach, and the permission each one requires.
// "/admin/security" needs none — it only ever touches the signed-in
// user's own 2FA setup, never anyone else's data. Everything else under
// /admin not listed here stays ADMIN-only, even for staff with some
// unrelated permission — this whitelist is intentionally short; extending
// staff access to another admin area means adding both the permission
// check in its server actions AND a line here, never one without the
// other (see README §13.18).
const STAFF_ALLOWED: { prefix: string; permission: string | null }[] = [
  { prefix: "/admin/security", permission: null },
  { prefix: "/admin/support", permission: "SUPPORT" },
  { prefix: "/admin/contact-messages", permission: "SUPPORT" },
  { prefix: "/admin/questions", permission: "SUPPORT" },
];

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";
    if (!isAdminRoute) return NextResponse.next();

    const token = req.nextauth.token as any;
    const role = token?.role;
    const permissions: string[] = Array.isArray(token?.permissions) ? token.permissions : [];

    if (role === "ADMIN") return NextResponse.next();

    if (role === "STAFF") {
      // A staff account visiting the dashboard root has no dashboard of
      // their own (that page shows store-wide analytics) — send them
      // straight to whichever allowed area they actually have.
      if (path === "/admin") {
        const first = STAFF_ALLOWED.find((a) => !a.permission || permissions.includes(a.permission));
        return NextResponse.redirect(new URL(first ? first.prefix : "/admin/login", req.url));
      }
      const allowed = STAFF_ALLOWED.some(
        (a) => path.startsWith(a.prefix) && (!a.permission || permissions.includes(a.permission))
      );
      if (allowed) return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/admin/login", req.url));
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/admin/login")) return true;
        if (path.startsWith("/admin")) return !!token;
        if (path.startsWith("/account")) return !!token;
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
