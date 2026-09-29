"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import ProductInfoTabs from "@/components/ProductInfoTabs";
import WishlistButton from "@/components/WishlistButton";
import { useCart } from "@/components/CartContext";
import { fmtToman, fa } from "@/lib/format";

export type VariantOption = {
  id: string;
  brandId: string | null;
  brandName: string | null;
  phoneModelId: string | null;
  phoneModelName: string | null;
  colorId: string | null;
  colorName: string | null;
  colorHex: string | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
};

function uniqueBy<T, K>(arr: T[], keyFn: (t: T) => K) {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

export default function VariantProductView({
  productId,
  productName,
  categoryName,
  categoryHref,
  brandName,
  description,
  fallbackImage,
  variants,
  initialWishlisted = false,
  myBrandId = null,
  myPhoneModelId = null,
}: {
  productId: string;
  productName: string;
  categoryName: string;
  categoryHref: string;
  brandName: string | null;
  description: string;
  fallbackImage: string;
  variants: VariantOption[];
  initialWishlisted?: boolean;
  // The customer's saved "گوشی من" (account ← گوشی من), if any — used only
  // to pre-select a matching brand/model so they don't have to re-pick it
  // on every variable product; the customer can still change the selection
  // freely, and nothing here restricts which options are shown.
  myBrandId?: string | null;
  myPhoneModelId?: string | null;
}) {
  const { addToCart, setCartOpen } = useCart();
  const [qty, setQty] = useState(1);

  const usesBrand = variants.some((v) => v.brandId);
  const usesModel = variants.some((v) => v.phoneModelId);
  const usesColor = variants.some((v) => v.colorId);

  const brandOptions = usesBrand
    ? uniqueBy(variants.filter((v) => v.brandId), (v) => v.brandId).map((v) => ({ id: v.brandId as string, name: v.brandName || "" }))
    : [];
  const [brandId, setBrandId] = useState<string>(() => {
    if (brandOptions.length === 1) return brandOptions[0].id;
    if (myBrandId && brandOptions.some((b) => b.id === myBrandId)) return myBrandId;
    return "";
  });

  const modelOptions = usesModel
    ? uniqueBy(
        variants.filter((v) => v.phoneModelId && (!usesBrand || !brandId || v.brandId === brandId)),
        (v) => v.phoneModelId
      ).map((v) => ({ id: v.phoneModelId as string, name: v.phoneModelName || "" }))
    : [];
  const [modelId, setModelId] = useState<string>(() => {
    if (myPhoneModelId && modelOptions.some((m) => m.id === myPhoneModelId)) return myPhoneModelId;
    return "";
  });

  const colorOptions = usesColor
    ? uniqueBy(
        variants.filter(
          (v) =>
            v.colorId &&
            (!usesBrand || !brandId || v.brandId === brandId) &&
            (!usesModel || !modelId || v.phoneModelId === modelId)
        ),
        (v) => v.colorId
      ).map((v) => ({ id: v.colorId as string, name: v.colorName || "", hex: v.colorHex }))
    : [];
  const [colorId, setColorId] = useState<string>("");

  // Auto-select when a dimension collapses to exactly one option.
  useMemo(() => {
    if (usesModel && modelOptions.length === 1 && !modelId) setModelId(modelOptions[0].id);
  }, [modelOptions, usesModel, modelId]);
  useMemo(() => {
    if (usesColor && colorOptions.length === 1 && !colorId) setColorId(colorOptions[0].id);
  }, [colorOptions, usesColor, colorId]);

  const selected = useMemo(() => {
    return variants.find(
      (v) =>
        (!usesBrand || v.brandId === brandId) &&
        (!usesModel || v.phoneModelId === modelId) &&
        (!usesColor || v.colorId === colorId)
    );
  }, [variants, usesBrand, usesModel, usesColor, brandId, modelId, colorId]);

  const fullySelected = (!usesBrand || brandId) && (!usesModel || modelId) && (!usesColor || colorId);
  const outOfStock = selected ? !selected.isActive || selected.stock <= 0 : false;
  const disc = selected?.oldPrice ? Math.round((1 - selected.price / selected.oldPrice) * 100) : 0;
  const heroImage = selected?.imageUrl || fallbackImage;

  function pickBrand(id: string) {
    setBrandId(id);
    setModelId("");
    setColorId("");
    setQty(1);
  }
  function pickModel(id: string) {
    setModelId(id);
    setColorId("");
    setQty(1);
  }
  function pickColor(id: string) {
    setColorId(id);
    setQty(1);
  }

  function add() {
    if (!selected || outOfStock) return;
    const label = [
      usesBrand ? selected.brandName : null,
      usesModel ? selected.phoneModelName : null,
      usesColor ? selected.colorName : null,
    ]
      .filter(Boolean)
      .join(" / ");
    addToCart(
      {
        productId,
        variantId: selected.id,
        variantLabel: label || null,
        name: productName,
        price: selected.price,
        image: selected.imageUrl || fallbackImage,
      },
      qty
    );
    setCartOpen(true);
  }

  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div className="relative aspect-square rounded-3xl overflow-hidden bg-[var(--surface-2)]">
        {heroImage && <Image src={heroImage} alt={productName} fill sizes="500px" className="object-cover" />}
      </div>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-sm muted">{categoryName}{brandName ? ` · ${brandName}` : ""}</span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1 mb-3">{productName}</h1>
          </div>
          <WishlistButton productId={productId} initialWishlisted={initialWishlisted} />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl font-extrabold">
            {selected ? fmtToman(selected.price) : `از ${fmtToman(Math.min(...variants.map((v) => v.price)))}`}
          </span>
          {selected?.oldPrice ? (
            <>
              <span className="muted line-through text-sm">{fmtToman(selected.oldPrice)}</span>
              <span className="text-xs px-2 py-1 rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>{fa(disc)}٪-</span>
            </>
          ) : null}
        </div>

        {usesBrand && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">برند گوشی</p>
            <div className="flex flex-wrap gap-2">
              {brandOptions.map((b) => (
                <button
                  key={b.id}
                  onClick={() => pickBrand(b.id)}
                  className="px-4 h-10 rounded-full border text-sm"
                  style={brandId === b.id ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { borderColor: "var(--line)" }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {usesModel && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">مدل گوشی</p>
            <div className="flex flex-wrap gap-2">
              {modelOptions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickModel(m.id)}
                  className="px-4 h-10 rounded-full border text-sm"
                  style={modelId === m.id ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { borderColor: "var(--line)" }}
                >
                  {m.name}
                </button>
              ))}
              {modelOptions.length === 0 && <span className="text-xs muted">ابتدا برند را انتخاب کنید</span>}
            </div>
          </div>
        )}

        {usesColor && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">رنگ</p>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickColor(c.id)}
                  title={c.name}
                  className="w-9 h-9 rounded-full border-2"
                  style={{ background: c.hex || "#ccc", borderColor: colorId === c.id ? "var(--ink)" : "transparent" }}
                />
              ))}
              {colorOptions.length === 0 && <span className="text-xs muted">ابتدا مدل را انتخاب کنید</span>}
            </div>
          </div>
        )}

        {!fullySelected && (
          <p className="text-sm mb-4" style={{ color: "#a24e56" }}>لطفاً همه گزینه‌ها را انتخاب کنید</p>
        )}

        {fullySelected && selected && !outOfStock && (
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-medium">تعداد</span>
              <div className="flex items-center gap-3 border line rounded-full px-2 h-11">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center">−</button>
                <span className="w-6 text-center">{fa(qty)}</span>
                <button onClick={() => setQty((q) => Math.min(selected.stock, q + 1))} className="w-7 h-7 flex items-center justify-center">＋</button>
              </div>
              <span className="text-xs muted">{fa(selected.stock)} عدد موجود</span>
            </div>
            <button onClick={add} className="hidden md:inline-block px-10 h-[52px] rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>
              افزودن به سبد خرید
            </button>
          </div>
        )}

        {fullySelected && (outOfStock || !selected) && (
          <span className="hidden md:inline-block px-6 h-[52px] leading-[52px] rounded-full surface2 muted text-sm mb-6">ناموجود</span>
        )}

        {/* Mobile sticky buy bar */}
        {fullySelected && selected && (
          <div className="md:hidden fixed bottom-0 inset-x-0 z-30 surface border-t line px-4 py-3 flex items-center gap-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <span className="font-extrabold text-sm shrink-0">{fmtToman(selected.price)}</span>
            {!outOfStock ? (
              <button onClick={add} className="flex-1 h-12 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>
                افزودن به سبد خرید
              </button>
            ) : (
              <span className="flex-1 h-12 leading-[3rem] text-center rounded-full surface2 muted text-sm">ناموجود</span>
            )}
          </div>
        )}
        {fullySelected && selected && <div className="md:hidden h-16" aria-hidden="true" />}

        <ProductInfoTabs
          description={description}
          specs={[
            { label: "دسته‌بندی", value: categoryName },
            ...(brandName ? [{ label: "برند", value: brandName }] : []),
          ]}
        />
      </div>
    </div>
  );
}
