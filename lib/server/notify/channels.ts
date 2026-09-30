import { getSmsProvider } from "@/lib/server/auth/sms";

export interface Recipient { phone: string | null; email: string | null }
export interface OutgoingMessage { title: string; body: string | null; link: string | null }

/**
 * External delivery channel. To add a real gateway, implement `send` and make `configured()` return true
 * only when credentials exist. Nothing is sent from a channel that is not enabled in NOTIFY_CHANNELS.
 */
export interface ChannelProvider {
  key: "sms" | "email" | "telegram";
  configured(): boolean;
  send(to: Recipient, msg: OutgoingMessage): Promise<void>;
}

const sms: ChannelProvider = {
  key: "sms",
  configured: () => true, // uses the SmsProvider abstraction (console in development)
  send: async (to, m) => { if (!to.phone) throw new Error("no_phone"); await getSmsProvider().send(to.phone, `${m.title}${m.body ? ` — ${m.body}` : ""}`); },
};
const email: ChannelProvider = {
  key: "email",
  configured: () => !!process.env.EMAIL_SMTP_URL,
  send: async () => { throw new Error("E-mail gateway not implemented yet"); },
};
const telegram: ChannelProvider = {
  key: "telegram",
  configured: () => !!process.env.TELEGRAM_BOT_TOKEN,
  send: async () => { throw new Error("Telegram gateway not implemented yet"); },
};

const ALL = { sms, email, telegram } as const;
export const getChannel = (key: string): ChannelProvider | undefined => (ALL as Record<string, ChannelProvider>)[key];

/** Channels listed in NOTIFY_CHANNELS (default: none). */
export function enabledChannels(): ChannelProvider["key"][] {
  return (process.env.NOTIFY_CHANNELS ?? "").split(",").map((s) => s.trim()).filter((s): s is ChannelProvider["key"] => s in ALL);
}
