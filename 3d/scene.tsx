"use client";

import { useEffect, useMemo } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { createShadowTexture } from "./textures";

/** نورپردازی استودیویی کاملاً محلی — بدون HDR خارجی (DESIGN.md §9.5) */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={4} position={[0, 5, 2]} scale={[10, 4, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={2.4} position={[-5, 1, 1]} scale={[1.5, 8, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={2} position={[5, 0, -2]} scale={[1.5, 8, 1]} rotation-y={-Math.PI / 2} />
        {/* نور لبهٔ برند (Volt) */}
        <Lightformer form="ring" color="#c8f135" intensity={2.4} position={[0, -1, -5]} scale={6} />
      </Environment>
    </>
  );
}

export function FloorShadow({ y, size = 2.4, opacity = 0.7 }: { y: number; size?: number; opacity?: number }) {
  const tex = useMemo(() => createShadowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
