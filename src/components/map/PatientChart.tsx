"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiagnoseRequest, DiagnoseResponse } from "@/lib/diagnosis";
import { track } from "@/lib/events";
import { CATEGORY_META, nearby, type Property } from "@/lib/properties";
import { DLBA_URL, PARTNERS, PROGRAM_NOTES } from "@/lib/programs";
import ApplicationWizard from "./ApplicationWizard";
import styles from "./PatientChart.module.css";

type Props = {
  property: Property;
  all: Property[];
  revived: boolean;
  onClose: () => void;
  onRevived: () => void;
};

type Photo = NonNullable<DiagnoseRequest["photo"]>;

// Shrink photos before upload: phone pictures are often 5+ MB.
async function toPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.82);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

export default function PatientChart({ property, all, revived, onClose, onRevived }: Props) {
  const meta = CATEGORY_META[property.category];
  const block = useMemo(() => nearby(all, property), [all, property]);
  const [goal, setGoal] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState(0);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    track("property_viewed", { parcelId: property.parcelId, neighborhood: property.neighborhood });
  }, [property]);

  async function diagnose() {
    setLoading(true);
    setError(null);
    try {
      const body: DiagnoseRequest = { property, nearby: block, goal: goal || undefined, photo: photo ?? undefined };
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DiagnoseResponse;
      setResult(data);
      setChoice(0);
      track("diagnosis_run", {
        parcelId: property.parcelId,
        neighborhood: property.neighborhood,
        detail: data.source,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const diagnosis = result?.diagnosis;

  return (
    <aside className={styles.chart} aria-label={`Patient chart for ${property.address}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker} style={{ color: revived ? "var(--alive)" : meta.color }}>
            {revived ? "Revived" : meta.label}
          </p>
          <h2 className={styles.address}>{property.address}</h2>
          <p className={styles.sub}>
            {property.neighborhood} · District {property.district} · Parcel {property.parcelId}
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close patient chart">
          ×
        </button>
      </header>

      <div className={styles.body}>
        {applying && diagnosis ? (
          <ApplicationWizard
            property={property}
            diagnosis={diagnosis}
            choice={choice}
            onBack={() => setApplying(false)}
            onSubmitted={onRevived}
          />
        ) : (
          <>
            <dl className={styles.vitals}>
              <div>
                <dt>Status</dt>
                <dd>{property.status}</dd>
              </div>
              <div>
                <dt>Within {block.radiusMeters}m</dt>
                <dd>
                  {block.total} Land Bank parcels · {block.byCategory.side + block.byCategory.lot} for sale
                </dd>
              </div>
            </dl>
            <p className={styles.note}>{PROGRAM_NOTES[property.status] ?? "Land Bank owned parcel."}</p>

            {!diagnosis && (
              <div className={styles.intake}>
                <label className={styles.field}>
                  <span>What would you bring back here? (optional)</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={goal}
                    placeholder="A garden for the kids on my block, a side yard, fix up the house for my family…"
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </label>
                <label className={styles.photo}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      setPhoto(file ? await toPhoto(file) : null);
                    }}
                  />
                  <span>{photo ? "Photo attached ✓" : "Add a photo of the lot (optional)"}</span>
                </label>
                <button type="button" className={styles.primary} onClick={diagnose} disabled={loading}>
                  {loading ? "Dr. Detroit is examining…" : "Diagnose this patient"}
                </button>
                {loading && <div className={styles.pulse} aria-hidden />}
                {error && <p className={styles.error}>Diagnosis failed: {error}</p>}
              </div>
            )}

            {diagnosis && (
              <div className={styles.result}>
                <p className={styles.verdict}>“{diagnosis.verdict}”</p>
                <p>{diagnosis.condition}</p>

                <fieldset className={styles.options}>
                  <legend>Revival options</legend>
                  {diagnosis.options.map((o, i) => (
                    <label key={o.title} className={styles.option} data-chosen={choice === i}>
                      <input type="radio" name="option" checked={choice === i} onChange={() => setChoice(i)} />
                      <span className={styles.optionTitle}>{o.title}</span>
                      <span>{o.why}</span>
                      <span className={styles.meta}>
                        {o.cost} · {o.timeline}
                      </span>
                    </label>
                  ))}
                </fieldset>

                {diagnosis.partners.length > 0 && (
                  <div className={styles.partners}>
                    <h3>Who can help</h3>
                    <ul>
                      {diagnosis.partners.map((name) => {
                        const partner = PARTNERS.find((p) => p.name === name);
                        return (
                          <li key={name}>
                            <a href={partner?.url ?? DLBA_URL} target="_blank" rel="noreferrer">
                              {name}
                            </a>
                            {partner && <span> · {partner.focus}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => {
                    setApplying(true);
                    track("application_started", {
                      parcelId: property.parcelId,
                      neighborhood: property.neighborhood,
                      detail: diagnosis.options[choice]?.kind,
                    });
                  }}
                >
                  Begin the resurrection →
                </button>
                <p className={styles.source}>
                  {result?.source === "claude"
                    ? "Plan drafted by Claude from city open data. Confirm details with the Land Bank."
                    : "Offline plan (AI unavailable). Confirm details with the Land Bank."}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
