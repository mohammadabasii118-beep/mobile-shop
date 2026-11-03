import * as THREE from 'three'

/** A rounded-rectangle THREE.Shape centred on the origin (XY plane). */
export function roundedRectShape(
  width: number,
  height: number,
  radius: number,
): THREE.Shape {
  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)
  const s = new THREE.Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.quadraticCurveTo(w, -h, w, -h + r)
  s.lineTo(w, h - r)
  s.quadraticCurveTo(w, h, w - r, h)
  s.lineTo(-w + r, h)
  s.quadraticCurveTo(-w, h, -w, h - r)
  s.lineTo(-w, -h + r)
  s.quadraticCurveTo(-w, -h, -w + r, -h)
  return s
}

/** Extruded rounded-rect slab with a soft bevel — the building block for phones, cases, etc. */
export function slabGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel = 0.012,
): THREE.ExtrudeGeometry {
  const shape = roundedRectShape(width, height, radius)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 24,
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

/** Remaps a flat geometry's UVs to 0..1 across its XY bounding box. */
export function normalizeUVs<T extends THREE.BufferGeometry>(geo: T): T {
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const sx = bb.max.x - bb.min.x || 1
  const sy = bb.max.y - bb.min.y || 1
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / sx
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / sy
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/** Builds a dark "nebula" wallpaper texture for the phone screen on a 2D canvas. */
export function makeScreenTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size * 2
  const ctx = c.getContext('2d')
  if (!ctx) return null

  // base
  ctx.fillStyle = '#05070d'
  ctx.fillRect(0, 0, c.width, c.height)

  const blobs: [number, number, number, string][] = [
    [0.3 * c.width, 0.3 * c.height, 1.0 * c.width, 'rgba(52,104,232,0.95)'],
    [0.8 * c.width, 0.75 * c.height, 0.9 * c.width, 'rgba(138,72,240,0.85)'],
    [0.5 * c.width, 0.55 * c.height, 0.7 * c.width, 'rgba(30,60,170,0.6)'],
  ]
  for (const [x, y, r, col] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, col)
    g.addColorStop(1, 'rgba(5,7,13,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, c.width, c.height)
  }

  // lock-screen clock
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.textAlign = 'center'
  ctx.font = '200 150px Inter, system-ui, sans-serif'
  ctx.fillText('9:41', c.width / 2, c.height * 0.2)
  ctx.fillStyle = 'rgba(210,222,245,0.7)'
  ctx.font = '400 30px Inter, system-ui, sans-serif'
  ctx.fillText('Tuesday, 12 September', c.width / 2, c.height * 0.245)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
