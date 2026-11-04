import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { Explorer } from "@/components/shop/explorer-boundary";
import { SearchHeading } from "@/components/shop/search-heading";

export const metadata: Metadata = { title: "جستجوی قطعات" };

export default function SearchPage() {
  return (
    <>
      <PageHeader title="جستجوی قطعات" subtitle="بر اساس نام قطعه، کد فنی فروشگاه (مثل HAP-NS-1021) یا شماره OEM (مثل 15208-65F0E) جستجو کنید." crumbs={[{ label: "جستجو" }]}>
        <Suspense>
          <SearchHeading />
        </Suspense>
      </PageHeader>
      <div className="container-x mt-8">
        <Explorer />
      </div>
    </>
  );
}
