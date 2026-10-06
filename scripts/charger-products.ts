export type ChargerProduct = {
  slug: string; name: string; brand: 'apple' | 'samsung'; cat: 'charger' | 'cable'; sku: string; price: number; img: string; stock: number;
  daysAgo: number; badge?: 'new'; short: string; desc: string; specs: [string, string][];
};

/** عکس‌ها در public/demo/chargers/<img>.jpg هستند. */
export const CHARGER_PRODUCTS: ChargerProduct[] = [
  { slug: 'apple-20w-charger', name: 'شارژر ۲۰ وات اصلی اپل', brand: 'apple', cat: 'charger', sku: 'APL-20', price: 1350000, img: 'apple-20w', stock: 12, daysAgo: 80,
    short: 'آداپتور رسمی ۲۰ وات USB-C با کلگی سه‌شاخ.', desc: 'شارژ سریع آیفون و آیپد.', specs: [['توان', '۲۰ وات'], ['پورت', 'USB-C']] },
  { slug: 'apple-40w-dynamic-charger', name: 'شارژر ۴۰ وات Dynamic اپل (تا ۶۰ وات)', brand: 'apple', cat: 'charger', sku: 'APL-40', price: 2150000, img: 'apple-40w', stock: 9, badge: 'new', daysAgo: 6,
    short: 'آداپتور USB-C با توان پویا تا ۶۰ وات.', desc: 'مناسب آیفون، آیپد و مک‌بوک ایر.', specs: [['توان', '۴۰ وات (حداکثر ۶۰)'], ['پورت', 'USB-C']] },
  { slug: 'apple-usbc-lightning-cable', name: 'کابل USB-C به Lightning اپل ۱ متر', brand: 'apple', cat: 'cable', sku: 'APL-CBL', price: 790000, img: 'apple-usbc-lightning', stock: 22, daysAgo: 20,
    short: 'کابل اصلی اپل برای شارژ سریع آیفون.', desc: 'پشتیبانی از شارژ سریع با آداپتور ۲۰ وات به بالا.', specs: [['طول', '۱ متر'], ['کانکتور', 'USB-C به Lightning']] },
  { slug: 'samsung-15w-charger-white', name: 'شارژر ۱۵ وات PD سامسونگ', brand: 'samsung', cat: 'charger', sku: 'SAM-15', price: 690000, img: 'samsung-15w-white', stock: 30, daysAgo: 25,
    short: 'آداپتور USB-C سفید با هولوگرام اصالت.', desc: 'مناسب گلکسی سری A و M.', specs: [['توان', '۱۵ وات'], ['رنگ', 'سفید']] },
  { slug: 'samsung-25w-charger-white', name: 'شارژر ۲۵ وات سامسونگ (سفید)', brand: 'samsung', cat: 'charger', sku: 'SAM-25W', price: 890000, img: 'samsung-25w-white', stock: 24, daysAgo: 15,
    short: 'شارژ سریع Super Fast Charging.', desc: 'شارژر اصلی سامسونگ با کلگی سه‌شاخ.', specs: [['توان', '۲۵ وات'], ['رنگ', 'سفید']] },
  { slug: 'samsung-25w-charger-black', name: 'شارژر ۲۵ وات سامسونگ (مشکی)', brand: 'samsung', cat: 'charger', sku: 'SAM-25B', price: 890000, img: 'samsung-25w-black', stock: 18, daysAgo: 14,
    short: 'شارژ سریع Super Fast Charging.', desc: 'شارژر اصلی سامسونگ با کلگی سه‌شاخ.', specs: [['توان', '۲۵ وات'], ['رنگ', 'مشکی']] },
  { slug: 'samsung-45w-charger-black', name: 'شارژر ۴۵ وات سامسونگ با کابل (مشکی)', brand: 'samsung', cat: 'charger', sku: 'SAM-45B', price: 1650000, img: 'samsung-45w-black', stock: 11, daysAgo: 10,
    short: 'همراه کابل USB-C ۵ آمپر، Low Standby.', desc: 'مناسب گلکسی S24 Ultra و تبلت‌های سامسونگ.', specs: [['توان', '۴۵ وات'], ['کابل', 'USB-C ۱٫۸ متر ۵A']] },
  { slug: 'samsung-45w-charger-white', name: 'شارژر ۴۵ وات سامسونگ با کابل (سفید)', brand: 'samsung', cat: 'charger', sku: 'SAM-45W', price: 1650000, img: 'samsung-45w-white', stock: 8, daysAgo: 9,
    short: 'همراه کابل USB-C ۵ آمپر، Low Standby.', desc: 'مناسب گلکسی S24 Ultra و تبلت‌های سامسونگ.', specs: [['توان', '۴۵ وات'], ['کابل', 'USB-C ۱٫۸ متر ۵A']] },
  { slug: 'samsung-60w-charger-black', name: 'شارژر ۶۰ وات سامسونگ (مشکی)', brand: 'samsung', cat: 'charger', sku: 'SAM-60', price: 2250000, img: 'samsung-60w-black', stock: 5, badge: 'new', daysAgo: 4,
    short: 'Low Standby؛ مناسب گوشی و تبلت.', desc: 'شارژر ۶۰ وات اصلی سامسونگ.', specs: [['توان', '۶۰ وات'], ['رنگ', 'مشکی']] },
];
