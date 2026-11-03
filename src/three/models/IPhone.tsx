import { useMemo } from 'react'
import * as THREE from 'three'
import { slabGeometry, roundedRectShape, normalizeUVs } from '../lib/geometry'
import { PHONE } from '../lib/dims'

export const FRAME_COLOR = '#4a1c27' // iPhone 18 Pro Max — burgundy titanium

function loadTex(url: string) {
  const t = new THREE.TextureLoader().load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * 3D iPhone: real extruded metal body, with the real product photography
 * (front & back of the iPhone 18 Pro Max) mapped onto its faces.
 */
export default function IPhone(props: JSX.IntrinsicElements['group']) {
  const { w, h, d, r } = PHONE

  const frameGeo = useMemo(() => slabGeometry(w, h, d, r), [w, h, d, r])
  const faceGeo = useMemo(
    () => normalizeUVs(new THREE.ShapeGeometry(roundedRectShape(w * 0.995, h * 0.997, r), 32)),
    [w, h, r],
  )
  const frontTex = useMemo(() => loadTex('/textures/iphone-front.jpg'), [])
  const backTex = useMemo(() => loadTex('/textures/iphone-back.jpg'), [])

  return (
    <group {...props}>
      {/* titanium frame */}
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <meshPhysicalMaterial color={FRAME_COLOR} metalness={1} roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.25} envMapIntensity={1.4} />
      </mesh>

      {/* front: display (self-lit) */}
      <mesh geometry={faceGeo} position={[0, 0, d / 2 + 0.002]}>
        <meshBasicMaterial map={frontTex} toneMapped={false} />
      </mesh>
      {/* front glass sheen */}
      <mesh geometry={faceGeo} position={[0, 0, d / 2 + 0.004]}>
        <meshPhysicalMaterial transparent opacity={0.05} roughness={0} clearcoat={1} envMapIntensity={1.5} depthWrite={false} />
      </mesh>

      {/* back: matte glass with camera plateau (photographic) */}
      <mesh geometry={faceGeo} position={[0, 0, -d / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial map={backTex} roughness={0.45} metalness={0.15} envMapIntensity={0.6} />
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
