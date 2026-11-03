import { useMemo } from 'react'
import * as THREE from 'three'
import { roundedRectShape } from '../lib/geometry'
import { PLATEAU, LENSES, LENS_R, FLASH, LIDAR, PLATEAU_Z } from '../lib/dims'

const ALU = '#5a1524'

function circlePath(x: number, y: number, rad: number) {
  const p = new THREE.Path()
  p.absarc(x, y, rad, 0, Math.PI * 2, true)
  return p
}

/**
 * Independent 3D camera-lens protector (as in the product photo): an aluminium
 * plate covering the camera plateau, with a metal ring and sapphire-glass disc
 * capping each lens barrel. Built in phone-local coordinates at its final pose.
 */
export default function LensGlass(props: JSX.IntrinsicElements['group']) {
  const plateGeo = useMemo(() => {
    const s = roundedRectShape(PLATEAU.w, PLATEAU.h, PLATEAU.r)
    const shape = new THREE.Shape(s.getPoints(64).map((p) => new THREE.Vector2(p.x, p.y + PLATEAU.cy)))
    LENSES.forEach(([x, y]) => shape.holes.push(circlePath(x, y, LENS_R + 0.006)))
    shape.holes.push(circlePath(FLASH[0], FLASH[1], 0.058))
    shape.holes.push(circlePath(LIDAR[0], LIDAR[1], 0.062))
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 48 })
    g.computeVertexNormals()
    return g
  }, [])

  const capZ = PLATEAU_Z - 0.046

  return (
    <group {...props}>
      {/* aluminium plate */}
      <mesh geometry={plateGeo} position={[0, 0, PLATEAU_Z - 0.012]} castShadow>
        <meshPhysicalMaterial color={ALU} metalness={0.8} roughness={0.45} clearcoat={0.3} envMapIntensity={0.7} />
      </mesh>

      {LENSES.map(([x, y], i) => (
        <group key={i} position={[x, y, 0]}>
          {/* metal sleeve around the barrel */}
          <mesh position={[0, 0, PLATEAU_Z - 0.026]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[LENS_R + 0.014, LENS_R + 0.014, 0.042, 48, 1, true]} />
            <meshPhysicalMaterial color={ALU} metalness={0.9} roughness={0.25} side={THREE.DoubleSide} />
          </mesh>
          {/* polished ring */}
          <mesh position={[0, 0, capZ]}>
            <torusGeometry args={[LENS_R + 0.008, 0.009, 16, 64]} />
            <meshPhysicalMaterial color="#c9a7b0" metalness={1} roughness={0.15} clearcoat={1} envMapIntensity={1.8} />
          </mesh>
          {/* sapphire glass disc */}
          <mesh position={[0, 0, capZ - 0.002]} rotation={[0, Math.PI, 0]} renderOrder={2}>
            <circleGeometry args={[LENS_R + 0.004, 48]} />
            <meshPhysicalMaterial color="#cfe0ff" transparent opacity={0.07} roughness={0} clearcoat={1} reflectivity={1} envMapIntensity={2} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {/* glint */}
          <mesh position={[-0.03, 0.03, capZ - 0.003]} rotation={[0, Math.PI, 0.6]} renderOrder={3}>
            <planeGeometry args={[0.02, 0.11]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.22} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
