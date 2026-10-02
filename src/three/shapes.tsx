import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';

/** گوشی سه‌بعدی procedural با قاب (قابل جایگزینی با GLB) */
export function PhoneModel({ caseColor = '#8B5CF6', screenColor = '#0a0a14', scale = 1 }: { caseColor?: string; screenColor?: string; scale?: number }) {
  const lens = useMemo(() => [[-0.28, 0.9], [-0.28, 0.5], [0.12, 0.7]] as const, []);
  return (
    <group scale={scale}>
      {/* قاب */}
      <RoundedBox args={[1.5, 3.1, 0.2]} radius={0.22} smoothness={4}>
        <meshPhysicalMaterial color={caseColor} roughness={0.25} metalness={0.2} clearcoat={1} clearcoatRoughness={0.15} />
      </RoundedBox>
      {/* بدنه گوشی داخل قاب (نمایشگر) */}
      <RoundedBox args={[1.34, 2.94, 0.06]} radius={0.17} smoothness={4} position={[0, 0, 0.115]}>
        <meshStandardMaterial color={screenColor} roughness={0.15} metalness={0.6} emissive="#2b1b66" emissiveIntensity={0.55} />
      </RoundedBox>
      {/* جزیره دوربین پشت */}
      <RoundedBox args={[0.78, 0.9, 0.08]} radius={0.16} smoothness={3} position={[-0.3, 0.95, -0.14]}>
        <meshStandardMaterial color="#0c0c0c" roughness={0.3} metalness={0.8} />
      </RoundedBox>
      {lens.map(([x, y], i) => (
        <group key={i} position={[x - 0.02, y + 0.05, -0.2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.06, 32]} /><meshStandardMaterial color="#222" metalness={1} roughness={0.2} /></mesh>
          <mesh position={[0, 0, -0.035]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.095, 0.095, 0.02, 32]} /><meshStandardMaterial color="#0b1220" metalness={0.9} roughness={0.05} emissive="#38bdf8" emissiveIntensity={0.3} /></mesh>
        </group>
      ))}
      {/* لوگو */}
      <mesh position={[0, -0.5, -0.105]} rotation={[0, Math.PI, 0]}>
        <ringGeometry args={[0.32, 0.36, 48]} /><meshBasicMaterial color="#fff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Dynamic Island */}
      <mesh position={[0, 1.34, 0.15]}><capsuleGeometry args={[0.05, 0.3, 4, 12]} /><meshBasicMaterial color="#000" /></mesh>
      <mesh position={[0, 1.34, 0.15]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  );
}

export function MiniCase({ color = '#EC4899' }: { color?: string }) {
  return (
    <group>
      <RoundedBox args={[0.6, 1.2, 0.1]} radius={0.12} smoothness={3}><meshPhysicalMaterial color={color} roughness={0.3} clearcoat={1} /></RoundedBox>
      <RoundedBox args={[0.5, 1.1, 0.04]} radius={0.09} position={[0, 0, 0.04]}><meshStandardMaterial color="#0c0c0c" /></RoundedBox>
    </group>
  );
}
export function Cable({ color = '#38BDF8' }: { color?: string }) {
  return (
    <group>
      <mesh><torusGeometry args={[0.45, 0.04, 16, 64]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
      <mesh position={[0.45, 0, 0]}><boxGeometry args={[0.16, 0.22, 0.1]} /><meshStandardMaterial color="#d7e2ea" metalness={0.9} roughness={0.2} /></mesh>
      <mesh position={[-0.45, 0, 0]}><boxGeometry args={[0.16, 0.22, 0.1]} /><meshStandardMaterial color="#d7e2ea" metalness={0.9} roughness={0.2} /></mesh>
    </group>
  );
}
export function Charger({ color = '#FB923C' }: { color?: string }) {
  return (
    <group>
      <RoundedBox args={[0.5, 0.5, 0.5]} radius={0.1}><meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.8} /></RoundedBox>
      <mesh position={[-0.1, 0, 0.35]}><boxGeometry args={[0.05, 0.14, 0.2]} /><meshStandardMaterial color="#ddd" metalness={1} roughness={0.2} /></mesh>
      <mesh position={[0.1, 0, 0.35]}><boxGeometry args={[0.05, 0.14, 0.2]} /><meshStandardMaterial color="#ddd" metalness={1} roughness={0.2} /></mesh>
    </group>
  );
}
export function Earbuds() {
  return (
    <group>
      <RoundedBox args={[0.7, 0.55, 0.3]} radius={0.15}><meshPhysicalMaterial color="#f1f5f9" roughness={0.25} clearcoat={1} /></RoundedBox>
      <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.12, 24, 24]} /><meshStandardMaterial color="#fff" roughness={0.3} /></mesh>
    </group>
  );
}
export function MagSafe() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.38, 0.38, 0.07, 48]} /><meshPhysicalMaterial color="#e5e7eb" roughness={0.2} clearcoat={1} /></mesh>
      <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.012, 8, 48]} /><meshBasicMaterial color="#8B5CF6" /></mesh>
    </group>
  );
}
