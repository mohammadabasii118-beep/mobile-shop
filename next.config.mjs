/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Phase 10 hardening — plain, safe response headers that no real page in
  // this app relies on NOT having, plus a real Content-Security-Policy
  // (Phase 10 remaining item) built from an actual audit of this codebase's
  // resources, not a copy-pasted template:
  //   - script-src/style-src need 'unsafe-inline' because this app really
  //     does use a couple of hand-written inline <script> tags (the
  //     product JSON-LD in app/product/[slug]/page.tsx and the
  //     dark-mode-flash-prevention script in components/ThemeScript.tsx)
  //     and, throughout the UI, React inline `style={{...}}` attributes —
  //     a nonce-based CSP would be stricter but requires per-request nonce
  //     plumbing this project doesn't have yet; documented here rather than
  //     silently claimed as "strict".
  //   - img-src allows any https: host because next.config.mjs's own
  //     images.remotePatterns already allows any https hostname for
  //     product images (an admin can paste any real image URL) — the CSP
  //     can't be stricter than that without breaking real product images.
  //   - connect-src is 'self' only: the Zarinpal gateway calls happen
  //     server-side (lib/payment/zarinpal.ts, fetch from Node, never from
  //     the browser) and the browser only ever does a full top-level
  //     navigation to Zarinpal's own hosted page — not a fetch/XHR — so no
  //     external host needs to be allowed here.
  //   - frame-ancestors 'none' duplicates X-Frame-Options: DENY below in
  //     the modern CSP way; kept both for older-browser coverage.
  //
  // IMPORTANT — honestly stated per this project's testing rules: this
  // sandbox cannot run `next build`/`next dev` or load the site in a real
  // browser, so this CSP has been reasoned through from a full source-code
  // audit but has NOT been click-tested. Before relying on it in
  // production, the person deploying this app MUST: 1) run the site
  // locally with `npm run build && npm start`, 2) open the browser
  // DevTools Console, 3) click through every real page (home, category,
  // product detail, cart, checkout — including the card-transfer receipt
  // upload and Zarinpal redirect flow — account pages, and the full admin
  // panel including product image upload), and 4) confirm there are zero
  // "Refused to ... because it violates the following Content Security
  // Policy directive" errors. If any appear, they name the exact directive
  // to loosen (e.g. adding a specific host to img-src). See README §13.19.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // This storefront is never meant to be embedded in another
          // site's <iframe> (no partner-embed feature exists), so denying
          // framing outright closes a real clickjacking surface.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disables browser features this app never uses, so an XSS bug
          // elsewhere can't additionally reach the camera/mic/location.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};
export default nextConfig;
