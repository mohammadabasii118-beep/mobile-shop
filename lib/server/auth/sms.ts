import { env } from "@/lib/server/env";

/** Implement this interface to plug in a real SMS gateway; nothing else in the auth code changes. */
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    // Development only: OTP codes are printed to the server log.
    console.info(`[sms:console] to=${to} message=${message}`);
  }
}

export function getSmsProvider(): SmsProvider {
  switch (env().SMS_PROVIDER) {
    case "console":
    default:
      return new ConsoleSmsProvider();
  }
}
