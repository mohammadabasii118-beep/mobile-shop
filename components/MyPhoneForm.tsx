"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMyPhone, clearMyPhone } from "@/lib/actions/myPhone";

type BrandOption = { id: string; name: string };
type ModelOption = { id: string; name: string; brandId: string };

export default function MyPhoneForm({
  brands,
  models,
  current,
}: {
  brands: BrandOption[];
  models: ModelOption[];
  current: { brandId: string | null; phoneModelId: string | null };
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(current.brandId || "");
  const [modelId, setModelId] = useState(current.phoneModelId || "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const availableModels = models.filter((m) => m.brandId === brandId);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await setMyPhone(brandId, modelId);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "خطا در ذخیره");
      }
    });
  }

  function onClear() {
    setError("");
    startTransition(async () => {
      await clearMyPhone();
      setBrandId("");
      setModelId("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSave} className="surface border line rounded-2xl p-5">
      <h2 className="font-bold text-sm mb-1">گوشی من</h2>
      <p className="text-xs muted mb-4">با ذخیره‌ی مدل گوشی خود، در صفحه‌ی محصولات متغیر گزینه‌ی مناسب شما از قبل انتخاب می‌شود و می‌توانید محصولات را فقط بر اساس سازگاری با گوشی خودتان فیلتر کنید.</p>
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <select
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setModelId("");
          }}
          className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none flex-1"
        >
          <option value="">برند گوشی</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={!brandId}
          className="h-11 rounded-lg border line bg-transparent px-3 text-sm outline-none flex-1 disabled:opacity-60"
        >
          <option value="">مدل گوشی</option>
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm mb-3" style={{ color: "#a24e56" }}>{error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={pending || !brandId || !modelId} className="px-6 h-10 rounded-full text-white font-bold text-sm disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {pending ? "در حال ذخیره…" : "ذخیره"}
        </button>
        {current.phoneModelId && (
          <button type="button" onClick={onClear} disabled={pending} className="text-xs muted underline underline-offset-4">
            پاک کردن
          </button>
        )}
      </div>
    </form>
  );
}
