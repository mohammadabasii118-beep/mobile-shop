"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MaterialId, PatternId, PhoneId } from "@/data/configurator";
import type { ProductKind } from "@/types/product";
import { MODEL_HEIGHT, ProductModel, type Quality } from "./models";
import { FloorShadow, StudioLights } from "./scene";

export type AnglePreset = "iso" | "front" | "side" | "back" | "detail";

/** [azimuth, polar, distanceFactor] */
const PRESETS: Record<AnglePreset, [number, number, number]> = {
  iso: [0.55, 1.4, 1],
  front: [0, 1.55, 1],
  side: [Math.PI / 2, 1.55, 1],
  back: [Math.PI, 1.55, 1],
  detail: [0.3, 1.1, 0.55],
};

export interface ViewerApi {
  rotate: (delta: number) => void;
}

export interface Viewer3DProps {
  kind: ProductKind;
  color: string;
  phone: PhoneId;
  material: MaterialId;
  pattern: PatternId;
  angle: AnglePreset;
  zoom: number;
  autoRotate: boolean;
  quality: Quality;
  reducedMotion: boolean;
  apiRef?: MutableRefObject<ViewerApi | null>;
}

const BASE_DISTANCE = 5;

function CameraRig({ angle, zoom, reducedMotion, controls, apiRef }: {
  angle: AnglePreset; zoom: number; reducedMotion: boolean;
  controls: MutableRefObject<OrbitControlsImpl | null>;
  apiRef?: MutableRefObject<ViewerApi | null>;
}) {
  const { camera, gl } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  const first = useRef(true);

  // موبایل: اسکرول عمودی صفحه آزاد بماند، چرخش افقی با swipe (DESIGN.md §9)
  useEffect(() => {
    gl.domElement.style.touchAction = "pan-y";
  }, [gl]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => { goal.current = null; };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, [controls]);

  useEffect(() => {
    if (apiRef) {
      apiRef.current = {
        rotate: (delta) => {
          const c = controls.current;
          if (!c) return;
          goal.current = null;
          camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
          c.update();
        },
      };
    }
  }, [apiRef, camera, controls]);

  const set = (az: number, polar: number, dist: number) => {
    const g = new THREE.Vector3(
      dist * Math.sin(polar) * Math.sin(az),
      dist * Math.cos(polar),
      dist * Math.sin(polar) * Math.cos(az),
    );
    if (first.current || reducedMotion) {
      camera.position.copy(g);
      controls.current?.update();
      first.current = false;
    } else goal.current = g;
  };

  useEffect(() => {
    const [az, polar, f] = PRESETS[angle];
    set(az, polar, (BASE_DISTANCE * f) / zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angle]);

  useEffect(() => {
    if (first.current) return;
    const dir = camera.position.clone().normalize();
    const f = PRESETS[angle][2];
    const g = dir.multiplyScalar((BASE_DISTANCE * f) / zoom);
    if (reducedMotion) { camera.position.copy(g); controls.current?.update(); } else goal.current = g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    camera.position.lerp(g, 1 - Math.exp(-dt * 7));
    if (camera.position.distanceTo(g) < 0.01) goal.current = null;
    controls.current?.update();
  });
  return null;
}

export default function Viewer3D(p: Viewer3DProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const low = p.quality === "low";
  const floorY = -MODEL_HEIGHT[p.kind] / 2 - 0.05;

  return (
    <Canvas
      dpr={low ? [1, 1.5] : [1, 2]}
      camera={{ position: [2, 1, 4.6], fov: 32, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <StudioLights />
      <group position={[0, p.kind === "earbuds" ? 0.1 : 0, 0]}>
        <ProductModel kind={p.kind} color={p.color} phone={p.phone} material={p.material} pattern={p.pattern} quality={p.quality} />
      </group>
      <FloorShadow y={floorY} />
      <OrbitControls
        ref={controls as never}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.8}
        minPolarAngle={0.6}
        maxPolarAngle={2.3}
        autoRotate={p.autoRotate && !p.reducedMotion}
        autoRotateSpeed={1.4}
      />
      <CameraRig angle={p.angle} zoom={p.zoom} reducedMotion={p.reducedMotion} controls={controls} apiRef={p.apiRef} />
    </Canvas>
  );
}
