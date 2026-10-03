"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { luminance, shade } from "@/lib/color";
import { materials, phones, type MaterialId, type PatternId, type PhoneId } from "@/data/configurator";
import type { ProductKind } from "@/types/product";
import { createPatternTexture } from "./textures";

export type Quality = "high" | "low";

interface CommonProps {
  color: string;
  quality: Quality;
}

const seg = (q: Quality) => (q === "low" ? 2 : 5);

/* ------------------------------------------------------------------ */
/* Lens                                                                */
/* ------------------------------------------------------------------ */
function Lens({ x, y, z, r = 0.07 }: { x: number; y: number; z: number; r?: number }) {
  return (
    <group position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, 0.03, 24]} />
        <meshStandardMaterial color="#0c0d0f" roughness={0.25} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.62, 24]} />
        <meshPhysicalMaterial color="#15171c" roughness={0.05} metalness={0.4} clearcoat={1} />
      </mesh>
      <mesh position={[0, 0.014, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.011, 8, 32]} />
        <meshStandardMaterial color="#9a9da6" roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Phone case — configurator target                                    */
/* ------------------------------------------------------------------ */
interface CaseProps extends CommonProps {
  phone: PhoneId;
  material: MaterialId;
  pattern: PatternId;
}

export function PhoneCaseModel({ phone, color, material, pattern, quality }: CaseProps) {
  const spec = phones.find((p) => p.id === phone)!;
  const mat = materials.find((m) => m.id === material)!;
  const { w, h, d } = spec;
  const back = d / 2;
  const clear = material === "clear";
  const bodyColor = clear ? "#dfe9f0" : color;
  const islandColor = clear ? "#1b1d22" : shade(color, -0.14);
  const tex = useMemo(() => createPatternTexture(pattern, luminance(color) < 0.5), [pattern, color]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const s = seg(quality);
  const T = 0.035; // ضخامت جزیرهٔ دوربین

  return (
    <group>
      {clear && (
        <RoundedBox args={[w - 0.05, h - 0.05, d - 0.03]} radius={0.1} smoothness={s}>
          <meshPhysicalMaterial color={color} roughness={0.35} metalness={0.5} clearcoat={0.6} />
        </RoundedBox>
      )}
      <RoundedBox args={[w, h, d]} radius={0.115} smoothness={s}>
        <meshPhysicalMaterial
          color={bodyColor}
          roughness={mat.roughness}
          metalness={mat.metalness}
          clearcoat={mat.clearcoat}
          clearcoatRoughness={0.15}
          transparent={clear}
          opacity={clear ? 0.3 : 1}
          depthWrite={!clear}
        />
      </RoundedBox>

      {/* صفحهٔ نمایش (روبه‌روی گوشی) */}
      <RoundedBox args={[w - 0.1, h - 0.1, 0.012]} radius={0.08} smoothness={s} position={[0, 0, -back - 0.002]}>
        <meshPhysicalMaterial color="#050506" roughness={0.1} metalness={0.2} clearcoat={1} />
      </RoundedBox>

      {tex && (
        <mesh position={[0, -0.04, back + 0.002]}>
          <planeGeometry args={[w - 0.14, h - 0.24]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}

      {/* حلقهٔ مگ‌سیف */}
      <mesh position={[0, -0.1, back + 0.003]}>
        <torusGeometry args={[w * 0.29, 0.005, 8, 56]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.28} roughness={0.5} />
      </mesh>

      {/* جزیرهٔ دوربین */}
      {spec.camera === "square" && (
        <group position={[-w / 2 + 0.07 + 0.2, h / 2 - 0.07 - 0.2, back + T / 2]}>
          <RoundedBox args={[0.4, 0.4, T]} radius={0.09} smoothness={s}>
            <meshPhysicalMaterial color={islandColor} roughness={0.35} clearcoat={0.5} />
          </RoundedBox>
          <Lens x={-0.09} y={0.09} z={T / 2 + 0.008} />
          <Lens x={0.09} y={0.09} z={T / 2 + 0.008} />
          <Lens x={0} y={-0.09} z={T / 2 + 0.008} />
        </group>
      )}
      {spec.camera === "bar" && (
        <group position={[0, h / 2 - 0.4, back + T / 2]}>
          <RoundedBox args={[w - 0.02, 0.26, T]} radius={0.1} smoothness={s}>
            <meshPhysicalMaterial color={islandColor} roughness={0.35} clearcoat={0.5} />
          </RoundedBox>
          <Lens x={-0.2} y={0} z={T / 2 + 0.008} r={0.065} />
          <Lens x={0} y={0} z={T / 2 + 0.008} r={0.065} />
          <Lens x={0.2} y={0} z={T / 2 + 0.008} r={0.065} />
        </group>
      )}
      {spec.camera === "column" && (
        <group position={[-w / 2 + 0.2, h / 2 - 0.24, back]}>
          {[0, 1, 2].map((i) => (
            <group key={i} position={[0, -i * 0.25, 0]}>
              <mesh position={[0, 0, T / 2]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, T, 28]} />
                <meshPhysicalMaterial color={islandColor} roughness={0.35} clearcoat={0.5} />
              </mesh>
              <Lens x={0} y={0} z={T + 0.008} r={0.072} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic charger                                                    */
/* ------------------------------------------------------------------ */
export function ChargerModel({ color, quality }: CommonProps) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.52, -0.2, 0),
      new THREE.Vector3(0.9, -0.5, 0.05),
      new THREE.Vector3(0.7, -0.95, 0.15),
      new THREE.Vector3(0.9, -1.35, 0.1),
    ]),
    [],
  );
  const ring = shade(color, 0.12);
  return (
    <group rotation={[-0.25, 0, 0]} position={[-0.2, 0.2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.15, quality === "low" ? 40 : 80]} />
        <meshPhysicalMaterial color={color} roughness={0.38} metalness={0.35} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.078]}>
        <torusGeometry args={[0.52, 0.012, 8, 72]} />
        <meshStandardMaterial color={ring} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.078]}>
        <torusGeometry args={[0.22, 0.01, 8, 56]} />
        <meshStandardMaterial color={ring} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <circleGeometry args={[0.04, 20]} />
        <meshStandardMaterial color="#c8f135" emissive="#c8f135" emissiveIntensity={0.7} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.032, 8, false]} />
        <meshStandardMaterial color={shade(color, -0.3)} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Earbuds                                                             */
/* ------------------------------------------------------------------ */
export function EarbudsModel({ color, quality }: CommonProps) {
  const s = seg(quality);
  const mat = <meshPhysicalMaterial color={color} roughness={0.4} metalness={0.05} clearcoat={0.5} clearcoatRoughness={0.3} />;
  const bud = (x: number, tilt: number) => (
    <group position={[x, 0.32, 0.02]} rotation={[0, 0, tilt]}>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.15, 24, 18]} />
        {mat}
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <capsuleGeometry args={[0.055, 0.38, 4, 14]} />
        {mat}
      </mesh>
    </group>
  );
  return (
    <group rotation={[0.1, 0, 0]} position={[0, -0.15, 0]}>
      <RoundedBox args={[1.2, 0.62, 0.62]} radius={0.26} smoothness={s} position={[0, -0.22, 0]}>
        {mat}
      </RoundedBox>
      {/* درب باز */}
      <group position={[0, 0.08, -0.31]} rotation={[-1.1, 0, 0]}>
        <RoundedBox args={[1.2, 0.34, 0.62]} radius={0.22} smoothness={s} position={[0, 0.14, 0.31]}>
          {mat}
        </RoundedBox>
      </group>
      {bud(-0.28, 0.12)}
      {bud(0.28, -0.12)}
      <mesh position={[0, -0.05, 0.32]}>
        <circleGeometry args={[0.025, 16]} />
        <meshStandardMaterial color="#c8f135" emissive="#c8f135" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Power bank                                                          */
/* ------------------------------------------------------------------ */
export function PowerbankModel({ color, quality }: CommonProps) {
  const s = seg(quality);
  return (
    <group>
      <RoundedBox args={[0.88, 1.6, 0.32]} radius={0.15} smoothness={s}>
        <meshPhysicalMaterial color={color} roughness={0.5} metalness={0.15} clearcoat={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.2, 0.162]}>
        <torusGeometry args={[0.26, 0.006, 8, 56]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.24 + i * 0.16, -0.5, 0.162]}>
          <sphereGeometry args={[0.03, 12, 10]} />
          <meshStandardMaterial
            color={i < 3 ? "#c8f135" : "#808289"}
            emissive={i < 3 ? "#c8f135" : "#000000"}
            emissiveIntensity={i < 3 ? 0.8 : 0}
          />
        </mesh>
      ))}
      <RoundedBox args={[0.22, 0.04, 0.1]} radius={0.015} smoothness={2} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#0b0c0e" roughness={0.6} />
      </RoundedBox>
    </group>
  );
}

/* ------------------------------------------------------------------ */
export const MODEL_HEIGHT: Record<ProductKind, number> = {
  case: 1.6, charger: 1.6, earbuds: 1.2, powerbank: 1.6, adapter: 1.4, cable: 1.4, glass: 1.6,
};

export function ProductModel(props: CommonProps & { kind: ProductKind; phone: PhoneId; material: MaterialId; pattern: PatternId }) {
  switch (props.kind) {
    case "case":
      return <PhoneCaseModel {...props} />;
    case "charger":
      return <ChargerModel {...props} />;
    case "earbuds":
      return <EarbudsModel {...props} />;
    case "powerbank":
      return <PowerbankModel {...props} />;
    default:
      return null;
  }
}
