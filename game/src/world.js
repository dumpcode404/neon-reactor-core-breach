// Simulation: player, enemies, bullets, pickups, waves, combo and screens.
// Pure logic (no canvas); render.js draws the state. Deterministic under a seeded RNG.

import { COMBO, ENEMY, FIELD, PLAYER, WAVES } from './config.js';
import { freshPlayerStats, draftUpgrades, applyUpgrade } from './upgrades.js';
import { makeRng, pickRng } from './random.js';
import {
  sfxBossWarn, sfxDash, sfxEnemyShoot, sfxExplosion, sfxGameOver,
  sfxHit, sfxKill, sfxPickup, sfxPlayerHit, sfxShoot, sfxUpgrade,
  sfxVictory, sfxWave, setIntensity,
} from './audio.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_UPGRADE = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;
export const SCREEN_PAUSE = 5;

const TAU = Math.PI * 2;

function edgeSpawn(state, rng, margin) {
  const m = margin || 30;
  const side = Math.floor(rng() * 4);
  if (side === 0) return { x: pickRng(rng, 0, FIELD.width), y: -m };
  if (side === 1) return { x: FIELD.width + m, y: pickRng(rng, 0, FIELD.height) };
  if (side === 2) return { x: pickRng(rng, 0, FIELD.width), y: FIELD.height + m };
  return { x: -m, y: pickRng(rng, 0, FIELD.height) };
}

export function createWorld(opts) {
  const o = opts || {};
  const state = {
    screen: SCREEN_TITLE,
    pausedFrom: SCREEN_PLAY,
    time: 0,
    wave: 0,
    waveState: 'idle',
    spawnQueue: [],
    spawnTimer: 0,
    waveBanner: 0,
    bossWarn: 0,
    player: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    pickups: [],
    draft: [],
    score: 0,
    best: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    shake: 0,
    hitStop: 0,
    slowmo: 0,
    muted: false,
    newBest: false,
    titleTime: 0,
    rng: makeRng((o.seed || 1) >>> 0),
    silent: !!o.silent,
    fx: null,
  };

  function fx() {
    return state.fx;
  }

  function resetPlayer() {
    const s = freshPlayerStats();
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hull: s.hullMax,
      shield: s.shieldMax,
      fireTimer: 0,
      dashTimer: 0,
      dashCd: 0,
      dashDx: 0,
      dashDy: 0,
      invuln: 0,
      stats: s,
      alive: true,
    };
  }

  function reset() {
    state.time = 0;
    state.wave = 0;
    state.waveState = 'idle';
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.waveBanner = 0;
    state.bossWarn = 0;
    state.enemies = [];
    state.bullets = [];
    state.ebullets = [];
    state.pickups = [];
    state.draft = [];
    state.score = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 0;
    state.hitStop = 0;
    state.slowmo = 0;
    state.newBest = false;
    state.titleTime = 0;
    state.rng = makeRng((o.seed || 1) >>> 0);
    resetPlayer();
  }

  function loadBest(store) {
    try {
      const v = store && store.getItem('neon-reactor-best');
      state.best = v ? parseInt(v, 10) || 0 : 0;
    } catch (e) {
      state.best = 0;
    }
  }

  function saveBest(store) {
    try {
      if (store && state.score > state.best) {
        store.setItem('neon-reactor-best', String(state.score));
        state.best = state.score;
        state.newBest = true;
      }
    } catch (e) { /* storage unavailable */ }
  }

  function addScore(base, x, y) {
    const mult = 1 + Math.min(COMBO.maxMult, state.combo) * 0.25;
    const gained = Math.round(base * mult * state.player.stats.scoreMult);
    state.score += gained;
    return gained;
  }

  function bumpCombo(x, y) {
    state.combo += 1;
    state.comboTimer = COMBO.window;
    // Milestone callouts only — the HUD meter carries the running total.
    if (fx() && state.combo >= 5 && state.combo % 5 === 0) {
      fx().text(x, y - 18, `COMBO x${state.combo}!`, '#ff7ae0', 18);
    }
  }

  function spawnEnemy(kind, x, y) {
    const t = ENEMY[kind];
    const hpScale = 1 + (state.wave - 1) * 0.12;
    const e = {
      kind,
      x, y,
      vx: 0, vy: 0,
      hp: t.hp * hpScale,
      maxHp: t.hp * hpScale,
      speed: t.speed * pickRng(state.rng, 0.9, 1.1),
      radius: t.radius,
      score: t.score,
      damage: t.damage,
      color: t.color,
      fireTimer: pickRng(state.rng, 0.5, 1.8),
      phase: pickRng(state.rng, 0, TAU),
      telegraph: 0,
      teleKind: null,
      chargeDx: 0,
      chargeDy: 0,
      flash: 0,
    };
    state.enemies.push(e);
    return e;
  }

  function queueWave(n) {
    const def = WAVES[n - 1];
    state.wave = n;
    state.spawnQueue = [];
    const rng = state.rng;
    const push = (kind, count) => {
      for (let i = 0; i < count; i += 1) state.spawnQueue.push(kind);
    };
    push('chaser', def.chaser);
    push('weaver', def.weaver);
    push('splitter', def.splitter);
    push('sniper', def.sniper);
    // Shuffle.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = tmp;
    }
    if (def.boss) state.spawnQueue.push(def.boss);
    state.waveState = 'spawning';
    state.spawnTimer = 0.5;
    state.waveBanner = 2.4;
    if (!state.silent) sfxWave();
    if (def.boss) {
      state.bossWarn = 2.2;
      if (!state.silent) sfxBossWarn();
    }
  }

  function startRun() {
    reset();
    state.screen = SCREEN_PLAY;
    queueWave(1);
  }

  function openUpgrade() {
    state.draft = draftUpgrades(state.rng, 3);
    state.screen = SCREEN_UPGRADE;
    state.waveBanner = 0;
    state.bossWarn = 0;
    if (!state.silent) sfxUpgrade();
  }

  function chooseUpgrade(i) {
    if (i < 0 || i >= state.draft.length) return;
    applyUpgrade(state.player.stats, state.draft[i].id);
    const s = state.player.stats;
    state.player.hullMax = s.hullMax;
    state.player.shieldMax = s.shieldMax;
    state.draft = [];
    if (state.wave >= WAVES.length) {
      winRun();
      return;
    }
    state.screen = SCREEN_PLAY;
    queueWave(state.wave + 1);
  }

  function endRun(won) {
    state.screen = won ? SCREEN_WIN : SCREEN_OVER;
    saveBest(o.store);
    if (fx()) {
      const p = state.player;
      fx().ring(p.x, p.y, won ? '#7dffb0' : '#ff5470', 220, 0.8);
      fx().burst(p.x, p.y, won ? '#7dffb0' : '#ff8a5e', 70, 320, 1.1, 5);
    }
    if (!state.silent) {
      if (won) sfxVictory();
      else sfxGameOver();
    }
  }

  function winRun() {
    endRun(true);
  }

  function loseRun() {
    state.player.alive = false;
    endRun(false);
  }

  function damagePlayer(amount, sx, sy) {
    const p = state.player;
    if (!p.alive || p.invuln > 0 || p.dashTimer > 0) return;
    state.combo = 0;
    state.comboTimer = 0;
    let rest = amount;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, rest);
      p.shield -= absorbed;
      rest -= absorbed;
    }
    p.hull -= rest;
    p.invuln = 0.7;
    state.shake = Math.min(14, state.shake + 7);
    state.hitStop = Math.max(state.hitStop, 0.06);
    if (fx()) {
      fx().burst(p.x, p.y, '#ff5470', 22, 300, 0.6, 4);
      fx().text(p.x, p.y - 24, `-${Math.round(amount)}`, '#ff6b81', 16);
    }
    if (!state.silent) sfxPlayerHit();
    if (p.hull <= 0) {
      p.hull = 0;
      loseRun();
    }
  }

  function killEnemy(e) {
    e.dead = true;
    state.kills += 1;
    bumpCombo(e.x, e.y);
    addScore(e.score, e.x, e.y);
    state.slowmo = e.kind === 'warden' || e.kind === 'mothership' ? 0.35 : state.slowmo;
    state.hitStop = Math.max(state.hitStop, e.kind === 'chaser' || e.kind === 'mite' ? 0.015 : 0.05);
    state.shake = Math.min(16, state.shake + (e.kind === 'mothership' ? 12 : 3));
    if (fx()) {
      fx().burst(e.x, e.y, e.color, e.kind === 'mothership' ? 90 : 22, 300, 0.7, 4);
      fx().ring(e.x, e.y, e.color, e.radius * 4, 0.4);
    }
    if (!state.silent) {
      if (e.kind === 'warden' || e.kind === 'mothership') sfxExplosion();
      else sfxKill(state.combo);
    }
    // Drops.
    const rng = state.rng;
    if (e.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const m = spawnEnemy('mite', e.x + pickRng(rng, -14, 14), e.y + pickRng(rng, -14, 14));
        m.hp = m.maxHp = ENEMY.mite.hp;
      }
    }
    if (e.kind === 'mothership' || e.kind === 'warden' || rng() < 0.22) {
      state.pickups.push({
        x: e.x, y: e.y, vx: pickRng(rng, -60, 60), vy: pickRng(rng, -60, 60),
        kind: rng() < 0.12 ? 'hull' : 'shard',
        value: e.kind === 'mothership' ? 500 : e.kind === 'warden' ? 150 : 25,
        age: 0, life: 9,
      });
    }
    if (e.kind === 'mothership') {
      state.slowmo = 0.8;
      winRun();
    }
  }

  function firePlayer() {
    const p = state.player;
    const n = p.stats.projectiles;
    const base = p.angle;
    for (let i = 0; i < n; i += 1) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.11;
      const a = base + off;
      state.bullets.push({
        x: p.x + Math.cos(a) * 18,
        y: p.y + Math.sin(a) * 18,
        vx: Math.cos(a) * p.stats.bulletSpeed,
        vy: Math.sin(a) * p.stats.bulletSpeed,
        damage: p.stats.bulletDamage,
        pierce: p.stats.pierce,
        crit: state.rng() < p.stats.critChance,
        age: 0, life: 1.1,
      });
    }
    p.fireTimer = p.stats.fireInterval;
    if (!state.silent) sfxShoot();
    if (fx()) fx().burst(p.x + Math.cos(base) * 20, p.y + Math.sin(base) * 20, '#9df2ff', 3, 120, 0.2, 3);
  }

  function fireEnemy(e, speed, damage) {
    const p = state.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    state.ebullets.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage, age: 0, life: 4, radius: 5,
    });
    if (!state.silent) sfxEnemyShoot();
  }

  function updateEnemies(dt) {
    const p = state.player;
    const rng = state.rng;
    for (const e of state.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt * 6);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      e.phase += dt * 3;
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) {
          if (e.teleKind === 'snipe') fireEnemy(e, 520, e.damage + 8);
          else if (e.teleKind === 'ring') {
            for (let i = 0; i < 10; i += 1) {
              const a = (i / 10) * TAU + e.phase;
              state.ebullets.push({
                x: e.x, y: e.y,
                vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
                damage: e.damage, age: 0, life: 3.4, radius: 6,
              });
            }
            if (!state.silent) sfxEnemyShoot();
          } else if (e.teleKind === 'charge') {
            e.vx = e.chargeDx * 460;
            e.vy = e.chargeDy * 460;
          } else if (e.teleKind === 'beam') {
            // Mothership sweep: three fast aimed bolts.
            for (let k = -1; k <= 1; k += 1) {
              const a = Math.atan2(dy, dx) + k * 0.14;
              state.ebullets.push({
                x: e.x, y: e.y,
                vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
                damage: e.damage, age: 0, life: 3, radius: 7,
              });
            }
            if (!state.silent) sfxEnemyShoot();
          }
          e.teleKind = null;
        }
        if (e.teleKind !== 'charge') {
          e.vx *= 1 - 3 * dt;
          e.vy *= 1 - 3 * dt;
        }
      } else if (e.kind === 'chaser' || e.kind === 'mite') {
        e.vx += (nx * e.speed - e.vx) * Math.min(1, 3 * dt);
        e.vy += (ny * e.speed - e.vy) * Math.min(1, 3 * dt);
      } else if (e.kind === 'weaver') {
        const px = -ny;
        const py = nx;
        const sway = Math.sin(e.phase) * 130;
        const approach = dist > 220 ? 1 : 0.25;
        e.vx += ((nx * e.speed * approach + px * sway) - e.vx) * Math.min(1, 4 * dt);
        e.vy += ((ny * e.speed * approach + py * sway) - e.vy) * Math.min(1, 4 * dt);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < 520) {
          e.fireTimer = pickRng(rng, 1.4, 2.4);
          fireEnemy(e, 300, e.damage);
        }
      } else if (e.kind === 'splitter') {
        e.vx += (nx * e.speed - e.vx) * Math.min(1, 2 * dt);
        e.vy += (ny * e.speed - e.vy) * Math.min(1, 2 * dt);
      } else if (e.kind === 'sniper') {
        const want = 380;
        const radial = dist > want + 40 ? 1 : dist < want - 40 ? -0.7 : 0;
        const orbit = 0.7;
        e.vx += ((nx * radial * e.speed + -ny * orbit * e.speed) - e.vx) * Math.min(1, 2.5 * dt);
        e.vy += ((ny * radial * e.speed + nx * orbit * e.speed) - e.vy) * Math.min(1, 2.5 * dt);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < 640) {
          e.fireTimer = pickRng(rng, 2.0, 3.0);
          e.telegraph = 0.7;
          e.teleKind = 'snipe';
        }
      } else if (e.kind === 'warden') {
        e.vx += (nx * e.speed - e.vx) * Math.min(1, 2 * dt);
        e.vy += (ny * e.speed - e.vy) * Math.min(1, 2 * dt);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = pickRng(rng, 1.6, 2.4);
          if (dist < 200 && rng() < 0.5) {
            e.telegraph = 0.6;
            e.teleKind = 'charge';
            e.chargeDx = nx;
            e.chargeDy = ny;
          } else {
            e.telegraph = 0.6;
            e.teleKind = 'ring';
          }
        }
      } else if (e.kind === 'mothership') {
        const wantY = 150;
        e.vx += ((dist > 300 ? nx * e.speed : Math.cos(e.phase * 0.4) * e.speed) - e.vx) * Math.min(1, 1.5 * dt);
        e.vy += (((wantY - e.y) * 0.8) - e.vy) * Math.min(1, 1.5 * dt);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = pickRng(rng, 1.2, 1.9);
          const roll = rng();
          if (roll < 0.4) {
            e.telegraph = 0.7;
            e.teleKind = 'ring';
          } else if (roll < 0.75) {
            e.telegraph = 0.6;
            e.teleKind = 'beam';
          } else {
            for (let i = 0; i < 3; i += 1) {
              const s = edgeSpawn(state, rng, 20);
              const m = spawnEnemy('mite', s.x, s.y);
              m.hp = m.maxHp = ENEMY.mite.hp;
            }
            if (fx()) fx().ring(e.x, e.y, e.color, 160, 0.5);
          }
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Contact damage.
      if (p.alive && dist < e.radius + PLAYER.radius && e.teleKind !== 'charge') {
        damagePlayer(e.damage, e.x, e.y);
        const push = 260;
        e.vx -= nx * push;
        e.vy -= ny * push;
      } else if (p.alive && e.teleKind === 'charge' && e.telegraph <= 0) {
        if (dist < e.radius + PLAYER.radius + 6) {
          damagePlayer(e.damage + 8, e.x, e.y);
        }
      }
    }
    // Remove dead / count living bosses.
    let living = 0;
    let bossAlive = false;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      if (state.enemies[i].dead) state.enemies.splice(i, 1);
      else {
        living += 1;
        if (state.enemies[i].kind === 'warden' || state.enemies[i].kind === 'mothership') bossAlive = true;
      }
    }
    return { living, bossAlive };
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.age >= b.life || b.x < -40 || b.x > FIELD.width + 40 || b.y < -40 || b.y > FIELD.height + 40;
      if (!dead) {
        for (const e of state.enemies) {
          if (e.dead) continue;
          const rr = e.radius + 4;
          if (Math.abs(e.x - b.x) > rr || Math.abs(e.y - b.y) > rr) continue;
          if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
          let dmg = b.damage;
          if (b.crit) dmg *= state.player.stats.critMult;
          e.hp -= dmg;
          e.flash = 1;
          if (fx()) {
            fx().burst(b.x, b.y, b.crit ? '#ffe95e' : '#9df2ff', b.crit ? 8 : 4, 200, 0.3, 3);
            if (b.crit) fx().text(e.x, e.y - e.radius - 8, `${Math.round(dmg)}!`, '#ffe95e', 14);
          }
          if (!state.silent) sfxHit();
          if (e.hp <= 0) killEnemy(e);
          if (b.pierce > 0) {
            b.pierce -= 1;
            b.damage *= 0.8;
          } else {
            dead = true;
          }
          break;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    // Enemy bullets vs player.
    const p = state.player;
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.age >= b.life || b.x < -60 || b.x > FIELD.width + 60 || b.y < -60 || b.y > FIELD.height + 60;
      if (!dead && p.alive && p.invuln <= 0 && p.dashTimer <= 0) {
        const rr = b.radius + PLAYER.radius - 3;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < rr * rr) {
          damagePlayer(b.damage, b.x, b.y);
          dead = true;
        }
      }
      if (dead) state.ebullets.splice(i, 1);
    }
  }

  function updatePickups(dt) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const k = state.pickups[i];
      k.age += dt;
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.stats.magnetRadius) {
        const pull = 420 * (1 - d / (p.stats.magnetRadius + 60));
        k.vx += (dx / d) * pull * dt * 4;
        k.vy += (dy / d) * pull * dt * 4;
      } else {
        k.vx *= 1 - 1.5 * dt;
        k.vy *= 1 - 1.5 * dt;
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      let dead = k.age >= k.life;
      if (!dead && d < PLAYER.radius + 9) {
        if (k.kind === 'shard') {
          addScore(k.value, k.x, k.y, true);
          if (fx()) fx().text(k.x, k.y - 10, `+${k.value}`, '#7dffb0', 13);
        } else {
          p.hull = Math.min(p.hullMax, p.hull + 20);
          if (fx()) fx().text(k.x, k.y - 10, '+HULL', '#7dffb0', 13);
        }
        if (!state.silent) sfxPickup();
        dead = true;
      }
      if (dead) state.pickups.splice(i, 1);
    }
  }

  function updatePlay(dt, input, store) {
    const p = state.player;
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
    state.waveBanner = Math.max(0, state.waveBanner - dt);
    state.bossWarn = Math.max(0, state.bossWarn - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.shield = Math.min(p.shieldMax, p.shield + p.shieldRegen * dt);
    p.dashCd = Math.max(0, p.dashCd - dt);

    // Movement / dash.
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.x += p.dashDx * p.stats.dashSpeed * dt;
      p.y += p.dashDy * p.stats.dashSpeed * dt;
      if (fx()) fx().trail(p.x, p.y, '#9df2ff', 8);
    } else {
      const ax = input.moveX;
      const ay = input.moveY;
      p.vx += (ax * p.stats.speed - p.vx) * Math.min(1, 12 * dt);
      p.vy += (ay * p.stats.speed - p.vy) * Math.min(1, 12 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x));
    p.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y));

    if (input.consumeDash() && p.dashCd <= 0 && p.dashTimer <= 0) {
      let dx = input.moveX;
      let dy = input.moveY;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.angle);
        dy = Math.sin(p.angle);
      }
      const l = Math.hypot(dx, dy) || 1;
      p.dashDx = dx / l;
      p.dashDy = dy / l;
      p.dashTimer = PLAYER.dashTime;
      p.dashCd = p.stats.dashCooldown;
      if (!state.silent) sfxDash();
      if (fx()) fx().ring(p.x, p.y, '#9df2ff', 60, 0.3);
    }

    // Aim + fire.
    const view = state.view || { scale: 1, ox: 0, oy: 0 };
    if (!input.usingTouch) {
      const wx = (input.mouseX - view.ox) / view.scale;
      const wy = (input.mouseY - view.oy) / view.scale;
      const dx = wx - p.x;
      const dy = wy - p.y;
      if (Math.hypot(dx, dy) > 4) p.angle = Math.atan2(dy, dx);
    } else if (Math.hypot(input.aimX, input.aimY) > 0.1) {
      p.angle = Math.atan2(input.aimY, input.aimX);
    }
    p.fireTimer -= dt;
    if (input.firing && p.fireTimer <= 0) firePlayer();

    // Spawning.
    if (state.waveState === 'spawning') {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const batch = state.wave >= 8 ? 3 : 2;
        for (let i = 0; i < batch && state.spawnQueue.length > 0; i += 1) {
          const kind = state.spawnQueue.shift();
          const s = edgeSpawn(state, state.rng, 26);
          const e = spawnEnemy(kind, s.x, s.y);
          if (fx()) fx().ring(e.x, e.y, e.color, 50, 0.4);
        }
        state.spawnTimer = Math.max(0.25, 0.9 - state.wave * 0.05);
        if (state.spawnQueue.length === 0) state.waveState = 'fighting';
      }
    }

    updateBullets(dt);
    const { living, bossAlive } = updateEnemies(dt);
    updatePickups(dt);

    setIntensity(state.enemies.length > 6 || bossAlive ? 1 : state.enemies.length > 2 ? 0.6 : 0.3);

    if (state.screen !== SCREEN_PLAY) return; // death/boss kill may have flipped screens
    if (state.waveState === 'fighting' && living === 0 && state.spawnQueue.length === 0) {
      openUpgrade();
    }
  }

  function update(dt, input, store) {
    state.time += dt;
    if (state.screen === SCREEN_TITLE) {
      state.titleTime += dt;
      if (input.confirmPressed || input.restartPressed) startRun();
      return;
    }
    if (state.screen === SCREEN_UPGRADE) {
      if (input.cardChoice >= 0) chooseUpgrade(input.cardChoice);
      return;
    }
    if (state.screen === SCREEN_OVER || state.screen === SCREEN_WIN) {
      if (input.restartPressed) startRun();
      return;
    }
    if (state.screen === SCREEN_PAUSE) {
      if (input.restartPressed) startRun();
      else if (input.pausePressed || input.confirmPressed) state.screen = state.pausedFrom;
      return;
    }
    // SCREEN_PLAY
    if (input.pausePressed) {
      state.pausedFrom = SCREEN_PLAY;
      state.screen = SCREEN_PAUSE;
      return;
    }
    if (input.mutePressed) {
      state.muted = !state.muted;
    }
    // Hit-stop & slow-mo juice.
    let scale = 1;
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      scale = 0.05;
    } else if (state.slowmo > 0) {
      state.slowmo -= dt;
      scale = 0.35;
    }
    updatePlay(dt * scale, input, store);
    state.shake = Math.max(0, state.shake - dt * 26);
  }

  // Card hit-testing helper for mouse/touch (set by render each frame).
  state.cardRects = [];

  function clickAt(x, y) {
    if (state.screen === SCREEN_UPGRADE) {
      for (let i = 0; i < state.cardRects.length; i += 1) {
        const r = state.cardRects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          chooseUpgrade(i);
          return true;
        }
      }
    }
    return false;
  }

  reset();

  return {
    state,
    reset,
    loadBest,
    saveBest,
    startRun,
    chooseUpgrade,
    update,
    clickAt,
  };
}
