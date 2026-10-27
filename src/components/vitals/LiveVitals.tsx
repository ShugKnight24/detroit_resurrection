"use client";

import { useEffect, useState } from "react";
import type { Vitals } from "@/lib/event-store";
import type { EventType } from "@/lib/events";
import styles from "./LiveVitals.module.css";

const EVENT_LABEL: Record<EventType, string> = {
  property_viewed: "Viewed",
  diagnosis_run: "Diagnosed",
  application_started: "Started application",
  application_step: "Application step",
  application_submitted: "Submitted",
  song_played: "Shocked the block",
};

export default function LiveVitals() {
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/events", { cache: "no-store" })
        .then((r) => r.json() as Promise<Vitals>)
        .then((v) => {
          if (alive) {
            setVitals(v);
            setError(false);
          }
        })
        .catch(() => alive && setError(true));
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!vitals) return <p className={styles.waiting}>{error ? "Monitor offline." : "Connecting to the monitor…"}</p>;

  const funnel = [
    { label: "Parcels viewed", value: vitals.propertiesViewed },
    { label: "Diagnoses", value: vitals.diagnoses },
    { label: "Applications started", value: vitals.applicationsStarted },
    { label: "Applications submitted", value: vitals.applicationsSubmitted },
  ];
  const top = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className={styles.grid}>
      <section className={styles.tiles} aria-label="Headline metrics">
        <Tile label="Lots on their way back" value={vitals.applicationsSubmitted} tone="alive" />
        <Tile label="Start → submit rate" value={`${Math.round(vitals.conversionRate * 100)}%`} />
        <Tile
          label="Median time, first look → apply"
          value={vitals.medianMinutesToApply === null ? "--" : `${vitals.medianMinutesToApply.toFixed(1)} min`}
        />
        <Tile label="Visitors" value={vitals.visitors} />
      </section>

      <section className={styles.panel} aria-labelledby="funnel-title">
        <h2 id="funnel-title">From curiosity to revival</h2>
        <ol className={styles.funnel}>
          {funnel.map((f) => (
            <li key={f.label}>
              <span>{f.label}</span>
              <span className={styles.bar} style={{ "--w": `${(f.value / top) * 100}%` } as React.CSSProperties} />
              <span className={styles.value}>{f.value}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.panel} aria-labelledby="hood-title">
        <h2 id="hood-title">Neighborhoods with a pulse</h2>
        {vitals.topNeighborhoods.length === 0 ? (
          <p className={styles.empty}>No applications yet. Be the first.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Neighborhood</th>
                <th>Started</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {vitals.topNeighborhoods.map((h) => (
                <tr key={h.name}>
                  <td>{h.name}</td>
                  <td>{h.started}</td>
                  <td>{h.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="feed-title">
        <h2 id="feed-title">Live feed</h2>
        {vitals.recent.length === 0 ? (
          <p className={styles.empty}>Flatline. Nothing yet.</p>
        ) : (
          <ul className={styles.feed}>
            {vitals.recent.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className={styles.time}>
                  {new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                <span>{EVENT_LABEL[e.type]}</span>
                <span className={styles.where}>{e.neighborhood ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: "alive" }) {
  return (
    <div className={styles.tile} data-tone={tone}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  );
}
