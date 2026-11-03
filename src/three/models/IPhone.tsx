import { useMemo } from 'react'
import * as THREE from 'three'
import { slabGeometry, roundedRectShape, makeScreenTexture, normalizeUVs } from '../lib/geometry'
import { PHONE, TITAN } from '../lib/dims'

/** Procedural, PBR-shaded iPhone built from real 3D geometry. */
export default function IPhone(props: JSX.IntrinsicElements['group']) {
  const { w, h, d, r } = PHONE

  const frameGeo = useMemo(() => slabGeometry(w, h, d, r), [w, h, d, r])
  const bezelGeo = useMemo(
    () => new THREE.ShapeGeometry(roundedRectShape(w * 0.965, h * 0.975, r * 0.9)),
    [w, h, r],
  )
  const screenGeo = useMemo(
    () => normalizeUVs(new THREE.ShapeGeometry(roundedRectShape(w * 0.9, h * 0.94, r * 0.72), 24)),
    [w, h, r],
  )
  const backGeo = useMemo(
    () => new THREE.ShapeGeometry(roundedRectShape(w * 0.965, h * 0.975, r * 0.9)),
    [w, h, r],
  )
  const camModuleGeo = useMemo(() => slabGeometry(0.44, 0.44, 0.06, 0.13), [])
  const islandGeo = useMemo(
    () => new THREE.ShapeGeometry(roundedRectShape(0.27, 0.075, 0.037)),
    [],
  )
  const screenTex = useMemo(() => makeScreenTexture(), [])

  const lensPos: [number, number][] = [
    [-0.09, 0.09],
    [0.09, 0.09],
    [-0.09, -0.09],
  ]

  return (
    <group {...props}>
      {/* titanium frame */}
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={TITAN}
          metalness={1}
          roughness={0.34}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* back glass */}
      <mesh geometry={backGeo} position={[0, 0, -d / 2 - 0.001]} rotation={[Math.PI, 0, 0]}>
        <meshPhysicalMaterial
          color="#0b0c10"
          metalness={0.6}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={1.1}
        />
      </mesh>

      {/* front black bezel */}
      <mesh geometry={bezelGeo} position={[0, 0, d / 2 + 0.001]}>
        <meshStandardMaterial color="#050608" metalness={0.2} roughness={0.5} />
      </mesh>

      {/* screen (emissive wallpaper) */}
      <mesh geometry={screenGeo} position={[0, 0, d / 2 + 0.004]}>
        <meshBasicMaterial map={screenTex ?? undefined} toneMapped={false} color={screenTex ? '#ffffff' : '#0b1530'} />
      </mesh>
      {/* glass sheen over screen */}
      <mesh geometry={screenGeo} position={[0, 0, d / 2 + 0.006]}>
        <meshPhysicalMaterial
          transparent
          opacity={0.06}
          roughness={0}
          metalness={0}
          clearcoat={1}
          envMapIntensity={1.5}
          color="#ffffff"
          depthWrite={false}
        />
      </mesh>

      {/* dynamic island */}
      <mesh geometry={islandGeo} position={[0, h * 0.4, d / 2 + 0.008]}>
        <meshStandardMaterial color="#000000" roughness={0.4} />
      </mesh>

      {/* rear camera module */}
      <group position={[-w * 0.26, h * 0.3, -d / 2 - 0.03]}>
        <mesh geometry={camModuleGeo}>
          <meshPhysicalMaterial color="#17181c" metalness={0.5} roughness={0.35} clearcoat={0.6} />
        </mesh>
        {lensPos.map(([x, y], i) => (
          <group key={i} position={[x, y, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.072, 0.078, 0.05, 32]} />
              <meshStandardMaterial color="#2a2c33" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.03, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.02, 32]} />
              <meshPhysicalMaterial color="#05070c" metalness={0.4} roughness={0.05} clearcoat={1} envMapIntensity={1.5} />
            </mesh>
          </group>
        ))}
        {/* flash */}
        <mesh position={[0.11, -0.09, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 20]} />
          <meshStandardMaterial color="#f5f1df" emissive="#fff6d8" emissiveIntensity={0.3} roughness={0.4} />
        </mesh>
      </group>

      {/* side buttons */}
      <mesh position={[-w / 2 - 0.008, 0.25, 0]}>
        <boxGeometry args={[0.02, 0.26, 0.055]} />
        <meshStandardMaterial color="#9aa0ab" metalness={1} roughness={0.35} />
      </mesh>
      <mesh position={[w / 2 + 0.008, 0.38, 0]}>
        <boxGeometry args={[0.02, 0.32, 0.055]} />
        <meshStandardMaterial color="#9aa0ab" metalness={1} roughness={0.35} />
      </mesh>
      <mesh position={[-w / 2 - 0.008, -0.1, 0]}>
        <boxGeometry args={[0.02, 0.16, 0.055]} />
        <meshStandardMaterial color="#9aa0ab" metalness={1} roughness={0.35} />
      </mesh>
    </group>
  )
}
