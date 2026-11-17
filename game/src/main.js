// Entry point: fixed-timestep loop, UI clicks, screens, juice wiring.
// Frame-rate independent: requestAnimationFrame with clamped deltaTime so the
// game behaves identically on 60 Hz and 120 Hz displays.

import { FIELD } from './config.js';
import { createInput } from './input.js';
import { createWorld, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './world.js';
import { createParticles } from './particles.js';
import { fitView, renderFrame } from './render.js';
import { setIntensity, setMuted, unlockAudio, updateMusic } from './audio.js';
import { shotParams, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const g = canvas.getContext('2d');

const params = shotParams();
const SHOT_MODE = params.shot !== '';
const SEED = (params.seed || 7) >>> 0;

const world = createWorld({ seed: SEED, silent: SHOT_MODE, store: SHOT_MODE ? null : window.localStorage });
world.state.fx = createParticles();
const input = createInput(canvas);
const particles = world.state.fx;

world.loadBest(SHOT_MODE ? null : window.localStorage);
if (world.state.best > 0) {
  setStatus(`Best run ${world.state.best}. Press Enter or click to start.`);
}

function setStatus(text) {
  if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
}

// Pointer UI: cards, title / end screens, touch dash button.
function toLogical(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const v = world.state.view || { scale: 1, ox: 0, oy: 0 };
  return { x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale };
}

canvas.addEventListener('mousedown', (e) => {
  unlockAudio();
  if (SHOT_MODE) return;
  const p = toLogical(e.clientX, e.clientY);
  const s = world.state;
  if (s.screen === SCREEN_UPGRADE) {
    world.clickAt(p.x, p.y);
    return;
  }
  if (s.screen === SCREEN_TITLE || s.screen === SCREEN_OVER || s.screen === SCREEN_WIN) {
    world.startRun();
    setStatus('Defend the core. Chain kills for combo.');
  }
});

canvas.addEventListener('touchstart', (e) => {
  unlockAudio();
  if (SHOT_MODE) return;
  const s = world.state;
  for (const t of e.changedTouches) {
    const p = toLogical(t.clientX, t.clientY);
    if (s.screen === SCREEN_UPGRADE) {
      world.clickAt(p.x, p.y);
    } else if (s.screen === SCREEN_TITLE || s.screen === SCREEN_OVER || s.screen === SCREEN_WIN) {
      world.startRun();
      setStatus('Defend the core. Chain kills for combo.');
    } else if (s.dashRect && p.x >= s.dashRect.x && p.x <= s.dashRect.x + s.dashRect.w &&
               p.y >= s.dashRect.y && p.y <= s.dashRect.y + s.dashRect.h) {
      input.dashQueued = true;
    }
  }
}, { passive: true });

window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

if (SHOT_MODE) {
  stageShot(params.shot, world, input);
  const view = fitView(canvas);
  particles.update(0.016);
  world.update(0.0001, input, null);
  renderFrame(g, world, input, particles, view, world.state.time + 3.7);
  setStatus(`Screenshot scene: ${params.shot}.`);
} else {
  let last = performance.now();
  let announced = SCREEN_TITLE;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // clamp: identical behavior on 60/120/240 Hz
    if (dt < 0) dt = 0;
    input.poll();
    if (input.mutePressed) {
      world.state.muted = !world.state.muted;
      setMuted(world.state.muted);
    }
    world.update(dt, input, window.localStorage);
    particles.update(dt);
    updateMusic(dt);
    const view = fitView(canvas);
    renderFrame(g, world, input, particles, view, world.state.time);
    const s = world.state;
    if (s.screen !== announced) {
      announced = s.screen;
      if (s.screen === SCREEN_PLAY) setStatus(`Wave ${s.wave}. Score ${s.score}. Hull ${Math.ceil(s.player.hull)}.`);
      else if (s.screen === SCREEN_UPGRADE) setStatus('Sector clear. Choose an upgrade: 1, 2 or 3.');
      else if (s.screen === SCREEN_OVER) setStatus(`Reactor breached on wave ${s.wave}. Score ${s.score}. Press R to retry.`);
      else if (s.screen === SCREEN_WIN) setStatus(`Core secured! Score ${s.score}. Press R to play again.`);
      else setStatus('NEON REACTOR: CORE BREACH. Press Enter or click to start.');
    } else if (s.screen === SCREEN_PLAY && Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) {
      setStatus(`Wave ${s.wave}. Score ${s.score}. Hull ${Math.ceil(s.player.hull)}.`);
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Keep canvas fitted on resize / orientation change.
window.addEventListener('resize', () => fitView(canvas));
window.addEventListener('orientationchange', () => fitView(canvas));

export { FIELD, setIntensity };
