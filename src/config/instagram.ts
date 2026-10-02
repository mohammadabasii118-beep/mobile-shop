/**
 * Instagram mode (no Meta API is used in any mode):
 *   mock   - demo: fake posts/stories are "published" to a mock provider (default)
 *   manual - semi-automatic: each Telegram post becomes a "ready to post" item (caption + image)
 *            that the admin posts by hand in the Instagram app. Enable with INSTAGRAM_MODE=manual.
 */
export type InstagramMode = "mock" | "manual";
export const instagramMode = (): InstagramMode => (process.env.INSTAGRAM_MODE === "manual" ? "manual" : "mock");
