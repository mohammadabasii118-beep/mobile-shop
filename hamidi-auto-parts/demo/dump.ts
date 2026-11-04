import { PRODUCTS } from "@/data/products";
import { MODELS, BRANDS } from "@/data/vehicles";
import { CATEGORIES } from "@/data/categories";
import { BRAND_CONTENT } from "@/data/brand-content";
const data = {
  brands: BRANDS,
  models: MODELS,
  categories: CATEGORIES.map(({ icon, image, ...c }) => ({ ...c, image: image.replace("/images/parts/", "").replace(".png", "") })),
  brandContent: BRAND_CONTENT,
  products: PRODUCTS.map(({ specs, description, image, ...p }) => ({ ...p, img: image.replace("/images/parts/", "").replace(".png", ""), description })),
};
console.log(JSON.stringify(data));
