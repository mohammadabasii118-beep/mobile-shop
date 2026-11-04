import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { CartView } from "@/components/shop/cart-view";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductRail } from "@/components/shop/product-rail";
import { SectionHeading } from "@/components/shop/section-heading";
import { Button } from "@/components/ui/button";
import { bestsellers } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({ title: "سبد خرید", description: "سبد خرید فروشگاه حمیدی", path: "/cart", index: false });

/** Static shell; the cart itself lives in localStorage and hydrates on the client. */
export default function CartPage() {
  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-x flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <Breadcrumbs items={[{ href: "/cart", label: "سبد خرید" }]} />
            <h1 className="mt-2 text-2xl font-black">سبد خرید</h1>
          </div>
          <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="مراحل خرید">
            {["سبد خرید", "اطلاعات ارسال", "پرداخت"].map((s, i) => (
              <li key={s} className="flex items-center gap-2" aria-current={i === 0 ? "step" : undefined}>
                <span className={i === 0 ? "grid size-7 place-items-center rounded-full bg-primary text-white" : "grid size-7 place-items-center rounded-full bg-neutral-200 text-neutral-700"}>{toFa(i + 1)}</span>
                <span className={i === 0 ? "text-neutral-950" : "text-neutral-600"}>{s}</span>
                {i < 2 && <span className="h-px w-6 bg-neutral-300" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="container-x mt-8">
        <CartView
          emptyState={
            <>
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
                <span className="grid size-20 place-items-center rounded-3xl bg-neutral-100 text-neutral-500"><ShoppingBag className="size-9" aria-hidden /></span>
                <h2 className="mt-6 text-xl font-black">سبد خرید شما خالی است</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-neutral-600">از بین قطعات اصلی نیسان و هوندا، قطعه مورد نیاز خودروی خود را انتخاب کنید.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button asChild size="lg"><Link href="/shop">رفتن به فروشگاه <ArrowLeft aria-hidden /></Link></Button>
                  <Button asChild size="lg" variant="outline"><Link href="/#vehicle">انتخاب بر اساس خودرو</Link></Button>
                </div>
              </div>
              <section className="mt-16" aria-labelledby="cart-best">
                <SectionHeading id="cart-best" eyebrow="پیشنهاد ما" title="محصولات پرفروش" href="/shop" />
                <ProductRail products={bestsellers(8)} label="محصولات پرفروش" />
              </section>
            </>
          }
        />
      </div>
    </>
  );
}
