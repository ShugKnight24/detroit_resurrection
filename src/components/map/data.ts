import { expand, type Property, type Snapshot } from "@/lib/properties";

let cache: Promise<Property[]> | null = null;

export function loadProperties(): Promise<Property[]> {
  cache ??= fetch("/data/properties.json")
    .then((res) => {
      if (!res.ok) throw new Error(`properties.json: HTTP ${res.status}`);
      return res.json() as Promise<Snapshot>;
    })
    .then(expand)
    .catch((error) => {
      cache = null;
      throw error;
    });
  return cache;
}

const REVIVED_KEY = "resurrection.revived";

export function loadRevived(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(REVIVED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function saveRevived(ids: Set<string>) {
  try {
    localStorage.setItem(REVIVED_KEY, JSON.stringify([...ids]));
  } catch {
    // Private mode: the gold dot just won't survive a reload.
  }
}

// White house silhouette, tinted per category through MapLibre's SDF icons.
export function houseImage(): ImageData {
  const w = 44;
  const h = 44;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(w / 2, 4);
  ctx.lineTo(w - 4, 20);
  ctx.lineTo(w - 8, 20);
  ctx.lineTo(w - 8, h - 4);
  ctx.lineTo(8, h - 4);
  ctx.lineTo(8, 20);
  ctx.lineTo(4, 20);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, w, h);
}
