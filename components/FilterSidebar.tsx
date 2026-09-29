"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function FilterSidebar({
  subcategories,
  myPhoneLabel,
}: {
  subcategories?: { slug: string; id: string; name: string }[];
  // When the customer has a saved "گوشی من", its display name — showing
  // the checkbox only when there's something concrete to filter by,
  // rather than a generic option that means nothing until they set one.
  myPhoneLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value === null || value === "") sp.delete(key);
    else sp.set(key, value);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function toggleCat(id: string) {
    const current = params.get("cat")?.split(",").filter(Boolean) || [];
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    update("cat", next.length ? next.join(",") : null);
  }

  const selectedCats = params.get("cat")?.split(",").filter(Boolean) || [];

  return (
    <aside className="w-full md:w-56 shrink-0 flex flex-col gap-6">
      <div>
        <h4 className="font-bold text-sm mb-3">مرتب‌سازی</h4>
        <select
          defaultValue={params.get("sort") || "default"}
          onChange={(e) => update("sort", e.target.value === "default" ? null : e.target.value)}
          className="w-full h-10 rounded-lg border line bg-transparent px-3 text-sm"
        >
          <option value="default">پیش‌فرض</option>
          <option value="cheap">ارزان‌ترین</option>
          <option value="expensive">گران‌ترین</option>
        </select>
      </div>
      {subcategories && subcategories.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-3">دسته‌بندی</h4>
          <div className="flex flex-col gap-2">
            {subcategories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selectedCats.includes(c.id)} onChange={() => toggleCat(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={params.get("discount") === "1"}
            onChange={(e) => update("discount", e.target.checked ? "1" : null)}
          />
          فقط کالاهای تخفیف‌دار
        </label>
      </div>
      {myPhoneLabel && (
        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={params.get("myphone") === "1"}
              onChange={(e) => update("myphone", e.target.checked ? "1" : null)}
            />
            فقط سازگار با گوشی من ({myPhoneLabel})
          </label>
        </div>
      )}
    </aside>
  );
}
