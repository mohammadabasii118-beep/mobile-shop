import Link from 'next/link';
import { ChevronLeft, Info, TriangleAlert, Inbox } from 'lucide-react';
import { fa } from '@/lib/format';

export function PageHead({ title, desc, crumbs, children }: { title: string; desc?: string; crumbs?: { label: string; href?: string }[]; children?: React.ReactNode }) {
  return (
    <div className="ad-head">
      <div>
        {crumbs && (
          <nav className="ad-crumb" aria-label="مسیر">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <ChevronLeft style={{ width: 12, height: 12 }} aria-hidden />}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="acts">{children}</div>}
    </div>
  );
}

export function Card({ title, desc, actions, footer, children, tight, id }: { title?: string; desc?: string; actions?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; tight?: boolean; id?: string }) {
  return (
    <section className="ad-card" id={id}>
      {title && (
        <div className="hd">
          <h2>{title}</h2>
          {actions}
          {desc && <p>{desc}</p>}
        </div>
      )}
      <div className={`bd${tight ? ' tight' : ''}`}>{children}</div>
      {footer && <div className="ft">{footer}</div>}
    </section>
  );
}

export function Note({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return <div className={`ad-note${warn ? ' warn' : ''}`}>{warn ? <TriangleAlert /> : <Info />}<div>{children}</div></div>;
}

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function EmptyState({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return <div className="ad-empty"><Inbox /><h3>{title}</h3>{desc && <p>{desc}</p>}{children}</div>;
}

export function Kpi({ label, value, unit, delta, icon, href, hint }: { label: string; value: string; unit?: string; delta?: { v: number; goodWhenUp?: boolean } | null; icon?: React.ReactNode; href?: string; hint?: string }) {
  const d = delta ? (delta.v === 0 ? 'flat' : (delta.v > 0) === (delta.goodWhenUp ?? true) ? 'up' : 'down') : null;
  return (
    <div className="kpi">
      <span className="lb">{icon}{label}</span>
      <span className="v num">{value}{unit && <small> {unit}</small>}</span>
      {delta && <span className={`d ${d}`}>{delta.v > 0 ? '▲' : delta.v < 0 ? '▼' : '■'} {fa(Math.abs(Math.round(delta.v)))}٪ نسبت به دوره‌ی قبل</span>}
      {hint && <span className="mute" style={{ fontSize: 12 }}>{hint}</span>}
      {href && <Link className="more link" href={href}>مشاهده</Link>}
    </div>
  );
}

export function Pagination({ page, pages, total, hrefFor, per }: { page: number; pages: number; total: number; hrefFor: (p: number) => string; per: number }) {
  if (total === 0) return null;
  const from = (page - 1) * per + 1, to = Math.min(total, page * per);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="ad-pager">
      <span className="num">نمایش {fa(from)} تا {fa(to)} از {fa(total)}</span>
      {pages > 1 && (
        <nav className="pager" aria-label="صفحه‌بندی">
          {page > 1 && <Link href={hrefFor(page - 1)} aria-label="قبلی">‹</Link>}
          {nums.map((n, i) => (
            <span key={n} style={{ display: 'contents' }}>
              {i > 0 && n - nums[i - 1] > 1 && <span>…</span>}
              {n === page ? <span className="cur">{fa(n)}</span> : <Link href={hrefFor(n)}>{fa(n)}</Link>}
            </span>
          ))}
          {page < pages && <Link href={hrefFor(page + 1)} aria-label="بعدی">›</Link>}
        </nav>
      )}
    </div>
  );
}

export function qsLink(base: string, sp: Record<string, string | string[] | undefined>, patch: Record<string, string | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) { const val = Array.isArray(v) ? v[0] : v; if (val) p.set(k, val); }
  for (const [k, v] of Object.entries(patch)) (v === null ? p.delete(k) : p.set(k, v));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export function Switch({ name, label, defaultChecked, value = '1' }: { name: string; label: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} />
      <span className="tr" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
