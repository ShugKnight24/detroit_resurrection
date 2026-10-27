"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// A low-poly person with human proportions (about 1.25 units tall next to the
// 3.5-unit cottages) and a walk cycle: counter-swinging arms, knee-less legs,
// a small bob. `gait` returns the stride phase in radians for the current time,
// or null to stand still.
export type Look = { skin: string; hair: string; top: string; bottom: string; shoes?: string };

export const SKIN = ["#8d5a3b", "#5c3a24", "#c68c64", "#a8714d", "#f0c8a0", "#7a4a2e"];
export const TOPS = ["#2f3b52", "#7a2430", "#5b6b3e", "#c9a24a", "#e8e3d8", "#3f6f8f", "#8e4f3a", "#2b2b2e"];
export const BOTTOMS = ["#2b3340", "#3d4a63", "#4a3b2e", "#1f2024", "#6b6152"];
export const HAIR = ["#1a1412", "#2b1d14", "#4a3020", "#0f0f10", "#6b4a2a"];

export function lookFor(i: number): Look {
  return {
    skin: SKIN[i % SKIN.length],
    hair: HAIR[(i * 3) % HAIR.length],
    top: TOPS[(i * 5) % TOPS.length],
    bottom: BOTTOMS[(i * 7) % BOTTOMS.length],
  };
}

type Props = {
  look: Look;
  gait: (t: number) => number | null;
  zombie?: boolean;
  crouch?: boolean;
} & React.ComponentProps<"group">;

export default function Person({ look, gait, zombie = false, crouch = false, ...group }: Props) {
  const legs = useRef<THREE.Group[]>([]);
  const arms = useRef<THREE.Group[]>([]);
  const body = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const phase = gait(t);
    const swing = phase === null ? 0 : Math.sin(phase);
    const amp = zombie ? 0.25 : 0.55;
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = (i ? -swing : swing) * amp;
    });
    arms.current.forEach((arm, i) => {
      if (!arm) return;
      if (zombie) {
        arm.rotation.x = -1.35 + Math.sin(t * 1.3 + i) * 0.08;
      } else if (crouch) {
        arm.rotation.x = -0.9;
      } else {
        arm.rotation.x = (i ? swing : -swing) * 0.45;
      }
    });
    if (body.current) {
      body.current.position.y = (phase === null ? 0 : Math.abs(Math.cos(phase)) * 0.025) - (crouch ? 0.22 : 0);
      body.current.rotation.z = zombie ? Math.sin(t * 1.7) * 0.06 : 0;
      body.current.rotation.x = crouch ? 0.45 : zombie ? 0.12 : 0;
    }
  });

  const skin = zombie ? "#7f9a72" : look.skin;
  return (
    <group {...group}>
      <group ref={body}>
        {[-0.075, 0.075].map((x, i) => (
          <group
            key={x}
            ref={(g) => {
              if (g) legs.current[i] = g;
            }}
            position={[x, 0.62, 0]}
          >
            <mesh position={[0, -0.29, 0]}>
              <capsuleGeometry args={[0.06, 0.46, 4, 8]} />
              <meshStandardMaterial color={look.bottom} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.6, 0.04]}>
              <boxGeometry args={[0.1, 0.07, 0.2]} />
              <meshStandardMaterial color={look.shoes ?? "#18181a"} roughness={0.6} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.66, 0]}>
          <boxGeometry args={[0.24, 0.12, 0.15]} />
          <meshStandardMaterial color={look.bottom} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.88, 0]} scale={[1, 1, 0.72]}>
          <capsuleGeometry args={[0.13, 0.24, 4, 10]} />
          <meshStandardMaterial color={zombie ? "#5a5248" : look.top} roughness={0.85} />
        </mesh>
        {[-0.17, 0.17].map((x, i) => (
          <group
            key={x}
            ref={(g) => {
              if (g) arms.current[i] = g;
            }}
            position={[x, 1.02, 0]}
          >
            <mesh position={[0, -0.2, 0]}>
              <capsuleGeometry args={[0.042, 0.3, 4, 8]} />
              <meshStandardMaterial color={zombie ? "#5a5248" : look.top} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.4, 0]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color={skin} roughness={0.7} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.08, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.06, 8]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.2, 0]} scale={[1, 1.1, 1]}>
          <sphereGeometry args={[0.095, 16, 12]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.24, -0.012]} scale={[1.05, 0.85, 1.05]}>
          <sphereGeometry args={[0.095, 16, 8, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
          <meshStandardMaterial color={zombie ? "#2a2a24" : look.hair} roughness={0.95} />
        </mesh>
        {zombie &&
          [-0.035, 0.035].map((x) => (
            <mesh key={x} position={[x, 1.21, 0.088]}>
              <sphereGeometry args={[0.014, 6, 6]} />
              <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
            </mesh>
          ))}
      </group>
    </group>
  );
}

export function Dog({ gait, ...group }: { gait: (t: number) => number | null } & React.ComponentProps<"group">) {
  const legs = useRef<THREE.Mesh[]>([]);
  useFrame((state) => {
    const p = gait(state.clock.elapsedTime);
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = p === null ? 0 : Math.sin(p * 1.6 + (i % 2) * Math.PI) * 0.5;
    });
  });
  return (
    <group {...group}>
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[0.16, 0.14, 0.38]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.34, 0.22]}>
        <boxGeometry args={[0.13, 0.12, 0.14]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.32, -0.22]} rotation={[0.8, 0, 0]}>
        <boxGeometry args={[0.03, 0.03, 0.14]} />
        <meshStandardMaterial color="#8a5a32" />
      </mesh>
      {[
        [-0.05, 0.12],
        [0.05, 0.12],
        [-0.05, -0.12],
        [0.05, -0.12],
      ].map(([x, z], i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) legs.current[i] = m;
          }}
          position={[x, 0.09, z]}
        >
          <boxGeometry args={[0.04, 0.18, 0.04]} />
          <meshStandardMaterial color="#6e4526" />
        </mesh>
      ))}
    </group>
  );
}
