/** متن پیام اول /start (در پنل مدیریت ← «ظاهر و بنر» قابل تغییر است) */
export const DEFAULT_WELCOME = `سلام، به میراث خوش اومدی❤️

✅ میراث یه بازی کارتیه. تا پنج تا کارت می‌چینی و باهاشون با یه حریف روبه‌رو می‌شی؛ یا ربات (حالت سولو) یا یه بازیکن واقعی (مولتی‌پلیر).

⚔ مبارزه این‌طوری پیش می‌ره:
نوبت‌ها یکی‌درمیونه، یه حمله از تو، یه حمله از حریف. وقتی نوبتته، کارتی که می‌خوای رو با انگشت می‌گیری و می‌کشی روی کارت حریف تا بهش حمله کنه. پانزده ثانیه وقت داری و اگه نزنی، بازی خودش یه حمله انتخاب می‌کنه. هر کارتی که حمله کرد، چند نوبت خاموش می‌شه و باید از بقیه کارت‌هات استفاده کنی. هر ضربه اول شیلد کارت رو کم می‌کنه و وقتی شیلد تموم شد، نوبت جانه. هر کارت بعد از چند حمله قدرت ویژه می‌گیره و حمله‌ی بعدیش دو برابر می‌شه. هر کی زودتر همه‌ی کارت‌های حریف رو بزنه، برنده‌ست.

💰 فقط برنده جعبه می‌گیره. توی جعبه سکه و تجربه هست و گاهی هم کارت جدید. جعبه تایمر داره و باید صبر کنی تا باز بشه. بازنده چیزی نمی‌گیره. اگه وسط مبارزه بازی رو ببندی یا اینترنتت قطع بشه، بازنده حساب می‌شی.

⚒ یه چیز دیگه: بازی هنوز نسخه‌ی آزمایشیه. ممکنه به باگ بخوری یا بعضی چیزها بین آپدیت‌ها عوض بشه. اگه مشکلی دیدی به پشتیبانی بگو، و اگه می‌شه یه اسکرین‌شات یا ویدیو هم بفرست.

✅ کانال رسمی: @MirasGame
✅ پشتیبانی: @BHK_Su`;

/** متن بالای دکمه‌ی ورود به بازی (پیام دوم /start) */
export const READY_TEXT = 'هر وقت آماده بودی، بزن بریم👇';

export interface BotOptions {
  token: string;
  /** آدرس HTTPS بازی (همان که داخل تلگرام باز می‌شود) */
  webAppUrl: string;
  apiBase?: string;
  /** متن سفارشی پیام اول (اگر خالی باشد متن پیش‌فرض) */
  welcomeText?: () => string | undefined;
  /** دستور /backup؛ تشخیص ادمین‌بودن با خود تابع است و متن جواب را برمی‌گرداند */
  onBackup?: (fromId: number, chatId: number) => Promise<string>;
  /** استار تلگرام: قبل از گرفتن پول (null = تأیید، رشته = رد با این پیام) */
  onPreCheckout?: (q: any) => string | null;
  /** استار تلگرام: بعد از پرداخت موفق؛ متنی که برای بازیکن فرستاده شود (یا null) */
  onPayment?: (m: any) => string | null;
  /** کاربری با /start (و متن بعدش، مثل ref_123) آمد */
  onStart?: (fromId: number, payload: string) => void;
  /** نام کاربری ربات بعد از اتصال */
  onReady?: (username: string) => void;
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

  /** پیام اول: متن معرفی. پیام دوم: متن کوتاه + دکمه‌ی (شیشه‌ای) ورود به بازی */
  const welcome = async (chatId: number) => {
    await api('sendMessage', { chat_id: chatId, text: o.welcomeText?.()?.trim() || DEFAULT_WELCOME, disable_web_page_preview: true });
    await api('sendMessage', {
      chat_id: chatId,
      text: READY_TEXT,
      reply_markup: { inline_keyboard: [[{ text: '🎮 ورود به بازی', web_app: { url: o.webAppUrl } }]] },
    });
  };

  (async () => {
    try {
      const me = await api('getMe');
      if (!me.ok) { log(`توکن نامعتبر است: ${me.description ?? ''}`); return; }
      log(`فعال شد: @${me.result.username}`);
      o.onReady?.(me.result.username);
      await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'میراث', web_app: { url: o.webAppUrl } } });
    } catch (e) { log(`خطا در اتصال به تلگرام: ${(e as Error).message}`); }

    let offset = 0;
    while (!stopped) {
      try {
        const j = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'pre_checkout_query'] }, ac.signal);
        if (!j.ok) {
          if (j.error_code === 409) { log('این توکن را برنامه‌ی دیگری هم استفاده می‌کند (۴۰۹). برای اینکه مزاحمش نشوم متوقف شدم. برای این بازی یک ربات جدا بساز.'); return; }
          if (j.error_code === 401) { log('توکن نامعتبر است.'); return; }
          await sleep(5000); continue;
        }
        for (const u of j.result as any[]) {
          offset = u.update_id + 1;
          if (u.pre_checkout_query && o.onPreCheckout) {
            const q = u.pre_checkout_query; let err: string | null = 'خطای داخلی';
            try { err = o.onPreCheckout(q); } catch (e) { log(`pre_checkout: ${(e as Error).message}`); }
            await api('answerPreCheckoutQuery', err ? { pre_checkout_query_id: q.id, ok: false, error_message: err } : { pre_checkout_query_id: q.id, ok: true });
            continue;
          }
          const m = u.message;
          if (m?.successful_payment && o.onPayment) {
            try { const t = o.onPayment(m); if (t) await api('sendMessage', { chat_id: m.chat.id, text: t }); } catch (e) { log(`payment: ${(e as Error).message}`); }
            continue;
          }
          if (m?.chat?.type === 'private' && typeof m.text === 'string' && m.text.startsWith('/start')) {
            try { o.onStart?.(m.from?.id, m.text.slice(6).trim()); } catch (e) { log(`start: ${(e as Error).message}`); }
            await welcome(m.chat.id);
          }
          else if (m?.chat?.type === 'private' && typeof m.text === 'string' && m.text.startsWith('/backup') && o.onBackup) {
            try { await api('sendMessage', { chat_id: m.chat.id, text: await o.onBackup(m.from?.id, m.chat.id) }); } catch (e) { log(`backup: ${(e as Error).message}`); }
          }
        }
      } catch (e) {
        if (stopped) return;
        await sleep(3000);
      }
    }
  })();

  return { stop() { stopped = true; ac.abort(); } };
}
