'use client';

import { useState } from 'react';

export default function DiscountScope({ categories, brands }: { categories: { id: number; name: string }[]; brands: { id: number; name: string }[] }) {
  const [scope, setScope] = useState('all');
  return (
    <>
      <div className="fld"><label htmlFor="ds">محدوده</label>
        <select id="ds" className="sel" name="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">همه‌ی محصولات</option><option value="category">یک دسته‌بندی</option><option value="brand">یک برند</option>
        </select></div>
      {scope === 'category' && <div className="fld"><label htmlFor="dc">دسته‌بندی</label><select id="dc" className="sel" name="scope_id" required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
      {scope === 'brand' && <div className="fld"><label htmlFor="db">برند</label><select id="db" className="sel" name="scope_id" required>{brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
    </>
  );
}
