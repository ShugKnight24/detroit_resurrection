export const EVENT_TYPES = [
  "property_viewed",
  "diagnosis_run",
  "application_started",
  "application_step",
  "application_submitted",
  "song_played",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type VitalEvent = {
  type: EventType;
  visitor: string;
  at: number;
  parcelId?: string;
  neighborhood?: string;
  detail?: string;
};

const VISITOR_KEY = "resurrection.visitor";

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

// Fire-and-forget. Vitals are a nice-to-have and must never break the UI.
export function track(type: EventType, fields: Omit<VitalEvent, "type" | "visitor" | "at"> = {}) {
  const event: VitalEvent = { type, visitor: visitorId(), at: Date.now(), ...fields };
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {});
}
