import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/utils";
import { productSitemapCount } from "./product/sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/cart",
          "/search",
          "/vehicle",
          // faceted / sorted listing URLs: crawl budget protection (they are noindex + canonical anyway)
          "/*?*sort=",
          "/*?*price=",
          "/*?*stock=",
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, ...Array.from({ length: productSitemapCount() }, (_, i) => `${SITE_URL}/product/sitemap/${i}.xml`)],
    host: SITE_URL,
  };
}
