import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Search } from 'lucide-react';
import { all, get } from '@/lib/db';
import { fa, jdate, normText, toman } from '@/lib/format';
import { Card, EmptyState, PageHead, Pagination, Pill, qsLink, one } from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/client';
import { createUser, updateUser } from '@/lib/actions/admin-sales';

export const metadata: Metadata = { title: 'کاربران' };
const PER = 25;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = normText(one(sp.q)), role = one(sp.role), editId = Number(one(sp.edit)) || 0;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where: string[] = []; const args: unknown[] = [];
  if (q) { where.push('(u.name LIKE ? OR u.login LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (role === 'admin' || role === 'customer') { where.push('u.role = ?'); args.push(role); }
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM users u ${W}`, ...args)!.n;
  const rows = all<{ id: number; name: string; login: string; role: string; active: number; created_at: string; orders: number; spent: number }>(
    `SELECT u.id, u.name, u.login, u.role, u.active, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.status NOT IN ('cancelled','returned')) spent
     FROM users u ${W} ORDER BY u.id DESC LIMIT ? OFFSET ?`, ...args, PER, (page - 1) * PER);
  const cur = editId ? get<{ id: number; name: string; login: string; role: string; active: number }>('SELECT id, name, login, role, active FROM users WHERE id = ?', editId) : undefined;
  const href = (p: number) => qsLink('/admin/users', sp, { page: String(p) });
  return (
    <>
      <PageHead title="کاربران" desc="مشتری‌ها و مدیران. مدیران به پنل دسترسی دارند؛ مشتری‌ها فقط حساب و سفارش‌های خودشان را می‌بینند." />
      <div className="ad-cols">
        <Card tight>
          <nav className="ad-tabs"><Link href="/admin/users" aria-current={!role ? 'page' : undefined}>همه</Link><Link href="/admin/users?role=customer" aria-current={role === 'customer' ? 'page' : undefined}>مشتری‌ها</Link><Link href="/admin/users?role=admin" aria-current={role === 'admin' ? 'page' : undefined}>مدیران</Link></nav>
          <div className="ad-toolbar"><form method="get" action="/admin/users">{role && <input type="hidden" name="role" value={role} />}<label className="ad-search grow"><Search className="i" style={{ width: 18 }} /><input name="q" defaultValue={q} placeholder="نام یا موبایل…" aria-label="جستجوی کاربر" /></label><button className="btn btn-secondary">جستجو</button></form></div>
          {rows.length === 0 ? <EmptyState title="کاربری پیدا نشد" /> : (
            <div className="ad-tablewrap"><table className="ad-table cards">
              <thead><tr><th>کاربر</th><th>نقش</th><th>عضویت</th><th className="num-col">سفارش‌ها</th><th className="num-col">مجموع خرید</th><th>وضعیت</th><th /></tr></thead>
              <tbody>{rows.map((u) => (
                <tr key={u.id}>
                  <td className="full"><b style={{ color: 'var(--ink)' }}>{u.name || '—'}</b><small className="mute num" style={{ display: 'block' }}>{u.login}</small></td>
                  <td data-label="نقش"><Pill tone={u.role === 'admin' ? 'info' : 'muted'}>{u.role === 'admin' ? 'مدیر' : 'مشتری'}</Pill></td>
                  <td data-label="عضویت" className="mute">{jdate(u.created_at)}</td>
                  <td data-label="سفارش‌ها" className="num-col">{fa(u.orders)}</td>
                  <td data-label="مجموع خرید" className="num-col">{u.spent ? `${toman(u.spent)} تومان` : '—'}</td>
                  <td data-label="وضعیت"><Pill tone={u.active ? 'success' : 'danger'}>{u.active ? 'فعال' : 'مسدود'}</Pill></td>
                  <td className="full"><div className="actions"><Link className="btn btn-secondary btn-sm" href={`/admin/users?edit=${u.id}`}><Pencil />ویرایش</Link></div></td>
                </tr>))}</tbody>
            </table></div>
          )}
          <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} total={total} hrefFor={href} per={PER} />
        </Card>
        <div className="ad-stack">
          {cur && (
            <Card title={`ویرایش ${cur.name || cur.login}`}>
              <ActionForm key={cur.id} action={updateUser.bind(null, cur.id)}>
                <div className="fld"><label htmlFor="un">نام</label><input id="un" className="input" name="name" defaultValue={cur.name} /></div>
                <div className="fld"><label htmlFor="ur">نقش</label><select id="ur" className="sel" name="role" defaultValue={cur.role}><option value="customer">مشتری</option><option value="admin">مدیر</option></select></div>
                <div className="fld"><label htmlFor="up">رمز عبور جدید</label><input id="up" className="input" name="password" type="password" dir="ltr" autoComplete="new-password" placeholder="خالی = بدون تغییر" /></div>
                <label className="switch"><input type="checkbox" name="active" value="1" defaultChecked={!!cur.active} /><span className="tr" /><span>حساب فعال</span></label>
              </ActionForm>
              <Link className="link" href="/admin/users">انصراف</Link>
            </Card>
          )}
          <Card title="کاربر جدید">
            <ActionForm action={createUser} submit="ساخت کاربر" reset>
              <div className="fld"><label htmlFor="cn">نام</label><input id="cn" className="input" name="name" required /></div>
              <div className="fld"><label htmlFor="cr">نقش</label><select id="cr" className="sel" name="role"><option value="admin">مدیر</option><option value="customer">مشتری</option></select></div>
              <div className="fld"><label htmlFor="cl">نام کاربری / موبایل</label><input id="cl" className="input" name="login" dir="ltr" required /><span className="help">مدیر: حروف انگلیسی. مشتری: شماره موبایل.</span></div>
              <div className="fld"><label htmlFor="cp">رمز عبور</label><input id="cp" className="input" name="password" type="password" dir="ltr" autoComplete="new-password" required minLength={6} /></div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
