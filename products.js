// دسته‌بندی‌ها و محصولات (قیمت به تومان)
window.CATEGORIES = [
  { id: "cases", name: "قاب موبایل", icon: "📱", subs: [] },
  { id: "cables", name: "کابل و شارژر", icon: "🔌", subs: [
    { id: "cable", name: "کابل" }, { id: "charger", name: "شارژر و آداپتور" }, { id: "powerbank", name: "پاوربانک" } ] },
  { id: "accessories", name: "لوازم جانبی", icon: "🎧", subs: [
    { id: "glass", name: "گلس و محافظ صفحه" }, { id: "charm", name: "آویز" },
    { id: "strap", name: "بند و هولدر" }, { id: "other", name: "سایر" } ] }
];
window.PRODUCTS = [
  { id: 1, cat: "cases", name: "قاب سیلیکونی آیفون 15", price: 280000, emoji: "📱" },
  { id: 2, cat: "cases", name: "قاب ضدضربه سامسونگ S24", price: 350000, emoji: "🛡️" },
  { id: 3, cat: "cases", name: "قاب شفاف شیائومی Note 13", price: 190000, emoji: "📱" },
  { id: 4, cat: "cables", sub: "cable", name: "کابل تایپ‌سی به تایپ‌سی 1 متری", price: 150000, emoji: "🔌" },
  { id: 5, cat: "cables", sub: "cable", name: "کابل لایتنینگ اورجینال", price: 220000, emoji: "🔌" },
  { id: 6, cat: "cables", sub: "charger", name: "شارژر فست 33 وات", price: 420000, emoji: "⚡" },
  { id: 7, cat: "cables", sub: "charger", name: "شارژر دیواری 20 وات PD", price: 380000, emoji: "⚡" },
  { id: 8, cat: "cables", sub: "powerbank", name: "پاوربانک 10000 میلی‌آمپر", price: 750000, emoji: "🔋" },
  { id: 9, cat: "accessories", sub: "glass", name: "گلس تمام صفحه آیفون 15", price: 120000, emoji: "🪟" },
  { id: 10, cat: "accessories", sub: "glass", name: "گلس مات سامسونگ S24", price: 130000, emoji: "🪟" },
  { id: 11, cat: "accessories", sub: "charm", name: "آویز موبایل طرح خرس", price: 60000, emoji: "🧸" },
  { id: 12, cat: "accessories", sub: "strap", name: "بند گردنی موبایل", price: 85000, emoji: "🎀" },
  { id: 13, cat: "accessories", sub: "strap", name: "هولدر انگشتی پاپ‌سوکت", price: 70000, emoji: "💍" },
  { id: 14, cat: "accessories", sub: "other", name: "هولدر موبایل خودرو", price: 240000, emoji: "🚗" }
];
