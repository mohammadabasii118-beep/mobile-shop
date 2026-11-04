import type { Metadata } from "next";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Explorer } from "@/components/shop/explorer-boundary";
import { PRODUCTS } from "@/data/products";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = { title: "فروشگاه و همه محصولات" };

export default function ShopPage() {
  return (
    <>
      <PageHeader
        title="فروشگاه لوازم یدکی"
        subtitle={`${toFa(PRODUCTS.length)} قطعه اصلی و OEM برای نیسان و هوندا. با فیلتر برند، مدل، سال ساخت و دسته‌بندی، قطعه دقیق خودروی خود را پیدا کنید.`}
        crumbs={[{ label: "فروشگاه" }]}
      />
      <div className="container-x mt-8">
        <Explorer />
      </div>
    </>
  );
}
