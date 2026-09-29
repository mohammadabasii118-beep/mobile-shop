import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Blog, BrandMarquee, CategoryTiles, Hero, PhonePicker, Rails, TelegramBanner } from "@/components/home-sections";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <BrandMarquee />
        <Rails only="first" />
        <PhonePicker />
        <Rails only="rest" />
        <CategoryTiles />
        <TelegramBanner />
        <Blog />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
