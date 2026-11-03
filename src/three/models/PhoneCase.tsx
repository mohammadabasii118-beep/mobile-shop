import { useMemo } from 'react'
import * as THREE from 'three'
import { roundedRectShape } from '../lib/geometry'
import { PHONE } from '../lib/dims'

type Props = JSX.IntrinsicElements['group'] & {
  color?: string
}

/** Independent 3D case shell that wraps the phone body: side rim + back panel with camera cut-out. */
export default function PhoneCase({ color = '#1f232b', ...props }: Props) {
  const { w, h, d, r } = PHONE

  // Side rim: outer rounded rect minus inner (phone-sized) rounded rect, extruded.
  const rimGeo = useMemo(() => {
    const outer = roundedRectShape(w + 0.07, h + 0.07, r + 0.035)
    const inner = roundedRectShape(w + 0.012, h + 0.012, r + 0.004)
    outer.holes.push(new THREE.Path(inner.getPoints(40).map((p) => p.clone())))
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: d + 0.05,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 3,
      curveSegments: 24,
    })
    geo.center()
    geo.computeVertexNormals()
    return geo
  }, [w, h, d, r])

  // Back panel with a camera cut-out hole.
  const backGeo = useMemo(() => {
    const shape = roundedRectShape(w + 0.07, h + 0.07, r + 0.035)
    const hole = roundedRectShape(0.56, 0.56, 0.16)
    const holePts = hole.getPoints(32).map((p) => p.clone().add(new THREE.Vector2(-w * 0.26, h * 0.3)))
    shape.holes.push(new THREE.Path(holePts))
    return new THREE.ShapeGeometry(shape, 24)
  }, [w, h, r])

  return (
    <group {...props}>
      <mesh geometry={rimGeo} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.1} roughness={0.55} clearcoat={0.35} clearcoatRoughness={0.4} />
      </mesh>
      <mesh geometry={backGeo} position={[0, 0, -(d / 2) - 0.03]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} metalness={0.1} roughness={0.55} clearcoat={0.35} clearcoatRoughness={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
