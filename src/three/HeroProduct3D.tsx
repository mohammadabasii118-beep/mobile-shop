import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Float } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { Cable, Charger, Earbuds, MagSafe, MiniCase, PhoneModel } from './shapes';

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  return m;
}

function Scene({ mobile, reduce, color }: { mobile: boolean; reduce: boolean; color: string }) {
  const group = useRef<THREE.Group>(null);
  const items = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!group.current) return;
    const { x, y } = state.pointer; // Mouse parallax
    const t = state.clock.elapsedTime;
    const tx = reduce ? 0 : x * 0.6 + Math.sin(t * 0.4) * 0.25;
    const ty = reduce ? 0 : -y * 0.25;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, tx, 3, dt);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, ty, 3, dt);
    if (items.current && !reduce) { items.current.position.x = THREE.MathUtils.damp(items.current.position.x, -x * 0.35, 2, dt); items.current.position.y = THREE.MathUtils.damp(items.current.position.y, -y * 0.2, 2, dt); }
  });
  const f = reduce ? 0 : 1;
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <pointLight position={[-4, -1, 2]} intensity={25} color="#8B5CF6" />
      <pointLight position={[4, -2, 3]} intensity={18} color="#EC4899" />
      <group ref={group}>
        <Float speed={1.6 * f} rotationIntensity={0.2 * f} floatIntensity={0.8 * f}>
          <group rotation={[0.08, -0.35, 0.06]}><PhoneModel caseColor={color} scale={mobile ? 0.9 : 1} /></group>
        </Float>
      </group>
      {!mobile && (
        <group ref={items}>
          <Float speed={2 * f} floatIntensity={1.2 * f}><group position={[-3.1, 1.3, -0.5]} rotation={[0.3, 0.5, -0.3]}><MiniCase color="#EC4899" /></group></Float>
          <Float speed={1.4 * f} floatIntensity={1 * f}><group position={[3.2, 1.1, -0.3]} rotation={[0.6, 0.2, 0.4]}><Cable /></group></Float>
          <Float speed={1.8 * f} floatIntensity={1.1 * f}><group position={[3, -1.4, 0.4]} rotation={[0.3, -0.5, 0.2]}><Charger /></group></Float>
          <Float speed={1.5 * f} floatIntensity={1 * f}><group position={[-3, -1.4, 0.2]} rotation={[0.4, 0.4, -0.2]}><Earbuds /></group></Float>
          <Float speed={2.2 * f} floatIntensity={1.3 * f}><group position={[1.9, 2.2, -1]} rotation={[1.1, 0.3, 0]}><MagSafe /></group></Float>
        </group>
      )}
      {!mobile && <ContactShadows position={[0, -2.3, 0]} opacity={0.5} scale={9} blur={2.6} far={4} />}
    </>
  );
}

/** Hero سه‌بعدی: پارالکس ماوس، چرخش، شناور، نورپردازی، سایه — در موبایل سبک می‌شود. */
export default function HeroProduct3D({ color = '#8B5CF6', className = '' }: { color?: string; className?: string }) {
  const mobile = useIsMobile();
  const reduce = !!useReducedMotion();
  return (
    <div className={className}>
      <Canvas dpr={mobile ? [1, 1.25] : [1, 2]} camera={{ position: [0, 0, 7.2], fov: 38 }} gl={{ antialias: !mobile, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
        <Suspense fallback={null}><Scene mobile={mobile} reduce={reduce} color={color} /></Suspense>
      </Canvas>
    </div>
  );
}
