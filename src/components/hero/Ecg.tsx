"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { sinceShock, type Phase } from "./timeline";

const BEAT_SECONDS = 60 / 72;
const g = (p: number, mu: number, sigma: number, amp: number) => amp * Math.exp(-((p - mu) ** 2) / (2 * sigma ** 2));

// One PQRST complex over a beat, p in [0, 1).
const beat = (p: number) =>
  g(p, 0.14, 0.025, 0.12) + g(p, 0.245, 0.008, -0.15) + g(p, 0.27, 0.01, 1) + g(p, 0.295, 0.01, -0.3) + g(p, 0.52, 0.04, 0.3);

function sample(phase: Phase, s: number, t: number) {
  const noise = (Math.random() - 0.5) * 0.02;
  if (s < 0) return noise + (phase === "charging" || phase === "charged" ? (Math.random() - 0.5) * 0.06 : 0);
  if (s < 0.5) return Math.sin(s * 60) * 1.1 * (1 - s / 0.5) + noise; // shock artifact
  if (s < 0.9) return noise;
  return beat(((s - 0.9) / BEAT_SECONDS) % 1) + noise + Math.sin(t) * 0.01;
}

export default function Ecg({ phase, shockAt }: { phase: Phase; shockAt: number | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ phase, shockAt });
  useLayoutEffect(() => {
    props.current = { phase, shockAt };
  }, [phase, shockAt]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const RATE = 120; // samples per second
    const WINDOW = 4; // seconds on screen
    const buffer = new Float32Array(RATE * WINDOW);
    let head = 0;
    let last = performance.now();
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = el.clientWidth * dpr;
      el.height = el.clientHeight * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const draw = (now: number) => {
      const steps = Math.min(buffer.length, Math.round(((now - last) / 1000) * RATE));
      if (steps > 0) {
        last = now;
        const s = sinceShock(props.current.shockAt);
        for (let i = 0; i < steps; i++) {
          buffer[head] = sample(props.current.phase, s - (steps - i) / RATE, now / 1000);
          head = (head + 1) % buffer.length;
        }
      }

      const { width, height } = el;
      ctx.clearRect(0, 0, width, height);
      const alive = props.current.phase === "alive" || props.current.phase === "shock";
      ctx.strokeStyle = alive ? "#7cffb2" : "#ff4d5e";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8 * (width / el.clientWidth);
      ctx.lineWidth = 2 * (width / el.clientWidth);
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[(head + i) % buffer.length];
        const x = (i / (buffer.length - 1)) * width;
        const y = height * 0.62 - v * height * 0.42;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvas} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden />;
}
