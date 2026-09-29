"use client";
import { signOut } from "next-auth/react";

export default function AdminSignOut() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="text-xs px-3 h-8 rounded-full border line">
      خروج
    </button>
  );
}
