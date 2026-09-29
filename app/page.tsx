import { BottomNav, Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BestSellers, Blog, CategoryGrid, CategoryPills, Featured, Hero, Newest, PhonePicker, TelegramBanner } from "@/components/home-sections";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <CategoryPills />
        <Featured />
        <PhonePicker />
        <Newest />
        <CategoryGrid />
        <BestSellers />
        <TelegramBanner />
        <Blog />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
