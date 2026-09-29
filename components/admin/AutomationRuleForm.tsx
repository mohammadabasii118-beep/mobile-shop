"use client";
import { useState } from "react";
import { createAutomationRule } from "@/lib/actions/automation";

const TRIGGERS = [
  { value: "ORDER_DELIVERED", label: "سفارش تحویل داده شد" },
  { value: "NEW_SUPPORT_TICKET", label: "تیکت پشتیبانی جدید" },
  { value: "NEW_CONTACT_MESSAGE", label: "پیام تماس جدید" },
  { value: "LOW_STOCK", label: "موجودی یک محصول کم شد" },
];
const ACTIONS = [
  { value: "CREATE_ADMIN_ALERT", label: "ساخت هشدار برای مدیر" },
  { value: "GRANT_LOYALTY_BONUS", label: "اعطای امتیاز وفاداری پاداشی (فقط برای «سفارش تحویل داده شد»)" },
];

export default function AutomationRuleForm() {
  const [action, setAction] = useState("CREATE_ADMIN_ALERT");

  return (
    <form action={createAutomationRule} className="grid gap-4 max-w-xl surface border line rounded-2xl p-5">
      <div>
        <label className="text-sm font-medium block mb-1">نام قانون</label>
        <input name="name" required placeholder="مثلاً: هشدار تیکت جدید" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">وقتی این اتفاق افتاد (رویداد)</label>
        <select name="trigger" required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">این کار را انجام بده</label>
        <select name="action" required value={action} onChange={(e) => setAction(e.target.value)} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      {action === "GRANT_LOYALTY_BONUS" && (
        <div>
          <label className="text-sm font-medium block mb-1">تعداد امتیاز پاداش</label>
          <input name="points" type="number" min={1} max={10000} defaultValue={5} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked /> فعال
      </label>
      <button className="px-8 h-11 rounded-full text-white font-bold text-sm w-fit" style={{ background: "var(--ink)" }}>ساخت قانون</button>
    </form>
  );
}
