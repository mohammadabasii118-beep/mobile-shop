"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AdminSearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/admin/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={submit} className="flex-1 max-w-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی محصول، سفارش، کاربر…"
        className="w-full h-9 rounded-lg border line bg-transparent px-3 text-sm outline-none"
      />
    </form>
  );
}
