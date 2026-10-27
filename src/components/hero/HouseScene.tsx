"use client";

import { Environment, Lightformer, QuadraticBezierLine, RoundedBox, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, TiltShift2, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useLayoutEffect, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import Person, { Dog, lookFor } from "./Person";
import { clamp01, sinceShock, smooth, type Phase } from "./timeline";

type SceneProps = { phase: Phase; shockAt: number | null };
type Clock = { current: SceneProps };

// postprocessing's ToneMappingMode.ACES_FILMIC
const ACES_FILMIC = 6;

const WARM = new THREE.Color("#ffc46b");
const SPARK = new THREE.Color("#bfe3ff");
const EYE = new THREE.Color("#ff2a3d");
const DEAD_GRASS = new THREE.Color("#4a4430");
const LIVE_GRASS = new THREE.Color("#3f7a3c");
const DUSK = new THREE.Color("#131b2c");
const GLOW = new THREE.Color("#2a2538");

// Camera opens close on the patient house (so the paddles read), then pulls
// back after the shock to reveal the whole revived block.
const CLOSE = new THREE.Vector3(0.4, 1.35, 1.9);
const WIDE = new THREE.Vector3(-0.6, 1.3, 1.4);
const LOOK = new THREE.Vector3();
const easeOutBack = (t: number) => {
  const c = clamp01(t);
  return 1 + 2.7 * (c - 1) ** 3 + 1.7 * (c - 1) ** 2;
};

/* ---------- Layout ---------- */

type LotKind = "zombie" | "garden" | "patient" | "ghost" | "monster";
const LOTS: { x: number; kind: LotKind; siding: string; door: string; delay: number }[] = [
  { x: -8.4, kind: "zombie", siding: "#a14b34", door: "#1f2a3a", delay: 1.9 },
  { x: -4.2, kind: "garden", siding: "", door: "", delay: 1.3 },
  { x: 0, kind: "patient", siding: "#e6dcc4", door: "#7a2430", delay: 0.55 },
  { x: 4.2, kind: "ghost", siding: "#6f8f7d", door: "#efe6d2", delay: 1.55 },
  { x: 8.4, kind: "monster", siding: "#3d5f86", door: "#c9a24a", delay: 2.2 },
];
const BACK_ROW = [-10.5, -6.3, -2.1, 2.1, 6.3, 10.5].map((x, i) => ({
  x,
  z: -6.5 - (i % 2) * 1.2,
  scale: 0.85 + ((i * 37) % 10) / 60,
  delay: 2.6 + i * 0.18,
  siding: ["#8a7f70", "#6e7d86", "#9a6a52", "#7d8a6a", "#a39a88", "#6a6f80"][i],
}));
const SIDEWALK_Z = 3.6;
const ROAD_Z = 5.9;
const LAMPS = [-6.3, -2.1, 2.1, 6.3];

/* ---------- Shared geometry (module scope, built once) ---------- */

function gable(w: number, h: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}
const ROOF = gable(3.5, 1.45, 3.05);
const BACK_ROOF = gable(3.4, 1.3, 2.9);

/* ---------- Defibrillator ---------- */

const UNIT = new THREE.Vector3(0.9, 0.25, 3.0);
const PADDLES = [
  { rest: new THREE.Vector3(-0.4, 1.0, 2.9), contact: new THREE.Vector3(-0.6, 1.3, 1.36), side: -0.25 },
  { rest: new THREE.Vector3(1.0, 1.0, 2.9), contact: new THREE.Vector3(0.55, 1.75, 1.36), side: 0.25 },
].map((p) => ({
  ...p,
  start: UNIT.clone().add(new THREE.Vector3(p.side, 0.2, 0)),
  at: new THREE.Vector3(),
  mid: new THREE.Vector3(),
  end: new THREE.Vector3(),
}));

const SPARK_COUNT = 180;
const SPARKS = (() => {
  const velocity = new Float32Array(SPARK_COUNT * 3);
  const origin = new Float32Array(SPARK_COUNT * 3);
  for (let i = 0; i < SPARK_COUNT; i++) {
    const c = PADDLES[i % 2].contact;
    origin.set([c.x, c.y, c.z + 0.05], i * 3);
    velocity.set([(Math.random() - 0.5) * 6, Math.random() * 5, Math.random() * 4], i * 3);
  }
  return { velocity, origin, positions: origin.slice() };
})();

/* ---------- Street life ---------- */

const WALKERS = Array.from({ length: 13 }, (_, i) => ({
  z: SIDEWALK_Z + (i % 2 ? 0.32 : -0.28),
  speed: (0.45 + ((i * 53) % 10) / 25) * (i % 2 ? 1 : -1),
  offset: (i * 7.3) % 30,
  scale: i % 6 === 5 ? 0.7 : 0.95 + ((i * 17) % 10) / 80,
  look: lookFor(i),
  delay: 2.7 + (i % 7) * 0.22,
  dog: i === 3,
}));

const rebuild = (s: number, delay: number) => ({
  ruin: s < 0 ? 1 : 1 - smooth((s - delay) / 0.45),
  build: s < 0 ? 0 : easeOutBack((s - delay - 0.3) / 0.8),
});

function useLatest(props: SceneProps): Clock {
  const ref = useRef(props);
  useLayoutEffect(() => {
    ref.current = props;
  });
  return ref;
}

/* ---------- Houses ---------- */

type HouseLook = {
  siding: string;
  roof: string;
  trim: string;
  door: string;
  ruined?: boolean;
  eyes?: boolean;
  lit?: React.RefObject<THREE.MeshStandardMaterial[]>;
};

// A Detroit front-gable cottage: foundation, clapboard body, steep gable,
// offset door, wide front window, attic window, and a porch.
function Cottage({ siding, roof, trim, door, ruined = false, eyes = false, lit }: HouseLook) {
  const glass = (i: number, w: number, h: number) => (
    <meshStandardMaterial
      ref={(m) => {
        if (m && lit) lit.current[i] = m;
      }}
      color={ruined ? "#0a0a0c" : "#2a2010"}
      emissive={eyes ? EYE : WARM}
      emissiveIntensity={eyes ? 3 : 0}
      roughness={0.3}
      key={`${w}${h}`}
    />
  );
  return (
    <group rotation={[0, 0, ruined ? 0.015 : 0]}>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[3.1, 0.26, 2.7]} />
        <meshStandardMaterial color="#6d6a64" roughness={1} />
      </mesh>
      <mesh position={[0, 1.31, 0]}>
        <boxGeometry args={[3, 2.1, 2.6]} />
        <meshStandardMaterial color={siding} roughness={0.85} />
      </mesh>
      {[-1.48, 1.48].map((x) =>
        [-1.28, 1.28].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.31, z]}>
            <boxGeometry args={[0.09, 2.1, 0.09]} />
            <meshStandardMaterial color={trim} />
          </mesh>
        )),
      )}
      <mesh geometry={ROOF} position={[0, 2.36, 0]} rotation={[0, 0, ruined ? 0.03 : 0]}>
        <meshStandardMaterial color={roof} roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.38, 0]}>
        <boxGeometry args={[3.2, 0.08, 2.8]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      {/* front window, attic window, door */}
      <group position={[-0.6, 1.4, 1.305]}>
        <mesh position={[0, 0, -0.004]}>
          <planeGeometry args={[1.18, 0.98]} />
          <meshStandardMaterial color={trim} />
        </mesh>
        <mesh name={eyes ? "eye" : undefined}>
          <planeGeometry args={[1.0, 0.8]} />
          {glass(0, 1, 0.8)}
        </mesh>
      </group>
      <group position={[0, 2.95, 1.53]}>
        <mesh position={[0, 0, -0.004]}>
          <planeGeometry args={[0.62, 0.62]} />
          <meshStandardMaterial color={trim} />
        </mesh>
        <mesh name={eyes ? "eye" : undefined}>
          <planeGeometry args={[0.48, 0.48]} />
          {glass(1, 0.48, 0.48)}
        </mesh>
      </group>
      <mesh position={[0.75, 0.95, 1.31]}>
        <boxGeometry args={[0.62, 1.3, 0.04]} />
        <meshStandardMaterial color={ruined ? "#140e0c" : door} roughness={0.6} />
      </mesh>
      {/* porch */}
      <mesh position={[0, 0.2, 1.9]}>
        <boxGeometry args={[3.0, 0.16, 1.1]} />
        <meshStandardMaterial color={ruined ? "#4a4038" : "#8a7a66"} roughness={0.9} />
      </mesh>
      <mesh position={[0.75, 0.08, 2.6]}>
        <boxGeometry args={[0.8, 0.12, 0.35]} />
        <meshStandardMaterial color="#6d6a64" />
      </mesh>
      {(ruined ? [-1.38] : [-1.38, 1.38]).map((x) => (
        <mesh key={x} position={[x, 1.1, 2.38]}>
          <boxGeometry args={[0.1, 1.65, 0.1]} />
          <meshStandardMaterial color={trim} />
        </mesh>
      ))}
      <mesh position={[0, 1.96, 1.95]} rotation={[0.06, 0, ruined ? 0.13 : 0]}>
        <boxGeometry args={[3.15, 0.08, 1.25]} />
        <meshStandardMaterial color={roof} roughness={0.75} />
      </mesh>
      {ruined && (
        <>
          {[
            [-0.6, 1.4, 1.34, 0.4],
            [-0.6, 1.4, 1.34, -0.4],
            [0.75, 0.95, 1.35, 0.9],
            [0.75, 0.95, 1.35, -0.9],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} rotation={[0, 0, r]}>
              <boxGeometry args={[i < 2 ? 1.25 : 1.35, 0.12, 0.03]} />
              <meshStandardMaterial color={i % 2 ? "#6a5640" : "#7a6448"} roughness={1} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function RevivedExtras() {
  return (
    <>
      {[-1.2, 1.25].map((x) => (
        <mesh key={x} position={[x, 0.42, 2.25]}>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshStandardMaterial color="#3f7a45" roughness={1} />
        </mesh>
      ))}
      {/* picket fence along the sidewalk */}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position={[-1.85 + i * 0.3, 0.33, 2.95]}>
          <boxGeometry args={[0.06, 0.5, 0.04]} />
          <meshStandardMaterial color="#f2efe6" />
        </mesh>
      ))}
      <mesh position={[-1.05, 0.38, 2.95]}>
        <boxGeometry args={[1.65, 0.05, 0.03]} />
        <meshStandardMaterial color="#f2efe6" />
      </mesh>
      <group position={[1.95, 0, 0.8]}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 1.5, 8]} />
          <meshStandardMaterial color="#4a3526" />
        </mesh>
        <mesh position={[0, 1.85, 0]}>
          <icosahedronGeometry args={[0.75, 1]} />
          <meshStandardMaterial color="#3d7a48" roughness={1} flatShading />
        </mesh>
      </group>
    </>
  );
}

/* ---------- The haunting ---------- */

function Ghost({ clock, delay }: { clock: Clock; delay: number }) {
  const group = useRef<THREE.Group>(null);
  const sheet = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = sinceShock(clock.current.shockAt);
    const flee = s < 0 ? 0 : clamp01((s - delay + 0.3) / 1);
    if (group.current) {
      group.current.position.set(Math.sin(t * 0.6) * 0.7, 2.1 + Math.sin(t * 1.6) * 0.12 + flee * 5, 2.2);
      group.current.rotation.set(0, Math.sin(t * 0.6) * 0.3, Math.sin(t * 1.2) * 0.08);
      group.current.visible = flee < 1;
    }
    if (sheet.current) sheet.current.opacity = 0.88 * (1 - flee);
    if (glow.current) glow.current.intensity = 3 * (1 - flee);
  });
  // Lathe profile: rounded head flowing into a flared, wavy hem.
  const profile = Array.from({ length: 14 }, (_, i) => {
    const k = i / 13;
    const y = 1 - k;
    const r = k < 0.35 ? Math.sin((k / 0.35) * (Math.PI / 2)) * 0.32 : 0.32 + (k - 0.35) * 0.32;
    return new THREE.Vector2(r, y * 1.05);
  });
  return (
    <group ref={group}>
      <mesh>
        <latheGeometry args={[profile, 28]} />
        <meshStandardMaterial
          ref={sheet}
          color="#f4f7ff"
          emissive="#a9c6ff"
          emissiveIntensity={0.55}
          roughness={0.4}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.82, 0.29]} scale={[0.8, 1.3, 0.5]}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshBasicMaterial color="#0b0d14" />
        </mesh>
      ))}
      <mesh position={[0, 0.66, 0.31]} scale={[1, 1.5, 0.5]}>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshBasicMaterial color="#0b0d14" />
      </mesh>
      <pointLight ref={glow} position={[0, 0.4, 0.4]} color="#a9c6ff" intensity={3} distance={5} decay={1.5} />
    </group>
  );
}

function Zombie({ clock, delay }: { clock: Clock; delay: number }) {
  const group = useRef<THREE.Group>(null);
  const pos = useRef(0);
  useFrame((_, dt) => {
    const s = sinceShock(clock.current.shockAt);
    const gone = s < 0 ? 0 : clamp01((s - delay + 0.2) / 0.5);
    pos.current += dt;
    if (group.current) {
      const x = Math.sin(pos.current * 0.3) * 1.1;
      group.current.position.set(x, 0.05, 2.35);
      group.current.rotation.y = Math.cos(pos.current * 0.3) > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.current.scale.setScalar(Math.max(0.001, 1 - gone));
      group.current.visible = gone < 1;
    }
  });
  return (
    <group ref={group}>
      <Person look={lookFor(2)} gait={(t) => t * 2.2} zombie />
    </group>
  );
}

function MonsterFace({ group }: { group: React.RefObject<THREE.Group | null> }) {
  const top = useRef<THREE.Group>(null);
  const bottom = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const chomp = (Math.sin(t * 2.6) + 1) / 2;
    if (top.current) top.current.position.y = 1.55 + chomp * 0.05;
    if (bottom.current) bottom.current.position.y = 0.36 - chomp * 0.04;
    const blink = t % 3.4 < 0.12 ? 0.08 : 1;
    group.current?.traverse((o) => {
      if (o.name === "eye") o.scale.y = blink;
    });
  });
  const teeth = [-0.2, -0.1, 0, 0.1, 0.2];
  return (
    <>
      <group ref={top} position={[0.75, 1.55, 1.36]}>
        {teeth.map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.045, 0.16, 6]} />
            <meshStandardMaterial color="#efe6d2" roughness={0.4} />
          </mesh>
        ))}
      </group>
      <group ref={bottom} position={[0.75, 0.36, 1.36]}>
        {teeth.map((x) => (
          <mesh key={x} position={[x + 0.05, 0, 0]}>
            <coneGeometry args={[0.045, 0.14, 6]} />
            <meshStandardMaterial color="#efe6d2" roughness={0.4} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function JunkLot() {
  return (
    <>
      <mesh position={[0, 0.03, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 4.2]} />
        <meshStandardMaterial color="#3a3224" roughness={1} />
      </mesh>
      <mesh position={[-0.8, 0.14, 1.5]} rotation={[Math.PI / 2, 0, 0.3]}>
        <torusGeometry args={[0.24, 0.1, 10, 22]} />
        <meshStandardMaterial color="#141414" roughness={0.8} />
      </mesh>
      {[
        [0.7, 0.2, 1.1],
        [1.0, 0.17, 1.6],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} scale={[1, 0.8, 1]}>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshStandardMaterial color="#17181a" roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.5, -0.8]} rotation={[0, 0.2, -0.15]}>
        <boxGeometry args={[1.4, 0.9, 0.06]} />
        <meshStandardMaterial color="#5a5048" roughness={1} />
      </mesh>
    </>
  );
}

function Garden({ clock, delay }: { clock: Clock; delay: number }) {
  const people = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = sinceShock(clock.current.shockAt);
    const k = s < 0 ? 0 : smooth((s - delay - 1.2) / 0.6);
    if (people.current) {
      people.current.scale.setScalar(Math.max(0.001, k));
      people.current.visible = k > 0.01;
    }
  });
  return (
    <>
      <mesh position={[0, 0.03, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 4.2]} />
        <meshStandardMaterial color="#3f6b38" roughness={1} />
      </mesh>
      {[-1.05, 0, 1.05].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.8, 0.4, 2.0]} />
            <meshStandardMaterial color="#8a6a48" roughness={0.9} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[(i % 2 ? 0.15 : -0.15), 0.52, -0.8 + i * 0.4]}>
              <icosahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color={i % 2 ? "#5fa845" : "#4f8a3a"} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {[-1.5, 1.5].map((x) => (
        <group key={x} position={[x, 0, 1.7]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
            <meshStandardMaterial color="#4f8a3a" />
          </mesh>
          <mesh position={[0, 1.22, 0.03]} rotation={[Math.PI / 2.4, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.05, 16]} />
            <meshStandardMaterial color="#ffc93c" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <group ref={people} visible={false}>
        <Person look={lookFor(9)} gait={() => null} crouch position={[-0.55, 0.05, 1.35]} rotation={[0, Math.PI, 0]} />
        <Person look={lookFor(4)} gait={() => null} position={[0.55, 0.05, 1.45]} rotation={[0, -0.4, 0]} scale={0.72} />
      </group>
    </>
  );
}

/* ---------- One lot: haunted, then rebuilt ---------- */

function Lot({ clock, lot }: { clock: Clock; lot: (typeof LOTS)[number] }) {
  const ruined = useRef<THREE.Group>(null);
  const revived = useRef<THREE.Group>(null);
  const windows = useRef<THREE.MeshStandardMaterial[]>([]);
  const porch = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const s = sinceShock(clock.current.shockAt);
    const { ruin, build } = rebuild(s, lot.delay);
    const t = state.clock.elapsedTime;
    if (ruined.current) {
      const breathe = lot.kind === "monster" ? Math.sin(t * 2) * 0.012 : 0;
      ruined.current.scale.set(1 + breathe, Math.max(0.001, ruin), 1 + breathe);
      ruined.current.visible = ruin > 0.001;
    }
    if (revived.current) {
      revived.current.scale.set(1, Math.max(0.001, build), 1);
      revived.current.visible = build > 0.001;
    }
    const glow = s < 0 ? 0 : smooth((s - lot.delay - 0.6) / 0.8);
    for (const m of windows.current) m.emissiveIntensity = glow * 2.2;
    if (porch.current) porch.current.intensity = glow * 5;
  });

  return (
    <group position={[lot.x, 0, 0]}>
      <group ref={ruined}>
        {lot.kind === "garden" ? (
          <JunkLot />
        ) : (
          <Cottage siding="#5d5850" roof="#2a2624" trim="#7a756c" door="#140e0c" ruined eyes={lot.kind === "monster"} />
        )}
        {lot.kind === "monster" && <MonsterFace group={ruined} />}
      </group>
      {lot.kind === "ghost" && <Ghost clock={clock} delay={lot.delay} />}
      {lot.kind === "zombie" && <Zombie clock={clock} delay={lot.delay} />}
      <group ref={revived} visible={false}>
        {lot.kind === "garden" ? (
          <Garden clock={clock} delay={lot.delay} />
        ) : (
          <>
            <Cottage siding={lot.siding} roof="#33363d" trim="#f2efe6" door={lot.door} lit={windows} />
            <RevivedExtras />
          </>
        )}
      </group>
      {lot.kind !== "garden" && (
        <pointLight ref={porch} position={[0.75, 1.75, 2.1]} color={WARM} intensity={0} distance={5} decay={1.6} />
      )}
    </group>
  );
}

function BackHouse({ clock, x, z, scale, delay, siding }: { clock: Clock } & (typeof BACK_ROW)[number]) {
  const windows = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const s = sinceShock(clock.current.shockAt);
    const lit = s < 0 ? 0 : smooth((s - delay) / 0.6);
    for (const m of windows.current) m.emissiveIntensity = lit * 1.8;
  });
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[3, 2.1, 2.6]} />
        <meshStandardMaterial color={siding} roughness={0.9} />
      </mesh>
      <mesh geometry={BACK_ROOF} position={[0, 2.2, 0]}>
        <meshStandardMaterial color="#2c2e33" roughness={0.8} />
      </mesh>
      {[-0.7, 0.7].map((wx, i) => (
        <mesh key={wx} position={[wx, 1.3, 1.305]}>
          <planeGeometry args={[0.8, 0.7]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) windows.current[i] = m;
            }}
            color="#14100a"
            emissive={WARM}
            emissiveIntensity={0}
          />
        </mesh>
      ))}
    </group>
  );
}

function Walker({ clock, w }: { clock: Clock; w: (typeof WALKERS)[number] }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = sinceShock(clock.current.shockAt);
    const appear = s < 0 ? 0 : smooth((s - w.delay) / 0.6);
    if (!group.current) return;
    group.current.visible = appear > 0.01;
    if (!group.current.visible) return;
    const span = 32;
    const x = ((((w.offset + t * w.speed) % span) + span) % span) - span / 2;
    group.current.position.set(x, 0.12, w.z);
    group.current.rotation.y = w.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.current.scale.setScalar(appear * w.scale);
  });
  const stride = Math.abs(w.speed) * 7.5;
  return (
    <group ref={group} visible={false}>
      <Person look={w.look} gait={(t) => t * stride} />
      {w.dog && <Dog gait={(t) => t * stride} position={[0.35, 0, 0.55]} />}
    </group>
  );
}

function Street({ clock }: { clock: Clock }) {
  const lamps = useRef<THREE.MeshStandardMaterial[]>([]);
  const lights = useRef<THREE.PointLight[]>([]);
  useFrame((state) => {
    const s = sinceShock(clock.current.shockAt);
    const t = state.clock.elapsedTime;
    LAMPS.forEach((_, i) => {
      const on = s < 0 ? 0.08 : Math.max(0.08, smooth((s - 1.6 - i * 0.15) / 0.3));
      const flicker = on > 0.08 && on < 1 ? (Math.sin(t * 60 + i) > 0 ? 1 : 0.25) : 1;
      const v = on * flicker;
      if (lamps.current[i]) lamps.current[i].emissiveIntensity = v * 4;
      if (lights.current[i]) lights.current[i].intensity = v * 7;
    });
  });
  return (
    <>
      <mesh position={[0, 0.06, SIDEWALK_Z]}>
        <boxGeometry args={[44, 0.12, 1.5]} />
        <meshStandardMaterial color="#77736c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.07, SIDEWALK_Z + 0.78]}>
        <boxGeometry args={[44, 0.14, 0.1]} />
        <meshStandardMaterial color="#8a867e" />
      </mesh>
      <mesh position={[0, 0.02, ROAD_Z]}>
        <boxGeometry args={[44, 0.04, 3.2]} />
        <meshStandardMaterial color="#26282c" roughness={0.85} />
      </mesh>
      {Array.from({ length: 15 }, (_, i) => (
        <mesh key={i} position={[-21 + i * 3, 0.045, ROAD_Z]}>
          <boxGeometry args={[1.2, 0.01, 0.08]} />
          <meshStandardMaterial color="#d8b04a" roughness={0.6} />
        </mesh>
      ))}
      {LAMPS.map((x, i) => (
        <group key={x} position={[x, 0, SIDEWALK_Z + 0.6]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 3, 8]} />
            <meshStandardMaterial color="#2a2c30" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 3.05, 0]}>
            <sphereGeometry args={[0.15, 14, 10]} />
            <meshStandardMaterial
              ref={(m) => {
                if (m) lamps.current[i] = m;
              }}
              color="#2a2418"
              emissive={WARM}
              emissiveIntensity={0}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            ref={(l) => {
              if (l) lights.current[i] = l;
            }}
            position={[0, 2.9, 0]}
            color={WARM}
            intensity={0}
            distance={7}
            decay={1.4}
          />
        </group>
      ))}
    </>
  );
}

function Grass({ clock }: { clock: Clock }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const count = 1100;
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
      m.position.set((rand() - 0.5) * 26, 0.12, -1.6 + rand() * 4.4);
      m.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
      m.scale.setScalar(0.5 + rand() * 0.9);
      m.updateMatrix();
      mesh.current?.setMatrixAt(i, m.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(() => {
    const s = sinceShock(clock.current.shockAt);
    material.current?.color.lerpColors(DEAD_GRASS, LIVE_GRASS, s < 0 ? 0 : smooth((s - 0.6) / 2));
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} receiveShadow>
      <coneGeometry args={[0.03, 0.3, 3]} />
      <meshStandardMaterial ref={material} color={DEAD_GRASS} roughness={1} />
    </instancedMesh>
  );
}

function Paddle({ index, clock }: { index: number; clock: Clock }) {
  const group = useRef<THREE.Group>(null);
  const face = useRef<THREE.MeshStandardMaterial>(null);
  const cable = useRef<ComponentRef<typeof QuadraticBezierLine>>(null);
  const { rest, start } = PADDLES[index];
  useFrame((state) => {
    const { contact, at, mid, end } = PADDLES[index];
    const { phase, shockAt } = clock.current;
    const s = sinceShock(shockAt);
    const t = state.clock.elapsedTime;
    const armed = phase === "charging" || phase === "charged";
    const reach = s < 0 ? 0 : s < 0.18 ? smooth(s / 0.18) : 1 - smooth((s - 0.35) / 0.4);
    const stow = s < 0 ? 0 : smooth((s - 1) / 0.6);
    at.lerpVectors(rest, contact, reach);
    at.y += armed ? Math.sin(t * 40 + index) * 0.012 : Math.sin(t * 1.4 + index * 2) * 0.04;
    at.y -= stow * 1.2;
    if (group.current) {
      group.current.position.copy(at);
      group.current.rotation.y = (index ? -1 : 1) * 0.25 * (1 - reach);
      group.current.visible = stow < 1;
    }
    if (face.current) {
      const glow = phase === "charged" ? 1.4 + Math.sin(t * 12) * 0.6 : phase === "charging" ? 0.8 : 0;
      face.current.emissiveIntensity = s >= 0 && s < 0.4 ? 5 : glow;
    }
    mid.lerpVectors(start, at, 0.5).setY(Math.min(start.y, at.y) - 0.5);
    cable.current?.setPoints(start, end.copy(at).setZ(at.z + 0.25), mid);
  });
  return (
    <>
      <group ref={group}>
        <RoundedBox args={[0.4, 0.3, 0.1]} radius={0.04}>
          <meshStandardMaterial ref={face} color="#e8e3d8" emissive={SPARK} emissiveIntensity={0} />
        </RoundedBox>
        <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.28, 12]} />
          <meshStandardMaterial color="#e2403f" roughness={0.4} />
        </mesh>
      </group>
      <QuadraticBezierLine ref={cable} start={start} end={rest} color="#1d1d1d" lineWidth={2} />
    </>
  );
}

function Defibrillator({ clock }: { clock: Clock }) {
  const unit = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = sinceShock(clock.current.shockAt);
    const stow = s < 0 ? 0 : smooth((s - 1) / 0.6);
    if (unit.current) {
      unit.current.position.y = UNIT.y - stow * 0.6;
      unit.current.visible = stow < 1;
    }
  });
  return (
    <>
      <group ref={unit} position={UNIT.toArray()}>
        <RoundedBox args={[0.8, 0.36, 0.55]} radius={0.05}>
          <meshStandardMaterial color="#d9d3c6" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.05, 0.28]}>
          <planeGeometry args={[0.45, 0.18]} />
          <meshStandardMaterial color="#04110a" emissive="#7cffb2" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
      <Paddle index={0} clock={clock} />
      <Paddle index={1} clock={clock} />
    </>
  );
}

function Sparks({ clock }: { clock: Clock }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  useFrame(() => {
    const s = sinceShock(clock.current.shockAt) - 0.16;
    if (!points.current || !material.current) return;
    points.current.visible = s > 0 && s < 1.4;
    if (!points.current.visible) return;
    const { velocity, origin, positions } = SPARKS;
    for (let i = 0; i < SPARK_COUNT * 3; i += 3) {
      positions[i] = origin[i] + velocity[i] * s;
      positions[i + 1] = Math.max(0.02, origin[i + 1] + velocity[i + 1] * s - 4.9 * s * s);
      positions[i + 2] = origin[i + 2] + velocity[i + 2] * s;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    material.current.opacity = 1 - s / 1.4;
  });
  return (
    <points ref={points} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[SPARKS.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={material} color={SPARK} size={0.06} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

/* ---------- Camera, light, sky ---------- */

function Rig({ clock }: { clock: Clock }) {
  const flash = useRef<THREE.PointLight>(null);
  const warmKey = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const view = useRef({ w: 0, h: 0, reduce: false });
  const pointer = useRef(new THREE.Vector2());

  useLayoutEffect(() => {
    view.current.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useFrame((state, dt) => {
    const s = sinceShock(clock.current.shockAt);
    const dawn = s < 0 ? 0 : smooth((s - 0.8) / 3);
    const cam = state.camera as THREE.PerspectiveCamera;
    const { width, height } = state.size;
    const narrow = width / height < 1;

    // Compose: street in the right ~60% on wide screens, above the console.
    if (width !== view.current.w || height !== view.current.h) {
      view.current.w = width;
      view.current.h = height;
      if (narrow) cam.setViewOffset(width, height, 0, -height * 0.1, width, height);
      else cam.setViewOffset(width, height, -width * 0.22, height * 0.05, width, height);
      cam.updateProjectionMatrix();
    }

    pointer.current.lerp(state.pointer, 1 - Math.exp(-dt * 2.5));
    const reveal = s < 0 ? 0 : smooth((s - 1.1) / 2.6);
    const armed = clock.current.phase === "charging" || clock.current.phase === "charged" ? 1 : 0;
    LOOK.lerpVectors(CLOSE, WIDE, reveal);
    const az = pointer.current.x * 0.07 + 0.05 * (1 - reveal);
    const el = 0.3 + pointer.current.y * 0.03 + reveal * 0.06;
    const d = narrow ? 44 : 22 - armed * 1.5 * (1 - reveal) + reveal * 12;
    cam.position.set(
      LOOK.x + Math.sin(az) * Math.cos(el) * d,
      LOOK.y + Math.sin(el) * d,
      LOOK.z + Math.cos(az) * Math.cos(el) * d,
    );
    if (!view.current.reduce && s >= 0.15 && s < 0.7) {
      const k = 0.18 * (1 - (s - 0.15) / 0.55);
      cam.position.x += (Math.random() - 0.5) * k;
      cam.position.y += (Math.random() - 0.5) * k;
    }
    cam.lookAt(LOOK);

    if (flash.current) flash.current.intensity = s >= 0.15 && s < 0.6 ? 120 * (1 - (s - 0.15) / 0.45) : 0;
    if (warmKey.current) warmKey.current.intensity = dawn * 1.8;
    if (hemi.current) hemi.current.intensity = 1.15 + dawn * 0.25;
    state.scene.environmentIntensity = 0.55 + dawn * 0.35;
    if (state.scene.background instanceof THREE.Color) state.scene.background.lerpColors(DUSK, GLOW, dawn);
    if (state.scene.fog instanceof THREE.Fog) state.scene.fog.color.lerpColors(DUSK, GLOW, dawn);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#8fa3d9", "#2b2016", 1.15]} />
      <directionalLight
        position={[-14, 18, 10]}
        color="#c4d2ff"
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <directionalLight ref={warmKey} position={[16, 8, 12]} color="#ffb070" intensity={0} />
      <pointLight ref={flash} position={[0, 1.6, 2.6]} color={SPARK} intensity={0} distance={18} />
    </>
  );
}

// Every mesh casts and receives soft shadows.
function Shadows({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, []);
  return <group ref={group}>{children}</group>;
}

export default function HouseScene({ active = true, ...props }: SceneProps & { active?: boolean }) {
  const clock = useLatest(props);
  return (
    <Canvas
      dpr={[1, 1.6]}
      shadows="percentage"
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 26, near: 1, far: 140, position: [0, 12, 30] }}
      aria-hidden
    >
      <color attach="background" args={["#131b2c"]} />
      <fog attach="fog" args={["#131b2c", 34, 80]} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.6} color="#9fb4ff" position={[-14, 8, -10]} scale={[18, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#ffcf99" position={[14, 4, 10]} scale={[10, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#8090c4" position={[0, 16, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
      </Environment>
      <Stars radius={60} depth={20} count={1400} factor={2.2} fade speed={0.3} />
      <mesh position={[14, 15, -34]}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#f3eedd" fog={false} toneMapped={false} />
      </mesh>
      <Rig clock={clock} />
      <Shadows>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[110, 110]} />
          <meshStandardMaterial color="#1d2219" roughness={1} />
        </mesh>
        {BACK_ROW.map((b) => (
          <BackHouse key={b.x} clock={clock} {...b} />
        ))}
        {LOTS.map((lot) => (
          <Lot key={lot.x} clock={clock} lot={lot} />
        ))}
        <Street clock={clock} />
        {WALKERS.map((w, i) => (
          <Walker key={i} clock={clock} w={w} />
        ))}
        <Defibrillator clock={clock} />
      </Shadows>
      <Grass clock={clock} />
      <Sparks clock={clock} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.82} luminanceSmoothing={0.25} radius={0.7} />
        <TiltShift2 blur={0.1} taper={0.4} samples={10} start={[0, 0.48]} end={[1, 0.48]} />
        <Vignette offset={0.3} darkness={0.55} />
        <ToneMapping mode={ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
