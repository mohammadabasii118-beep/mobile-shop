"use client";
import { useState } from "react";
import { toggleSection, reorderSection } from "@/lib/actions/homepage";
import { EditCustomBlockForm } from "./CustomBlockForm";

const typeLabel: Record<string, string> = {
  HERO: "بنر اصلی (Hero)", CATEGORY_STRIP: "نوار دسته‌بندی‌ها", BEST_SELLERS: "پرفروش‌ترین‌ها",
  BANNER: "بنر میانی", NEW_ARRIVALS: "جدیدترین‌ها", DISCOUNTED: "تخفیف‌های ویژه",
  TRENDING: "پرطرفدارترین‌ها", WHY_US: "چرا کیس لاین", TESTIMONIALS: "نظرات مشتریان",
  CUSTOM_BLOCK: "بلوک محتوای دلخواه",
};

export default function HomepageSectionRow({ section }: { section: any }) {
  const [order, setOrder] = useState(section.order);
  const [active, setActive] = useState(section.isActive);

  return (
    <div className="surface border line rounded-xl p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{section.title || typeLabel[section.type] || section.type}</span>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            onBlur={() => reorderSection(section.id, order)}
            className="w-16 h-9 rounded-lg border line bg-transparent px-2 text-sm text-center"
          />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); toggleSection(section.id, e.target.checked); }} />
            فعال
          </label>
        </div>
      </div>
      {section.type === "CUSTOM_BLOCK" && (
        <div className="mt-1">
          <EditCustomBlockForm id={section.id} config={section.config || {}} />
        </div>
      )}
    </div>
  );
}
