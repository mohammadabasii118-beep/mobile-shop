import { avatarColor } from "@/lib/placeholder";
import { cn } from "@/lib/cn";

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase()}
    </span>
  );
}
