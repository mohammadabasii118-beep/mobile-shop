export type BrandId = "nissan" | "honda";

export interface VehicleModel {
  id: string;
  brand: BrandId;
  nameFa: string;
  nameEn: string;
  /** inclusive production range available in the catalogue */
  from: number;
  to: number;
  body?: string;
}

export interface Brand {
  id: BrandId;
  nameFa: string;
  nameEn: string;
  tagline: string;
  color: string;
}

export const BRANDS: Brand[] = [
  { id: "nissan", nameFa: "نیسان", nameEn: "NISSAN", tagline: "قطعات اصلی و OEM نیسان", color: "#c3002f" },
  { id: "honda", nameFa: "هوندا", nameEn: "HONDA", tagline: "قطعات هوندا از ۱۹۹۰ تا ۲۰۱۷", color: "#cc0000" },
];

/**
 * Catalogue of supported vehicles. Add / remove models here –
 * every selector, filter and brand page reads from this list.
 */
export const MODELS: VehicleModel[] = [
  // Nissan
  { id: "murano", brand: "nissan", nameFa: "مورانو", nameEn: "Murano", from: 2003, to: 2017, body: "SUV" },
  { id: "maxima", brand: "nissan", nameFa: "ماکسیما", nameEn: "Maxima", from: 1995, to: 2017, body: "سدان" },
  { id: "excel", brand: "nissan", nameFa: "اکسل", nameEn: "Excel", from: 2005, to: 2016, body: "سدان" },
  { id: "x-trail", brand: "nissan", nameFa: "ایکس‌تریل", nameEn: "X-Trail", from: 2001, to: 2017, body: "SUV" },
  { id: "juke", brand: "nissan", nameFa: "جوک", nameEn: "Juke", from: 2010, to: 2017, body: "کراس‌اوور" },
  { id: "teana", brand: "nissan", nameFa: "تیانا", nameEn: "Teana", from: 2003, to: 2017, body: "سدان" },
  // Honda 1990 – 2017
  { id: "accord", brand: "honda", nameFa: "آکورد", nameEn: "Accord", from: 1990, to: 2017, body: "سدان" },
  { id: "civic", brand: "honda", nameFa: "سیویک", nameEn: "Civic", from: 1990, to: 2017, body: "سدان / هاچبک" },
  { id: "cr-v", brand: "honda", nameFa: "سی‌آر‌وی", nameEn: "CR-V", from: 1995, to: 2017, body: "SUV" },
  { id: "city", brand: "honda", nameFa: "سیتی", nameEn: "City", from: 1996, to: 2017, body: "سدان" },
  { id: "jazz", brand: "honda", nameFa: "جاز / فیت", nameEn: "Jazz / Fit", from: 2001, to: 2017, body: "هاچبک" },
  { id: "odyssey", brand: "honda", nameFa: "اودیسه", nameEn: "Odyssey", from: 1994, to: 2017, body: "ون" },
  { id: "pilot", brand: "honda", nameFa: "پایلوت", nameEn: "Pilot", from: 2002, to: 2017, body: "SUV" },
  { id: "hr-v", brand: "honda", nameFa: "اچ‌آر‌وی", nameEn: "HR-V", from: 1998, to: 2017, body: "کراس‌اوور" },
  { id: "prelude", brand: "honda", nameFa: "پرلود", nameEn: "Prelude", from: 1990, to: 2001, body: "کوپه" },
  { id: "integra", brand: "honda", nameFa: "اینتگرا", nameEn: "Integra", from: 1990, to: 2006, body: "کوپه" },
  { id: "legend", brand: "honda", nameFa: "لجند", nameEn: "Legend", from: 1990, to: 2012, body: "سدان" },
  { id: "element", brand: "honda", nameFa: "المنت", nameEn: "Element", from: 2003, to: 2011, body: "SUV" },
  { id: "insight", brand: "honda", nameFa: "اینسایت", nameEn: "Insight", from: 1999, to: 2014, body: "هیبرید" },
  { id: "stream", brand: "honda", nameFa: "استریم", nameEn: "Stream", from: 2000, to: 2014, body: "ون" },
  { id: "crosstour", brand: "honda", nameFa: "کراس‌تور", nameEn: "Crosstour", from: 2010, to: 2015, body: "کراس‌اوور" },
  { id: "ridgeline", brand: "honda", nameFa: "ریج‌لاین", nameEn: "Ridgeline", from: 2006, to: 2017, body: "پیکاپ" },
  { id: "cr-z", brand: "honda", nameFa: "سی‌آر‌زد", nameEn: "CR-Z", from: 2010, to: 2016, body: "کوپه هیبرید" },
  { id: "s2000", brand: "honda", nameFa: "اس ۲۰۰۰", nameEn: "S2000", from: 1999, to: 2009, body: "رودستر" },
];

export const getBrand = (id: string) => BRANDS.find((b) => b.id === id);
export const getModel = (id: string) => MODELS.find((m) => m.id === id);
export const modelsOf = (brand: BrandId) => MODELS.filter((m) => m.brand === brand);

export function yearsOf(modelId: string): number[] {
  const m = getModel(modelId);
  if (!m) return [];
  const years: number[] = [];
  for (let y = m.to; y >= m.from; y--) years.push(y);
  return years;
}
