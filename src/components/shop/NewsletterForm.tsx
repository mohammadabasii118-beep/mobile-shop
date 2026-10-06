'use client';

import { useShop } from './CartProvider';

export default function NewsletterForm() {
  const { toast } = useShop();
  return (
    <form className="nl" onSubmit={(e) => { e.preventDefault(); (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value = ''; toast('عضویت شما در خبرنامه ثبت شد'); }}>
      <input type="email" name="email" required placeholder="ایمیل شما" aria-label="ایمیل برای عضویت در خبرنامه" dir="ltr" />
      <button className="btn btn-charge" type="submit">عضویت</button>
    </form>
  );
}
