/**
 * ربات تلگرام (long polling؛ بدون نیاز به HTTPS عمومی). توکن فقط از env خوانده می‌شود و هرگز در خطا یا لاگ نمی‌آید.
 * ربات باید «ادمین کانال» باشد. تلگرام پست‌های قبل از اتصال ربات را به ربات نمی‌دهد.
 */
import { get, run } from '../db';
import { ingestPost } from './ingest';

export type ChannelStatus = { configured: boolean; channel: string; connected: boolean; lastPollAt: string | null; lastPostAt: string | null; error: string | null };

const cfg = () => ({
  token: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  channel: (process.env.TELEGRAM_CHANNEL || '').trim(),
  base: (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, ''),
});
export const channelConfigured = () => Boolean(cfg().token && cfg().channel);

const setKV = (k: string, v: string) => run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, v);
const getKV = (k: string) => get<{ value: string }>('SELECT value FROM settings WHERE key = ?', k)?.value ?? null;

export function channelStatus(): ChannelStatus {
  return {
    configured: channelConfigured(),
    channel: cfg().channel,
    connected: getKV('tg_error') === '' && getKV('tg_last_poll') !== null,
    lastPollAt: getKV('tg_last_poll'),
    lastPostAt: getKV('tg_last_post'),
    error: getKV('tg_error') || null,
  };
}

async function call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  const { token, base } = cfg();
  let res: Response;
  try {
    res = await fetch(`${base}/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new Error(`اتصال به تلگرام برقرار نشد (${(e as Error).name})`); // بدون URL، چون توکن داخل آن است
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(data.description || `خطای تلگرام ${res.status}`);
  return data.result as T;
}

async function download(fileId: string): Promise<Buffer | null> {
  try {
    const f = await call<{ file_path?: string; file_size?: number }>('getFile', { file_id: fileId });
    if (!f.file_path || (f.file_size ?? 0) > 12 * 1024 * 1024) return null;
    const { token, base } = cfg();
    const res = await fetch(`${base}/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

interface TgChat { id: number; type: string; username?: string }
interface TgMessage {
  message_id: number; date: number; chat: TgChat; text?: string; caption?: string; media_group_id?: string;
  photo?: { file_id: string }[]; video?: { thumbnail?: { file_id: string } };
}
interface TgUpdate { update_id: number; channel_post?: TgMessage; edited_channel_post?: TgMessage }

function isOurChannel(chat: TgChat): boolean {
  const want = cfg().channel.toLowerCase();
  return chat.type === 'channel' && (String(chat.id) === want || (!!chat.username && `@${chat.username}`.toLowerCase() === want));
}

async function handle(u: TgUpdate) {
  const m = u.channel_post ?? u.edited_channel_post;
  if (!m || !isOurChannel(m.chat)) return;
  const fileId = m.photo?.at(-1)?.file_id ?? m.video?.thumbnail?.file_id;
  const edited = Boolean(u.edited_channel_post);
  const res = await ingestPost({
    key: `${m.chat.id}:${m.message_id}`,
    groupId: m.media_group_id ?? null,
    text: m.text ?? m.caption ?? '',
    date: new Date(m.date * 1000),
    image: fileId && !edited ? await download(fileId) : null,
    edited,
  });
  if (res.status === 'created') setKV('tg_last_post', new Date().toISOString());
}

const g = globalThis as unknown as { __channelPoller?: boolean };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loop() {
  setKV('tg_error', '');
  for (;;) {
    try {
      const offset = Number(getKV('tg_offset') ?? 0) || undefined;
      let updates: TgUpdate[];
      try {
        updates = await call<TgUpdate[]>('getUpdates', { offset, timeout: 25, allowed_updates: ['channel_post', 'edited_channel_post'] }, 40_000);
      } catch (e) {
        // اگر webhook فعال باشد، getUpdates کار نمی‌کند؛ فقط در این حالت webhook را برمی‌داریم
        if (/webhook/i.test((e as Error).message)) {
          await call('deleteWebhook', { drop_pending_updates: false });
          continue;
        }
        throw e;
      }
      setKV('tg_last_poll', new Date().toISOString());
      setKV('tg_error', '');
      for (const u of updates) {
        try {
          await handle(u);
        } catch (e) {
          setKV('tg_error', `پردازش یک پست ناموفق بود: ${(e as Error).message}`.slice(0, 300));
        }
        setKV('tg_offset', String(u.update_id + 1)); // حتی اگر پردازش خطا داد، پست خراب جلوی بقیه را نمی‌گیرد
      }
    } catch (e) {
      const msg = (e as Error).message || 'خطای ناشناخته';
      setKV('tg_error', /conflict/i.test(msg) ? 'این توکن همزمان جای دیگری (مثلاً پنل شبکه‌های اجتماعی) در حال دریافت پیام است. برای هر ربات فقط یک دریافت‌کننده مجاز است.' : msg.slice(0, 300));
      await sleep(15_000);
    }
  }
}

/** از src/instrumentation.ts یک‌بار برای هر پروسه‌ی سرور صدا زده می‌شود. */
export function startChannelPolling() {
  if (!channelConfigured() || g.__channelPoller) return;
  g.__channelPoller = true;
  void loop();
}
