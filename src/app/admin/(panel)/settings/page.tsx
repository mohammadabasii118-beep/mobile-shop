import type { Metadata } from 'next';
import { getSettings } from '@/lib/catalog';
import { getUser } from '@/lib/auth';
import { Card, PageHead } from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/client';
import { changeMyAccount, saveSettings } from '@/lib/actions/admin-content';

export const metadata: Metadata = { title: 'تنظیمات فروشگاه' };

export default async function SettingsPage() {
  const s = getSettings();
  const me = (await getUser())!;
  return (
    <>
      <PageHead title="تنظیمات فروشگاه" desc="اطلاعات فروشگاه، هزینه‌ی ارسال، روش‌های پرداخت و حساب شما. هر بخش جداگانه ذخیره می‌شود." />
      <div className="ad-stack" style={{ maxWidth: 860 }}>
        <Card title="اطلاعات عمومی" id="general" desc="در هدر، فوتر و عنوان سایت نمایش داده می‌شود.">
          <ActionForm action={saveSettings.bind(null, 'general')}>
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="s1">نام فروشگاه</label><input id="s1" className="input" name="store_name" defaultValue={s.store_name} required /></div>
              <div className="fld"><label htmlFor="s1e">نام لاتین اضافی کنار لوگو (اختیاری)</label><input id="s1e" className="input" name="store_name_en" dir="ltr" defaultValue={s.store_name_en} /></div>
              <div className="fld"><label htmlFor="s2">شعار کوتاه</label><input id="s2" className="input" name="tagline" defaultValue={s.tagline} /></div>
              <div className="fld"><label htmlFor="s3">تلفن تماس</label><input id="s3" className="input" name="phone" defaultValue={s.phone} /></div>
              <div className="fld"><label htmlFor="s4">ایمیل</label><input id="s4" className="input" name="email" dir="ltr" defaultValue={s.email} /></div>
              <div className="fld"><label htmlFor="s5">اینستاگرام (لینک)</label><input id="s5" className="input" name="instagram" dir="ltr" defaultValue={s.instagram} placeholder="https://instagram.com/…" /></div>
              <div className="fld"><label htmlFor="s6">تلگرام (لینک)</label><input id="s6" className="input" name="telegram" dir="ltr" defaultValue={s.telegram} placeholder="https://t.me/…" /></div>
            </div>
            <div className="fld"><label htmlFor="s7">نشانی</label><input id="s7" className="input" name="address" defaultValue={s.address} /></div>
            <div className="fld"><label htmlFor="s8">درباره‌ی فروشگاه (فوتر)</label><textarea id="s8" className="textarea" name="footer_about" defaultValue={s.footer_about} /></div>
          </ActionForm>
        </Card>
        <Card title="پیام‌های نوار بالای سایت" id="announce" desc="هر خط یک پیام. در موبایل فقط پیام اول نمایش داده می‌شود.">
          <ActionForm action={saveSettings.bind(null, 'announce')}>
            <div className="fld"><label htmlFor="a1" className="sr">پیام‌ها</label><textarea id="a1" className="textarea" name="announcements" defaultValue={s.announcements} /></div>
          </ActionForm>
        </Card>
        <Card title="ارسال" id="shipping" desc="هزینه‌ی ارسال به همه‌ی نقاط یکسان است.">
          <ActionForm action={saveSettings.bind(null, 'shipping')}>
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="h1">هزینه‌ی ارسال (تومان)</label><input id="h1" className="input num" name="shipping_cost" inputMode="numeric" defaultValue={s.shipping_cost} /></div>
              <div className="fld"><label htmlFor="h2">ارسال رایگان از مبلغ (تومان)</label><input id="h2" className="input num" name="free_shipping_min" inputMode="numeric" defaultValue={s.free_shipping_min} /><span className="help">۰ یعنی ارسال رایگان نداریم.</span></div>
            </div>
          </ActionForm>
        </Card>
        <Card title="پرداخت" id="payment" desc="روش‌هایی که مشتری هنگام تسویه می‌بیند.">
          <ActionForm action={saveSettings.bind(null, 'payment')}>
            <label className="switch"><input type="checkbox" name="pay_online" value="1" defaultChecked={s.pay_online === '1'} /><span className="tr" /><span>پرداخت آنلاین (درگاه)</span></label>
            <label className="switch"><input type="checkbox" name="pay_cod" value="1" defaultChecked={s.pay_cod === '1'} /><span className="tr" /><span>پرداخت در محل</span></label>
            <div className="fld"><label htmlFor="p1">متن راهنما در صفحه‌ی تسویه</label><textarea id="p1" className="textarea" name="checkout_note" defaultValue={s.checkout_note} style={{ minHeight: 64 }} /></div>
            <p className="help mute" style={{ fontSize: 12.5 }}>درگاه آنلاین فعلاً آزمایشی است (پولی کسر نمی‌شود). برای اتصال به درگاه بانکی، راهنمای README را ببینید.</p>
          </ActionForm>
        </Card>
        <Card title="موجودی" id="inventory">
          <ActionForm action={saveSettings.bind(null, 'inventory')}>
            <div className="fld" style={{ maxWidth: 280 }}><label htmlFor="i1">آستانه‌ی «کم‌موجودی» (عدد)</label><input id="i1" className="input num" name="low_stock" inputMode="numeric" defaultValue={s.low_stock} /><span className="help">با رسیدن موجودی به این عدد، برچسب «تنها N عدد» نمایش داده می‌شود.</span></div>
          </ActionForm>
        </Card>
        <Card title="حساب من" id="account" desc={`نام کاربری: ${me.login}`}>
          <ActionForm action={changeMyAccount}>
            <div className="fld"><label htmlFor="m1">نام نمایشی</label><input id="m1" className="input" name="name" defaultValue={me.name} required /></div>
            <div className="ad-grid2">
              <div className="fld"><label htmlFor="m2">رمز فعلی</label><input id="m2" className="input" name="current" type="password" dir="ltr" autoComplete="current-password" /></div>
              <div className="fld"><label htmlFor="m3">رمز جدید (حداقل ۸ نویسه)</label><input id="m3" className="input" name="password" type="password" dir="ltr" autoComplete="new-password" /></div>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
