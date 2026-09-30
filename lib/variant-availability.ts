/**
 * Two-way model ↔ colour availability for the product page (pure, no server imports).
 * A variant is selectable only when it is active AND in stock; callers pass only active variants, stock is checked here.
 * Availability is always derived from the product's real variants — never from independent model/colour lists.
 */
export interface AvailVariant { id: string; modelId: string | null; colorId: string | null; brandId?: string | null; seriesId?: string | null; stock: number }
export interface AvailSel { model: string; color: string }
export interface AvailFilter { brand?: string; series?: string }

const buyable = (v: AvailVariant) => v.stock > 0;
/** Variants inside the current brand/series filter (the filter narrows which models are considered, nothing else). */
export const inFilter = (variants: AvailVariant[], f: AvailFilter = {}) => variants.filter((v) => (!f.brand || v.brandId === f.brand) && (!f.series || v.seriesId === f.series));

/** Models that can still be chosen given the current colour (or any colour when none is chosen). */
export function availableModels(variants: AvailVariant[], sel: AvailSel, f: AvailFilter = {}): Set<string> {
  const out = new Set<string>();
  for (const v of inFilter(variants, f)) if (v.modelId && buyable(v) && (!sel.color || v.colorId === sel.color)) out.add(v.modelId);
  return out;
}
/** Colours that can still be chosen given the current model (or any model when none is chosen). */
export function availableColors(variants: AvailVariant[], sel: AvailSel, f: AvailFilter = {}): Set<string> {
  const out = new Set<string>();
  for (const v of inFilter(variants, f)) if (v.colorId && buyable(v) && (!sel.model || v.modelId === sel.model)) out.add(v.colorId);
  return out;
}
/** The exact variant for a complete selection, or null when that combination does not exist / is not buyable. */
export function findVariant<T extends AvailVariant>(variants: T[], sel: AvailSel): T | null {
  const hasModel = variants.some((v) => v.modelId), hasColor = variants.some((v) => v.colorId);
  if ((hasModel && !sel.model) || (hasColor && !sel.color)) return null;
  return variants.find((v) => (!hasModel || v.modelId === sel.model) && (!hasColor || v.colorId === sel.color) && buyable(v)) ?? null;
}
/**
 * Applies a click on a model (or colour) and repairs the other side: if the new choice is incompatible with the current
 * other selection, that other selection is cleared so the user never sits in an impossible state. Clicking the chosen chip unselects it.
 */
export function choose(variants: AvailVariant[], sel: AvailSel, axis: "model" | "color", id: string, f: AvailFilter = {}): AvailSel {
  const next: AvailSel = { ...sel, [axis]: sel[axis] === id ? "" : id };
  const other = axis === "model" ? "color" : "model";
  if (next[axis] && next[other]) {
    const ok = (axis === "model" ? availableColors(variants, { model: next.model, color: "" }, f) : availableModels(variants, { model: "", color: next.color }, f)).has(next[other]);
    if (!ok) next[other] = "";
  }
  return next;
}
