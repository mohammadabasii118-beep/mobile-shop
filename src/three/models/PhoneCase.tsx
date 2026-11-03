import { useMemo } from 'react'
import * as THREE from 'three'
import { roundedRectShape, normalizeUVs } from '../lib/geometry'
import { PHONE } from '../lib/dims'

type Props = JSX.IntrinsicElements['group'] & {
  color?: string
}

/** Independent 3D case: translucent side rim + back panel with the real case photo. */
export default function PhoneCase({ color = '#6b2f4a', ...props }: Props) {
  const { w, h, d, r } = PHONE

  const rimGeo = useMemo(() => {
    const outer = roundedRectShape(w + 0.07, h + 0.07, r + 0.035)
    const inner = roundedRectShape(w + 0.012, h + 0.012, r + 0.004)
    outer.holes.push(new THREE.Path(inner.getPoints(48)))
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: d + 0.05,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 4,
      curveSegments: 32,
    })
    geo.center()
    geo.computeVertexNormals()
    return geo
  }, [w, h, d, r])

  const backGeo = useMemo(
    () => normalizeUVs(new THREE.ShapeGeometry(roundedRectShape(w + 0.07, h + 0.07, r + 0.035), 32)),
    [w, h, r],
  )
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load('/textures/case-back.jpg')
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])

  return (
    <group {...props}>
      <mesh geometry={rimGeo} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.05} roughness={0.3} clearcoat={1} clearcoatRoughness={0.15} transparent opacity={0.92} />
      </mesh>
      <mesh geometry={backGeo} position={[0, 0, -(d / 2) - 0.032]} rotation={[0, Math.PI, 0]} castShadow>
        <meshStandardMaterial map={tex} roughness={0.35} metalness={0.05} envMapIntensity={0.7} />
      </mesh>
    </group>
  )
}
