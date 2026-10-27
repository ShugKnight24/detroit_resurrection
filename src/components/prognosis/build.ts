import * as THREE from "three";

// An overhead Detroit neighborhood that comes back to life over one timeline:
// vacant lots and boarded houses, then side yards, gardens, rehabbed and infill
// homes, and finally a commercial strip, a playground, and full sidewalks.
// Everything is instanced and driven by `update(t)`; nothing allocates per frame.

export const STAGES = [
  { at: 0, name: "Today", line: "Vacant lots, boarded houses, dark porches." },
  { at: 3, name: "Year 1 · Side lots", line: "Neighbors adopt the lot next door." },
  { at: 6.5, name: "Year 3 · Gardens", line: "Empty clusters turn into gardens and green space." },
  { at: 10, name: "Year 5 · Homes", line: "Boarded houses get rehabbed. Infill homes fill the gaps." },
  { at: 14, name: "Year 10 · Main street", line: "Shops open, kids get a playground, the block fills in." },
] as const;
export const END = 18.5;

export const stageAt = (t: number) => {
  let s = 0;
  STAGES.forEach((st, i) => {
    if (t >= st.at) s = i;
  });
  return s;
};

// Layout
const BX = 4;
const BZ = 3;
const PER_ROW = 6;
const LOT_W = 2;
const LOT_D = 3;
const STREET = 3;
const BLOCK_W = PER_ROW * LOT_W;
const BLOCK_D = 2 * LOT_D;
const WIDTH = BX * BLOCK_W + (BX - 1) * STREET;
const DEPTH = BZ * BLOCK_D + (BZ - 1) * STREET;
const blockX = (bx: number) => -WIDTH / 2 + bx * (BLOCK_W + STREET);
const blockZ = (bz: number) => -DEPTH / 2 + bz * (BLOCK_D + STREET);
// Main street runs between block rows 0 and 1.
const MAIN_Z = blockZ(1) - STREET / 2;

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const pop = (x: number) => {
  const c = clamp01(x);
  return 1 + 2.4 * (c - 1) ** 3 + 1.4 * (c - 1) ** 2;
};

const C = {
  dirt: new THREE.Color("#3b3022"),
  lawn: new THREE.Color("#3f6f3c"),
  soil: new THREE.Color("#4e3b29"),
  plaza: new THREE.Color("#6b6a66"),
  play: new THREE.Color("#b5523b"),
  boarded: new THREE.Color("#3d3833"),
  roofDead: new THREE.Color("#1e1b19"),
};
const SIDING = ["#e3d6bb", "#9a4632", "#6f8f7d", "#34557a", "#c9a24a", "#b9b3a6", "#7a2430", "#d9a273"].map(
  (c) => new THREE.Color(c),
);
const SHOP = ["#c84b31", "#2f6f8f", "#e0b04a", "#5a8a52", "#8e4f8a", "#d9774a"].map((c) => new THREE.Color(c));
const SHIRTS = ["#ff8a3d", "#7cffb2", "#b48cff", "#ffd166", "#e86a6a", "#6ab0e8", "#f2efe6", "#c9a24a"].map(
  (c) => new THREE.Color(c),
);

type Item = {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: THREE.Vector3;
  from: number; // appears (pops in) at
  to: number; // leaves at (Infinity = stays)
  dur: number;
  color?: THREE.Color;
  colorTo?: THREE.Color;
  colorAt?: number;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const item = (
  x: number,
  y: number,
  z: number,
  ry: number,
  from: number,
  extra: Partial<Item> & { sx?: number; sy?: number; sz?: number } = {},
): Item => ({
  p: new THREE.Vector3(x, y, z),
  q: new THREE.Quaternion().setFromAxisAngle(Y_AXIS, ry),
  s: new THREE.Vector3(extra.sx ?? 1, extra.sy ?? 1, extra.sz ?? 1),
  from,
  to: extra.to ?? Infinity,
  dur: extra.dur ?? 0.7,
  color: extra.color,
  colorTo: extra.colorTo,
  colorAt: extra.colorAt,
});

class Layer {
  mesh: THREE.InstancedMesh;
  private colorState: Uint8Array;
  private m = new THREE.Matrix4();
  private sc = new THREE.Vector3();

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly items: Item[],
    shadows = true,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
    this.mesh.count = items.length;
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.colorState = new Uint8Array(items.length);
    items.forEach((it, i) => {
      if (it.color) this.mesh.setColorAt(i, it.color);
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(t: number) {
    let colorsDirty = false;
    this.items.forEach((it, i) => {
      // `from <= 0` means present from the start, no pop-in.
      const appear = it.from <= 0 ? 1 : pop((t - it.from) / it.dur);
      const leave = it.to === Infinity ? 1 : 1 - smooth((t - it.to) / 0.35);
      const k = Math.max(0.0001, appear * leave);
      this.sc.set(it.s.x, it.s.y * k, it.s.z);
      if (k < 0.01) this.sc.set(0.0001, 0.0001, 0.0001);
      this.m.compose(it.p, it.q, this.sc);
      this.mesh.setMatrixAt(i, this.m);
      if (it.colorTo && it.colorAt !== undefined) {
        const want = t >= it.colorAt ? 1 : 0;
        if (this.colorState[i] !== want) {
          this.colorState[i] = want;
          this.mesh.setColorAt(i, want ? it.colorTo : it.color!);
          colorsDirty = true;
        }
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

type Lot = {
  x: number;
  z: number;
  facing: 1 | -1; // +1 faces +z
  bx: number;
  bz: number;
  row: 0 | 1;
  i: number;
  start: "vacant" | "boarded" | "home";
  fate: "home" | "rehab" | "sideyard" | "garden" | "infill" | "shop" | "playground" | "park";
  at: number;
};

function planLots(): Lot[] {
  const rand = rng(1931);
  const lots: Lot[] = [];
  for (let bz = 0; bz < BZ; bz++)
    for (let bx = 0; bx < BX; bx++)
      for (const row of [0, 1] as const)
        for (let i = 0; i < PER_ROW; i++) {
          const r = rand();
          lots.push({
            x: blockX(bx) + LOT_W / 2 + i * LOT_W,
            z: blockZ(bz) + (row === 0 ? LOT_D / 2 : LOT_D * 1.5),
            facing: row === 0 ? -1 : 1,
            bx,
            bz,
            row,
            i,
            start: r < 0.42 ? "vacant" : r < 0.6 ? "boarded" : "home",
            fate: "home",
            at: 0,
          });
        }

  const at = (bx: number, bz: number, row: number, i: number) =>
    lots.find((l) => l.bx === bx && l.bz === bz && l.row === row && l.i === i);

  for (const l of lots) {
    const onMain = l.bx >= 1 && l.bx <= 2 && ((l.bz === 0 && l.row === 1) || (l.bz === 1 && l.row === 0));
    const neighbors = [at(l.bx, l.bz, l.row, l.i - 1), at(l.bx, l.bz, l.row, l.i + 1)];
    const nextToHome = neighbors.some((n) => n?.start === "home");
    const r = rand();
    if (l.start === "home") l.fate = "home";
    else if (onMain) {
      l.fate = "shop";
      l.at = STAGES[4].at + rand() * 2.2;
    } else if (l.start === "boarded") {
      l.fate = "rehab";
      l.at = STAGES[3].at + rand() * 3;
    } else if (nextToHome && r < 0.55) {
      l.fate = "sideyard";
      l.at = STAGES[1].at + rand() * 2.8;
    } else if (r < 0.75) {
      l.fate = "garden";
      l.at = STAGES[2].at + rand() * 3;
    } else {
      l.fate = "infill";
      l.at = STAGES[3].at + 0.6 + rand() * 3;
    }
  }

  // A playground and pocket park on a corner of the bottom-right block.
  for (const [i, fate] of [
    [4, "playground"],
    [5, "park"],
  ] as const) {
    for (const row of [0, 1] as const) {
      const l = at(2, 2, row, i)!;
      l.start = "vacant";
      l.fate = fate;
      l.at = STAGES[4].at + 0.4 + row * 0.3;
    }
  }
  return lots;
}

export function createNeighborhood() {
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
  const white = () => mat("#ffffff");

  // Ground, streets, block slabs
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(WIDTH + 40, DEPTH + 40)), mat("#0f1114", { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const slabGeo = track(new THREE.BoxGeometry(BLOCK_W + 0.8, 0.14, BLOCK_D + 0.8));
  const slabMat = mat("#55534f");
  for (let bz = 0; bz < BZ; bz++)
    for (let bx = 0; bx < BX; bx++) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(blockX(bx) + BLOCK_W / 2, 0.07, blockZ(bz) + BLOCK_D / 2);
      slab.receiveShadow = true;
      root.add(slab);
    }

  const dashGeo = track(new THREE.BoxGeometry(0.7, 0.01, 0.06));
  const dashMat = mat("#c9a24a", { emissive: "#c9a24a", emissiveIntensity: 0.25 });
  const dashes: THREE.Matrix4[] = [];
  for (let bz = 0; bz < BZ - 1; bz++) {
    const z = blockZ(bz + 1) - STREET / 2;
    for (let x = -WIDTH / 2 - 6; x < WIDTH / 2 + 6; x += 1.6) dashes.push(new THREE.Matrix4().makeTranslation(x, 0.02, z));
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  dashes.forEach((m, i) => dashMesh.setMatrixAt(i, m));
  root.add(dashMesh);

  // Lots
  const lots = planLots();
  const L: Record<string, Item[]> = {
    patch: [], tomb: [], house: [], roof: [], glow: [], hedge: [], bed: [], crop: [],
    shop: [], awning: [], sign: [], trunk: [], crown: [], play: [],
  };
  const rand = rng(77);

  for (const l of lots) {
    const ry = l.facing === 1 ? 0 : Math.PI;
    const front = l.z + l.facing * 0.35;
    const glowZ = front + l.facing * 0.81;
    const siding = SIDING[Math.floor(rand() * SIDING.length)];

    const patchTo =
      l.fate === "sideyard" || l.fate === "park"
        ? C.lawn
        : l.fate === "garden"
          ? C.soil
          : l.fate === "shop"
            ? C.plaza
            : l.fate === "playground"
              ? C.play
              : l.fate === "infill"
                ? C.lawn
                : undefined;
    L.patch.push(
      item(l.x, 0.16, l.z, 0, 0, {
        color: l.start === "vacant" ? C.dirt : C.lawn,
        colorTo: patchTo,
        colorAt: patchTo ? l.at : undefined,
      }),
    );

    if (l.start === "vacant") {
      L.tomb.push(item(l.x + (rand() - 0.5) * 0.8, 0.4, l.z + (rand() - 0.5), ry + (rand() - 0.5) * 0.4, 0, { to: l.at - 0.2 }));
    }

    if (l.start === "home" || l.start === "boarded") {
      const boarded = l.start === "boarded";
      // Boarded houses squash down and pop back up repainted.
      L.house.push(
        item(l.x, 0.18, front, ry, 0, {
          color: boarded ? C.boarded : siding,
          colorTo: boarded ? siding : undefined,
          colorAt: boarded ? l.at : undefined,
          to: boarded ? l.at - 0.35 : Infinity,
        }),
      );
      L.roof.push(item(l.x, 1.28, front, ry, 0, { color: C.roofDead, to: boarded ? l.at - 0.35 : Infinity }));
      if (boarded) {
        L.house.push(item(l.x, 0.18, front, ry, l.at, { color: siding }));
        L.roof.push(item(l.x, 1.28, front, ry, l.at + 0.15, { color: new THREE.Color("#2b2f36") }));
      }
      const litFrom = boarded ? l.at + 0.6 : rand() < 0.5 ? 0 : STAGES[1].at + rand() * 6;
      L.glow.push(item(l.x, 0.75, glowZ, ry, litFrom, { dur: 0.4 }));
    }

    switch (l.fate) {
      case "sideyard":
        L.hedge.push(item(l.x, 0.32, l.z - l.facing * 1.35, 0, l.at + 0.2, { sx: 1.9 }));
        L.trunk.push(item(l.x + 0.5, 0.5, l.z, 0, l.at + 0.4));
        L.crown.push(item(l.x + 0.5, 1.05, l.z, 0, l.at + 0.55, { color: new THREE.Color("#4a8a4a") }));
        break;
      case "garden":
        for (const dx of [-0.55, 0, 0.55]) {
          L.bed.push(item(l.x + dx, 0.28, l.z, 0, l.at + Math.abs(dx) * 0.4));
          L.crop.push(item(l.x + dx, 0.42, l.z, 0, l.at + 0.3 + Math.abs(dx) * 0.4));
        }
        break;
      case "infill":
        L.house.push(item(l.x, 0.18, front, ry, l.at, { color: siding }));
        L.roof.push(item(l.x, 1.28, front, ry, l.at + 0.15, { color: new THREE.Color("#2b2f36") }));
        L.glow.push(item(l.x, 0.75, glowZ, ry, l.at + 0.7, { dur: 0.4 }));
        break;
      case "shop": {
        const color = SHOP[Math.floor(rand() * SHOP.length)];
        const shopFront = l.z + l.facing * 0.2;
        L.shop.push(item(l.x, 0.18, shopFront, ry, l.at, { color: new THREE.Color("#a49a8a").lerp(color, 0.25), sy: 0.9 + rand() * 0.5 }));
        L.awning.push(item(l.x, 0.95, shopFront + l.facing * 1.25, ry, l.at + 0.3, { color }));
        L.sign.push(item(l.x, 1.35, shopFront + l.facing * 1.16, ry, l.at + 0.5, { color }));
        break;
      }
      case "park":
        for (const dx of [-0.45, 0.45]) {
          L.trunk.push(item(l.x + dx, 0.5, l.z + dx, 0, l.at + 0.2));
          L.crown.push(item(l.x + dx, 1.1, l.z + dx, 0, l.at + 0.35, { color: new THREE.Color("#3d7a48"), sx: 1.3, sy: 1.3, sz: 1.3 }));
        }
        break;
      case "playground":
        L.play.push(item(l.x, 0.18, l.z, l.row ? 0.6 : -0.3, l.at + 0.3));
        break;
    }
  }

  // Street trees along the main street, planted in waves.
  for (let x = blockX(1) + 1; x < blockX(3) - 1; x += 2.2) {
    for (const side of [-1, 1]) {
      const z = MAIN_Z + side * (STREET / 2 + 0.1);
      const from = STAGES[2].at + rand() * 6;
      L.trunk.push(item(x, 0.5, z, 0, from));
      L.crown.push(item(x, 1.05, z, 0, from + 0.15, { color: new THREE.Color("#3f7f45") }));
    }
  }

  const box = (w: number, h: number, d: number, lift = true) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (lift) g.translate(0, h / 2, 0);
    return track(g);
  };
  const roofGeo = track(new THREE.ConeGeometry(1.05, 0.75, 4).rotateY(Math.PI / 4).scale(1, 1, 1.15));
  roofGeo.translate(0, 0.375, 0);

  const playground = (() => {
    const g = new THREE.Group();
    const red = mat("#e85a3a");
    const blue = mat("#3a7ae8");
    const yellow = mat("#ffd166");
    const slide = new THREE.Mesh(box(0.25, 0.04, 1.2, false), yellow);
    slide.position.set(-0.4, 0.45, 0);
    slide.rotation.x = 0.6;
    const tower = new THREE.Mesh(box(0.4, 0.7, 0.4), blue);
    tower.position.set(-0.4, 0, -0.65);
    const frame = new THREE.Mesh(box(0.9, 0.06, 0.06), red);
    frame.position.set(0.4, 0.75, 0.3);
    const legs = [-0.4, 0.4].map((dx) => {
      const leg = new THREE.Mesh(box(0.05, 0.75, 0.05), red);
      leg.position.set(0.4 + dx, 0, 0.3);
      return leg;
    });
    const round = new THREE.Mesh(track(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16)), blue);
    round.position.set(0.4, 0.1, -0.5);
    g.add(slide, tower, frame, ...legs, round);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  })();
  const playGroups = L.play.map((it) => {
    const g = playground.clone();
    g.position.copy(it.p);
    g.quaternion.copy(it.q);
    root.add(g);
    return { g, it };
  });

  const layers = [
    new Layer(box(LOT_W - 0.1, 0.04, LOT_D - 0.1), white(), L.patch, false),
    new Layer(box(0.32, 0.5, 0.1), mat("#6b6f78"), L.tomb),
    new Layer(box(1.4, 1.1, 1.6), white(), L.house),
    new Layer(roofGeo, white(), L.roof),
    new Layer(box(0.9, 0.28, 0.02, false), mat("#1a1408", { emissive: "#ffd166", emissiveIntensity: 2.6 }), L.glow, false),
    new Layer(box(1, 0.3, 0.16), mat("#2f5f33"), L.hedge),
    new Layer(box(0.42, 0.22, 1.9), mat("#7a5a3a"), L.bed),
    new Layer(box(0.34, 0.1, 1.8), mat("#5fa845", { emissive: "#2f6a1f", emissiveIntensity: 0.3 }), L.crop),
    new Layer(box(1.85, 1.6, 2.2), white(), L.shop),
    new Layer(box(1.7, 0.06, 0.55, false), white(), L.awning),
    new Layer(box(1.1, 0.22, 0.04, false), mat("#ffffff", { emissive: "#ffffff", emissiveIntensity: 1.6, toneMapped: false }), L.sign, false),
    new Layer(track(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 6).translate(0, -0.2, 0)), mat("#4a3526"), L.trunk),
    new Layer(track(new THREE.IcosahedronGeometry(0.42, 0)), white(), L.crown),
  ];
  // Sign colors glow in their shop color.
  const signLayer = layers[10];
  L.sign.forEach((it, i) => it.color && signLayer.mesh.setColorAt(i, it.color));
  layers.forEach((l) => root.add(l.mesh));

  // People: walkers on block sidewalks, kids around the playground.
  type Walker = { bx: number; bz: number; u: number; speed: number; from: number; kid: boolean; cx: number; cz: number; r: number };
  const walkers: Walker[] = [];
  const wr = rng(5);
  const stageShare = [0.08, 0.2, 0.3, 0.42];
  for (let n = 0; n < 260; n++) {
    const pick = wr();
    let acc = 0;
    let stage = 1;
    stageShare.forEach((sh, i) => {
      if (pick > acc) stage = i + 1;
      acc += sh;
    });
    walkers.push({
      bx: Math.floor(wr() * BX),
      bz: Math.floor(wr() * BZ),
      u: wr(),
      speed: (0.012 + wr() * 0.01) * (wr() < 0.5 ? 1 : -1),
      from: STAGES[stage].at + wr() * 3.5,
      kid: false,
      cx: 0,
      cz: 0,
      r: 0,
    });
  }
  const pg = lots.find((l) => l.fate === "playground")!;
  for (let n = 0; n < 26; n++) {
    walkers.push({
      bx: 0, bz: 0, u: wr(), speed: (0.15 + wr() * 0.2) * (wr() < 0.5 ? 1 : -1),
      from: STAGES[4].at + 1 + wr() * 2, kid: true,
      cx: pg.x + (wr() - 0.5) * 0.6, cz: pg.z + 1.5 * (wr() - 0.5) + 0.75, r: 0.4 + wr() * 0.9,
    });
  }

  const bodyGeo = track(new THREE.CapsuleGeometry(0.075, 0.16, 3, 8).translate(0, 0.2, 0));
  const headGeo = track(new THREE.SphereGeometry(0.065, 8, 6).translate(0, 0.4, 0));
  const bodies = new THREE.InstancedMesh(bodyGeo, white(), walkers.length);
  const heads = new THREE.InstancedMesh(headGeo, mat("#8d5a3b"), walkers.length);
  for (const m of [bodies, heads]) {
    m.castShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }
  walkers.forEach((_, i) => bodies.setColorAt(i, SHIRTS[i % SHIRTS.length]));

  const perimeter = (bx: number, bz: number, u: number, out: THREE.Vector3) => {
    const x0 = blockX(bx) - 0.2;
    const z0 = blockZ(bz) - 0.2;
    const w = BLOCK_W + 0.4;
    const d = BLOCK_D + 0.4;
    const total = 2 * (w + d);
    let s = (((u % 1) + 1) % 1) * total;
    if (s < w) return out.set(x0 + s, 0.14, z0);
    s -= w;
    if (s < d) return out.set(x0 + w, 0.14, z0 + s);
    s -= d;
    if (s < w) return out.set(x0 + w - s, 0.14, z0 + d);
    s -= w;
    return out.set(x0, 0.14, z0 + d - s);
  };

  // Cars and a bus on the cross streets.
  const cars = Array.from({ length: 9 }, (_, i) => ({
    lane: i % (BZ - 1),
    dir: i % 2 ? 1 : -1,
    offset: (i * 9.7) % (WIDTH + 12),
    speed: 2.2 + (i % 3) * 0.6,
    from: STAGES[3].at + (i % 5) * 0.7,
    bus: i === 0,
  }));
  const carGeo = box(0.9, 0.38, 0.46);
  const carMesh = new THREE.InstancedMesh(carGeo, white(), cars.length);
  carMesh.castShadow = true;
  carMesh.frustumCulled = false;
  const carColors = ["#e8e3d8", "#b33a3a", "#2d4f7a", "#1f1f22", "#7a7f86"].map((c) => new THREE.Color(c));
  cars.forEach((c, i) => carMesh.setColorAt(i, c.bus ? new THREE.Color("#ffb627") : carColors[i % carColors.length]));
  root.add(carMesh);

  const tmp = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const m4 = new THREE.Matrix4();

  function update(t: number, clock: number) {
    for (const l of layers) l.update(t);
    for (const { g, it } of playGroups) g.scale.setScalar(Math.max(0.0001, pop((t - it.from) / it.dur)));

    walkers.forEach((w, i) => {
      const k = smooth((t - w.from) / 0.6);
      if (k <= 0.001) {
        tmpS.setScalar(0.0001);
        m4.compose(tmp.set(0, -5, 0), tmpQ.identity(), tmpS);
      } else {
        let yaw: number;
        if (w.kid) {
          const a = w.u * 6.28 + clock * w.speed * 6;
          tmp.set(w.cx + Math.cos(a) * w.r, 0.2, w.cz + Math.sin(a) * w.r * 0.6);
          yaw = -a;
        } else {
          const u = w.u + clock * w.speed;
          perimeter(w.bx, w.bz, u, tmp);
          perimeter(w.bx, w.bz, u + Math.sign(w.speed) * 0.002, ahead);
          yaw = Math.atan2(ahead.x - tmp.x, ahead.z - tmp.z);
        }
        tmp.y += Math.abs(Math.sin(clock * 9 + i)) * 0.03;
        tmpQ.setFromAxisAngle(Y_AXIS, yaw);
        tmpS.setScalar(k * (w.kid ? 0.7 : 1));
        m4.compose(tmp, tmpQ, tmpS);
      }
      bodies.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;

    const span = WIDTH + 12;
    cars.forEach((c, i) => {
      const k = smooth((t - c.from) / 0.6);
      const x = ((((c.offset + clock * c.speed * c.dir) % span) + span) % span) - span / 2;
      const z = blockZ(c.lane + 1) - STREET / 2 + c.dir * 0.55;
      tmpQ.setFromAxisAngle(Y_AXIS, c.dir > 0 ? 0 : Math.PI);
      tmpS.set(c.bus ? 2.2 : 1, c.bus ? 1.5 : 1, 1).multiplyScalar(Math.max(0.0001, k));
      m4.compose(tmp.set(x, 0.02, z), tmpQ, tmpS);
      carMesh.setMatrixAt(i, m4);
    });
    carMesh.instanceMatrix.needsUpdate = true;
  }

  function counts(t: number) {
    const done = (fate: Lot["fate"]) => lots.filter((l) => l.fate === fate && t >= l.at + 0.4).length;
    return {
      homes: done("rehab") + done("infill"),
      yards: done("sideyard"),
      gardens: done("garden"),
      shops: done("shop"),
      people: walkers.filter((w) => t >= w.from).length,
      vacant: lots.filter((l) => l.start !== "home" && t < l.at + 0.4).length,
    };
  }

  update(0, 0);

  return {
    root,
    update,
    counts,
    size: { width: WIDTH, depth: DEPTH },
    dispose() {
      disposables.forEach((d) => d.dispose());
      root.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
    },
  };
}

export type Neighborhood = ReturnType<typeof createNeighborhood>;
