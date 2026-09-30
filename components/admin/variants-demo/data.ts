/** Demo data for the variant-system prototype. Nothing here touches the database. */
export interface Val { id: string; label: string; brand?: string; series?: string; hex?: string; active: boolean }
export interface Attr { key: string; name: string; kind: "model" | "color" | "generic"; values: Val[] }

const M = (id: string, label: string, brand: string, series: string): Val => ({ id, label, brand, series, active: true });
const C = (id: string, label: string, hex: string): Val => ({ id, label, hex, active: true });
const G = (id: string, label: string): Val => ({ id, label, active: true });

export const MODELS: Val[] = [
  M("ip11", "iPhone 11", "Apple", "iPhone 11"), M("ip11p", "iPhone 11 Pro", "Apple", "iPhone 11"), M("ip11pm", "iPhone 11 Pro Max", "Apple", "iPhone 11"),
  M("ip12", "iPhone 12", "Apple", "iPhone 12"), M("ip12p", "iPhone 12 Pro", "Apple", "iPhone 12"), M("ip12pm", "iPhone 12 Pro Max", "Apple", "iPhone 12"),
  M("ip13", "iPhone 13", "Apple", "iPhone 13"), M("ip13p", "iPhone 13 Pro", "Apple", "iPhone 13"), M("ip13pm", "iPhone 13 Pro Max", "Apple", "iPhone 13"),
  M("ip14", "iPhone 14", "Apple", "iPhone 14"), M("ip14p", "iPhone 14 Pro", "Apple", "iPhone 14"), M("ip14pm", "iPhone 14 Pro Max", "Apple", "iPhone 14"),
  M("ip15", "iPhone 15", "Apple", "iPhone 15"), M("ip15p", "iPhone 15 Pro", "Apple", "iPhone 15"), M("ip15pm", "iPhone 15 Pro Max", "Apple", "iPhone 15"),
  M("ip16", "iPhone 16", "Apple", "iPhone 16"), M("ip16p", "iPhone 16 Pro", "Apple", "iPhone 16"), M("ip16pm", "iPhone 16 Pro Max", "Apple", "iPhone 16"),
  M("s23", "Galaxy S23", "Samsung", "Galaxy S"), M("s23u", "Galaxy S23 Ultra", "Samsung", "Galaxy S"), M("s24", "Galaxy S24", "Samsung", "Galaxy S"), M("s24u", "Galaxy S24 Ultra", "Samsung", "Galaxy S"), M("s25", "Galaxy S25", "Samsung", "Galaxy S"),
  M("a35", "Galaxy A35", "Samsung", "Galaxy A"), M("a55", "Galaxy A55", "Samsung", "Galaxy A"),
  M("x13", "Xiaomi 13", "Xiaomi", "Xiaomi"), M("x14", "Xiaomi 14", "Xiaomi", "Xiaomi"), M("x15", "Xiaomi 15", "Xiaomi", "Xiaomi"),
  M("rn13", "Redmi Note 13", "Xiaomi", "Redmi Note"), M("rn13p", "Redmi Note 13 Pro", "Xiaomi", "Redmi Note"), M("pf6", "Poco F6", "Xiaomi", "Poco"),
  M("px9", "Pixel 9", "Google", "Pixel"), M("px9p", "Pixel 9 Pro", "Google", "Pixel"),
];

export const COLORS: Val[] = [C("c-black", "مشکی", "#1f2937"), C("c-white", "سفید", "#f8fafc"), C("c-pink", "صورتی", "#f9a8d4"), C("c-green", "سبز", "#4ade80"), C("c-blue", "آبی", "#60a5fa"), C("c-purple", "بنفش", "#a78bfa")];

export const initialAttrs = (): Attr[] => [
  { key: "model", name: "مدل گوشی", kind: "model", values: MODELS.map((m) => ({ ...m })) },
  { key: "color", name: "رنگ", kind: "color", values: COLORS.map((c) => ({ ...c })) },
  { key: "material", name: "جنس", kind: "generic", values: [G("m-sil", "سیلیکونی"), G("m-tpu", "TPU"), G("m-leather", "چرمی"), G("m-hard", "پلی‌کربنات")] },
  { key: "type", name: "نوع قاب", kind: "generic", values: [G("t-mag", "مگ‌سیف"), G("t-card", "کارت‌خور"), G("t-clear", "شفاف"), G("t-armor", "ضدضربه")] },
  { key: "design", name: "طرح", kind: "generic", values: [G("d-leo", "لئوپارد"), G("d-flower", "گل‌دار"), G("d-plain", "ساده")] },
  { key: "size", name: "سایز", kind: "generic", values: [G("z-s", "کوچک"), G("z-m", "متوسط"), G("z-l", "بزرگ")] },
  { key: "storage", name: "حافظه", kind: "generic", values: [G("s-64", "۶۴ گیگ"), G("s-128", "۱۲۸ گیگ"), G("s-256", "۲۵۶ گیگ")] },
  { key: "version", name: "نسخه", kind: "generic", values: [G("v-std", "استاندارد"), G("v-plus", "پلاس")] },
];

export interface Variant { id: string; sel: Record<string, string>; sku: string; price: string; stock: number; active: boolean; image: boolean }
export interface AttrUse { enabled: boolean; variations: boolean; values: string[] }
export interface Product { type: "simple" | "variable"; name: string; basePrice: number; skuPrefix: string; simpleStock: number; use: Record<string, AttrUse>; variants: Variant[] }

export const vkey = (sel: Record<string, string>, keys: string[]) => keys.map((k) => sel[k] ?? "").join("|");

/** Cartesian product of the chosen values of the attributes used for variations. */
export function combos(attrs: Attr[], use: Record<string, AttrUse>): Record<string, string>[] {
  const used = attrs.filter((a) => use[a.key]?.enabled && use[a.key]!.variations && use[a.key]!.values.length);
  return used.reduce<Record<string, string>[]>((acc, a) => acc.flatMap((c) => use[a.key]!.values.map((v) => ({ ...c, [a.key]: v }))), [{}]).filter((c) => Object.keys(c).length);
}

export function initialProduct(): Product {
  const attrs = initialAttrs();
  const models = ["ip13", "ip13p", "ip13pm", "ip14", "ip14p", "ip14pm", "ip15", "ip15p", "ip15pm", "s24", "s24u", "x14"];
  const colors = ["c-black", "c-white", "c-pink", "c-green"];
  const use: Record<string, AttrUse> = { model: { enabled: true, variations: true, values: models }, color: { enabled: true, variations: true, values: colors } };
  const variants: Variant[] = combos(attrs, use).map((sel, i) => ({ id: "v" + i, sel, sku: `CF-2345-${i + 1}`, price: sel.model === "ip15p" || sel.model === "ip15pm" ? "728000" : "", stock: 3 + ((i * 7) % 18), active: true, image: sel.model === "ip15p" && sel.color === "c-black" }));
  const set = (model: string, color: string, patch: Partial<Variant>) => { const v = variants.find((x) => x.sel.model === model && x.sel.color === color); if (v) Object.assign(v, patch); };
  set("ip13p", "c-white", { active: false }); set("ip14", "c-white", { stock: 0 }); set("ip14", "c-pink", { active: false }); set("s24", "c-green", { active: false }); set("x14", "c-pink", { stock: 0 }); set("ip13", "c-green", { stock: 0 });
  return { type: "variable", name: "قاب Shiny Leopard AutoFocus (کد CF2345)", basePrice: 688000, skuPrefix: "CF-2345", simpleStock: 0, use, variants };
}
