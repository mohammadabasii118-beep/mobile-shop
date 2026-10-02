import { formatToman } from "@/utils/format";
import type { Product } from "@/types";
import type { AIProvider, AIReply } from "../types";

const norm = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
const tokens = (s: string) => norm(s).split(/[\s\-‌،,.؟?!]+/).filter((t) => t.length > 1);

function matchProducts(text: string, products: Product[]) {
  const t = tokens(text);
  return products
    .map((p) => ({ p, score: tokens(`${p.name} ${p.category}`).filter((w) => t.includes(w) && !["قاب", "برای"].includes(w)).length + (t.includes("قاب") && p.category.startsWith("قاب") ? 0.5 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

/** Deterministic keyword assistant. Replace with OpenAIProvider implementing the same interface. */
export class MockAIProvider implements AIProvider {
  async generateCaption({ title, price, addHashtags }: { title: string; price?: number; addHashtags: boolean }) {
    const base = `✨ ${title}${price ? `\n💰 قیمت: ${formatToman(price)}` : ""}\n📦 ارسال فوری به سراسر ایران\n📩 برای سفارش دایرکت بدید`;
    return addHashtags ? `${base}\n\n#caseline #لوازم_جانبی_موبایل #قاب_موبایل #خرید_آنلاین` : base;
  }

  async reply({ text, products }: { text: string; products: Product[] }): Promise<AIReply> {
    const t = norm(text);
    const hits = matchProducts(text, products);
    const top = hits[0];
    const active = products.filter((p) => p.status === "active");

    if (/قیمت|چنده|چقدر|price/.test(t)) {
      if (top) return { intent: "price", confident: true, text: `سلام 🌹 قیمت ${top.name}: ${formatToman(top.price)} هست.` };
      const min = Math.min(...active.map((p) => p.price));
      return { intent: "price", confident: true, text: `قیمت مدل‌های موجود از ${new Intl.NumberFormat("en-US").format(min)} تومان شروع میشه. کدوم محصول رو می‌خواید؟` };
    }
    if (/موجود|دارید|هست/.test(t)) {
      if (top) {
        return top.stock > 0
          ? { intent: "availability", confident: true, text: `سلام 🌹 بله، ${top.name} موجود هست (${formatToman(top.price)}). برای سفارش بفرمایید.` }
          : { intent: "availability", confident: true, text: `متاسفانه ${top.name} فعلاً ناموجود هست. اگه بخواید موجود شد خبرتون می‌کنم.` };
      }
      return { intent: "unknown", confident: false, text: "ببخشید، منظورتون کدوم محصول هست؟ لطفاً مدل گوشی رو بفرمایید." };
    }
    if (/ارسال|پست|تحویل/.test(t)) return { intent: "shipping", confident: true, text: "سلام 🌹 ارسال به سراسر ایران داریم؛ تهران 1-2 روز و شهرستان 2-4 روز کاری." };
    if (/ساعت|کاری|باز/.test(t)) return { intent: "hours", confident: true, text: "ما هر روز از 10 صبح تا 10 شب پاسخگو هستیم 🌹" };
    if (/^(سلام|درود|hi|hello)/.test(t)) return { intent: "greeting", confident: true, text: "سلام 🌹 خوش اومدید! چطور می‌تونم کمک کنم؟" };
    return { intent: "unknown", confident: false, text: "ممنون از پیامتون 🌹 برای پاسخ دقیق‌تر، لطفاً بیشتر توضیح بدید." };
  }
}
