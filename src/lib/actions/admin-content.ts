'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { all, get, run, tx } from '../db';
import { assertAdmin, getUser, hashPassword, verifyPassword } from '../auth';
import { normText, toInt } from '../format';
import type { AState } from '@/components/admin/client';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/* ═════════ بنرها ═════════ */
export async function saveBanner(id: number | null, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const title = str(fd, 'title').slice(0, 120);
  if (title.length < 2) return { error: 'عنوان بنر را وارد کنید' };
  const position = str(fd, 'position') === 'promo' ? 'promo' : 'hero';
  const layout = str(fd, 'layout') === 'cover' ? 'cover' : 'split';
  const theme = ['night', 'light', 'brand'].includes(str(fd, 'theme')) ? str(fd, 'theme') : 'night';
  const image = str(fd, 'image'), imageM = str(fd, 'image_mobile');
  if (layout === 'cover' && !image.startsWith('/uploads/')) return { error: 'برای بنر تمام‌تصویر، یک تصویر آپلود کنید' };
  const link = str(fd, 'link');
  if (link && !(link.startsWith('/') && !link.startsWith('//')) && !/^https?:\/\//.test(link)) return { error: 'لینک باید با / (صفحه‌ی داخلی) یا https:// شروع شود' };
  const badgeA = normText(str(fd, 'badge_a')).slice(0, 24), badgeB = normText(str(fd, 'badge_b')).slice(0, 40);
  const vals = [
    position, layout, theme, badgeA ? (badgeB ? `${badgeA}|${badgeB}` : badgeA) : '', title, normText(str(fd, 'subtitle')).slice(0, 220), normText(str(fd, 'cta_text')).slice(0, 30), link,
    image.startsWith('/uploads/') ? image : null, imageM.startsWith('/uploads/') ? imageM : null, /^p-[a-z]+$/.test(str(fd, 'art')) ? str(fd, 'art') : null,
    toInt(str(fd, 'sort')), fd.get('active') ? 1 : 0, str(fd, 'starts_at') || null, str(fd, 'ends_at') || null,
  ];
  if (id) run('UPDATE banners SET position=?, layout=?, theme=?, badge=?, title=?, subtitle=?, cta_text=?, link=?, image=?, image_mobile=?, art=?, sort=?, active=?, starts_at=?, ends_at=? WHERE id=?', ...vals, id);
  else {
    const max = get<{ m: number | null }>('SELECT MAX(sort) m FROM banners WHERE position = ?', position)?.m ?? 0;
    vals[11] = toInt(str(fd, 'sort')) || max + 1;
    run('INSERT INTO banners (position, layout, theme, badge, title, subtitle, cta_text, link, image, image_mobile, art, sort, active, starts_at, ends_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...vals);
  }
  revalidatePath('/admin/banners'); revalidatePath('/');
  if (!id) redirect('/admin/banners');
  return { ok: 'بنر ذخیره شد' };
}

export async function deleteBanner(id: number): Promise<AState> {
  await assertAdmin();
  run('DELETE FROM banners WHERE id = ?', id);
  revalidatePath('/admin/banners'); revalidatePath('/');
  redirect('/admin/banners');
}

export async function toggleBanner(id: number): Promise<AState> {
  await assertAdmin();
  run('UPDATE banners SET active = 1 - active WHERE id = ?', id);
  revalidatePath('/admin/banners'); revalidatePath('/');
  return { ok: 'وضعیت بنر تغییر کرد' };
}

export async function moveBanner(id: number, dir: -1 | 1): Promise<AState> {
  await assertAdmin();
  const b = get<{ id: number; position: string }>('SELECT id, position FROM banners WHERE id = ?', id);
  if (!b) return { error: 'بنر پیدا نشد' };
  const list = all<{ id: number }>('SELECT id FROM banners WHERE position = ? ORDER BY sort, id', b.position);
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  tx(() => list.forEach((x, k) => run('UPDATE banners SET sort = ? WHERE id = ?', k + 1, x.id)));
  revalidatePath('/admin/banners'); revalidatePath('/');
}

/* ═════════ تنظیمات ═════════ */
const GROUPS: Record<string, { keys: string[]; flags?: string[]; ints?: string[] }> = {
  general: { keys: ['store_name', 'store_name_en', 'tagline', 'phone', 'email', 'address', 'footer_about', 'instagram', 'telegram'] },
  announce: { keys: ['announcements'] },
  shipping: { keys: [], ints: ['shipping_cost', 'free_shipping_min'] },
  payment: { keys: ['checkout_note'], flags: ['pay_cod', 'pay_online'] },
  inventory: { keys: [], ints: ['low_stock'] },
};

export async function saveSettings(group: string, _p: AState, fd: FormData): Promise<AState> {
  await assertAdmin();
  const g = GROUPS[group];
  if (!g) return { error: 'گروه تنظیمات نامعتبر است' };
  const put = (k: string, v: string) => run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, v);
  tx(() => {
    for (const k of g.keys) {
      let v = String(fd.get(k) ?? '').replace(/\r/g, '').trim();
      if ((k === 'instagram' || k === 'telegram') && v && !/^https?:\/\//.test(v)) v = `https://${v}`;
      if (k === 'store_name' && !v) v = 'فروشگاه';
      put(k, v.slice(0, 600));
    }
    for (const k of g.ints ?? []) put(k, String(Math.max(0, toInt(fd.get(k)))));
    for (const k of g.flags ?? []) put(k, fd.get(k) ? '1' : '0');
  });
  revalidatePath('/', 'layout');
  return { ok: 'تنظیمات ذخیره شد' };
}

export async function changeMyAccount(_p: AState, fd: FormData): Promise<AState> {
  const me = await getUser();
  if (!me) return { error: 'ابتدا وارد شوید' };
  const name = normText(str(fd, 'name'));
  if (name.length < 2) return { error: 'نام را وارد کنید' };
  const cur = str(fd, 'current'), pw = str(fd, 'password');
  if (pw) {
    const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', me.id)!;
    if (!verifyPassword(cur, row.password_hash)) return { error: 'رمز فعلی درست نیست' };
    if (pw.length < 8) return { error: 'رمز جدید حداقل ۸ نویسه باشد' };
    run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(pw), me.id);
  }
  run('UPDATE users SET name = ? WHERE id = ?', name, me.id);
  revalidatePath('/admin', 'layout');
  return { ok: pw ? 'نام و رمز عبور ذخیره شد' : 'نام ذخیره شد' };
}
