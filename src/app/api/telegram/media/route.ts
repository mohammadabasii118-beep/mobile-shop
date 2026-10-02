import { api, HttpError } from "@/lib/api";
import { telegramConfig } from "@/config/telegram";
import { tgFile } from "@/services/telegram/client";

// Proxies Telegram media so the bot token never reaches the browser. Auth-protected like every API route.
export const GET = api(async ({ request }) => {
  if (!telegramConfig().live) throw new HttpError(404, "Telegram is not live");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{10,200}$/.test(id)) throw new HttpError(400, "Bad file id");
  try {
    const upstream = await tgFile(id);
    return new Response(upstream.body, {
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    throw new HttpError(502, "Could not load media");
  }
}, { limit: 600 });
