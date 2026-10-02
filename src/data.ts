import { Smartphone, BatteryCharging, Shield, Zap, Sparkles, Headphones, Cable, Gem } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Tile {
  label: string;
  icon: LucideIcon;
  from: string;
  to: string;
}

export const marqueeTiles: Tile[] = [
  { label: 'قاب گوشی', icon: Smartphone, from: '#18011F', to: '#B600A8' },
  { label: 'شارژر فست', icon: Zap, from: '#0b1d3a', to: '#2f7bff' },
  { label: 'پاوربانک', icon: BatteryCharging, from: '#06241c', to: '#10b981' },
  { label: 'گلس', icon: Shield, from: '#1f1235', to: '#7621B0' },
  { label: 'آویز موبایل', icon: Gem, from: '#2a0a12', to: '#ff4d6d' },
  { label: 'کابل', icon: Cable, from: '#2b1600', to: '#BE4C00' },
  { label: 'ایرباد', icon: Headphones, from: '#0d2530', to: '#22d3ee' },
  { label: 'مگ‌سیف', icon: Sparkles, from: '#241a00', to: '#facc15' },
  { label: 'قاب گوشی', icon: Smartphone, from: '#12122b', to: '#6366f1' },
  { label: 'شارژر فست', icon: Zap, from: '#2a0a2a', to: '#d946ef' },
  { label: 'پاوربانک', icon: BatteryCharging, from: '#2b1000', to: '#f97316' },
  { label: 'گلس', icon: Shield, from: '#06202a', to: '#06b6d4' },
  { label: 'آویز موبایل', icon: Gem, from: '#1b0a2b', to: '#a855f7' },
  { label: 'کابل', icon: Cable, from: '#0a2018', to: '#34d399' },
  { label: 'ایرباد', icon: Headphones, from: '#2a1010', to: '#f43f5e' },
  { label: 'مگ‌سیف', icon: Sparkles, from: '#101a2b', to: '#60a5fa' },
  { label: 'قاب گوشی', icon: Smartphone, from: '#24102a', to: '#e879f9' },
  { label: 'شارژر فست', icon: Zap, from: '#0f2a10', to: '#4ade80' },
  { label: 'پاوربانک', icon: BatteryCharging, from: '#2a2410', to: '#eab308' },
  { label: 'گلس', icon: Shield, from: '#101a2a', to: '#38bdf8' },
  { label: 'آویز موبایل', icon: Gem, from: '#2a1020', to: '#ec4899' },
];

export const categories = [
  { name: 'قاب گوشی', text: 'قاب‌های باریک، ضدضربه، شفاف و مگ‌سیف برای آیفون، سامسونگ، شیائومی و سایر برندها؛ محافظت کامل بدون حجم اضافه.' },
  { name: 'شارژر و کابل', text: 'شارژرهای فست، شارژر فندکی و کابل‌های روکش‌دار با استاندارد ایمنی برای همه دستگاه‌های شما.' },
  { name: 'پاوربانک', text: 'پاوربانک‌های جیبی و با ظرفیت بالا با شارژ سریع PD تا گوشی‌تان بیرون از خانه هیچ‌وقت خاموش نشود.' },
  { name: 'گلس محافظ صفحه', text: 'گلس‌های ۹H ضدخش و ضدلک انگشت، در مدل‌های معمولی و ضدجاسوسی، همراه با کیت نصب آسان.' },
  { name: 'آویز و اکسسوری', text: 'آویز، بند و اکسسوری‌های شیک برای گوشی؛ از مدل‌های ساده و مینیمال تا بامزه و فانتزی.' },
];

export interface Product {
  name: string;
  category: string;
  price: string;
  tiles: [Tile, Tile, Tile];
}

export const products: Product[] = [
  {
    name: 'قاب مگ‌سیف آئرو',
    category: 'قاب گوشی',
    price: '۲۴۹,۰۰۰ تومان',
    tiles: [
      { label: 'شفاف', icon: Smartphone, from: '#18011F', to: '#B600A8' },
      { label: 'ضدضربه', icon: Shield, from: '#1f1235', to: '#7621B0' },
      { label: 'مگ‌سیف', icon: Sparkles, from: '#2b1600', to: '#BE4C00' },
    ],
  },
  {
    name: 'پاوربانک ولت ۲۰۰۰۰',
    category: 'پاوربانک',
    price: '۸۹۰,۰۰۰ تومان',
    tiles: [
      { label: '۶۵ وات PD', icon: Zap, from: '#0b1d3a', to: '#2f7bff' },
      { label: '۲۰٬۰۰۰ میلی‌آمپر', icon: BatteryCharging, from: '#06241c', to: '#10b981' },
      { label: 'شارژ سریع', icon: BatteryCharging, from: '#2a0a2a', to: '#d946ef' },
    ],
  },
  {
    name: 'پک گلس کریستال 9H',
    category: 'گلس',
    price: '۱۲۰,۰۰۰ تومان',
    tiles: [
      { label: 'سختی ۹H', icon: Shield, from: '#06202a', to: '#06b6d4' },
      { label: 'ضدجاسوسی', icon: Shield, from: '#101a2a', to: '#38bdf8' },
      { label: 'نصب آسان', icon: Gem, from: '#2a1020', to: '#ec4899' },
    ],
  },
];
