import { useState } from 'react';
import type { Profile } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { openLink } from './telegram';

/**
 * عضویت اجباری کانال: یک منوی شیشه‌ای روی پس‌زمینه‌ی مات.
 * فقط تا وقتی عضویت تأیید نشده نشان داده می‌شود؛ بعد از تأیید (که در سرور ذخیره می‌شود) دیگر هیچ‌وقت.
 */
export function Gate({ ctx }: { ctx: Ctx }) {
  const username = ctx.cfg.channel?.username ?? 'MirasGame';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const verify = async () => {
    setBusy(true); setMsg(null);
    try {
      const j = await call('/api/channel/verify', {}) as { ok: boolean; error?: string; profile: Profile };
      if (j.ok) ctx.setProfile(j.profile);
      else setMsg(j.error ?? 'هنوز عضو کانال نیستی');
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="gate-bg" role="dialog" aria-modal="true" aria-label="عضویت در کانال">
      <div className="gate">
        <div className="gate-ico">📣</div>
        <p>برای بازی باید عضو کانال میراث باشی. اطلاعیه‌ی آپدیت‌ها و خبرها اونجا گذاشته می‌شه. بعد از عضویت، دکمه‌ی «عضو شدم» رو بزن.</p>
        {msg && <div className="gate-msg" role="alert">{msg}</div>}
        <button className="btn" onClick={() => openLink(`https://t.me/${username}`)}>عضویت در کانال</button>
        <button className="btn ghost" disabled={busy} onClick={() => void verify()}>{busy ? 'در حال بررسی…' : 'عضو شدم'}</button>
      </div>
    </div>
  );
}
