export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTelegramPolling } = await import("./services/telegram/poller");
    startTelegramPolling();
  }
}
