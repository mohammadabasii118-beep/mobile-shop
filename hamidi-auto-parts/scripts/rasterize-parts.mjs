// Converts the vector studio renders (assets/parts-svg) into high-resolution
// transparent PNG sources. next/image serves them as AVIF / WebP at the
// exact size each device needs, so the originals can be large.
import { readdirSync } from "node:fs";
import sharp from "sharp";

const src = new URL("../assets/parts-svg/", import.meta.url);
const out = new URL("../public/images/parts/", import.meta.url);

for (const file of readdirSync(src).filter((f) => f.endsWith(".svg"))) {
  const name = file.replace(/\.svg$/, "");
  await sharp(new URL(file, src).pathname, { density: 240 })
    .resize(1200, 1200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(new URL(`${name}.png`, out).pathname);
  console.log("✓", name);
}
