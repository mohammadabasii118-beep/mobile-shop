'use server';

import { revalidatePath } from 'next/cache';
import { get, run } from '../db';
import { assertAdmin } from '../auth';
import type { AState } from '@/components/admin/client';

export async function toggleChannelPost(id: number): Promise<AState> {
  await assertAdmin();
  const r = get<{ visible: number }>('SELECT visible FROM channel_posts WHERE id = ?', id);
  if (!r) return { error: 'پست پیدا نشد' };
  run('UPDATE channel_posts SET visible = ? WHERE id = ?', r.visible ? 0 : 1, id);
  revalidatePath('/admin/channel');
  return { ok: r.visible ? 'پست از سایت پنهان شد' : 'پست دوباره نمایش داده می‌شود' };
}

/** فقط ردیف فید حذف می‌شود؛ محصولی که از این پست ساخته شده دست‌نخورده می‌ماند (از «محصولات» حذف می‌شود). */
export async function deleteChannelPost(id: number): Promise<AState> {
  await assertAdmin();
  run('DELETE FROM channel_posts WHERE id = ?', id);
  revalidatePath('/admin/channel');
  return { ok: 'پست از فید حذف شد' };
}
