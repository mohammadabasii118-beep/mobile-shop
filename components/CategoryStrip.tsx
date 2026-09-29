import Link from "next/link";
import Icon from "./Icon";

export default function CategoryStrip({ categories }: { categories: { slug: string; name: string; imageUrl: string | null }[] }) {
  if (!categories.length) return null;
  return (
    <section className="max-w-4xl mx-auto px-4 md:px-8 pb-14">
      <div className="flex justify-start md:justify-center gap-6 md:gap-9 overflow-x-auto no-scrollbar">
        {categories.map((c) => (
          <Link key={c.slug} href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 shrink-0">
            <span className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border line surface2 overflow-hidden">
              {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <Icon name={c.slug} className="w-6 h-6 opacity-80" />}
            </span>
            <span className="text-[11px] muted whitespace-nowrap">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
