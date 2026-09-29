import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Blog, BrandMarquee, CategoryTiles, Hero, NewestRail, Rails, TelegramBanner } from "@/components/home-sections";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <BrandMarquee />
        <Rails slugs={["iphone", "samsung"]} />
        <CategoryTiles />
        <Rails slugs={["xiaomi", "airpods", "watch", "electric"]} />
        <NewestRail />
        <TelegramBanner />
        <Blog />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
