import type { NextConfig } from "next";

// `npm run build:pages` exports a static copy for GitHub Pages (served under /mobile-shop).
const pages = process.env.PAGES === "1";

const nextConfig: NextConfig = pages
  ? { output: "export", basePath: "/mobile-shop", images: { unoptimized: true } }
  : {};

export default nextConfig;
