# CaseLine — فروشگاه فارسی قاب گوشی و لوازم جانبی

React 18 · TypeScript · Vite · Tailwind · Framer Motion · React Three Fiber · Zustand

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

- مسیرها: `/ /shop /category/:slug /product/:slug /cart /checkout /customize /account/* /admin/* /about /contact /faq /shipping /returns`
- `src/data` داده‌ها · `src/store` وضعیت (Cart/Wishlist در LocalStorage) · `src/utils/pricing.ts` منطق قیمت
- `src/features/payment/PaymentProvider.ts` معماری پرداخت Provider-based (فعلاً Mock)
- `src/three` صحنه‌های سه‌بعدی؛ `ProductViewer3D` پارامتر `modelUrl` برای GLB/GLTF دارد.
