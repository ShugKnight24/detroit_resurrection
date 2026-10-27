// Tiny Web Audio synth for the defibrillator. No audio files to load.
let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function chargeWhine(seconds: number) {
  const a = audio();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(380, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2400, a.currentTime + seconds);
  gain.gain.setValueAtTime(0.0001, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, a.currentTime + 0.2);
  gain.gain.setValueAtTime(0.06, a.currentTime + seconds - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + seconds + 0.3);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + seconds + 0.35);
}

export function shockThump() {
  const a = audio();
  const now = a.currentTime;

  // Low body thump
  const osc = a.createOscillator();
  const og = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
  og.gain.setValueAtTime(0.5, now);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(og).connect(a.destination);
  osc.start(now);
  osc.stop(now + 0.5);

  // Electrical crack
  const noise = a.createBuffer(1, a.sampleRate * 0.25, a.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const ng = a.createGain();
  src.buffer = noise;
  filter.type = "highpass";
  filter.frequency.value = 1200;
  ng.gain.value = 0.35;
  src.connect(filter).connect(ng).connect(a.destination);
  src.start(now);
}
