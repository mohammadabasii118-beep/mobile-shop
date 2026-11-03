import { useMemo } from 'react'
import * as THREE from 'three'
import { slabGeometry, roundedRectShape, normalizeUVs } from '../lib/geometry'
import { PHONE, PLATEAU, LENSES, LENS_R, FLASH, LIDAR, PLATEAU_Z } from '../lib/dims'

export const FRAME_COLOR = '#5a1f2c' // iPhone 18 Pro Max — burgundy titanium

export function loadTex(url: string) {
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** UVs that sample the BACK photo at phone-local (x, y) — the back is seen mirrored. */
function backPhotoUVs(geo: THREE.BufferGeometry) {
  const W = PHONE.w * 0.995
  const H = PHONE.h * 0.997
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = 0.5 - pos.getX(i) / W
    uv[i * 2 + 1] = 0.5 + pos.getY(i) / H
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/**
 * 3D iPhone 18 Pro Max: extruded titanium body, real product photography on
 * front and back, and a genuinely raised camera plateau with protruding lens
 * barrels placed at the photo's exact lens positions.
 */
export default function IPhone(props: JSX.IntrinsicElements['group']) {
  const { w, h, d, r } = PHONE

  const frameGeo = useMemo(() => slabGeometry(w, h, d, r), [w, h, d, r])
  const faceGeo = useMemo(
    () => normalizeUVs(new THREE.ShapeGeometry(roundedRectShape(w * 0.995, h * 0.997, r), 32)),
    [w, h, r],
  )
  const plateauGeo = useMemo(() => {
    const g = slabGeometry(PLATEAU.w, PLATEAU.h, PLATEAU.depth, PLATEAU.r, 0.008)
    g.translate(0, PLATEAU.cy, 0)
    return g
  }, [])
  const capGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(roundedRectShape(PLATEAU.w - 0.02, PLATEAU.h - 0.02, PLATEAU.r - 0.01), 32)
    g.translate(0, PLATEAU.cy, 0)
    return backPhotoUVs(g)
  }, [])
  const frontTex = useMemo(() => loadTex('/textures/iphone-front.jpg'), [])
  const backTex = useMemo(() => loadTex('/textures/iphone-back.jpg'), [])

  return (
    <group {...props}>
      {/* titanium frame */}
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <meshPhysicalMaterial color={FRAME_COLOR} metalness={1} roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.25} envMapIntensity={1.4} />
      </mesh>

      {/* front: display (self-lit) + glass sheen */}
      <mesh geometry={faceGeo} position={[0, 0, d / 2 + 0.002]}>
        <meshBasicMaterial map={frontTex} toneMapped={false} />
      </mesh>
      <mesh geometry={faceGeo} position={[0, 0, d / 2 + 0.004]}>
        <meshPhysicalMaterial transparent opacity={0.05} roughness={0} clearcoat={1} envMapIntensity={1.5} depthWrite={false} />
      </mesh>

      {/* back: matte glass (photo) */}
      <mesh geometry={faceGeo} position={[0, 0, -d / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial map={backTex} roughness={0.45} metalness={0.15} envMapIntensity={0.6} />
      </mesh>

      {/* raised camera plateau */}
      <mesh geometry={plateauGeo} position={[0, 0, -d / 2 - PLATEAU.depth / 2]} castShadow>
        <meshPhysicalMaterial color={FRAME_COLOR} metalness={1} roughness={0.3} clearcoat={0.6} envMapIntensity={1.3} />
      </mesh>
      <mesh geometry={capGeo} position={[0, 0, PLATEAU_Z - 0.001]}>
        <meshStandardMaterial map={backTex} roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* protruding lens barrels */}
      {LENSES.map(([x, y], i) => (
        <group key={i} position={[x, y, PLATEAU_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[LENS_R, LENS_R, 0.04, 48]} />
            <meshPhysicalMaterial color={FRAME_COLOR} metalness={1} roughness={0.25} clearcoat={0.8} />
          </mesh>
          <mesh position={[0, 0.041, 0]}>
            <cylinderGeometry args={[LENS_R * 0.82, LENS_R * 0.82, 0.004, 48]} />
            <meshPhysicalMaterial color="#05060a" metalness={0.3} roughness={0.04} clearcoat={1} envMapIntensity={2} />
          </mesh>
          <mesh position={[0, 0.043, 0]}>
            <cylinderGeometry args={[LENS_R * 0.34, LENS_R * 0.34, 0.002, 32]} />
            <meshPhysicalMaterial color="#1b2a4a" metalness={0.6} roughness={0.05} clearcoat={1} envMapIntensity={2.5} />
          </mesh>
        </group>
      ))}

      {/* flash + LiDAR */}
      <mesh position={[FLASH[0], FLASH[1], PLATEAU_Z - 0.003]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.006, 32]} />
        <meshStandardMaterial color="#f4f1e6" emissive="#fff4da" emissiveIntensity={0.25} roughness={0.3} />
      </mesh>
      <mesh position={[LIDAR[0], LIDAR[1], PLATEAU_Z - 0.003]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.006, 32]} />
        <meshPhysicalMaterial color="#07080b" roughness={0.1} clearcoat={1} />
      </mesh>

      {/* side buttons */}
      {[
        [-w / 2 - 0.008, 0.25, 0.26],
        [-w / 2 - 0.008, -0.1, 0.16],
        [w / 2 + 0.008, 0.38, 0.32],
        [w / 2 + 0.008, -0.35, 0.14],
      ].map(([x, y, len], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[0.02, len, 0.055]} />
          <meshStandardMaterial color={FRAME_COLOR} metalness={1} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}
