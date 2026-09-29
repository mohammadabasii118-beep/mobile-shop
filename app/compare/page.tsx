"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCompare } from "@/components/CompareContext";
import Icon from "@/components/Icon";
import { fmtToman } from "@/lib/format";

type CompareProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  images: string[];
  stock: number;
  hasVariants: boolean;
  categoryName: string;
  brandName: string | null;
  specs: Record<string, string> | null;
};

export default function ComparePage() {
  const { ids, removeFromCompare, clearCompare } = useCompare();
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/compare?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .finally(() => setLoading(false));
  }, [ids]);

  // Union of every spec key across the selected products, so the table has
  // one row per real spec that at least one product actually has — never
  // an invented row.
  const specKeys = Array.from(new Set(products.flatMap((p) => Object.keys(p.specs || {}))));

  if (ids.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
        <Icon name="compare" className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <h1 className="text-xl font-extrabold mb-2">لیست مقایسه خالی است</h1>
        <p className="muted text-sm mb-6">با کلیک روی آیکون مقایسه در کارت هر محصول، آن را اینجا اضافه کنید (حداکثر ۴ محصول).</p>
        <Link href="/" className="inline-block px-6 h-11 leading-[44px] rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>
          بازگشت به فروشگاه
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">مقایسه محصولات</h1>
        <button onClick={clearCompare} className="text-sm muted underline underline-offset-4">پاک کردن همه</button>
      </div>

      {loading ? (
        <p className="muted text-sm">در حال بارگذاری…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <tbody>
              <tr>
                <td className="w-32"></td>
                {products.map((p) => (
                  <td key={p.id} className="p-3 align-top">
                    <div className="relative">
                      <button
                        onClick={() => removeFromCompare(p.id)}
                        className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full surface border line flex items-center justify-center"
                        aria-label="حذف از مقایسه"
                      >
                        <Icon name="x" className="w-3 h-3" />
                      </button>
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)] mb-2">
                        {p.images?.[0] && <Image src={p.images[0]} alt={p.name} fill sizes="200px" className="object-cover" />}
                      </div>
                      <Link href={`/product/${p.slug}`} className="text-sm font-medium clamp2 block mb-1">{p.name}</Link>
                      <p className="text-sm font-bold">{p.hasVariants ? `از ${fmtToman(p.price)}` : fmtToman(p.price)}</p>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-t line">
                <td className="p-3 text-sm font-medium muted">دسته‌بندی</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3 text-sm text-center">{p.categoryName}</td>
                ))}
              </tr>
              <tr className="border-t line">
                <td className="p-3 text-sm font-medium muted">برند</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3 text-sm text-center">{p.brandName || "—"}</td>
                ))}
              </tr>
              <tr className="border-t line">
                <td className="p-3 text-sm font-medium muted">موجودی</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3 text-sm text-center">
                    {p.hasVariants ? "بسته به گزینه" : p.stock > 0 ? "موجود" : "ناموجود"}
                  </td>
                ))}
              </tr>
              {specKeys.map((key) => (
                <tr key={key} className="border-t line">
                  <td className="p-3 text-sm font-medium muted">{key}</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-sm text-center">{p.specs?.[key] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
