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
- `Discount` = automatic reduction per unit: percent or fixed; scope all / category / product / variant / brand / model; time window; minimum cart subtotal; total and per-user limits; on/off. *Brand* matches the product's brand **or** the phone brand of the variant's model. Coupons (a code typed by the customer) are unchanged and apply **after** discounts.
- **No stacking**: for each unit the single best reduction wins among the legacy per-product discount (`retailDiscount`) and matching promotions. Discounts are retail-only (wholesale prices are separate, as before).
- Limits are enforced inside the order transaction (`UPDATE … usedCount < usageLimit`, per-user count) and given back when an unpaid order is cancelled or an order is fully refunded (same rollback path as coupons).
- Product/list pages show a discount only when it needs no cart context (no minimum order); the cart and checkout apply the rest.

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
- List sorting by price and the price filter use the stored base price minus the legacy discount; promotional discounts appear on cards and pages but are not part of the SQL sort.
- Home-page product rails are cached ≤ 60 s, so a promotion that starts or ends can lag there by up to a minute; product page, cart and checkout are always live.
- A rule/cost change can push an automatic retail price below a fixed wholesale price; the admin sees it in the table, the system does not block it.
