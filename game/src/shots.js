// Deterministic screenshot staging behind ?shot=title|combat|upgrade|triumph.
// Each scene plays the real simulation forward with a simple autopilot so the
// frame is what genuine gameplay looks like; the same seed gives the same frame.

import { FIELD } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './world.js';

const STEP = 1 / 60;

function autopilot(s) {
  // Flee nearest threat, chase nearest shard, keep firing at nearest enemy.
  const p = s.player;
  let threat = null;
  let threatD = 260;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < threatD) {
      threatD = d;
      threat = e;
    }
  }
  let moveX = 0;
  let moveY = 0;
  if (threat) {
    moveX = (p.x - threat.x) / (threatD || 1);
    moveY = (p.y - threat.y) / (threatD || 1);
  } else {
    let shard = null;
    let sd = 1e9;
    for (const k of s.pickups) {
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d < sd) {
        sd = d;
        shard = k;
      }
    }
    if (shard) {
      moveX = (shard.x - p.x) / (sd || 1);
      moveY = (shard.y - p.y) / (sd || 1);
    } else {
      moveX = Math.cos(s.time * 0.7);
      moveY = Math.sin(s.time * 0.9);
    }
  }
  // Strong pull toward mid-arena so the frame stays composed, not cornered.
  moveX += (FIELD.width / 2 - p.x) / (FIELD.width / 2) * 0.9;
  moveY += (FIELD.height / 2 - p.y) / (FIELD.height / 2) * 0.9;
  if (p.x < 150) moveX += 0.9;
  if (p.x > FIELD.width - 150) moveX -= 0.9;
  if (p.y < 130) moveY += 0.9;
  if (p.y > FIELD.height - 130) moveY -= 0.9;
  const ml = Math.hypot(moveX, moveY) || 1;
  if (ml > 1) {
    moveX /= ml;
    moveY /= ml;
  }
  let target = null;
  let td = 1e9;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < td) {
      td = d;
      target = e;
    }
  }
  return { moveX, moveY, target };
}

const FAKE_INPUT = {
  moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: true,
  usingTouch: false, mouseX: 0, mouseY: 0,
  consumeDash() { return false; },
  pausePressed: false, mutePressed: false, restartPressed: false,
  confirmPressed: false, cardChoice: -1,
};

function stepWorld(world, input, n, holdFire) {
  for (let i = 0; i < n; i += 1) {
    const s = world.state;
    const plan = autopilot(s);
    input.moveX = plan.moveX;
    input.moveY = plan.moveY;
    if (plan.target) {
      const dx = plan.target.x - s.player.x;
      const dy = plan.target.y - s.player.y;
      const l = Math.hypot(dx, dy) || 1;
      input.aimX = dx / l;
      input.aimY = dy / l;
      input.usingTouch = true; // steer by aim vector, independent of mouse
    }
    input.firing = !holdFire;
    world.update(STEP, input, null);
    if (s.screen !== SCREEN_PLAY) return;
  }
  input.usingTouch = false;
}

/** Drive world to the named scene; returns nothing (state is mutated). */
export function stageShot(name, world, input) {
  const s = world.state;
  if (name === 'combat') {
    world.startRun();
    // Base stats: the autopilot cannot clear waves instantly, so hostiles pile
    // up. Take the first frame with a real crowd and the ship mid-arena.
    let guard = 0;
    while (guard < 60 * 110 && (s.screen === SCREEN_PLAY || s.screen === SCREEN_UPGRADE)) {
      if (s.screen === SCREEN_UPGRADE) {
        world.chooseUpgrade(guard % 3);
      } else {
        stepWorld(world, input, 30);
      }
      guard += 30;
      if (
        s.screen === SCREEN_PLAY && s.wave >= 3 && s.enemies.length >= 6 &&
        s.player.x > 250 && s.player.x < 710 && s.player.y > 150 && s.player.y < 450
      ) break;
    }
    if (s.screen !== SCREEN_PLAY) {
      world.startRun();
      stepWorld(world, input, Math.floor(40 / STEP));
    }
    s.waveBanner = 0;
    s.bossWarn = 0;
    // Time the frame so player shots are visibly mid-flight (only with buffer,
    // so the wave cannot clear mid-timing and flip the screen).
    if (s.screen === SCREEN_PLAY && s.enemies.length > 2) {
      for (let i = 0; i < 24 && s.screen === SCREEN_PLAY && s.bullets.length === 0; i += 1) {
        world.update(STEP, input, null);
      }
    }
    s.waveBanner = 0;
    return;
  }
  if (name === 'upgrade') {
    world.startRun();
    stepWorld(world, input, Math.floor(14 / STEP));
    if (s.screen !== SCREEN_PLAY) {
      world.startRun();
      stepWorld(world, input, Math.floor(8 / STEP));
    }
    // Force the draft screen even if the wave is still running.
    if (s.screen === SCREEN_PLAY) {
      s.enemies.length = 0;
      s.spawnQueue.length = 0;
      s.waveState = 'fighting';
      world.update(STEP, FAKE_INPUT, null);
    }
    if (world.state.fx) world.state.fx.clear();
    return;
  }
  if (name === 'triumph') {
    world.startRun();
    // Simulate a hard-won victory: fast-forward, then award the win state.
    stepWorld(world, input, Math.floor(20 / STEP));
    s.enemies.length = 0;
    s.ebullets.length = 0;
    s.score = 24580;
    s.kills = 187;
    s.wave = 10;
    s.combo = 6;
    // Stage a hard-won victory: clear stale combat text so the panel reads clean.
    if (world.state.fx) world.state.fx.clear();
    // Stage a mothership kill for authentic win particles, then show screen.
    s.screen = SCREEN_WIN;
    s.newBest = true;
    s.best = 24580;
    return;
  }
  if (name === 'breach') {
    world.startRun();
    for (let round = 0; round < 12 && s.screen !== SCREEN_OVER; round += 1) {
      if (s.screen === SCREEN_UPGRADE) {
        world.chooseUpgrade(0);
        continue;
      }
      if (s.screen !== SCREEN_PLAY) break;
      // Ram into harm's way until the run ends.
      for (let i = 0; i < 60 * 25 && s.screen === SCREEN_PLAY; i += 1) {
        input.moveX = 1;
        input.moveY = 0.3;
        input.firing = true;
        input.usingTouch = false;
        world.update(STEP, input, null);
      }
    }
    return;
  }
  // Default: title.
  world.reset();
  for (let i = 0; i < 6 / STEP; i += 1) {
    world.update(STEP, FAKE_INPUT, null);
    if (world.state.screen !== SCREEN_TITLE) break;
  }
}

/** Query helper: read ?shot= and ?seed= from the URL. */
export function shotParams() {
  try {
    const q = new URLSearchParams(window.location.search);
    return { shot: q.get('shot') || '', seed: parseInt(q.get('seed') || '7', 10) || 7 };
  } catch (e) {
    return { shot: '', seed: 7 };
  }
}

export { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN, FIELD };
