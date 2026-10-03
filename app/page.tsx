import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/features/home/hero";
import { Categories } from "@/features/home/categories";
import { ProductShowcase } from "@/features/showcase/product-showcase";
import { BestSellers } from "@/features/home/best-sellers";
import { ProductDetailPreview } from "@/features/home/product-detail-preview";
import { Benefits } from "@/features/home/benefits";

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Categories />
        <ProductShowcase />
        <div className="h-section bg-bg" aria-hidden />
        <BestSellers />
        <ProductDetailPreview />
        <Benefits />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
