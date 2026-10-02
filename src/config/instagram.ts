/**
 * Instagram mode (the official Meta API is NOT used in any mode):
 *   mock       - demo: fake posts/stories are "published" to a mock provider (default)
 *   manual     - semi-automatic: each Telegram post becomes a "ready to post" item the admin posts by hand
 *   unofficial - like manual, plus a "Publish to Instagram" button that posts to YOUR account through the local
 *                Python sidecar (private mobile API). Violates Instagram's ToS — the account can be limited or banned.
 * Enable with INSTAGRAM_MODE=manual | unofficial.
 */
export type InstagramMode = "mock" | "manual" | "unofficial";

export const instagramMode = (): InstagramMode => {
  const m = process.env.INSTAGRAM_MODE;
  return m === "manual" || m === "unofficial" ? m : "mock";
};

export function sidecarConfig() {
  return {
    url: process.env.IG_SIDECAR_URL ?? "http://127.0.0.1:8765",
    secret: process.env.IG_SIDECAR_SECRET ?? "",
    /** Publish automatically when a Telegram post arrives. Off by default: the admin confirms each post. */
    autoPublish: process.env.IG_AUTO_PUBLISH === "true",
    dailyLimit: Math.max(1, Number(process.env.IG_DAILY_LIMIT ?? 5) || 5),
  };
}
