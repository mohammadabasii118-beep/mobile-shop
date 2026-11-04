import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const faDigits = "۰۱۲۳۴۵۶۷۸۹";

/** Convert latin digits inside any string/number to Persian digits. */
export function toFa(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => faDigits[Number(d)]);
}

/** Normalise Persian/Arabic digits and letters so search works with any keyboard. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\-_\s]+/g, " ")
    .trim();
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export const SHOP = {
  nameFa: "فروشگاه حمیدی",
  nameEn: "HAMIDI AUTO PARTS",
  slogan: "مرجع تخصصی لوازم یدکی نیسان و هوندا",
  phone: "021-66712345",
  mobile: "09121234567",
  whatsapp: "989121234567",
  address: "تهران، خیابان امین‌السلطان (چراغ برق)، پاساژ ایرانیان، طبقه همکف، پلاک ۱۸",
  hours: "شنبه تا چهارشنبه ۹ تا ۱۹ — پنجشنبه ۹ تا ۱۴",
  email: "info@hamidiautoparts.ir",
  instagram: "hamidi.autoparts",
};

export function whatsappLink(text?: string) {
  const base = `https://wa.me/${SHOP.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
