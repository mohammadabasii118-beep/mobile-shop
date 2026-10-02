const fa = new Intl.NumberFormat('fa-IR');

/** عدد فارسی با جداکننده هزارگان */
export const toFa = (n: number): string => fa.format(Math.round(n));

/** ۱٬۲۵۰٬۰۰۰ تومان */
export const formatPrice = (n: number): string => `${toFa(n)} تومان`;

export const faDate = (iso: string): string =>
  new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));

export const discountPercent = (price: number, old?: number): number =>
  old && old > price ? Math.round(((old - price) / old) * 100) : 0;
