"use client";
import { useState } from "react";
import Icon from "./Icon";

export type ProductSpec = { label: string; value: string };

const SHIPPING_ITEMS = [
  { icon: "truck", text: "ارسال ۲۴ تا ۷۲ ساعته به سراسر کشور" },
  { icon: "shield", text: "ضمانت اصالت کالا" },
  { icon: "return", text: "۷ روز مهلت بازگشت کالا (کالای دست‌نخورده و در بسته‌بندی اصلی)" },
  { icon: "card", text: "پرداخت امن — درگاه بانکی یا کارت‌به‌کارت" },
] as const;

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`panel-${id}`}
        className="w-full flex items-center justify-between py-4 text-right font-bold text-sm"
      >
        {title}
        <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <Icon name="menu" className="w-4 h-4 muted" />
        </span>
      </button>
      {open && (
        <div id={`panel-${id}`} className="pb-4 text-sm leading-8 muted">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Secondary product info, grouped into an accordion so the primary buy info
 * (image, price, options, add-to-cart) stays uncluttered above the fold.
 * Works identically on mobile and desktop — a single accordion pattern
 * avoids maintaining two separate (tab vs. accordion) layouts.
 */
export default function ProductInfoTabs({ description, specs }: { description: string; specs?: ProductSpec[] }) {
  const [openId, setOpenId] = useState<string | null>("description");

  function toggle(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="mt-8">
      <Section id="description" title="توضیحات محصول" open={openId === "description"} onToggle={() => toggle("description")}>
        <p className="whitespace-pre-line">{description}</p>
      </Section>

      {specs && specs.length > 0 && (
        <Section id="specs" title="مشخصات" open={openId === "specs"} onToggle={() => toggle("specs")}>
          <dl className="grid grid-cols-2 gap-y-2">
            {specs.map((s) => (
              <div key={s.label} className="contents">
                <dt className="font-medium text-[var(--text)]">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section id="shipping" title="ارسال، ضمانت و بازگشت کالا" open={openId === "shipping"} onToggle={() => toggle("shipping")}>
        <ul className="space-y-2">
          {SHIPPING_ITEMS.map((it) => (
            <li key={it.text} className="flex items-center gap-2">
              <Icon name={it.icon} className="w-4 h-4 shrink-0" />
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
