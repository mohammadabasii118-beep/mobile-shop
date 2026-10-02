import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/config/app";

/**
 * Future: Telegram sends updates here. Verify the `X-Telegram-Bot-Api-Secret-Token` header against
 * TELEGRAM_WEBHOOK_SECRET, then hand the update to services/telegram → automation engine.
 */
export async function POST(req: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "Webhooks are disabled in demo mode" }, { status: 501 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
