import "server-only";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { EVENT_TYPES, type VitalEvent } from "./events";

// Append-only JSON Lines file. Fine for a local demo; swap for a database
// before deploying, since serverless filesystems don't persist.
const FILE = path.join(process.cwd(), "data", "events.jsonl");

export function isVitalEvent(value: unknown): value is VitalEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.type === "string" &&
    (EVENT_TYPES as readonly string[]).includes(e.type) &&
    typeof e.visitor === "string" &&
    e.visitor.length <= 64 &&
    typeof e.at === "number" &&
    (e.parcelId === undefined || (typeof e.parcelId === "string" && e.parcelId.length <= 32)) &&
    (e.neighborhood === undefined || (typeof e.neighborhood === "string" && e.neighborhood.length <= 80)) &&
    (e.detail === undefined || (typeof e.detail === "string" && e.detail.length <= 120))
  );
}

export async function appendEvent(event: VitalEvent) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const { type, visitor, at, parcelId, neighborhood, detail } = event;
  await appendFile(FILE, JSON.stringify({ type, visitor, at, parcelId, neighborhood, detail }) + "\n");
}

export async function readEvents(): Promise<VitalEvent[]> {
  try {
    const text = await readFile(FILE, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as VitalEvent);
  } catch {
    return [];
  }
}

export type Vitals = {
  visitors: number;
  propertiesViewed: number;
  diagnoses: number;
  applicationsStarted: number;
  applicationsSubmitted: number;
  conversionRate: number;
  medianMinutesToApply: number | null;
  songPlays: number;
  topNeighborhoods: { name: string; started: number; submitted: number }[];
  recent: VitalEvent[];
};

export function summarize(events: VitalEvent[]): Vitals {
  const count = (type: VitalEvent["type"]) => events.filter((e) => e.type === type).length;

  // Time from first look at a parcel to starting its application, per visitor.
  const firstView = new Map<string, number>();
  const minutes: number[] = [];
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (!e.parcelId) continue;
    const key = `${e.visitor}:${e.parcelId}`;
    if (e.type === "property_viewed" && !firstView.has(key)) firstView.set(key, e.at);
    if (e.type === "application_started" && firstView.has(key)) {
      minutes.push((e.at - firstView.get(key)!) / 60_000);
      firstView.delete(key);
    }
  }
  minutes.sort((a, b) => a - b);

  const hoods = new Map<string, { started: number; submitted: number }>();
  for (const e of events) {
    if (!e.neighborhood) continue;
    if (e.type !== "application_started" && e.type !== "application_submitted") continue;
    const h = hoods.get(e.neighborhood) ?? { started: 0, submitted: 0 };
    if (e.type === "application_started") h.started += 1;
    else h.submitted += 1;
    hoods.set(e.neighborhood, h);
  }

  const started = count("application_started");
  const submitted = count("application_submitted");
  return {
    visitors: new Set(events.map((e) => e.visitor)).size,
    propertiesViewed: count("property_viewed"),
    diagnoses: count("diagnosis_run"),
    applicationsStarted: started,
    applicationsSubmitted: submitted,
    conversionRate: started ? submitted / started : 0,
    medianMinutesToApply: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null,
    songPlays: count("song_played"),
    topNeighborhoods: [...hoods.entries()]
      .map(([name, h]) => ({ name, ...h }))
      .sort((a, b) => b.started - a.started)
      .slice(0, 6),
    recent: events.slice(-8).reverse(),
  };
}
