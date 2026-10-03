"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { PhoneCaseModel, type Quality } from "./models";
import { FloorShadow, StudioLights } from "./scene";

function HeroProduct({ quality, reducedMotion }: { quality: Quality; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const input = useRef({ x: 0, y: 0, scroll: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      input.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      input.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => { input.current.scroll = Math.min(window.scrollY / 800, 1); };
    if (!reducedMotion && quality === "high") window.addEventListener("pointermove", onMove, { passive: true });
    if (!reducedMotion) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reducedMotion, quality]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 4);
    const { x, y, scroll } = input.current;
    // واکنش به موس (ملایم) + اسکرول = چرخش
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, -0.5 + x * 0.35 + scroll * 1.6, k);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.08 + y * 0.12, k);
    g.position.y = THREE.MathUtils.lerp(g.position.y, scroll * 0.4, k);
  });

  const body = (
    <group ref={group} rotation={[0.08, -0.5, 0.06]}>
      <PhoneCaseModel phone="iphone-17-pro" color="#cdbfa6" material="silicone" pattern="plain" quality={quality} />
    </group>
  );

  return reducedMotion || quality === "low" ? body : <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>{body}</Float>;
}

export default function HeroScene({ quality, reducedMotion }: { quality: Quality; reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={quality === "low" ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 4.7], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <StudioLights />
      <HeroProduct quality={quality} reducedMotion={reducedMotion} />
      <FloorShadow y={-0.95} size={2.6} opacity={0.6} />
    </Canvas>
  );
}
