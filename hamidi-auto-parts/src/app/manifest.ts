import type { MetadataRoute } from "next";
import { SHOP } from "@/lib/utils";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SHOP.nameFa} — ${SHOP.nameEn}`,
    short_name: SHOP.nameFa,
    description: SHOP.slogan,
    lang: "fa-IR",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b0b0d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
