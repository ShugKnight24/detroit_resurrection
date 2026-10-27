"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/events";
import type { InventoryStats } from "@/lib/snapshot-stats";
import Hero from "./hero/Hero";
import { chargeWhine, shockThump } from "./hero/sfx";
import { CHARGE_SECONDS, SHOCK_TO_ALIVE_SECONDS, type Phase } from "./hero/timeline";
import GraveyardMap from "./map/GraveyardMap";
import CaseFile from "./CaseFile";
import Partnership from "./partnership/Partnership";
import Prognosis from "./prognosis/Prognosis";
import Theatre, { type TheatreHandle } from "./theatre/Theatre";

export default function Experience({ stats }: { stats: InventoryStats }) {
  const [phase, setPhase] = useState<Phase>("flatline");
  const [shockAt, setShockAt] = useState<number | null>(null);
  const theatre = useRef<TheatreHandle>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, seconds: number) => {
    timers.current.push(window.setTimeout(fn, seconds * 1000));
  };

  function charge() {
    setPhase("charging");
    chargeWhine(CHARGE_SECONDS);
    later(() => setPhase("charged"), CHARGE_SECONDS);
  }

  function clear() {
    setPhase("shock");
    setShockAt(performance.now() / 1000);
    shockThump();
    // Must run inside the click so the browser allows sound.
    theatre.current?.play();
    track("song_played", { detail: "defib" });
    later(() => setPhase("alive"), SHOCK_TO_ALIVE_SECONDS);
  }

  return (
    <main>
      <Hero phase={phase} shockAt={shockAt} patients={stats.total} onCharge={charge} onClear={clear} />
      <Theatre ref={theatre} revived={phase === "alive"} />
      <CaseFile stats={stats} />
      <Partnership />
      <GraveyardMap />
      <Prognosis />
    </main>
  );
}
