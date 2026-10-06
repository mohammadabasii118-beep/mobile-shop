import { getAttributes, getBrands, getCategories } from '@/lib/catalog';

export function loadEditorRefs() {
  const cats = getCategories(false);
  const depth = (id: number | null, d = 0): number => { const c = cats.find((x) => x.id === id); return c?.parent_id ? depth(c.parent_id, d + 1) : d; };
  const flat: { id: number; name: string; depth: number }[] = [];
  const walk = (parent: number | null, d: number) => { for (const c of cats.filter((x) => x.parent_id === parent)) { flat.push({ id: c.id, name: c.name, depth: d }); walk(c.id, d + 1); } };
  walk(null, 0);
  void depth;
  return {
    categories: flat,
    brands: getBrands(false).map((b) => ({ id: b.id, name: b.name })),
    attributes: getAttributes().map((a) => ({ id: a.id, slug: a.slug, name: a.name, type: a.type, parent_attribute_id: a.parent_attribute_id, terms: a.terms.map((t) => ({ id: t.id, slug: t.slug, name: t.name, value: t.value, parent_term_id: t.parent_term_id })) })),
  };
}
