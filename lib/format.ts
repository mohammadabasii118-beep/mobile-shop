/** تنها مرجع قالب‌بندی عدد/قیمت — DESIGN.md §3 */
const nf = new Intl.NumberFormat("fa-IR");
const nf1 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const formatNumber = (n: number) => nf.format(Math.round(n));
export const formatDecimal = (n: number) => nf1.format(n);

export function formatCompact(n: number) {
  if (n >= 1_000_000_000) return `${nf1.format(n / 1_000_000_000)} میلیارد`;
  if (n >= 1_000_000) return `${nf1.format(n / 1_000_000)} میلیون`;
  if (n >= 1_000) return `${nf.format(Math.round(n / 1_000))} هزار`;
  return nf.format(n);
}
