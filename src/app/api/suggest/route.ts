import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/catalog';
import { normText } from '@/lib/format';

export async function GET(req: Request) {
  const q = normText(new URL(req.url).searchParams.get('q') || '').slice(0, 60);
  if (q.length < 2) return NextResponse.json([]);
  const { items } = listProducts({ q, limit: 5 });
  return NextResponse.json(items.map((p) => ({ name: p.name, slug: p.slug, brand: p.brand, image: p.image, price: p.price })));
}
