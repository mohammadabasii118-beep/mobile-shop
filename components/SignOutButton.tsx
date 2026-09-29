"use client";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm px-4 h-10 rounded-full border line">
      خروج از حساب
    </button>
  );
}
