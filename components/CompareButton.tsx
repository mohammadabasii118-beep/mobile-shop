"use client";
import { useCompare } from "./CompareContext";
import Icon from "./Icon";

export default function CompareButton({ productId, size = "sm" }: { productId: string; size?: "sm" | "md" }) {
  const { isComparing, toggleCompare, full } = useCompare();
  const active = isComparing(productId);
  const disabled = !active && full;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    toggleCompare(productId);
  }

  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconDim = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? "حذف از مقایسه" : "افزودن به مقایسه"}
      title={disabled ? "حداکثر ۴ محصول قابل مقایسه است" : active ? "حذف از مقایسه" : "افزودن به مقایسه"}
      type="button"
      className={`${dim} rounded-full flex items-center justify-center surface disabled:opacity-40`}
      style={{ color: active ? "var(--ink)" : "var(--muted)" }}
    >
      <Icon name="compare" className={iconDim} filled={active} />
    </button>
  );
}
