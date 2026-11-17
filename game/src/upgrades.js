// Between-wave upgrade drafts: pick 3 distinct cards, apply the chosen one.

import { PLAYER, UPGRADE_POOL } from './config.js';

export function draftUpgrades(rng, count) {
  const pool = UPGRADE_POOL.slice();
  const out = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function applyUpgrade(player, id) {
  switch (id) {
    case 'overclock':
      player.fireInterval *= 0.78;
      break;
    case 'split':
      player.projectiles = Math.min(5, player.projectiles + 1);
      break;
    case 'heavy':
      player.bulletDamage *= 1.35;
      break;
    case 'crit':
      player.critChance = Math.min(0.6, player.critChance + 0.12);
      break;
    case 'aegis':
      player.shieldMax += 25;
      player.shield = Math.min(player.shieldMax, player.shield + 25);
      player.shieldRegen += 2.5;
      break;
    case 'magnet':
      player.magnetRadius *= 1.7;
      break;
    case 'thrusters':
      player.speed *= 1.12;
      player.dashCooldown = Math.max(0.8, player.dashCooldown * 0.8);
      break;
    case 'nanites':
      player.hullMax += 15;
      player.hull = Math.min(player.hullMax, player.hull + 50);
      break;
    case 'greed':
      player.scoreMult *= 1.3;
      break;
    case 'pierce':
      player.pierce += 1;
      break;
    default:
      break;
  }
}

export function freshPlayerStats() {
  return {
    speed: PLAYER.speed,
    hullMax: PLAYER.hullMax,
    shieldMax: PLAYER.shieldMax,
    shieldRegen: PLAYER.shieldRegen,
    fireInterval: PLAYER.fireInterval,
    bulletDamage: PLAYER.bulletDamage,
    dashCooldown: PLAYER.dashCooldown,
    magnetRadius: PLAYER.magnetRadius,
    critChance: PLAYER.critChance,
    critMult: PLAYER.critMult,
    projectiles: PLAYER.projectiles,
    pierce: PLAYER.pierce,
    scoreMult: 1,
  };
}
