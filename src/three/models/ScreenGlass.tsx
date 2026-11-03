import { useMemo } from 'react'
import * as THREE from 'three'
import { slabGeometry, roundedRectShape } from '../lib/geometry'
import { PHONE } from '../lib/dims'

/**
 * Independent tempered-glass protector. Near-invisible: a thin clear slab that
 * mostly shows itself through environment reflections, a bright edge and a
 * soft raking highlight — it must not cloud the display beneath it.
 */
export default function ScreenGlass(props: JSX.IntrinsicElements['group']) {
  const { w, h, r } = PHONE
  const gw = w * 0.93
  const gh = h * 0.955
  const geo = useMemo(() => slabGeometry(gw, gh, 0.012, r * 0.74, 0.004), [gw, gh, r])

  // Bright polished edge (2.5D rounded bevel catches light).
  const edgeGeo = useMemo(() => {
    const outer = roundedRectShape(gw, gh, r * 0.74)
    const inner = roundedRectShape(gw - 0.018, gh - 0.018, r * 0.72)
    outer.holes.push(new THREE.Path(inner.getPoints(48)))
    return new THREE.ShapeGeometry(outer, 24)
  }, [gw, gh, r])

  const streakGeo = useMemo(
    () => new THREE.ShapeGeometry(roundedRectShape(w * 0.16, h * 0.92, 0.05)),
    [w, h],
  )

  return (
    <group {...props}>
      <mesh geometry={geo} renderOrder={2}>
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0}
          roughness={0}
          clearcoat={1}
          clearcoatRoughness={0}
          reflectivity={1}
          envMapIntensity={2.4}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={edgeGeo} position={[0, 0, 0.0065]} renderOrder={3}>
        <meshBasicMaterial color="#dfeaff" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* raking light reflection */}
      <mesh geometry={streakGeo} position={[-w * 0.14, 0, 0.007]} rotation={[0, 0, 0.3]} renderOrder={3}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.07} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={streakGeo} position={[w * 0.14, 0, 0.007]} rotation={[0, 0, 0.3]} scale={[0.45, 1, 1]} renderOrder={3}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.045} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
