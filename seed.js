// داده‌های اولیه فروشگاه
const cats = [
  ['c-case', 'قاب و کاور موبایل', null, '📱'],
  ['c-samsung', 'سامسونگ', 'c-case', '📱'],
  ['c-xiaomi', 'شیائومی', 'c-case', '📱'],
  ['c-iphone', 'آیفون', 'c-case', '📱'],
  ['c-airpod', 'کاور ایرپاد', null, '🎧'],
  ['c-airpod1', 'ایرپاد ۱ و ۲ آیفون', 'c-airpod', '🎧'],
  ['c-airpod3', 'ایرپاد ۳ آیفون', 'c-airpod', '🎧'],
  ['c-airpodpro', 'ایرپاد پرو', 'c-airpod', '🎧'],
  ['c-airpodpro2', 'ایرپاد پرو ۲', 'c-airpod', '🎧'],
  ['c-airpodmax', 'ایرپاد مکس', 'c-airpod', '🎧'],
  ['c-charger', 'کابل و شارژر', null, '🔌'],
  ['c-electric', 'لوازم برقی', null, '⚡'],
  ['c-power', 'پاوربانک', 'c-electric', '🔋'],
  ['c-speaker', 'اسپیکر و هندزفری', 'c-electric', '🔊'],
  ['c-carcharger', 'شارژر فندکی', 'c-electric', '🚗'],
  ['c-acc', 'لوازم جانبی', null, '✨'],
  ['c-glass', 'گلس و محافظ صفحه', 'c-acc', '🛡️'],
  ['c-strap', 'بند و آویز', 'c-acc', '🔗'],
  ['c-holder', 'پایه و هولدر', 'c-acc', '📍'],
].map(([id, name, parent, icon], i) => ({ id, name, parent, icon, order: i }));

const colors = { name: 'رنگ', values: ['مشکی', 'سفید', 'آبی', 'صورتی', 'شفاف'] };
const p = (id, name, category, price, oldPrice, sold, options, stock = 30, desc = '') => ({
  id, name, category, price, oldPrice, sold, options, stock, images: [], active: true,
  desc: desc || 'کیفیت عالی، ارسال سریع و ضمانت اصالت کالا.', createdAt: Date.now(),
});

const products = [
  p('p1', 'کاور سیلیکونی آیفون ۱۵ پرو', 'c-iphone', 320000, 390000, 240,
    [colors, { name: 'مدل گوشی', values: ['آیفون ۱۵', 'آیفون ۱۵ پلاس', 'آیفون ۱۵ پرو', 'آیفون ۱۵ پرو مکس'] }]),
  p('p2', 'کاور شفاف ضد ضربه آیفون ۱۴', 'c-iphone', 250000, 0, 180,
    [{ name: 'مدل گوشی', values: ['آیفون ۱۴', 'آیفون ۱۴ پرو', 'آیفون ۱۳'] }]),
  p('p3', 'کاور مگ‌سیف آیفون', 'c-iphone', 480000, 560000, 95,
    [colors, { name: 'مدل گوشی', values: ['آیفون ۱۵', 'آیفون ۱۵ پرو'] }]),
  p('p4', 'کاور ژله‌ای سامسونگ گلکسی S24', 'c-samsung', 210000, 260000, 150,
    [{ name: 'رنگ', values: ['مشکی', 'شفاف', 'آبی'] }, { name: 'مدل گوشی', values: ['S24', 'S24 پلاس', 'S24 اولترا'] }]),
  p('p5', 'کاور ضد ضربه سامسونگ A54', 'c-samsung', 190000, 0, 120, [colors]),
  p('p6', 'کاور چرمی شیائومی نوت ۱۳', 'c-xiaomi', 230000, 280000, 130,
    [{ name: 'رنگ', values: ['مشکی', 'قهوه‌ای', 'آبی'] }, { name: 'مدل گوشی', values: ['نوت ۱۳', 'نوت ۱۳ پرو', 'پوکو X6'] }]),
  p('p7', 'کاور سیلیکونی شیائومی ردمی ۱۲', 'c-xiaomi', 150000, 0, 90, [colors]),
  p('p8', 'کاور ایرپاد پرو ۲ سیلیکونی', 'c-airpodpro2', 140000, 180000, 210, [colors]),
  p('p9', 'کاور ایرپاد ۳ طرح‌دار', 'c-airpod3', 120000, 0, 160, [{ name: 'طرح', values: ['گربه', 'ستاره', 'ساده'] }]),
  p('p10', 'کاور ایرپاد ۱ و ۲ با کارابین', 'c-airpod1', 90000, 110000, 140, [colors]),
  p('p11', 'کاور ایرپاد پرو با بند', 'c-airpodpro', 130000, 0, 100, [colors]),
  p('p12', 'کاور ایرپاد مکس', 'c-airpodmax', 350000, 420000, 40, [colors]),
  p('p13', 'کابل شارژ تایپ‌سی به لایتنینگ ۱ متر', 'c-charger', 180000, 220000, 300,
    [{ name: 'طول', values: ['۱ متر', '۲ متر'] }]),
  p('p14', 'شارژر دیواری ۲۰ وات فست شارژ', 'c-charger', 390000, 450000, 260, [{ name: 'رنگ', values: ['سفید', 'مشکی'] }]),
  p('p15', 'پاوربانک ۲۰۰۰۰ میلی‌آمپر', 'c-power', 950000, 1150000, 110, [{ name: 'رنگ', values: ['مشکی', 'سفید'] }]),
  p('p16', 'هندزفری بلوتوث', 'c-speaker', 780000, 0, 85, [colors]),
  p('p17', 'گلس تمام صفحه', 'c-glass', 80000, 100000, 500,
    [{ name: 'مدل گوشی', values: ['آیفون ۱۵', 'آیفون ۱۴', 'سامسونگ S24', 'شیائومی نوت ۱۳'] }]),
  p('p18', 'بند آویز موبایل رنگی', 'c-strap', 95000, 0, 190, [{ name: 'رنگ', values: ['صورتی', 'آبی', 'مشکی', 'رنگین‌کمانی'] }]),
  p('p19', 'آویز مچی سیلیکونی', 'c-strap', 70000, 90000, 170, [colors]),
  p('p20', 'پایه نگهدارنده موبایل خودرو', 'c-holder', 210000, 0, 75, []),
];

const banners = [
  { id: 'b1', title: 'کالکشن جدید کاور آیفون ۱۵', subtitle: 'طرح‌های مینیمال و مگ‌سیف با ۲۵٪ تخفیف', cta: 'مشاهده کاورها', link: '#/category/c-iphone', gradient: 'linear-gradient(135deg,#7c3aed,#ec4899)', icon: '📱' },
  { id: 'b2', title: 'کاور ایرپاد، رنگ‌بندی جدید', subtitle: 'مناسب همه مدل‌های ایرپاد آیفون', cta: 'خرید کاور ایرپاد', link: '#/category/c-airpod', gradient: 'linear-gradient(135deg,#0ea5e9,#6366f1)', icon: '🎧' },
  { id: 'b3', title: 'شارژر و کابل اورجینال', subtitle: 'فست شارژ با گارانتی تعویض', cta: 'مشاهده محصولات', link: '#/category/c-charger', gradient: 'linear-gradient(135deg,#f97316,#f43f5e)', icon: '🔌' },
  { id: 'b4', title: 'تخفیف ویژه هفته', subtitle: 'تا ۴۰٪ تخفیف روی لوازم جانبی', cta: 'دیدن تخفیف‌ها', link: '#/sale', gradient: 'linear-gradient(135deg,#10b981,#0ea5e9)', icon: '🔥' },
];

const settings = {
  shopName: 'موبایل‌شاپ',
  phone: '09120000000',
  cardNumber: '6037-9900-0000-0000',
  cardOwner: 'نام صاحب حساب',
  bankName: 'بانک ملی',
  zarinpalMerchant: '',
  zarinpalSandbox: true,
  shipping: 45000,
  freeShippingOver: 1500000,
  boxes: [
    { title: 'قاب و کاور موبایل', link: '#/category/c-case', icon: '📱', gradient: 'linear-gradient(135deg,#8b5cf6,#d946ef)' },
    { title: 'کاور ایرپاد', link: '#/category/c-airpod', icon: '🎧', gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)' },
    { title: 'کابل و شارژر', link: '#/category/c-charger', icon: '🔌', gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
    { title: 'لوازم جانبی', link: '#/category/c-acc', icon: '✨', gradient: 'linear-gradient(135deg,#10b981,#14b8a6)' },
  ],
  rail: [
    { title: 'کاور آیفون', link: '#/category/c-iphone', icon: '📱', gradient: 'linear-gradient(135deg,#a78bfa,#ec4899)' },
    { title: 'کاور اندروید', link: '#/category/c-samsung', icon: '🤖', gradient: 'linear-gradient(135deg,#34d399,#0ea5e9)' },
    { title: 'کاور بند و آویز', link: '#/category/c-strap', icon: '🔗', gradient: 'linear-gradient(135deg,#fbbf24,#f97316)' },
    { title: 'کاور ایرپاد', link: '#/category/c-airpod', icon: '🎧', gradient: 'linear-gradient(135deg,#60a5fa,#6366f1)' },
    { title: 'گلس', link: '#/category/c-glass', icon: '🛡️', gradient: 'linear-gradient(135deg,#2dd4bf,#22c55e)' },
    { title: 'پاوربانک', link: '#/category/c-power', icon: '🔋', gradient: 'linear-gradient(135deg,#fb7185,#f43f5e)' },
  ],
};

module.exports = () => ({ settings, categories: cats, products, banners, orders: [], adminHash: null });
