"use client";

import { useMemo, useState } from "react";
import styles from "./Partnership.module.css";

// Illustrative assumptions, to be replaced with the Land Bank's real numbers
// during discovery.
const INELIGIBLE = 0.35; // share of raw interest that doesn't qualify
const REWORK = 0.4; // share of unassisted applications needing a second review
const WEEKS = 16;

type Model = { office: number[]; waitlist: number[] };

function simulate(interest: number, capacity: number, precheck: boolean, gate: boolean, paced: boolean): Model {
  const reach = interest * (precheck ? 1 - INELIGIBLE : 1);
  const cost = 1 + (gate ? 0 : REWORK); // reviews per application
  const office: number[] = [];
  const waitlist: number[] = [];
  let backlog = 0;
  let queue = 0;
  for (let w = 0; w < WEEKS; w++) {
    let sent = reach;
    if (paced) {
      // Hold applications in the app and release only what staff can review.
      queue += reach;
      const room = Math.max(0, capacity - backlog) / cost;
      sent = Math.min(queue, room);
      queue -= sent;
    }
    backlog = Math.max(0, backlog + sent * cost - capacity);
    office.push(backlog / capacity); // weeks of work piled up
    waitlist.push(queue);
  }
  return { office, waitlist };
}

function Chart({ base, guarded }: { base: number[]; guarded: number[] }) {
  const max = Math.max(4, ...base, ...guarded);
  const w = 560;
  const h = 200;
  const path = (data: number[]) =>
    data
      .map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
      .join(" ");
  const limitY = h - (2 / max) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} className={styles.chart} role="img" aria-label="Office backlog over 16 weeks">
      <line x1="0" x2={w} y1={limitY} y2={limitY} className={styles.limit} />
      <text x={w} y={limitY - 6} textAnchor="end" className={styles.limitText}>
        2 weeks of backlog
      </text>
      <path d={path(base)} className={styles.lineBase} />
      <path d={path(guarded)} className={styles.lineGuarded} />
      <text x="0" y={h + 18} className={styles.axis}>
        Week 1
      </text>
      <text x={w} y={h + 18} textAnchor="end" className={styles.axis}>
        Week {WEEKS}
      </text>
    </svg>
  );
}

export default function CapacitySim() {
  const [interest, setInterest] = useState(150);
  const [capacity, setCapacity] = useState(70);
  const [precheck, setPrecheck] = useState(true);
  const [gate, setGate] = useState(true);
  const [paced, setPaced] = useState(true);

  const base = useMemo(() => simulate(interest, capacity, false, false, false), [interest, capacity]);
  const guarded = useMemo(
    () => simulate(interest, capacity, precheck, gate, paced),
    [interest, capacity, precheck, gate, paced],
  );
  const endBase = base.office[WEEKS - 1];
  const endGuarded = guarded.office[WEEKS - 1];
  const waiting = Math.round(guarded.waitlist[WEEKS - 1]);

  return (
    <div className={styles.sim}>
      <div className={styles.simControls}>
        <p className={styles.label}>Capacity simulator</p>
        <label className={styles.slider}>
          <span>
            Residents ready to apply <b>{interest}/week</b>
          </span>
          <input type="range" min={20} max={500} step={10} value={interest} onChange={(e) => setInterest(+e.target.value)} />
        </label>
        <label className={styles.slider}>
          <span>
            Applications staff can review <b>{capacity}/week</b>
          </span>
          <input type="range" min={20} max={300} step={5} value={capacity} onChange={(e) => setCapacity(+e.target.value)} />
        </label>
        <div className={styles.toggles}>
          {[
            { on: precheck, set: setPrecheck, label: "Eligibility pre-check" },
            { on: gate, set: setGate, label: "Complete-packet gate" },
            { on: paced, set: setPaced, label: "Intake paced to capacity" },
          ].map((t) => (
            <button key={t.label} type="button" aria-pressed={t.on} onClick={() => t.set(!t.on)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className={styles.assumptions}>
          Assumes {Math.round(INELIGIBLE * 100)}% of raw interest doesn&apos;t qualify and {Math.round(REWORK * 100)}% of
          unassisted applications need a second review. We&apos;d replace both with the Land Bank&apos;s real numbers.
        </p>
      </div>

      <div className={styles.simOut}>
        <Chart base={base.office} guarded={guarded.office} />
        <ul className={styles.simLegend}>
          <li data-kind="base">Without guardrails</li>
          <li data-kind="guarded">With guardrails</li>
        </ul>
        <dl className={styles.simStats}>
          <div>
            <dd data-bad={endBase > 2}>{endBase.toFixed(1)} wks</dd>
            <dt>Office backlog after 16 weeks, unassisted</dt>
          </div>
          <div>
            <dd data-good={endGuarded <= 2}>{endGuarded.toFixed(1)} wks</dd>
            <dt>Office backlog with guardrails</dt>
          </div>
          <div>
            <dd>{waiting.toLocaleString()}</dd>
            <dt>Residents holding a place in line in the app, not in the office</dt>
          </div>
        </dl>
      </div>
    </div>
  );
}
