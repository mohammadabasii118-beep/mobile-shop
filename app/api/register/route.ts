import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "این ایمیل قبلاً ثبت‌نام کرده است" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.create({ data: { name, email, passwordHash, role: "CUSTOMER" } });
  return NextResponse.json({ ok: true });
}
