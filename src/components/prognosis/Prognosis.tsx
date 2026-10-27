"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "./build";
import type { Tick } from "./Diorama";
import styles from "./Prognosis.module.css";

const Diorama = dynamic(() => import("./Diorama"), { ssr: false });

const COUNTERS: { key: keyof Tick["counts"]; label: string }[] = [
  { key: "vacant", label: "Parcels waiting" },
  { key: "yards", label: "Side yards adopted" },
  { key: "gardens", label: "Gardens planted" },
  { key: "homes", label: "Homes back" },
  { key: "shops", label: "Shops open" },
  { key: "people", label: "People out" },
];

export default function Prognosis() {
  const section = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [started, setStarted] = useState(false);
  const [replay, setReplay] = useState(0);
  const [tick, setTick] = useState<Tick | null>(null);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.intersectionRatio > 0.45) setStarted(true);
      },
      { threshold: [0, 0.45] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stage = tick?.stage ?? 0;
  const s = STAGES[stage];

  return (
    <section id="prognosis" ref={section} className={styles.section} aria-labelledby="prognosis-title">
      <div className={styles.stage}>
        {inView || started ? (
          <Diorama active={inView} playing={started} replay={replay} onTick={setTick} />
        ) : (
          <div className={styles.placeholder} />
        )}
      </div>

      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span>04</span> The vision
        </p>
        <h2 id="prognosis-title" className={styles.title}>
          Detroit, ten years <em>of resurrections from now.</em>
        </h2>
        <p className={styles.lede}>
          Every lot on that map is a starting point. Side yards first, then gardens, then homes, then the main street
          that serves them: a neighborhood with everything its residents need, close to home.
        </p>
      </div>

      <div className={styles.caption} aria-live="polite">
        <div key={stage} className={styles.enter}>
          <span className={styles.step}>
            {String(stage + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
          </span>
          <span className={styles.name}>{s.name}</span>
          <span className={styles.line}>{s.line}</span>
        </div>
        <ol className={styles.progress} aria-hidden>
          {STAGES.map((st, i) => (
            <li key={st.name} data-on={i <= stage} />
          ))}
        </ol>
      </div>

      <dl className={styles.counters}>
        {COUNTERS.map((c) => (
          <div key={c.key}>
            <dd>{tick ? tick.counts[c.key] : "--"}</dd>
            <dt>{c.label}</dt>
          </div>
        ))}
        <button
          type="button"
          className={styles.replay}
          onClick={() => {
            setStarted(true);
            setReplay((r) => r + 1);
          }}
        >
          ↺ Replay
        </button>
      </dl>
      <p className={styles.note}>An illustrated vision, not a forecast. Real progress lives on the vitals page.</p>
    </section>
  );
}
