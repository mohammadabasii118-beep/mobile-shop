import { instagramMode, sidecarConfig } from "@/config/instagram";
import { api } from "@/lib/api";
import { sidecarStatus } from "@/services/instagram/sidecar";

export const GET = api(async () => {
  const mode = instagramMode();
  const { dailyLimit, autoPublish } = sidecarConfig();
  return { mode, dailyLimit, autoPublish, sidecar: mode === "unofficial" ? await sidecarStatus() : null };
});
