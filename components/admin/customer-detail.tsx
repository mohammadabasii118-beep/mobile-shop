"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, ErrorBox, Label, ORDER_LABEL, Pill, Spinner, StatusPill, act, btnDanger, btnGhost, btnPrimary, confirmAsk, fmtDate, fmtId, fmtNum, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface C {
  id: string; phone: string; email: string | null; firstName: string | null; lastName: string | null; displayName: string | null; isActive: boolean; phoneVerifiedAt: string | null; lastLoginAt: string | null; createdAt: string;
  roles: { id: string; key: string; name: string; isStaff: boolean }[]; addresses: { id: string; title: string | null; receiver: string; phone: string; province: string; city: string; address: string; postalCode: string | null }[];
  wallet: { balance: number } | null; loyalty: { points: number } | null; wholesaleProfile: { storeName: string; tier: { id: string; key: string; name: string } } | null;
  orders: { number: number; status: string; total: number; type: string; createdAt: string }[]; spent: number; paidOrders: number;
}

export function CustomerDetail({ id, canWrite, canRoles, canWholesale, selfId }: { id: string; canWrite: boolean; canRoles: boolean; canWholesale: boolean; selfId: string }) {
  const { data: c, error, loading, reload } = useApi<C>(`/api/admin/customers/${id}`);
  const roles = useApi<{ items: never[]; roles: { key: string; name: string; isStaff: boolean }[] }>(canRoles ? "/api/admin/customers?roles=1&per=1" : null);
  const tiers = useApi<{ items: { id: string; name: string; isActive: boolean }[] }>(canWholesale ? "/api/admin/r/tiers" : null);
  const [form, setForm] = useState<{ firstName: string; lastName: string; displayName: string; email: string } | null>(null);
  const [sel, setSel] = useState<string[] | null>(null);
  if (error) return <ErrorBox message={error} />;
  if (loading || !c) return <Spinner />;
  const f = form ?? { firstName: c.firstName ?? "", lastName: c.lastName ?? "", displayName: c.displayName ?? "", email: c.email ?? "" };
  const chosen = sel ?? c.roles.map((r) => r.key);
  const save = async () => { const r = await act("PATCH", `/api/admin/customers/${id}`, { firstName: f.firstName || undefined, lastName: f.lastName || undefined, displayName: f.displayName || undefined, email: f.email || null }, "اطلاعات ذخیره شد."); if (r.ok) { setForm(null); reload(); } };
  const toggle = async () => { if (!confirmAsk(c.isActive ? "حساب غیرفعال و همه نشست‌های آن بسته شود؟" : "حساب فعال شود؟")) return; const r = await act("PATCH", `/api/admin/customers/${id}`, { isActive: !c.isActive }, c.isActive ? "حساب غیرفعال شد." : "حساب فعال شد."); if (r.ok) reload(); };
  const saveRoles = async () => { const r = await act("POST", `/api/admin/customers/${id}/roles`, { roleKeys: chosen }, "نقش‌ها ذخیره شد."); if (r.ok) { setSel(null); reload(); } };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black">اطلاعات کاربر</h2><Pill tone={c.isActive ? "ok" : "bad"}>{c.isActive ? "فعال" : "غیرفعال"}</Pill></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label label="نام"><input className={inputCls} disabled={!canWrite} value={f.firstName} onChange={(e) => setForm({ ...f, firstName: e.target.value })} /></Label>
            <Label label="نام خانوادگی"><input className={inputCls} disabled={!canWrite} value={f.lastName} onChange={(e) => setForm({ ...f, lastName: e.target.value })} /></Label>
            <Label label="نام نمایشی"><input className={inputCls} disabled={!canWrite} value={f.displayName} onChange={(e) => setForm({ ...f, displayName: e.target.value })} /></Label>
            <Label label="ایمیل"><input dir="ltr" className={inputCls} disabled={!canWrite} value={f.email} onChange={(e) => setForm({ ...f, email: e.target.value })} /></Label>
            <Label label="موبایل (غیرقابل ویرایش)"><input dir="ltr" className={inputCls} disabled value={c.phone} readOnly /></Label>
            <div className="text-xs leading-6 text-muted">عضویت: {fmtDate(c.createdAt)}<br />آخرین ورود: {fmtDate(c.lastLoginAt)}<br />تأیید موبایل: {c.phoneVerifiedAt ? "بله" : "خیر"}</div>
          </div>
          {canWrite && <div className="mt-3 flex flex-wrap gap-2"><button className={btnPrimary} disabled={!form} onClick={save}>ذخیره</button>{c.id !== selfId && <button className={c.isActive ? btnDanger : btnGhost} onClick={toggle}>{c.isActive ? "غیرفعال‌سازی حساب" : "فعال‌سازی حساب"}</button>}</div>}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-black">سفارش‌ها <span className="text-xs font-normal text-muted">({fmtNum(c.paidOrders)} پرداخت‌شده، جمع خرید {fmtToman(c.spent)})</span></h2>
          {c.orders.length === 0 ? <p className="py-4 text-center text-sm text-muted">سفارشی ندارد.</p> : <ul className="divide-y divide-border text-sm">{c.orders.map((o) => <li key={o.number}><Link href={`/admin/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:text-primary"><b>#{fmtId(o.number)}</b><span className="text-xs text-muted">{fmtDate(o.createdAt)}</span><StatusPill map={ORDER_LABEL} value={o.status} /><b>{fmtToman(o.total)}</b></Link></li>)}</ul>}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-black">آدرس‌ها</h2>
          {c.addresses.length === 0 ? <p className="py-4 text-center text-sm text-muted">آدرسی ثبت نشده.</p> : <ul className="space-y-2 text-sm">{c.addresses.map((a) => <li key={a.id} className="rounded-lg bg-surface-2 p-3"><b>{a.title ?? "آدرس"}</b> — {a.receiver} (<span dir="ltr">{a.phone}</span>)<br /><span className="text-muted">{a.province}، {a.city}، {a.address}{a.postalCode ? ` — ${a.postalCode}` : ""}</span></li>)}</ul>}
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="space-y-2 text-sm">
          <h2 className="text-sm font-black">کیف پول و امتیاز</h2>
          <div className="flex justify-between"><span className="text-muted">موجودی کیف پول</span><b>{fmtToman(c.wallet?.balance ?? 0)}</b></div>
          <div className="flex justify-between"><span className="text-muted">امتیاز باشگاه</span><b>{fmtNum(c.loyalty?.points ?? 0)}</b></div>
          <p className="text-[11px] text-muted">فقط مشاهده — مدیریت کامل در فاز بعد.</p>
        </Card>
        <Card className="space-y-2 text-sm">
          <h2 className="text-sm font-black">همکاری عمده</h2>
          {c.wholesaleProfile ? (
            <>
              <p>فروشگاه: <b>{c.wholesaleProfile.storeName}</b></p>
              <p>سطح: <Pill tone="warn">{c.wholesaleProfile.tier.name}</Pill></p>
              {canWholesale && tiers.data && (
                <div className="flex gap-2 pt-1">
                  <select className={cn(inputCls, "flex-1")} value={c.wholesaleProfile.tier.id} onChange={async (e) => { const r = await act("PATCH", `/api/admin/wholesale/partners/${id}`, { tierId: e.target.value }, "سطح تغییر کرد."); if (r.ok) reload(); }} aria-label="سطح">{tiers.data.items.filter((t) => t.isActive || t.id === c.wholesaleProfile!.tier.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  <button className={btnDanger} onClick={async () => { if (confirmAsk("دسترسی عمده لغو شود؟")) { const r = await act("DELETE", `/api/admin/wholesale/partners/${id}`, undefined, "دسترسی عمده لغو شد."); if (r.ok) reload(); } }}>لغو</button>
                </div>
              )}
            </>
          ) : <p className="text-muted">همکار عمده نیست.</p>}
        </Card>
        {canRoles && roles.data && (
          <Card className="space-y-2">
            <h2 className="text-sm font-black">نقش‌ها</h2>
            <div className="space-y-1.5">{roles.data.roles.map((r) => <label key={r.key} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--primary)]" checked={chosen.includes(r.key)} onChange={(e) => setSel(e.target.checked ? [...chosen, r.key] : chosen.filter((k) => k !== r.key))} />{r.name}{r.isStaff && <Pill tone="info">کارمند</Pill>}</label>)}</div>
            <button className={cn(btnPrimary, "w-full")} disabled={!sel} onClick={saveRoles}>ذخیره نقش‌ها</button>
          </Card>
        )}
      </div>
    </div>
  );
}
