import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./storage"),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  SMS_PROVIDER: z.enum(["console"]).default("console"),
  // Set to 1 only when running behind a reverse proxy that overwrites X-Forwarded-For.
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Validated environment. Throws a readable error at first use if something is missing. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) throw new Error("Invalid environment: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    cached = parsed.data;
    const problems = productionProblems(cached);
    if (problems.length && process.env.NEXT_PHASE !== "phase-production-build") throw new Error("Unsafe production configuration: " + problems.join("; "));
  }
  return cached;
}

/** Settings that must never reach a real deployment. Also used by scripts/preflight.ts. Empty outside production. */
export function productionProblems(e: Env, nodeEnv = process.env.NODE_ENV): string[] {
  if (nodeEnv !== "production") return [];
  const out: string[] = [];
  if (/^(change|replace|secret|dev|test|example|x+$)/i.test(e.AUTH_SECRET) || new Set(e.AUTH_SECRET).size < 10) out.push("AUTH_SECRET looks like a placeholder — generate one with `openssl rand -base64 48`");
  if (!e.APP_URL.startsWith("https://") && process.env.ALLOW_INSECURE_HTTP !== "1") out.push("APP_URL must be https:// (set ALLOW_INSECURE_HTTP=1 only for a private staging check)");
  return out;
}

export const isProd = () => process.env.NODE_ENV === "production";
export const cookieSecure = () => env().APP_URL.startsWith("https://");
