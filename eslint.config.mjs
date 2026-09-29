import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Admin screens show admin-uploaded images at arbitrary sizes; next/image optimisation adds nothing there.
  { files: ["components/admin/**", "app/shop/page.tsx"], rules: { "@next/next/no-img-element": "off" } },
  globalIgnores([".next/**", "out/**", "lib/generated/**", "public/**", "docs/**", "scripts/**", "prisma/migrations/**"]),
]);
