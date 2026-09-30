import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fa = new Intl.NumberFormat("fa-IR");
export const toFa = (n: number) => fa.format(n);
export const formatToman = (n: number) => `${fa.format(n)} تومان`;

const faDate = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" });
/** Persian (Jalali) date, fixed to Tehran time so server and browser render the same text. */
export const formatDateFa = (d: string | Date) => faDate.format(new Date(d));
