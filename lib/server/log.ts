/** Structured one-line JSON logs (stdout) so journald / any log shipper can parse them. Never log secrets, OTP codes or bodies. */
type Level = "info" | "warn" | "error";
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(line);
}
export function errorFields(e: unknown) {
  const err = e as { name?: string; message?: string; code?: string; stack?: string };
  return { errName: err?.name, errCode: err?.code, errMessage: String(err?.message ?? e).slice(0, 300), stack: err?.stack?.split("\n").slice(0, 4).join(" | ") };
}
