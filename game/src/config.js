// Central tuning for NEON REACTOR: CORE BREACH.
// Logical playfield is 960x600; render scales it to any window (devicePixelRatio aware).

export const FIELD = { width: 960, height: 600 };

export const PLAYER = {
  radius: 13,
  speed: 265,
  hullMax: 100,
  shieldMax: 40,
  shieldRegen: 7,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletDamage: 12,
  dashCooldown: 2.1,
  dashTime: 0.18,
  dashSpeed: 780,
  magnetRadius: 90,
  critChance: 0.05,
  critMult: 2.2,
  projectiles: 1,
  pierce: 0,
};

export const COMBO = { window: 3.0, maxMult: 9 };

export const WAVES = [
  { chaser: 5, weaver: 0, splitter: 0, sniper: 0, boss: null },
  { chaser: 8, weaver: 2, splitter: 0, sniper: 0, boss: null },
  { chaser: 9, weaver: 5, splitter: 0, sniper: 0, boss: null },
  { chaser: 9, weaver: 6, splitter: 2, sniper: 2, boss: null },
  { chaser: 6, weaver: 4, splitter: 2, sniper: 2, boss: 'warden' },
  { chaser: 10, weaver: 7, splitter: 4, sniper: 3, boss: null },
  { chaser: 12, weaver: 8, splitter: 5, sniper: 4, boss: null },
  { chaser: 12, weaver: 9, splitter: 6, sniper: 6, boss: null },
  { chaser: 14, weaver: 10, splitter: 7, sniper: 7, boss: 'warden' },
  { chaser: 8, weaver: 6, splitter: 4, sniper: 4, boss: 'mothership' },
];

export const ENEMY = {
  chaser: { hp: 22, speed: 118, radius: 13, score: 50, damage: 12, color: '#ff3fa4' },
  weaver: { hp: 16, speed: 148, radius: 11, score: 70, damage: 10, color: '#29e6ff' },
  splitter: { hp: 60, speed: 62, radius: 20, score: 120, damage: 18, color: '#ffa02e' },
  mite: { hp: 8, speed: 205, radius: 7, score: 25, damage: 7, color: '#ffb35e' },
  sniper: { hp: 30, speed: 96, radius: 13, score: 110, damage: 14, color: '#b46bff' },
  warden: { hp: 520, speed: 74, radius: 30, score: 800, damage: 22, color: '#ff5470' },
  mothership: { hp: 1500, speed: 46, radius: 46, score: 5000, damage: 30, color: '#ff2e63' },
};

export const UPGRADE_POOL = [
  { id: 'overclock', name: 'OVERCLOCK', desc: '+28% fire rate', icon: '»' },
  { id: 'split', name: 'SPLIT CANNONS', desc: '+1 projectile', icon: '∴' },
  { id: 'heavy', name: 'HEAVY ROUNDS', desc: '+35% damage', icon: '◆' },
  { id: 'crit', name: 'CRIT CORE', desc: '+12% crit chance', icon: '✦' },
  { id: 'aegis', name: 'AEGIS PLATING', desc: '+25 max shield, faster regen', icon: '⛨' },
  { id: 'magnet', name: 'MAGNET COIL', desc: '+70% pickup radius', icon: '◉' },
  { id: 'thrusters', name: 'THRUSTERS', desc: '+12% speed, -20% dash cooldown', icon: '➤' },
  { id: 'nanites', name: 'NANITE SWARM', desc: 'Repair 50 hull, +15 max hull', icon: '+' },
  { id: 'greed', name: 'SHARD GREED', desc: '+30% score gains', icon: '$' },
  { id: 'pierce', name: 'LANCE TIPS', desc: 'Shots pierce +1 enemy', icon: '→' },
];
