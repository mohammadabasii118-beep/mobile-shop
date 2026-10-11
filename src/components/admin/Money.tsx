'use client';

/* ورودی پول با نمایش فارسی */
export default function Money({ value, onChange, id, placeholder }: { value: number | null; onChange: (v: number | null) => void; id?: string; placeholder?: string }) {
  return (
    <input
      id={id} className="input num" inputMode="numeric" placeholder={placeholder} value={value ? value.toLocaleString('fa-IR') : ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
        onChange(raw ? Number(raw) : null);
      }}
    />
  );
}
