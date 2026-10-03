import * as THREE from "three";
import type { PatternId } from "@/data/configurator";

/** بافت طرح قاب (شفاف + خطوط) — کوچک و کش‌شده تا بار GPU ناچیز بماند */
export function createPatternTexture(pattern: PatternId, onDark: boolean): THREE.CanvasTexture | null {
  if (pattern === "plain" || typeof document === "undefined") return null;
  const W = 256, H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const ink = onDark ? "255,255,255" : "0,0,0";

  if (pattern === "carbon") {
    const s = 16;
    for (let y = 0; y < H; y += s) {
      for (let x = 0; x < W; x += s) {
        const a = ((x + y) / s) % 2 === 0 ? 0.22 : 0.06;
        g.fillStyle = `rgba(${ink},${a})`;
        g.fillRect(x, y, s - 1, s - 1);
        g.fillStyle = `rgba(${ink},${a * 0.5})`;
        g.fillRect(x, y + s / 2, s - 1, 1);
      }
    }
  } else if (pattern === "stripes") {
    g.fillStyle = `rgba(${ink},0.26)`;
    for (let x = 18; x < W; x += 34) g.fillRect(x, 0, 6, H);
  } else if (pattern === "dots") {
    g.fillStyle = `rgba(${ink},0.3)`;
    for (let y = 14; y < H; y += 28) {
      for (let x = 14 + ((y / 28) % 2) * 14; x < W; x += 28) {
        g.beginPath();
        g.arc(x, y, 3.4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** سایهٔ تماسی نرم زیر محصول (به‌جای ContactShadows که هر فریم رندر می‌شود) */
export function createShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
