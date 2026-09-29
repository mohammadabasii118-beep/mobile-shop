"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type BrandOption = { id: string; name: string };
type ModelOption = { id: string; name: string; brandId: string };

/**
 * A quick "what phone do you have?" picker for the homepage hero — jumps
 * straight to /search filtered to products genuinely compatible with the
 * chosen model (same real compatibility logic as the "گوشی من" filter, via
 * lib/products.ts's compatibilityFilter). Works for anyone, logged in or
 * not — it doesn't save anything to an account, it's just a shortcut.
 */
export default function HeroPhonePicker({ brands, models }: { brands: BrandOption[]; models: ModelOption[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const availableModels = models.filter((m) => m.brandId === brandId);

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    router.push(`/search?model=${modelId}`);
  }

  return (
    <form onSubmit={go} className="surface border line rounded-2xl p-4 flex flex-col sm:flex-row gap-3 max-w-md mx-auto md:mx-0">
      <select
        value={brandId}
        onChange={(e) => { setBrandId(e.target.value); setModelId(""); }}
        aria-label="برند گوشی"
        className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none flex-1"
      >
        <option value="">برند گوشی شما</option>
        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        disabled={!brandId}
        aria-label="مدل گوشی"
        className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none flex-1 disabled:opacity-60"
      >
        <option value="">مدل گوشی</option>
        {availableModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button disabled={!modelId} className="h-11 px-6 rounded-full text-white text-sm font-bold disabled:opacity-50 shrink-0" style={{ background: "var(--ink)" }}>
        نمایش محصولات مناسب
      </button>
    </form>
  );
}
