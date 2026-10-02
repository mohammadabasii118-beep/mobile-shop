import type { Category } from '@/types';

export const categories: Category[] = [
  { slug: 'cases', name: 'قاب گوشی', description: 'قاب‌های خاص برای تمام مدل‌ها', hue: '#8B5CF6' },
  { slug: 'screen-protectors', name: 'محافظ صفحه', description: 'گلس‌های فول‌چسب و آنتی‌استاتیک', hue: '#38BDF8' },
  { slug: 'chargers', name: 'شارژر', description: 'شارژرهای سریع و ایمن', hue: '#FB923C' },
  { slug: 'cables', name: 'کابل', description: 'کابل‌های مقاوم و پرسرعت', hue: '#EC4899' },
  { slug: 'power-banks', name: 'پاوربانک', description: 'انرژی همراه، همه‌جا', hue: '#22C55E' },
  { slug: 'accessories', name: 'لوازم جانبی', description: 'هولدر، پایه، مبدل و بیشتر', hue: '#FACC15' },
];

export const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
