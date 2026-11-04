import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/parts/brake-disc.svg" alt="" className="size-48 animate-spin-slow opacity-80" />
      <p className="mt-6 text-6xl font-black text-primary">۴۰۴</p>
      <h1 className="mt-2 text-2xl font-black">صفحه مورد نظر پیدا نشد</h1>
      <p className="mt-2 text-neutral-500">ممکن است آدرس اشتباه باشد یا این قطعه دیگر موجود نباشد.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild><Link href="/">صفحه اصلی</Link></Button>
        <Button asChild variant="outline"><Link href="/shop">فروشگاه</Link></Button>
      </div>
    </div>
  );
}
