/**
 * Supplier integration scaffold.
 *
 * There is no live supplier API yet, so nothing here calls a real endpoint.
 * When you have API access, implement `SupplierClient` below (a new file,
 * e.g. lib/supplier/myProvider.ts) and set SUPPLIER_API_URL / SUPPLIER_API_KEY
 * in .env. Then wire `getSupplierClient()` to return it.
 *
 * Sync flow this is designed for (run via a script or an admin action):
 *   1. fetchProducts()              -> list of supplier SKUs/names
 *   2. fetchPrice(sku) / fetchStock(sku) / fetchImages(sku)
 *   3. calculateSellPrice(costPrice) from lib/pricing.ts to get the sell price
 *   4. upsert into the Product table (matched by `sku` / `supplierProductId`)
 */

export interface SupplierProductSummary {
  sku: string;
  name: string;
}

export interface SupplierClient {
  fetchProducts(): Promise<SupplierProductSummary[]>;
  fetchPrice(sku: string): Promise<number>; // cost price in Toman
  fetchStock(sku: string): Promise<number>;
  fetchImages(sku: string): Promise<string[]>;
}

class NotConfiguredSupplierClient implements SupplierClient {
  async fetchProducts(): Promise<SupplierProductSummary[]> {
    throw new Error("Supplier API is not configured yet. Set SUPPLIER_API_URL and SUPPLIER_API_KEY, and implement a SupplierClient.");
  }
  async fetchPrice(): Promise<number> {
    throw new Error("Supplier API is not configured yet.");
  }
  async fetchStock(): Promise<number> {
    throw new Error("Supplier API is not configured yet.");
  }
  async fetchImages(): Promise<string[]> {
    throw new Error("Supplier API is not configured yet.");
  }
}

export function getSupplierClient(): SupplierClient {
  // Swap this with a real implementation once SUPPLIER_API_URL is available.
  return new NotConfiguredSupplierClient();
}
