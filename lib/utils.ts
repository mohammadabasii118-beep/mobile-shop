import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fa = new Intl.NumberFormat("fa-IR");
export const toFa = (n: number) => fa.format(n);
export const formatToman = (n: number) => `${fa.format(n)} تومان`;
