// Shape of public/data/properties.json, written by scripts/snapshot-properties.mjs.
export type Snapshot = {
  fetchedAt: string;
  statuses: string[];
  neighborhoods: string[];
  // [lng, lat, statusIdx, neighborhoodIdx, address, parcelId, councilDistrict]
  rows: [number, number, number, number, string, string, number][];
};

export type Category = "side" | "lot" | "structure" | "dormant";

export type Property = {
  id: number;
  lng: number;
  lat: number;
  status: string;
  category: Category;
  neighborhood: string;
  address: string;
  parcelId: string;
  district: number;
};

export const CATEGORY_META: Record<Category, { label: string; blurb: string; color: string }> = {
  side: {
    label: "Side lot",
    blurb: "For sale to the owner-occupant next door",
    color: "#7cffb2",
  },
  lot: {
    label: "Lot for sale",
    blurb: "Vacant land listed by the Land Bank",
    color: "#ff8a3d",
  },
  structure: {
    label: "House for sale",
    blurb: "A structure listed for sale or renovation",
    color: "#b48cff",
  },
  dormant: {
    label: "Dormant",
    blurb: "Land Bank owned, not listed yet",
    color: "#5d6470",
  },
};

export function categorize(status: string): Category {
  if (/side lot/i.test(status)) return "side";
  if (/structure/i.test(status) && /for sale/i.test(status)) return "structure";
  if (/for sale/i.test(status)) return "lot";
  return "dormant";
}

export function expand(snapshot: Snapshot): Property[] {
  return snapshot.rows.map(([lng, lat, s, n, address, parcelId, district], id) => {
    const status = snapshot.statuses[s];
    return {
      id,
      lng,
      lat,
      status,
      category: categorize(status),
      neighborhood: snapshot.neighborhoods[n],
      address,
      parcelId,
      district,
    };
  });
}

export type Nearby = {
  radiusMeters: number;
  total: number;
  byCategory: Record<Category, number>;
};

// Counts Land Bank parcels near a point. A flat-earth approximation is plenty
// at city scale.
export function nearby(all: Property[], target: Property, radiusMeters = 200): Nearby {
  const mPerDegLat = 111_320;
  const mPerDegLng = mPerDegLat * Math.cos((target.lat * Math.PI) / 180);
  const byCategory: Record<Category, number> = { side: 0, lot: 0, structure: 0, dormant: 0 };
  let total = 0;
  for (const p of all) {
    if (p.id === target.id) continue;
    const dx = (p.lng - target.lng) * mPerDegLng;
    const dy = (p.lat - target.lat) * mPerDegLat;
    if (dx * dx + dy * dy <= radiusMeters * radiusMeters) {
      byCategory[p.category] += 1;
      total += 1;
    }
  }
  return { radiusMeters, total, byCategory };
}
