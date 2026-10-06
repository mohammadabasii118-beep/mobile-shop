import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { log } from "@/lib/server/log";

/**
 * Transactional e-mail over SMTP. Configured only by `EMAIL_SMTP_URL` (e.g. `smtps://user:pass@smtp.example.com:465`).
 * `EMAIL_FROM` is the sender ("CaseLine <no-reply@example.com>"). Without EMAIL_SMTP_URL nothing is sent.
 */
export const mailConfigured = () => !!process.env.EMAIL_SMTP_URL;

let transport: { url: string; t: Transporter } | undefined;
function getTransport() {
  const url = process.env.EMAIL_SMTP_URL!;
  if (!transport || transport.url !== url) transport = { url, t: nodemailer.createTransport({ url, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 } as SMTPTransport.Options) };
  return transport.t;
}

export function mailFrom() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  try { return `CaseLine <no-reply@${new URL(process.env.APP_URL ?? "").hostname}>`; } catch { return "CaseLine <no-reply@localhost>"; }
}

export async function sendMail(msg: { to: string; subject: string; text: string }) {
  if (!mailConfigured()) throw new Error("email_not_configured");
  await getTransport().sendMail({ from: mailFrom(), to: msg.to, subject: msg.subject, text: msg.text });
}

/** Never throws: used from fire-and-forget code paths where a failure must not change the HTTP answer. */
export async function trySendMail(msg: Parameters<typeof sendMail>[0]) {
  try { await sendMail(msg); return true; } catch (e) { log("warn", "mail_failed", { error: String((e as Error).message).slice(0, 200) }); return false; }
}
