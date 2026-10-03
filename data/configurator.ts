export type PhoneId = "iphone-17-pro" | "iphone-17" | "galaxy-s26-ultra" | "pixel-10-pro";
export type MaterialId = "silicone" | "leather" | "clear" | "aluminum";
export type PatternId = "plain" | "carbon" | "stripes" | "dots";

/** ابعاد به‌واحد صحنه (≈ ۱ واحد = ۱۰ سانتی‌متر) */
export interface PhoneSpec {
  id: PhoneId;
  name: string;
  w: number;
  h: number;
  d: number;
  camera: "square" | "bar" | "column";
  basePrice: number;
}

export const phones: PhoneSpec[] = [
  { id: "iphone-17-pro", name: "iPhone 17 Pro", w: 0.78, h: 1.6, d: 0.1, camera: "square", basePrice: 1_290_000 },
  { id: "iphone-17", name: "iPhone 17", w: 0.76, h: 1.56, d: 0.1, camera: "square", basePrice: 1_190_000 },
  { id: "galaxy-s26-ultra", name: "Galaxy S26 Ultra", w: 0.8, h: 1.64, d: 0.1, camera: "column", basePrice: 1_390_000 },
  { id: "pixel-10-pro", name: "Pixel 10 Pro", w: 0.78, h: 1.62, d: 0.1, camera: "bar", basePrice: 1_290_000 },
];

export interface MaterialSpec {
  id: MaterialId;
  name: string;
  hint: string;
  surcharge: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
}

export const materials: MaterialSpec[] = [
  { id: "silicone", name: "سیلیکون", hint: "نرم و ضدلک", surcharge: 0, roughness: 0.6, metalness: 0, clearcoat: 0 },
  { id: "leather", name: "چرم", hint: "دوخت دستی", surcharge: 600_000, roughness: 0.88, metalness: 0, clearcoat: 0 },
  { id: "clear", name: "شفاف", hint: "رنگ خود گوشی", surcharge: 100_000, roughness: 0.1, metalness: 0, clearcoat: 1 },
  { id: "aluminum", name: "آلومینیوم", hint: "بدنهٔ فلزی", surcharge: 900_000, roughness: 0.28, metalness: 0.95, clearcoat: 0.3 },
];

export const patterns: { id: PatternId; name: string; surcharge: number }[] = [
  { id: "plain", name: "ساده", surcharge: 0 },
  { id: "carbon", name: "کربن", surcharge: 150_000 },
  { id: "stripes", name: "راه‌راه", surcharge: 100_000 },
  { id: "dots", name: "نقطه‌ای", surcharge: 100_000 },
];

export const caseColors = [
  { id: "midnight", name: "نیمه‌شب", hex: "#2b2d33" },
  { id: "sand", name: "ماسه", hex: "#cdbfa6" },
  { id: "sage", name: "مریم‌گلی", hex: "#9db39a" },
  { id: "coral", name: "مرجانی", hex: "#e8765d" },
  { id: "ocean", name: "اقیانوس", hex: "#3f6c8f" },
];
