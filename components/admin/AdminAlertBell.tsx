import Link from "next/link";

export default function AdminAlertBell({ count }: { count: number }) {
  return (
    <Link href="/admin/alerts" className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--surface-2)] mr-auto">
      <span>🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -left-1 text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full text-white flex items-center justify-center" style={{ background: "#a24e56" }}>
          {count}
        </span>
      )}
    </Link>
  );
}
