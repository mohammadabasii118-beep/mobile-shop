import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validation";
import { runAutomationRules } from "@/lib/automation";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" }, { status: 400 });
  }
  await db.$transaction(async (tx) => {
    const msg = await tx.contactMessage.create({ data: parsed.data });
    await runAutomationRules(tx, "NEW_CONTACT_MESSAGE", {
      message: `پیام تماس جدید از ${msg.name}`,
      link: "/admin/contact-messages",
    });
  });
  return NextResponse.json({ ok: true });
}
