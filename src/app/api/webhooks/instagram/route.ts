import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/config/app";
import { verifyHmacSignature } from "@/lib/security/secrets";

/** Future: Meta webhook. GET = subscription handshake, POST = signed events (comments, messages). */
export async function GET(req: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "Webhooks are disabled in demo mode" }, { status: 501 });
  const q = new URL(req.url).searchParams;
  if (q.get("hub.verify_token") === process.env.META_WEBHOOK_VERIFY_TOKEN) return new Response(q.get("hub.challenge"));
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "Webhooks are disabled in demo mode" }, { status: 501 });
  const raw = await req.text();
  if (!verifyHmacSignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? "")) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
