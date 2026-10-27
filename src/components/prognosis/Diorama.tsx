"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, TiltShift2, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { END, createNeighborhood, stageAt, type Neighborhood } from "./build";

export type Tick = { stage: number; counts: ReturnType<Neighborhood["counts"]> };

// postprocessing's ToneMappingMode.ACES_FILMIC
const ACES_FILMIC = 6;

// Camera keyframes over the timeline: start on a dead block, end wide on the whole neighborhood.
const SHOTS = [
  { t: 0, at: new THREE.Vector3(-9, 0, -3), az: 0.75, el: 0.95, d: 24 },
  { t: 8, at: new THREE.Vector3(-4, 0, -1), az: 0.6, el: 0.92, d: 34 },
  { t: 15, at: new THREE.Vector3(0, 0, 0), az: 0.45, el: 0.86, d: 52 },
];
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

type Props = { playing: boolean; replay: number; onTick: (tick: Tick) => void };

function Scene({ playing, replay, onTick }: Props) {
  // Built once per mount (this module only loads client-side); freed on unmount.
  const [hood] = useState<Neighborhood>(createNeighborhood);
  const state = useRef({ t: 0, clock: 0, stage: -1, frame: 0 });
  const pointer = useRef(new THREE.Vector2());
  const shotAt = useRef(new THREE.Vector3());
  const tick = useRef(onTick);

  useLayoutEffect(() => {
    tick.current = onTick;
  });

  useEffect(() => () => hood.dispose(), [hood]);

  useEffect(() => {
    state.current.t = 0;
    state.current.stage = -1;
  }, [replay]);

  useEffect(() => {
    const onMove = (e: PointerEvent) =>
      pointer.current.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((three, delta) => {
    if (!hood) return;
    const k = state.current;
    const dt = Math.min(delta, 1 / 20);
    if (playing) k.t = Math.min(END, k.t + dt);
    k.clock += dt;
    hood.update(k.t, k.clock);

    // Interpolate between camera shots.
    let a = SHOTS[0];
    let b = SHOTS[SHOTS.length - 1];
    for (let i = 0; i < SHOTS.length - 1; i++) {
      if (k.t >= SHOTS[i].t && k.t <= SHOTS[i + 1].t) {
        a = SHOTS[i];
        b = SHOTS[i + 1];
      }
    }
    const f = a === b ? 1 : smooth((k.t - a.t) / (b.t - a.t));
    const cam = three.camera as THREE.PerspectiveCamera;
    const narrow = cam.aspect < 1.2 ? 1.5 : 1;
    shotAt.current.lerpVectors(a.at, b.at, k.t >= SHOTS[SHOTS.length - 1].t ? 1 : f);
    const az = THREE.MathUtils.lerp(a.az, b.az, f) + Math.sin(k.clock * 0.08) * 0.08 + pointer.current.x * 0.06;
    const el = THREE.MathUtils.lerp(a.el, b.el, f) - pointer.current.y * 0.03;
    const d = THREE.MathUtils.lerp(a.d, b.d, f) * narrow;
    const at = shotAt.current;
    cam.position.set(at.x + Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, at.z + Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(at);

    const stage = stageAt(k.t);
    k.frame += 1;
    if (stage !== k.stage || k.frame % 12 === 0) {
      k.stage = stage;
      tick.current({ stage, counts: hood.counts(k.t) });
    }
  });

  return hood ? <primitive object={hood.root} /> : null;
}

export default function Diorama({ active, ...props }: Props & { active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      shadows="percentage"
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 26, near: 1, far: 300, position: [20, 30, 20] }}
      aria-hidden
    >
      <color attach="background" args={["#0a0c10"]} />
      <fog attach="fog" args={["#0a0c10", 60, 140]} />
      <hemisphereLight args={["#b8c4ff", "#1a1410", 0.55]} />
      <directionalLight
        position={[-24, 40, 18]}
        intensity={2.2}
        color="#ffd9a8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#f0b878" position={[-14, 5, -12]} scale={[18, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.7} color="#8090c4" position={[0, 16, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#fff1d6" position={[7, 7, 16]} scale={3} target={[0, 0, 0]} />
      </Environment>
      <Scene {...props} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.8} luminanceSmoothing={0.25} radius={0.7} />
        <TiltShift2 blur={0.12} taper={0.35} samples={10} start={[0, 0.5]} end={[1, 0.5]} />
        <Vignette offset={0.3} darkness={0.6} />
        <ToneMapping mode={ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
