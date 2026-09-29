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
  }
  return cached;
}

export const isProd = () => process.env.NODE_ENV === "production";
export const cookieSecure = () => env().APP_URL.startsWith("https://");
