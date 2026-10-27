export type Phase = "flatline" | "charging" | "charged" | "shock" | "alive";

export const CHARGE_SECONDS = 1.5;
export const SHOCK_TO_ALIVE_SECONDS = 2.4;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

// Seconds since the shock, or -1 before it happens. Everything in the scene
// and the ECG keys off this one clock so they stay in sync.
export const sinceShock = (shockAt: number | null) =>
  shockAt === null ? -1 : performance.now() / 1000 - shockAt;
