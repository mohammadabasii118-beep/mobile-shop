import type { NextConfig } from "next";

const https = (process.env.APP_URL ?? "").startsWith("https://");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Only when the site is served over HTTPS (APP_URL=https://…): tells browsers to never use plain HTTP again.
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];
const noIndex = { key: "X-Robots-Tag", value: "noindex, nofollow" };
const noStore = { key: "Cache-Control", value: "no-store" };
// Unversioned static scripts: short browser cache, long stale-while-revalidate, so repeat visits are instant.
const staticJs = { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    // Uploaded product/banner photos live under /media; they are resized and served as AVIF/WebP by the image optimizer.
    localPatterns: [{ pathname: "/media/**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536],
    imageSizes: [64, 96, 128, 192, 256, 384],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private areas and APIs are never indexed nor cached by shared caches.
      { source: "/admin/:path*", headers: [noIndex, noStore] },
      { source: "/account/:path*", headers: [noIndex, noStore] },
      { source: "/account", headers: [noIndex, noStore] },
      { source: "/checkout", headers: [noIndex, noStore] },
      { source: "/api/:path*", headers: [noIndex, noStore] },
      { source: "/catalog.json", headers: [noIndex] },
      { source: "/site.js", headers: [staticJs] },
      { source: "/shop.js", headers: [staticJs] },
      { source: "/blog.js", headers: [staticJs] },
    ];
  },
};

export default nextConfig;
