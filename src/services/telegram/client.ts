import { telegramConfig } from "@/config/telegram";

interface TgResponse<T> { ok: boolean; result?: T; description?: string; error_code?: number }

/** Thin Bot API client. Errors never include the token. */
export async function tgCall<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  const { token, apiBase } = telegramConfig();
  let res: Response;
  try {
    res = await fetch(`${apiBase}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`Cannot reach Telegram (${(e as Error).name})`);
  }
  const data = (await res.json().catch(() => ({}))) as TgResponse<T>;
  if (!data.ok) throw new Error(data.description ?? `Telegram error ${res.status}`);
  return data.result as T;
}

export async function tgFile(fileId: string) {
  const { token, apiBase } = telegramConfig();
  const file = await tgCall<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("File not available");
  const res = await fetch(`${apiBase}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok || !res.body) throw new Error("Download failed");
  return res;
}
