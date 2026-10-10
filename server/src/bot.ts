export interface BotOptions {
  token: string;
  /** آدرس HTTPS بازی (همان که داخل تلگرام باز می‌شود) */
  webAppUrl: string;
  apiBase?: string;
  log?: (s: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ربات حداقلی: به /start جواب می‌دهد و دکمه‌ی ورود به بازی را می‌فرستد؛ دکمه‌ی منو را هم تنظیم می‌کند.
 * از getUpdates استفاده می‌کند. اگر برنامه‌ی دیگری (مثلاً ربات VPN) با همین توکن پیام می‌گیرد، تلگرام خطای ۴۰۹
 * می‌دهد و این ربات برای اینکه مزاحم آن نشود، کاملاً متوقف می‌شود.
 */
export function startBot(o: BotOptions) {
  const log = o.log ?? ((s: string) => console.log(`[bot] ${s}`));
  const base = `${o.apiBase ?? 'https://api.telegram.org'}/bot${o.token}`;
  const ac = new AbortController();
  let stopped = false;

  if (!o.webAppUrl.startsWith('https://')) {
    log('WEBAPP_URL باید با https:// شروع شود؛ ربات فعال نشد.');
    return { stop() {} };
  }

  const api = async (method: string, body: object = {}, signal?: AbortSignal): Promise<any> => {
    const r = await fetch(`${base}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
    return r.json();
  };

  const welcome = (chatId: number) => api('sendMessage', {
    chat_id: chatId,
    text: 'به «میراث» خوش آمدی ⚔️\nسه کارت انتخاب کن، با ربات یا بازیکن‌های دیگر نبرد کن و کارت‌هایت را قوی‌تر کن.',
    reply_markup: { inline_keyboard: [[{ text: '🎮 ورود به بازی', web_app: { url: o.webAppUrl } }]] },
  });

  (async () => {
    try {
      const me = await api('getMe');
      if (!me.ok) { log(`توکن نامعتبر است: ${me.description ?? ''}`); return; }
      log(`فعال شد: @${me.result.username}`);
      await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'میراث', web_app: { url: o.webAppUrl } } });
    } catch (e) { log(`خطا در اتصال به تلگرام: ${(e as Error).message}`); }

    let offset = 0;
    while (!stopped) {
      try {
        const j = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, ac.signal);
        if (!j.ok) {
          if (j.error_code === 409) { log('این توکن را برنامه‌ی دیگری هم استفاده می‌کند (۴۰۹). برای اینکه مزاحمش نشوم متوقف شدم. برای این بازی یک ربات جدا بساز.'); return; }
          if (j.error_code === 401) { log('توکن نامعتبر است.'); return; }
          await sleep(5000); continue;
        }
        for (const u of j.result as any[]) {
          offset = u.update_id + 1;
          const m = u.message;
          if (m?.chat?.type === 'private' && typeof m.text === 'string' && m.text.startsWith('/start')) await welcome(m.chat.id);
        }
      } catch (e) {
        if (stopped) return;
        await sleep(3000);
      }
    }
  })();

  return { stop() { stopped = true; ac.abort(); } };
}
