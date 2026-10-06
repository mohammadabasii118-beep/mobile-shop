'use client';

export default function SelectAll({ name = 'ids' }: { name?: string }) {
  return (
    <input
      type="checkbox" aria-label="انتخاب همه" style={{ width: 16, height: 16, accentColor: 'var(--ink)' }}
      onChange={(e) => document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((c) => (c.checked = e.target.checked))}
    />
  );
}
