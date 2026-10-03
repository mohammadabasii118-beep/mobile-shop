import { Zap } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <a href="/" className={`inline-flex min-h-11 items-center gap-2 ${className}`} aria-label="ولتا — صفحهٔ اصلی">
      <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-fg">
        <Zap className="size-4 fill-current" aria-hidden />
      </span>
      <span className="text-xl font-extrabold">ولتا</span>
    </a>
  );
}
