"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Ecg from "./Ecg";
import styles from "./Hero.module.css";
import type { Phase } from "./timeline";

const HouseScene = dynamic(() => import("./HouseScene"), {
  ssr: false,
  loading: () => <div className={styles.sceneFallback} />,
});

const MONITOR: Record<Phase, { rhythm: string; bpm: string }> = {
  flatline: { rhythm: "ASYSTOLE", bpm: "0" },
  charging: { rhythm: "CHARGING 200J", bpm: "0" },
  charged: { rhythm: "CHARGED · STAND CLEAR", bpm: "0" },
  shock: { rhythm: "SHOCK DELIVERED", bpm: "--" },
  alive: { rhythm: "SINUS RHYTHM", bpm: "72" },
};

type Props = {
  phase: Phase;
  shockAt: number | null;
  patients: number;
  onCharge: () => void;
  onClear: () => void;
};

export default function Hero({ phase, shockAt, patients, onCharge, onClear }: Props) {
  const monitor = MONITOR[phase];
  const section = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // Stop rendering the 3D scene once it scrolls away.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const alive = phase === "alive";

  return (
    <section ref={section} className={styles.hero} data-phase={phase} aria-label="Bring the block back to life">
      <div className={styles.scene}>
        <HouseScene phase={phase} shockAt={shockAt} active={onScreen} />
      </div>
      <div className={styles.flash} aria-hidden />

      <div className={styles.copy}>
        <p className={styles.kicker}>Detroit Land Bank · {patients.toLocaleString()} patients on the ward</p>
        <h1 className={styles.title}>
          Detroit <em>Resurrection</em>
        </h1>
        <p className={styles.lede}>
          Detroit&apos;s vacant lots and empty houses aren&apos;t gone. They&apos;re waiting for a neighbor. Find one,
          get a revival plan, and walk through the application.
        </p>
        <p className={styles.tagline} aria-live="polite">
          {alive ? "…bring me back to life." : " "}
        </p>
      </div>

      <div className={styles.console}>
        <div className={styles.monitor}>
          <div className={styles.readout}>
            <span className={styles.rhythm}>{monitor.rhythm}</span>
            <span className={styles.bpm}>
              {monitor.bpm}
              <small>BPM</small>
            </span>
          </div>
          <div className={styles.trace}>
            <Ecg phase={phase} shockAt={shockAt} />
          </div>
        </div>

        {phase === "flatline" && (
          <button type="button" className={styles.charge} onClick={onCharge}>
            Charge paddles
          </button>
        )}
        {phase === "charging" && (
          <button type="button" className={styles.charge} disabled>
            Charging…
          </button>
        )}
        {phase === "charged" && (
          <button type="button" className={styles.clear} onClick={onClear}>
            CLEAR!
          </button>
        )}
        {(phase === "shock" || alive) && (
          <a className={styles.next} href="#theatre">
            Now showing ↓
          </a>
        )}
        <p className={styles.hint}>
          {phase === "charged" ? "Plays the video with sound." : alive ? "Patient revived." : " "}
        </p>
      </div>
    </section>
  );
}
