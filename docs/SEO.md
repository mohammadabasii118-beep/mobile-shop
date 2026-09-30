# SEO — what exists and how it is managed

## Per-page metadata (`lib/seo.ts` → `buildMeta`)
| Page | Title / description | Canonical | Schema (JSON-LD) |
|---|---|---|---|
| `/` | Admin "home" SEO setting, else site defaults | `/` | Organization, WebSite (+SearchAction) |
| `/shop` | own title | `/shop` (filtered/paginated variants are `noindex`, canonical to the category or `/shop`) | BreadcrumbList, ItemList |
| `/category/[slug]` | category `seoTitle`/`seoDescription`/`seoContent`/`canonical` | category URL | BreadcrumbList, ItemList |
| `/brand/[slug]`, `/model/[slug]` | brand / phone-model `seoTitle`/`seoDescription` | own URL | BreadcrumbList |
| `/product/[slug]` | product `seoTitle`/`seoDescription` or generated from real data | product URL | Product + Offer (IRR = Toman × 10), Brand, BreadcrumbList; **AggregateRating + Review only when approved reviews exist** |
| `/blog`, `/blog/[slug]` | post `seoTitle`/`seoDescription` | own URL | Article (+Breadcrumb) |
| `/support` | own | own | — |

Open Graph and Twitter Card tags are generated for all of them (image = first product/post image when one exists).

## Never indexed
`/admin`, `/account/**`, `/checkout`, `/api/**` (also `X-Robots-Tag: noindex, nofollow` + `Cache-Control: private, no-store`), filtered `/shop?…` variants, 404/error pages.

## Sitemap and robots
- `/sitemap.xml` is dynamic (active products, categories, brands, phone models, published posts, static pages) and reflects admin edits immediately (public cache is invalidated on every admin write).
- `/robots.txt` disallows private areas, points to the sitemap and uses `APP_URL` as host. **Set `APP_URL` to the real https origin** or canonicals/sitemap will say `localhost`.

## Admin control
Panel → **سئو** (`/admin/seo`, permission `seo.write`): per-scope title/description; every category/brand/model/product/post editor also has `seoTitle`/`seoDescription`. Changing a slug of a product/category/brand/model/post records a `SlugRedirect` so the old URL answers **308** to the new one (no lost rankings, no duplicate pages).

## Internal linking
Product ↔ category ↔ brand ↔ phone model chips, breadcrumbs, related products, related posts, and phone-model landing pages listing compatible products.

## Rules followed
No generated filler text, no fake ratings/reviews, no duplicate pages for the same content (category canonical, `noindex` on filter/sort/page variants).

## Checklist after deployment
1. `APP_URL=https://your-domain`. 2. Submit `/sitemap.xml` in Google Search Console / Bing / Yandex. 3. Fill the home SEO setting and shop-wide description in `/admin/seo`. 4. Validate a product URL in Google's Rich Results Test. 5. Confirm `curl -I https://your-domain/account` shows `X-Robots-Tag: noindex`.
