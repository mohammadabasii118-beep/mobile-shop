import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dir = process.argv[2], out = process.argv[3];
const data = readFileSync(new URL("./data.json", import.meta.url), "utf8").trim();
const imgs = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const svg = readFileSync(`${dir}/${f}`, "utf8").replace(/\s+/g, " ");
  imgs[f.replace(".svg", "")] = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
let html = readFileSync(new URL("./template.html", import.meta.url), "utf8");
html = html.replace("/*__DATA__*/null", data.replace(/</g, "\\u003c")).replace("/*__IMG__*/null", JSON.stringify(imgs));
writeFileSync(out, html);
console.log("bytes", html.length);
