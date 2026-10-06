'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { submitReview, type FormState } from '@/lib/actions/shop';

export default function ReviewForm({ productId, loggedIn, defaultName }: { productId: number; loggedIn: boolean; defaultName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview.bind(null, productId), undefined);
  const [r, setR] = useState(0);
  if (!loggedIn) return <p className="mute" style={{ marginTop: 16, fontSize: 14 }}>برای ثبت نظر <Link className="link" href="/account/login?next=/">وارد شوید</Link>.</p>;
  return (
    <form action={action} className="form card-box" style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 16 }}>نظر خود را بنویسید</h3>
      <div className="fld">
        <span className="lab">امتیاز شما</span>
        <div className="stars" role="radiogroup" aria-label="امتیاز">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={r === n} aria-label={`${n} ستاره`} onClick={() => setR(n)} style={{ padding: 4 }}>
              <Star style={{ width: 24, height: 24, fill: n <= r ? 'currentColor' : 'none', stroke: 'currentColor' }} />
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={r} />
      </div>
      <div className="fld"><label htmlFor="rv-author">نام نمایشی</label><input id="rv-author" className="input" name="author" defaultValue={defaultName} maxLength={60} /></div>
      <div className="fld"><label htmlFor="rv-body">متن نظر</label><textarea id="rv-body" className="textarea" name="body" required minLength={10} maxLength={1500} /></div>
      {state?.error && <div className="alert err" role="alert">{state.error}</div>}
      {state?.ok && <div className="alert ok" role="status">{state.ok}</div>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'در حال ارسال…' : 'ثبت نظر'}</button>
    </form>
  );
}
