import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import { About, Contact, Customize, FAQ, NotFound, Returns, Shipping } from '@/pages/Static';
import AccountLayout from '@/pages/account/AccountLayout';
import { Addresses, Dashboard, OrderDetail, Orders, Points, Profile, Settings, WalletPage, Wishlist } from '@/pages/account/AccountPages';
import { Toaster } from '@/components/Toast';

const ProductPage = lazy(() => import('@/pages/Product'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const Admin = lazy(() => import('@/pages/admin/Admin'));

const Loading = () => <div className="grid min-h-[60vh] place-items-center text-mist/50">در حال بارگذاری…</div>;

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="category/:slug" element={<Shop />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="customize" element={<Customize />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="points" element={<Points />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="returns" element={<Returns />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="admin" element={<Admin />} />
        <Route path="admin/:section" element={<Admin />} />
      </Routes>
      <Toaster />
    </Suspense>
  );
}
