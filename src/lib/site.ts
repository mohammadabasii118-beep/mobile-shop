/** آدرس پایهٔ سایت — در محیط واقعی با NEXT_PUBLIC_SITE_URL تنظیم کنید. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://luxesell.example";

export const SITE_NAME = "لوکس‌سل";
