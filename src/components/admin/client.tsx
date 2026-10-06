'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';

export type AState = { ok?: string; error?: string; id?: number } | undefined;
export type AAction = (prev: AState, fd: FormData) => Promise<AState>;

export function adminToast(msg: string, kind: 'ok' | 'err' = 'ok') {
  window.dispatchEvent(new CustomEvent('ad-toast', { detail: { msg, kind } }));
}

export function AdminToaster() {
  const [list, setList] = useState<{ id: number; msg: string; kind: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const h = (e: Event) => {
      const { msg, kind } = (e as CustomEvent).detail;
      const id = ++n;
      setList((l) => [...l.slice(-2), { id, msg, kind }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4500);
    };
    window.addEventListener('ad-toast', h);
    return () => window.removeEventListener('ad-toast', h);
  }, []);
  return (
    <div className="toasts" style={{ bottom: 24 }} aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast${t.kind === 'err' ? ' err' : ''}`} role={t.kind === 'err' ? 'alert' : 'status'}>
          {t.kind === 'err' ? <AlertCircle className="i" /> : <Check className="i" />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/** فرم عمومی با وضعیت ارسال، پیام موفقیت/خطا و toast */
export function ActionForm({
  action, children, className = 'form', submit = 'ذخیره', submitClass = 'btn btn-primary', reset = false, footer, inline = false,
}: { action: AAction; children: React.ReactNode; className?: string; submit?: string; submitClass?: string; reset?: boolean; footer?: React.ReactNode; inline?: boolean }) {
  const [state, act, pending] = useActionState<AState, FormData>(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) { adminToast(state.ok); if (reset) ref.current?.reset(); }
    if (state.error) adminToast(state.error, 'err');
  }, [state, reset]);
  return (
    <form ref={ref} action={act} className={className}>
      {children}
      {state?.error && !inline && <div className="alert err" role="alert">{state.error}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={submitClass} disabled={pending}>{pending ? 'در حال ذخیره…' : submit}</button>
        {footer}
      </div>
    </form>
  );
}

/** دکمه‌ی حذف/عمل خطرناک با تأیید دومرحله‌ای (بدون window.confirm) */
export function ConfirmForm({
  action, label, confirmLabel = 'بله، انجام شود', className = 'btn btn-danger-soft btn-sm', icon, message = 'مطمئنید؟',
}: { action: () => Promise<AState | void>; label: string; confirmLabel?: string; className?: string; icon?: React.ReactNode; message?: string }) {
  const [ask, setAsk] = useState(false);
  const [pending, setPending] = useState(false);
  if (!ask) return <button type="button" className={className} onClick={() => setAsk(true)}>{icon}{label}</button>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label="تأیید">
      <span style={{ fontSize: 12.5, color: 'var(--sale)', fontWeight: 600 }}>{message}</span>
      <button
        type="button" className="btn btn-danger btn-sm" disabled={pending}
        onClick={async () => {
          setPending(true);
          const r = await action();
          setPending(false);
          setAsk(false);
          if (r && r.error) adminToast(r.error, 'err'); else if (r && r.ok) adminToast(r.ok);
        }}
      >{pending ? '…' : confirmLabel}</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsk(false)}>انصراف</button>
    </span>
  );
}

/** دکمه‌ی عمل سریع (بدون تأیید) که یک server action را صدا می‌زند */
export function QuickAction({ action, children, className = 'btn btn-secondary btn-sm', title }: { action: () => Promise<AState | void>; children: React.ReactNode; className?: string; title?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button" className={className} title={title} disabled={pending} aria-label={title}
      onClick={async () => {
        setPending(true);
        const r = await action();
        setPending(false);
        if (r && r.error) adminToast(r.error, 'err'); else if (r && r.ok) adminToast(r.ok);
      }}
    >{children}</button>
  );
}

export function PrintButton({ label = 'چاپ' }: { label?: string }) {
  return <button type="button" className="btn btn-secondary" onClick={() => window.print()}>{label}</button>;
}

/** نمایش عدد با جداکننده هنگام تایپ؛ مقدار واقعی لاتین در input مخفی */
export function MoneyInput({ name, defaultValue, id, placeholder, required }: { name: string; defaultValue?: number | null; id?: string; placeholder?: string; required?: boolean }) {
  const [v, setV] = useState(defaultValue ? String(defaultValue) : '');
  const shown = v ? Number(v).toLocaleString('fa-IR') : '';
  return (
    <>
      <input type="hidden" name={name} value={v} />
      <input
        id={id} className="input num" inputMode="numeric" placeholder={placeholder} value={shown} required={required}
        onChange={(e) => {
          const raw = e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
          setV(raw.replace(/^0+(?=\d)/, ''));
        }}
      />
    </>
  );
}
