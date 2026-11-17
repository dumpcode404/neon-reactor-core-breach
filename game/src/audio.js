// Procedural Web Audio: synthesized SFX + adaptive background pulse.
// No audio files. Context is created lazily on first user gesture; shot mode stays silent.

let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let pulseTimer = 0;
let intensity = 0;

function ensure() {
  if (ctx || typeof window === 'undefined') return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

export function setMuted(m) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
}

export function isMuted() {
  return muted;
}

export function setIntensity(v) {
  intensity = Math.max(0, Math.min(1, v));
}

function tone(freq, dur, type, vol, slideTo, delay) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + (delay || 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol, filterFreq, delay) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = filterFreq || 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(vol || 0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
}

export function sfxShoot() {
  tone(880, 0.09, 'square', 0.08, 220);
}

export function sfxEnemyShoot() {
  tone(320, 0.12, 'sawtooth', 0.06, 140);
}

export function sfxHit() {
  noise(0.08, 0.16, 2400);
  tone(220, 0.07, 'square', 0.1, 90);
}

export function sfxKill(combo) {
  const base = 300 + Math.min(9, combo || 1) * 60;
  tone(base, 0.14, 'square', 0.14, base * 2);
  noise(0.12, 0.12, 1800);
}

export function sfxExplosion() {
  noise(0.5, 0.4, 900);
  tone(120, 0.45, 'sawtooth', 0.25, 30);
}

export function sfxPlayerHit() {
  noise(0.25, 0.35, 700);
  tone(160, 0.3, 'sawtooth', 0.3, 50);
}

export function sfxDash() {
  noise(0.16, 0.18, 3200);
  tone(500, 0.14, 'sine', 0.12, 1200);
}

export function sfxPickup() {
  tone(1320, 0.09, 'sine', 0.12, 1980);
}

export function sfxUpgrade() {
  tone(520, 0.12, 'triangle', 0.2, 780);
  tone(780, 0.14, 'triangle', 0.2, 1170, 0.1);
  tone(1040, 0.2, 'triangle', 0.18, 1560, 0.2);
}

export function sfxWave() {
  tone(196, 0.25, 'sawtooth', 0.16, 392);
  tone(392, 0.3, 'sawtooth', 0.12, 784, 0.12);
}

export function sfxBossWarn() {
  for (let i = 0; i < 3; i += 1) tone(110, 0.22, 'sawtooth', 0.25, 82, i * 0.26);
}

export function sfxGameOver() {
  tone(330, 0.4, 'sawtooth', 0.22, 82);
  tone(220, 0.5, 'sawtooth', 0.2, 55, 0.3);
  noise(0.7, 0.3, 500, 0.1);
}

export function sfxVictory() {
  const seq = [523, 659, 784, 1046, 1318];
  seq.forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, f, i * 0.13));
}

// Adaptive pulse: a soft bass thump + hat whose rate follows combat intensity.
// Called every frame with deltaTime; cheap and silent until unlocked.
export function updateMusic(dt) {
  if (!ctx || muted || ctx.state !== 'running') return;
  pulseTimer -= dt;
  if (pulseTimer > 0) return;
  const rate = 0.42 - intensity * 0.24;
  pulseTimer = rate;
  const c = ctx;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55 + intensity * 25, t0);
  osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.18);
  g.gain.setValueAtTime(0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t0);
  osc.stop(t0 + 0.25);
}
