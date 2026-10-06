/**
 * منطق خالص (بدون وابستگی به دیتابیس) متغیرها؛ هم در سرور و هم در کلاینت استفاده می‌شود.
 */

export const ATTR = { brand: 'phone-brand', model: 'phone-model', color: 'color' } as const;

export type GenTerm = { id: number; slug: string; parent_term_id: number | null };
export type GenAttr = { id: number; slug: string; parent_attribute_id: number | null; terms: GenTerm[] };

/** مرتب‌سازی به‌طوری که ویژگی والد (برند) قبل از فرزند (مدل) بیاید */
function parentsFirst(list: GenAttr[]): GenAttr[] {
  const ids = new Set(list.map((a) => a.id));
  const out: GenAttr[] = [];
  const placed = new Set<number>();
  let guard = list.length + 2;
  while (out.length < list.length && guard-- > 0) {
    for (const a of list) {
      if (placed.has(a.id)) continue;
      if (!a.parent_attribute_id || !ids.has(a.parent_attribute_id) || placed.has(a.parent_attribute_id)) {
        out.push(a);
        placed.add(a.id);
      }
    }
  }
  for (const a of list) if (!placed.has(a.id)) out.push(a);
  return out;
}

/**
 * همه‌ی ترکیب‌های معتبر ویژگی‌ها.
 * اگر «مدل گوشی» والدی مثل «برند گوشی» داشته باشد، فقط مدل‌هایی که زیرمجموعه‌ی برند انتخابی‌اند ترکیب می‌شوند
 * (یعنی «Samsung × iPhone 15» ساخته نمی‌شود).
 */
export function generateCombos(list: GenAttr[]): Record<string, string>[] {
  type C = { attrs: Record<string, string>; picked: Map<number, number> };
  let combos: C[] = [{ attrs: {}, picked: new Map() }];
  for (const a of parentsFirst(list)) {
    const next: C[] = [];
    for (const c of combos) {
      const parentPick = a.parent_attribute_id ? c.picked.get(a.parent_attribute_id) : undefined;
      for (const t of a.terms) {
        if (parentPick !== undefined && t.parent_term_id !== null && t.parent_term_id !== parentPick) continue;
        const picked = new Map(c.picked);
        picked.set(a.id, t.id);
        next.push({ attrs: { ...c.attrs, [a.slug]: t.slug }, picked });
      }
    }
    combos = next;
  }
  // ترتیب کلیدها مطابق ترتیب ویژگی‌های محصول
  return combos.map((c) => {
    const o: Record<string, string> = {};
    for (const a of list) if (c.attrs[a.slug] !== undefined) o[a.slug] = c.attrs[a.slug];
    return o;
  });
}

export function attrsKey(attrs: Record<string, string>): string {
  return Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k]}`)
    .join('&');
}

export function effectivePrice(price: number, sale: number | null | undefined): number {
  return sale !== null && sale !== undefined && sale > 0 && sale < price ? sale : price;
}

export type SelVariation = { id: number; attrs: Record<string, string>; stock: number; status: string };

/** کدام گزینه‌ی ویژگی با انتخاب‌های فعلی ترکیب معتبر (و موجود) دارد؟ */
export function optionState(
  variations: SelVariation[],
  selected: Record<string, string | undefined>,
  attrSlug: string,
  termSlug: string,
): 'ok' | 'soldout' | 'unavailable' {
  const test = { ...selected, [attrSlug]: termSlug };
  const matches = variations.filter(
    (v) => v.status === 'active' && Object.entries(test).every(([k, val]) => val === undefined || v.attrs[k] === val),
  );
  if (!matches.length) return 'unavailable';
  return matches.some((v) => v.stock > 0) ? 'ok' : 'soldout';
}

export function findVariation<T extends SelVariation>(variations: T[], selected: Record<string, string | undefined>, slugs: string[]): T | undefined {
  if (slugs.some((s) => !selected[s])) return undefined;
  return variations.find((v) => v.status === 'active' && slugs.every((s) => v.attrs[s] === selected[s]));
}
