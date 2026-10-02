/**
 * Live Telegram is enabled by env only (secrets never live in code or in the UI):
 *   TELEGRAM_BOT_TOKEN=123456:ABC...     (from @BotFather)
 *   TELEGRAM_CHANNEL=@yourchannel        (or numeric id like -100123456789)
 * Set TELEGRAM_MODE=mock to force the demo provider even when the variables exist.
 */
export function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  let channel = process.env.TELEGRAM_CHANNEL?.trim() ?? "";
  if (channel && !channel.startsWith("@") && !/^-?\d+$/.test(channel)) channel = `@${channel}`;
  return {
    live: Boolean(token && channel) && process.env.TELEGRAM_MODE !== "mock",
    token,
    channel,
    apiBase: process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org",
  };
}
