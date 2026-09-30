# Variants, pricing engine and discounts (Phase 6)

## Variants
`ProductVariant` (already existed) is now the unit that is sold, priced and stocked. New optional axes: **phone model** (`phoneModelId`, its brand comes from the model) and **colour** (`colorId`, managed in *رنگ‌ها*). Stock stays one row per variant (`Inventory`), so iPhone 12 / white and iPhone 12 / black never share stock.
- A model + colour pair is unique per product (`variant_duplicate`, 409). Legacy variants (no model, no colour) keep working untouched.
- The variant name is generated from model and colour when left empty.
- Product page (no redesign): for a product with model/colour variants the existing select styling is reused for **brand → model → colour**; out-of-stock options are disabled; after selection the page shows that variant's price, price before discount, stock and SKU. Cart lines show "model · colour". Old products (compatibility list + single variant) behave as before.

## Pricing engine (`lib/server/price-engine/`)
```
cost ── rule (margin) ──► selling price ─► best discount ─► coupon ─► points ─► wallet ─► payable
```
- `calc.ts` pure integer maths (basis points / whole percents, no floats). `rules.ts` rule resolution + repricing. `discounts.ts` matching, limits, usage. `line.ts` `priceLines()` is **the** way cart and checkout price lines (identical totals).
- **Pricing mode** per product and per variant: `MANUAL` (default for every existing row; the typed price is used) or `AUTOMATIC` (price = cost + margin, computed on the server and stored in `retailPrice`, so listings, sorting, SEO and search keep working).
- **Rule precedence** (most specific active rule wins): variant › product › category (nearest first, then its parents) › global. Manual Override beats every rule. Rule = percent (basis points) or fixed Toman, optional round-up step (e.g. 1 000). New rule kinds can be added in `rules.ts` without touching checkout.
- Any change of cost, mode or rule reprices every affected AUTOMATIC item in the same transaction and writes `PriceHistory` (old/new price, old/new cost, old/new rule, source `manual|rule|bulk`, reason, admin).
- AUTOMATIC without cost or without any rule is **skipped and reported**, never guessed.

## Discounts
- `Discount` = automatic reduction per unit: percent or fixed; scope all / category / product / variant / brand / model; time window; minimum cart subtotal; total and per-user limits; on/off. There are two separate brand targets: **برند محصول** (`PRODUCT_BRAND`, the maker of the product, e.g. Spigen) matches only `Product.brandId`; **برند گوشی** (`PHONE_BRAND`, e.g. Apple) matches only the brand of the variant's phone model. The admin pickers list each kind separately (with counts) and explain the difference. The old ambiguous scope `BRAND` (first Phase 6 cut) can no longer be created; existing rows keep their old meaning until re-targeted. Coupons (a code typed by the customer) are unchanged and apply **after** discounts.
- **No stacking**: for each unit the single best reduction wins among the legacy per-product discount (`retailDiscount`) and matching promotions. Discounts are retail-only (wholesale prices are separate, as before).
- Limits are enforced inside the order transaction (`UPDATE … usedCount < usageLimit`, per-user count) and given back when an unpaid order is cancelled or an order is fully refunded (same rollback path as coupons).
- Product/list pages show a discount only when it needs no cart context (no minimum order); the cart and checkout apply the rest.

## Wholesale ↔ retail relationship (setting «رابطهٔ قیمت عمده و خرده»)
Configurable in *تنظیمات* (`wholesalePolicy`): **minimum distance** (wholesale must be at least X % below retail; 0 = "not above retail", the old rule), **maximum distance** (wholesale may not be more than Y % below retail; 0 = no limit), and **capAtRetail** (at checkout a partner never pays more than the public price of the day, i.e. retail after the discount shown to everyone).
- Enforced when prices are **saved**: product/variant create and edit (retail, wholesale, cost, mode, rules) run in one transaction that is rolled back with a clear `wholesale_policy` (400) message that states the allowed range. Only pairs whose price changed are judged, so an unrelated edit of an already-inconsistent product is not blocked and nothing is rewritten.
- Enforced when prices are **computed**: an automatic price (rule change, cost change, bulk operation) that would break the relationship is **not applied**, the old price stays, and it is reported (preview and result list them first, `wholesaleConflictCount`). A manual product edit that would cause it fails atomically instead.
- Tightening the policy never rewrites existing prices. *قیمت‌گذاری › جدول* shows a «قیمت عمده» column with an «ناسازگار با خرده» badge and a banner listing current conflicts (`GET /api/admin/pricing/wholesale`).
- Compatible with the existing wholesale system: tiers, minimum quantity, minimum order and the partner portal are unchanged; the tier discount only lowers the price further.

## Storefront sort by effective price
Sorting by price (low→high / high→low) orders by the **payable** price: cheapest active variant of *(base − best single discount)*. It is computed in SQL (`price-engine/effective-sql.ts`, lateral join, no new column, so time-based promotions and usage limits are always current) with exactly the same rules as the TypeScript engine (scope matching, time window, capacity, no-minimum-order, integer flooring, legacy discount, no-active-variant fallback). Prices printed on cards still come from the TypeScript engine; nothing is computed in the browser. An e2e test compares the SQL order with the prices shown by the pages for every discount scope.

## Checkout and snapshots
- Prices are always recomputed on the server. The quote returns `priceHash`; the checkout page echoes it. If anything that affects the price changed in between, the order is refused with `price_changed` (409) and the page re-quotes; the old price can never be charged.
- `OrderItem` now snapshots: brand, model, colour, original price, per-unit discount and its label, this line's exact coupon share (shares add up to the coupon discount) and final line total. Later price, rule or discount edits never touch existing orders.

## Admin
| Page | Permission | What |
|---|---|---|
| قیمت‌گذاری › جدول | `pricing.read` | product, variant, cost, margin, calculated price, discount, final price, stock, status; search, filters (category, phone brand, model, mode, stock), sort |
| › قوانین | `pricing.write` to edit | rules with **preview** of every price that would change |
| › تغییر گروهی | `pricing.write` | filter (category, brand, model, colour, SKU/name) + operation (cost ±%, ±Toman, set; set margin; manual price ±%, ±Toman; switch mode) → **preview old → new and counts** → confirm → one transaction |
| › تاریخچه | `pricing.read` | price/cost/rule history |
| تخفیف‌ها | `discount.write` | discounts, target picker, status (active / scheduled / expired / off) |
| رنگ‌ها | `product.write` | colours (used colours can only be disabled) |
| Dashboard | `dashboard.view` | product and variant counts, out of stock, active and expiring discounts, latest price changes |
Purchase cost is business-sensitive: without `pricing.read` the API returns `null` costs, and without `pricing.write` cost/mode inputs are ignored. Audit log entries: `pricing.rule.*`, `pricing.recompute`, `pricing.bulk`, `discount.*`, `variant.*`, `inventory.adjust`, `product.update`.

## Deployment notes
The migration `20261210000000_phase6_variants_pricing_discounts` is additive (new columns nullable/defaulted, new tables) and also inserts the permissions `pricing.read`, `pricing.write`, `discount.write` for the roles `super_admin` and `admin`, and turns existing free-text variant colours into managed colours. Nothing is deleted. Other custom roles must be granted the new permissions in the role editor.

## Known limits
- Home-page product rails are cached ≤ 60 s, so a promotion that starts or ends can lag there by up to a minute; product page, cart and checkout are always live.
- Percent fields of the wholesale policy accept at most two decimals; the tier discount is not part of the policy check (it only lowers the partner price further).

## Multiple categories and brands per product
A product keeps one **primary** category (required) and brand (optional), and can have any number of **extra** categories/brands (`ProductCategory`, `ProductBrand`).
The primary drives the breadcrumb, the card label and automatic margin rules. Extras make the product appear in those category/brand pages, the shop filters and counts,
and let category (including the parent of an extra category) and product-brand discounts match — in TypeScript (`matchesLine`) and in SQL (`effective-sql.ts`) alike.

## Variable products (phase 11)
`Product.productType` is SIMPLE (one axis-less variant) or VARIABLE (model × colour variants, managed only inside the product form's Variant Matrix).
A variant's price = its own `retailPrice` or the product's base price; its `salePrice` (special final price) competes with the legacy product discount and promotions — best single reduction wins
(`legacyFixedOf` in `discounts.ts`, mirrored in `effective-sql.ts`). Inactive or out-of-stock variants cannot be added to the cart or ordered (checked again on the server at cart and checkout);
order items snapshot price and image. Generated variants start inactive. Phone models are grouped Brand → Series → Model (`PhoneSeries`, optional per model; nothing is auto-grouped).
Custom attributes (`Attribute`/`AttributeValue`) are descriptive; `model` and `color` are system attributes; `usedForVariants` is reserved for future matrix axes.

## Variant wholesale price and two-way model ↔ colour (phase 12)
`ProductVariant.wholesalePrice`: `null` = **inherit** the product's wholesale base price, a number = **override** for that variant (the matrix shows «ارث‌بری (x)» / «اختصاصی (y)»; reset = save null). No extra "mode" column: the mode is derived from null, so there is one source of truth. Priced only in `unitPriceFor` on the server (partner from the DB, minimum quantity, tier discount, product wholesale discount, retail cap policy); retail promotions and variant sale prices never apply to a partner price. Cart, quote and checkout re-price on the server; order items snapshot price and type.
Product-page selection (`lib/variant-availability.ts`, unit-tested): a model/colour is selectable only if a variant that is active and in stock exists for it given the other choice; either side can be chosen first; an incompatible other side is cleared; brand/series filters only narrow the models considered.
