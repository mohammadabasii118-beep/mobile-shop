const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert any number/string to Persian digits. */
export function toFa(input: number | string): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Group thousands with the Persian thousands separator. */
export function groupThousands(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a price in Tomans with Persian digits, e.g. ۱٬۲۵۰٬۰۰۰ تومان. */
export function formatPrice(toman: number): string {
  return `${toFa(groupThousands(toman))} تومان`;
}

/** Percentage off, Persian. */
export function formatDiscount(percent: number): string {
  return `${toFa(percent)}٪`;
}
