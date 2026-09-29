import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Star } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { BuyBox, HotBadge, StickyBar, Thumb } from "@/components/product-detail";
import { ProductVisual } from "@/components/product-visual";
import { allProducts, getProduct, kindLabel, productFaq, productReviews } from "@/lib/data";
import { formatToman, toFa } from "@/lib/utils";

export function generateStaticParams() {
  return allProducts.map((p) => ({ id: p.id }));
}

const rules: [string, string][] = [
  ["سازگاری:", "قبل از خرید مدل دقیق گوشی خود را انتخاب کنید؛ محصول فقط برای همان مدل ارسال می‌شود."],
  ["تفاوت رنگ:", "ممکن است رنگ محصول بسته به نمایشگر شما اندکی متفاوت دیده شود و این مورد مشمول مرجوعی نیست."],
  ["زمان ارسال:", "سفارش‌های تهران همان روز و شهرستان‌ها ۲ تا ۴ روز کاری ارسال می‌شود."],
  ["ضمانت:", "محصول ۷ روز ضمانت بازگشت دارد؛ به‌شرط باز نشدن بسته‌بندی یا آسیب ندیدن کالا."],
  ["خارج از ضمانت:", "آسیب فیزیکی، استفاده نادرست و بسته‌بندی آسیب‌دیده مشمول بازگشت وجه نمی‌شود."],
];

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProduct(id);
  if (!p) notFound();
  const title = `خرید ${p.name}${p.compat ? ` ${p.compat}` : ""} با ضمانت اصالت | ارسال فوری`;
  const related = allProducts.filter((x) => x.id !== p.id && x.kind === p.kind).slice(0, 3);
  const others = allProducts.filter((x) => x.id !== p.id).slice(0, 7);
  return (
    <>
      <Header />
      <main className="pt-6">
        <Container className="grid items-start gap-4 lg:grid-cols-[1fr_230px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
              <h1 className="text-lg font-black leading-9 sm:text-xl">{title}</h1>
              <p className="mt-1 text-xs text-muted">(دیدگاه کاربر {toFa(p.reviews > 100 ? 3 : 1)}) · <span className="inline-flex items-center gap-1"><Star className="size-3 fill-warning text-warning" />{toFa(p.rating)}</span></p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div className="relative mx-auto aspect-square w-full max-w-sm md:order-2">
                  <Thumb p={p} className="size-full rounded-[32px]" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 rounded-b-[32px] bg-black/85 py-4 text-white">
                    <span dir="ltr" className="text-2xl font-black tracking-wide">{p.brand}</span>
                    <span dir="ltr" className="text-[10px] font-bold tracking-[0.3em] text-accent">Caseline.ir</span>
                  </div>
                  <div className="absolute end-3 top-3"><HotBadge /></div>
                </div>
                <div className="md:order-1"><BuyBox p={p} /></div>
              </div>
              <p className="mt-5 text-sm text-muted">دسته‌بندی: <b className="text-foreground">{kindLabel[p.kind]}</b></p>
            </section>

            <div className="tabs">
              <input type="radio" name="tab" id="tab-desc" defaultChecked className="sr-only" />
              <input type="radio" name="tab" id="tab-faq" className="sr-only" />
              <input type="radio" name="tab" id="tab-rev" className="sr-only" />
              <div className="mx-auto mb-3 flex w-fit rounded-full border border-border bg-surface p-1 text-sm shadow-sm">
                {[["tab-desc", "توضیحات"], ["tab-faq", "سوالات متداول"], ["tab-rev", "نظرات کاربران"]].map(([f, l]) => <label key={f} htmlFor={f} className="tab-label cursor-pointer rounded-full px-4 py-2 text-muted">{l}</label>)}
              </div>
              <div className="rounded-xl border border-border bg-surface p-5 text-[13px] leading-8 shadow-sm sm:p-8">
                <div className="panel panel-desc space-y-4">
                  <p>با رشد سریع استفاده از موبایل، انتخاب لوازم جانبی درست اهمیت زیادی پیدا کرده است. <b className="text-primary">{p.name}</b> یکی از پرطرفدارترین گزینه‌ها برای <b>{p.compat ?? p.brand}</b> است و هم ظاهر گوشی را زیباتر می‌کند و هم از آن محافظت می‌کند.</p>
                  <p>در ادامه ویژگی‌ها، مزایا و نکات مهم مربوط به <b>خرید {p.name}</b> را بررسی می‌کنیم.</p>
                  <div className="relative flex items-center gap-4 overflow-hidden rounded-lg p-5 text-white" style={{ background: "linear-gradient(120deg,#0b4f9c,#1f9bea)" }}>
                    <ProductVisual kind={p.kind} hue={200} className="size-28 shrink-0" />
                    <div className="flex-1 space-y-1"><div className="text-lg font-black">{p.name}</div><div dir="ltr" className="text-xs tracking-[0.3em] opacity-80">Caseline.ir</div>
                      <ul className="mt-2 grid gap-1 text-[11px] opacity-90 sm:grid-cols-2"><li>✓ ضمانت اصالت کالا</li><li>✓ ارسال سریع</li><li>✓ سازگاری کامل با مدل</li><li>✓ ۷ روز مرجوعی</li></ul></div>
                  </div>
                  <h2 className="pt-2 text-sm font-black">{p.name} چیست و چه کاربردی دارد؟</h2>
                  <p>این محصول با متریال مقاوم ساخته شده و برشی دقیق برای دکمه‌ها، دوربین و پورت‌ها دارد. سطح آن در برابر خط و خش و لک مقاوم است و حس دست خوبی ایجاد می‌کند.</p>
                  <h2 className="pt-2 text-sm font-black">چرا {p.name} از کیس‌لاین بخریم؟</h2>
                  <p>همه محصولات کیس‌لاین اورجینال هستند، قبل از ارسال تست می‌شوند و با ضمانت بازگشت وجه به دست شما می‌رسند. پشتیبانی ما هر روز پاسخ‌گوی شماست.</p>
                  <div className="rounded-lg bg-surface-2 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between font-black"><span className="grid size-8 place-items-center rounded-md bg-primary/12 text-primary"><FileText className="size-4" /></span>قوانین خرید و ارسال</div>
                    <ol className="space-y-3">
                      {rules.map(([h, t], i) => (
                        <li key={h} className="flex gap-3 rounded-md bg-surface p-3 text-[12px] leading-7"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">{toFa(i + 1)}</span><span><b className="text-primary">{h}</b> {t}</span></li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="panel panel-faq space-y-4">
                  {productFaq.map((f) => <div key={f.q}><h3 className="font-black">{f.q}</h3><p className="text-muted">{f.a}</p></div>)}
                </div>
                <div className="panel panel-rev space-y-4">
                  {productReviews.map((r) => <div key={r.name} className="rounded-md bg-surface-2 p-4"><div className="flex items-center justify-between"><b>{r.name}</b><span className="text-warning">{"★".repeat(r.rate)}</span></div><p className="mt-1 text-muted">{r.text}</p></div>)}
                </div>
              </div>
            </div>

            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
              <h2 className="mb-4 text-sm font-black">محصولات مشابه</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(related.length ? related : others.slice(0, 3)).map((x, i) => <div key={x.id} className={i === 2 ? "hidden sm:block" : ""}><ProductCard p={x} showCat /></div>)}
              </div>
            </section>
          </div>

          <aside className="rounded-xl border border-border bg-surface p-3 shadow-sm lg:sticky lg:top-20">
            <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-black">پیشنهادهای ویژه</h2><Link href="/" className="text-[11px] font-bold text-primary">همه</Link></div>
            <ul className="space-y-2">
              {others.map((x) => (
                <li key={x.id}><Link href={`/product/${x.id}`} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 hover:shadow-sm">
                  <Thumb p={x} className="size-12 shrink-0 rounded-lg" />
                  <span className="min-w-0"><span className="line-clamp-2 block text-[10.5px] font-medium leading-5">خرید {x.name}</span><span className="text-[10px] font-bold text-primary">{formatToman(x.price)}</span></span>
                </Link></li>
              ))}
            </ul>
          </aside>
        </Container>
      </main>
      <Footer />
      <StickyBar p={p} />
      <BottomNav />
    </>
  );
}
