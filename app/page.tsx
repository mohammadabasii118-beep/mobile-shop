import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Benefits, BestSellers, Blog, BrandsStrip, Categories, Featured, Hero, PhonePicker, PromoBanners, Recommended } from "@/components/home-sections";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Categories />
        <PhonePicker />
        <Featured />
        <PromoBanners />
        <BestSellers />
        <BrandsStrip />
        <Benefits />
        <Recommended />
        <Blog />
      </main>
      <Footer />
    </>
  );
}
