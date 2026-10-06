"use client";
import { LogOut } from "lucide-react";
import { api } from "@/lib/client/api";

export function LogoutButton() {
  return (
    <button onClick={async () => { await api("POST", "/api/auth/logout"); /* full reload so every server-rendered part drops the session */ // eslint-disable-next-line @next/next/no-location-assign-relative-destination
 window.location.href = "/"; }} className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-xs font-medium text-muted hover:text-hot sm:text-[13px]">
      خروج<LogOut className="size-4" />
    </button>
  );
}
