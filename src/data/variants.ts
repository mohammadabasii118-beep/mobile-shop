import type { Product, Variant } from '@/types';

/** منطق واریانت‌ها: هر ترکیب مدل گوشی × رنگ یک SKU و موجودی جدا دارد. */
export const vKey = (model: string, color: string) => `${model}|${color}`;

export function buildVariants(p: Product, prev: Variant[] = [], seedStock = false): Variant[] {
  const old = new Map(prev.map((v) => [vKey(v.model, v.color.name), v]));
  const n = Math.max(1, p.models.length * p.colors.length);
  const base = Math.floor(p.stock / n);
  const out: Variant[] = [];
  let i = 0;
  p.models.forEach((m, mi) => p.colors.forEach((c, ci) => {
    const kept = old.get(vKey(m, c.name));
    // موجودی نمونه (دمو): بعضی ترکیب‌ها ناموجود یا کم‌موجودی‌اند
    const demo = p.stock <= 0 ? 0 : i % 5 === 3 ? 0 : i % 7 === 2 ? Math.min(3, base) : base + (i % 3) * 2;
    out.push(kept ?? { id: `${p.id}-${mi}-${ci}`, productId: p.id, model: m, color: c, sku: `${p.sku}-M${mi + 1}-C${ci + 1}`, stock: seedStock ? demo : 0, reserved: 0, active: true });
    i++;
  }));
  return out;
}

export const variantAvailable = (v: Variant) => (v.active ? Math.max(0, v.stock - v.reserved) : 0);
export const totalAvailable = (vs: Variant[]) => vs.reduce((s, v) => s + variantAvailable(v), 0);
export const variantPrice = (p: Product, v?: Variant) => v?.price ?? p.price;
