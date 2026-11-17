// All drawing: arena, entities with neon glow, telegraphs, HUD and every screen.
// Canvas is fit to the window (devicePixelRatio aware); world.state.view maps
// pointer pixels back to logical coordinates for aiming and card clicks.

import { FIELD, PLAYER } from './config.js';
import {
  SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN,
} from './world.js';

function glow(g, color, blur) {
  g.shadowColor = color;
  g.shadowBlur = blur;
}

function noGlow(g) {
  g.shadowBlur = 0;
}

function drawShip(g, x, y, angle, radius, color, invuln, dashing) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  if (invuln > 0 && Math.floor(invuln * 14) % 2 === 0) g.globalAlpha = 0.35;
  glow(g, color, 16);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(radius + 4, 0);
  g.lineTo(-radius, radius * 0.85);
  g.lineTo(-radius * 0.45, 0);
  g.lineTo(-radius, -radius * 0.85);
  g.closePath();
  g.fill();
  noGlow(g);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(radius * 0.25, 0, radius * 0.28, 0, Math.PI * 2);
  g.fill();
  if (dashing) {
    g.strokeStyle = '#9df2ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, radius + 8, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

function drawEnemyShape(g, e) {
  g.save();
  g.translate(e.x, e.y);
  if (e.flash > 0) {
    g.globalAlpha = 0.6 + 0.4 * e.flash;
  }
  glow(g, e.color, 14);
  g.fillStyle = e.color;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  const r = e.radius;
  if (e.kind === 'chaser' || e.kind === 'mite') {
    g.rotate(Math.atan2(e.vy, e.vx));
    g.beginPath();
    g.moveTo(r, 0);
    g.lineTo(-r, r * 0.8);
    g.lineTo(-r, -r * 0.8);
    g.closePath();
    g.fill();
  } else if (e.kind === 'weaver') {
    g.rotate(Math.atan2(e.vy, e.vx));
    g.beginPath();
    g.moveTo(r * 1.3, 0);
    g.lineTo(0, r * 0.7);
    g.lineTo(-r * 1.3, 0);
    g.lineTo(0, -r * 0.7);
    g.closePath();
    g.fill();
  } else if (e.kind === 'splitter') {
    g.rotate(e.phase * 0.4);
    g.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    noGlow(g);
    g.fillStyle = '#3a1200';
    g.beginPath();
    g.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    g.fill();
  } else if (e.kind === 'sniper') {
    g.rotate(Math.PI / 4 + e.phase * 0.2);
    g.strokeStyle = e.color;
    g.lineWidth = 3;
    g.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    noGlow(g);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, 3, 0, Math.PI * 2);
    g.fill();
  } else if (e.kind === 'warden' || e.kind === 'mothership') {
    const spikes = e.kind === 'warden' ? 8 : 12;
    g.rotate(e.phase * 0.3);
    g.beginPath();
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.72;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    noGlow(g);
    g.fillStyle = '#0b0512';
    g.beginPath();
    g.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

function drawTelegraph(g, e, player) {
  if (e.telegraph <= 0 || !e.teleKind) return;
  const pulse = 0.5 + 0.5 * Math.sin(e.telegraph * 30);
  g.save();
  g.globalAlpha = 0.55 + 0.35 * pulse;
  if (e.teleKind === 'snipe' && player) {
    g.strokeStyle = '#ff2e63';
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(e.x, e.y);
    g.lineTo(player.x, player.y);
    g.stroke();
    g.setLineDash([]);
  } else if (e.teleKind === 'ring' || e.teleKind === 'beam') {
    g.strokeStyle = '#ff2e63';
    g.lineWidth = 2 + pulse * 2;
    g.beginPath();
    g.arc(e.x, e.y, e.radius + 14 + pulse * 8, 0, Math.PI * 2);
    g.stroke();
  } else if (e.teleKind === 'charge') {
    g.strokeStyle = '#ffb35e';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(e.x, e.y);
    g.lineTo(e.x + e.chargeDx * 220, e.y + e.chargeDy * 220);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

function drawHud(g, s) {
  const p = s.player;
  g.textBaseline = 'top';
  // Score block.
  g.textAlign = 'left';
  g.font = 'bold 26px monospace';
  glow(g, '#ffe95e', 10);
  g.fillStyle = '#ffe95e';
  g.fillText(String(s.score).padStart(7, '0'), 16, 10);
  noGlow(g);
  g.font = '13px monospace';
  g.fillStyle = '#8fa3d8';
  g.fillText(`BEST ${Math.max(s.best, s.score)}`, 16, 40);
  // Wave block.
  g.textAlign = 'center';
  g.font = 'bold 22px monospace';
  g.fillStyle = '#9df2ff';
  glow(g, '#29e6ff', 8);
  g.fillText(`WAVE ${Math.max(1, s.wave)} / 10`, FIELD.width / 2, 10);
  noGlow(g);
  const left = s.spawnQueue.length + s.enemies.filter((e) => !e.dead).length;
  g.font = '13px monospace';
  g.fillStyle = '#8fa3d8';
  g.fillText(s.waveState === 'fighting' && left === 0 ? 'SECTOR CLEAR' : `HOSTILES ${left}`, FIELD.width / 2, 36);
  // Combo meter.
  if (s.combo >= 2) {
    const mult = (1 + Math.min(9, s.combo) * 0.25).toFixed(2).replace(/\.?0+$/, '');
    g.textAlign = 'right';
    g.font = 'bold 24px monospace';
    glow(g, '#ff7ae0', 12);
    g.fillStyle = '#ff7ae0';
    g.fillText(`COMBO x${s.combo} (${mult})`, FIELD.width - 16, 10);
    noGlow(g);
    const w = 150;
    g.fillStyle = 'rgba(255,122,224,0.25)';
    g.fillRect(FIELD.width - 16 - w, 40, w, 6);
    g.fillStyle = '#ff7ae0';
    g.fillRect(FIELD.width - 16 - w, 40, w * Math.max(0, s.comboTimer / 3), 6);
  } else {
    g.textAlign = 'right';
    g.font = '13px monospace';
    g.fillStyle = '#8fa3d8';
    g.fillText('CHAIN KILLS FOR COMBO', FIELD.width - 16, 12);
  }
  // Hull + shield bars.
  const bx = 16;
  const by = FIELD.height - 44;
  g.textAlign = 'left';
  g.font = 'bold 13px monospace';
  g.fillStyle = '#7dffb0';
  g.fillText('HULL', bx, by - 18);
  g.fillStyle = 'rgba(125,255,176,0.2)';
  g.fillRect(bx + 52, by - 18, 190, 14);
  g.fillStyle = '#35e07f';
  glow(g, '#35e07f', 6);
  g.fillRect(bx + 52, by - 18, 190 * Math.max(0, p.hull / p.hullMax), 14);
  noGlow(g);
  g.fillStyle = '#9df2ff';
  g.fillText('AEGIS', bx, by + 2);
  g.fillStyle = 'rgba(157,242,255,0.2)';
  g.fillRect(bx + 52, by + 2, 190, 10);
  g.fillStyle = '#29e6ff';
  g.fillRect(bx + 52, by + 2, 190 * Math.max(0, p.shield / p.shieldMax), 10);
  // Dash cooldown pip.
  const dashK = 1 - p.dashCd / p.stats.dashCooldown;
  g.textAlign = 'right';
  g.fillStyle = dashK >= 1 ? '#9df2ff' : '#4a5a86';
  g.font = 'bold 13px monospace';
  g.fillText(dashK >= 1 ? 'DASH READY [SPACE]' : 'DASH …', FIELD.width - 16, FIELD.height - 26);
  // Boss HP.
  const boss = s.enemies.find((e) => !e.dead && (e.kind === 'warden' || e.kind === 'mothership'));
  if (boss) {
    const bw = 420;
    const bx2 = FIELD.width / 2 - bw / 2;
    const by2 = 58;
    g.textAlign = 'center';
    g.font = 'bold 14px monospace';
    g.fillStyle = '#ff6b81';
    g.fillText(boss.kind === 'mothership' ? 'MOTHERSHIP' : 'WARDEN', FIELD.width / 2, by2);
    g.fillStyle = 'rgba(255,46,99,0.25)';
    g.fillRect(bx2, by2 + 18, bw, 10);
    g.fillStyle = '#ff2e63';
    glow(g, '#ff2e63', 8);
    g.fillRect(bx2, by2 + 18, bw * Math.max(0, boss.hp / boss.maxHp), 10);
    noGlow(g);
  }
  // Wave banner.
  if (s.waveBanner > 0) {
    g.globalAlpha = Math.min(1, s.waveBanner);
    g.textAlign = 'center';
    g.font = 'bold 54px monospace';
    glow(g, '#29e6ff', 22);
    g.fillStyle = '#dff7ff';
    g.fillText(`WAVE ${s.wave}`, FIELD.width / 2, FIELD.height / 2 - 90);
    noGlow(g);
    g.globalAlpha = 1;
  }
  if (s.bossWarn > 0) {
    g.globalAlpha = 0.6 + 0.4 * Math.sin(s.time * 12);
    g.textAlign = 'center';
    g.font = 'bold 30px monospace';
    glow(g, '#ff2e63', 16);
    g.fillStyle = '#ff6b81';
    g.fillText('!! CAPITAL SIGNATURE !!', FIELD.width / 2, FIELD.height / 2 - 30);
    noGlow(g);
    g.globalAlpha = 1;
  }
}

function panel(g, x, y, w, h) {
  g.fillStyle = 'rgba(8,12,28,0.88)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = '#29e6ff';
  g.lineWidth = 2;
  glow(g, '#29e6ff', 12);
  g.strokeRect(x, y, w, h);
  noGlow(g);
}

function drawTitle(g, s, input) {
  const cx = FIELD.width / 2;
  panel(g, cx - 330, 110, 660, 380);
  g.textAlign = 'center';
  g.font = 'bold 58px monospace';
  glow(g, '#ff2e63', 24);
  g.fillStyle = '#ff5e7e';
  g.fillText('NEON REACTOR', cx, 180);
  noGlow(g);
  g.font = 'bold 26px monospace';
  glow(g, '#29e6ff', 14);
  g.fillStyle = '#9df2ff';
  g.fillText('· CORE BREACH ·', cx, 220);
  noGlow(g);
  g.font = '15px monospace';
  g.fillStyle = '#c4d2f5';
  g.fillText('Hold the reactor core through 10 waves.', cx, 262);
  g.fillText('Chain kills for combo. Draft upgrades. Kill the MOTHERSHIP.', cx, 286);
  g.font = 'bold 15px monospace';
  g.fillStyle = '#ffe95e';
  if (input.usingTouch) {
    g.fillText('LEFT stick move · RIGHT stick aim+fire · DASH button', cx, 322);
  } else {
    g.fillText('WASD move · MOUSE aim · CLICK / SPACE fire+dash', cx, 322);
    g.fillText('1/2/3 draft upgrades · P pause · M mute · R restart', cx, 344);
  }
  if (s.best > 0) {
    g.font = '15px monospace';
    g.fillStyle = '#8fa3d8';
    g.fillText(`BEST RUN ${s.best}`, cx, 374);
  }
  if (Math.floor(s.titleTime * 2) % 2 === 0) {
    g.font = 'bold 22px monospace';
    glow(g, '#7dffb0', 12);
    g.fillStyle = '#7dffb0';
    g.fillText(input.usingTouch ? '— TAP TO START —' : '— PRESS ENTER OR CLICK TO START —', cx, 428);
    noGlow(g);
  }
}

// Vector upgrade icons (font-independent: no reliance on symbol glyphs).
function drawCardIcon(g, id, x, y, r) {
  glow(g, '#29e6ff', 14);
  g.strokeStyle = '#9df2ff';
  g.fillStyle = '#9df2ff';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  if (id === 'overclock') {
    g.moveTo(x - r * 0.5, y - r * 0.7);
    g.lineTo(x + r * 0.1, y);
    g.lineTo(x - r * 0.5, y + r * 0.7);
    g.moveTo(x + r * 0.1, y - r * 0.7);
    g.lineTo(x + r * 0.7, y);
    g.lineTo(x + r * 0.1, y + r * 0.7);
    g.stroke();
  } else if (id === 'split') {
    g.arc(x - r * 0.5, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
    g.moveTo(x + r * 0.72, y - r * 0.4);
    g.arc(x + r * 0.5, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
    g.moveTo(x + r * 0.22, y + r * 0.45);
    g.arc(x, y + r * 0.45, r * 0.22, 0, Math.PI * 2);
    g.fill();
  } else if (id === 'heavy') {
    g.moveTo(x, y - r * 0.8);
    g.lineTo(x + r * 0.6, y);
    g.lineTo(x, y + r * 0.8);
    g.lineTo(x - r * 0.6, y);
    g.closePath();
    g.fill();
  } else if (id === 'crit') {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r * 0.85 : r * 0.32;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  } else if (id === 'aegis') {
    g.moveTo(x - r * 0.6, y - r * 0.6);
    g.lineTo(x + r * 0.6, y - r * 0.6);
    g.lineTo(x + r * 0.6, y);
    g.quadraticCurveTo(x + r * 0.6, y + r * 0.55, x, y + r * 0.8);
    g.quadraticCurveTo(x - r * 0.6, y + r * 0.55, x - r * 0.6, y);
    g.closePath();
    g.stroke();
  } else if (id === 'magnet') {
    g.arc(x, y - r * 0.1, r * 0.55, Math.PI, 0, false);
    g.moveTo(x + r * 0.55, y - r * 0.1);
    g.lineTo(x + r * 0.55, y + r * 0.5);
    g.moveTo(x - r * 0.55, y - r * 0.1);
    g.lineTo(x - r * 0.55, y + r * 0.5);
    g.stroke();
  } else if (id === 'thrusters') {
    g.moveTo(x - r * 0.6, y - r * 0.45);
    g.lineTo(x + r * 0.3, y - r * 0.45);
    g.lineTo(x + r * 0.3, y - r * 0.8);
    g.lineTo(x + r * 0.8, y);
    g.lineTo(x + r * 0.3, y + r * 0.8);
    g.lineTo(x + r * 0.3, y + r * 0.45);
    g.lineTo(x - r * 0.6, y + r * 0.45);
    g.closePath();
    g.fill();
  } else if (id === 'nanites') {
    g.fillRect(x - r * 0.2, y - r * 0.7, r * 0.4, r * 1.4);
    g.fillRect(x - r * 0.7, y - r * 0.2, r * 1.4, r * 0.4);
  } else if (id === 'greed') {
    g.arc(x, y, r * 0.65, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x, y, r * 0.22, 0, Math.PI * 2);
    g.fill();
  } else {
    g.moveTo(x - r * 0.7, y);
    g.lineTo(x + r * 0.5, y);
    g.moveTo(x + r * 0.1, y - r * 0.4);
    g.lineTo(x + r * 0.5, y);
    g.lineTo(x + r * 0.1, y + r * 0.4);
    g.stroke();
  }
  noGlow(g);
}

function drawUpgrade(g, s) {
  const cx = FIELD.width / 2;
  g.fillStyle = 'rgba(4,6,16,0.72)';
  g.fillRect(0, 0, FIELD.width, FIELD.height);
  g.textAlign = 'center';
  g.font = 'bold 34px monospace';
  glow(g, '#ffe95e', 16);
  g.fillStyle = '#ffe95e';
  g.fillText('SECTOR CLEAR — CHOOSE AN UPGRADE', cx, 120);
  noGlow(g);
  s.cardRects.length = 0;
  const cw = 220;
  const ch = 250;
  const gap = 30;
  const x0 = cx - (cw * 3 + gap * 2) / 2;
  const y0 = 190;
  s.draft.forEach((card, i) => {
    const x = x0 + i * (cw + gap);
    s.cardRects.push({ x, y: y0, w: cw, h: ch });
    panel(g, x, y0, cw, ch);
    g.fillStyle = '#ff7ae0';
    g.font = 'bold 15px monospace';
    g.fillText(`[${i + 1}]`, x + cw / 2, y0 + 26);
    drawCardIcon(g, card.id, x + cw / 2, y0 + 108, 34);
    g.font = 'bold 17px monospace';
    g.fillStyle = '#ffffff';
    g.fillText(card.name, x + cw / 2, y0 + 178);
    g.font = '14px monospace';
    g.fillStyle = '#8fa3d8';
    const words = card.desc.split(' ');
    let line = '';
    let ly = y0 + 204;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 22) {
        g.fillText(line.trim(), x + cw / 2, ly);
        ly += 20;
        line = w;
      } else {
        line = `${line} ${w}`;
      }
    }
    g.fillText(line.trim(), x + cw / 2, ly);
  });
  g.font = '14px monospace';
  g.fillStyle = '#8fa3d8';
  g.fillText('Click a card or press 1 / 2 / 3', cx, y0 + ch + 30);
}

function drawEnd(g, s, won) {
  g.fillStyle = won ? 'rgba(4,20,12,0.68)' : 'rgba(24,4,12,0.68)';
  g.fillRect(0, 0, FIELD.width, FIELD.height);
  const cx = FIELD.width / 2;
  panel(g, cx - 300, 130, 600, 330);
  g.textAlign = 'center';
  if (won) {
    g.font = 'bold 52px monospace';
    glow(g, '#7dffb0', 22);
    g.fillStyle = '#7dffb0';
    g.fillText('CORE SECURED', cx, 205);
    noGlow(g);
    g.font = '17px monospace';
    g.fillStyle = '#c4d2f5';
    g.fillText('The MOTHERSHIP burns. The reactor sings again.', cx, 248);
  } else {
    g.font = 'bold 52px monospace';
    glow(g, '#ff2e63', 22);
    g.fillStyle = '#ff5e7e';
    g.fillText('REACTOR BREACH', cx, 205);
    noGlow(g);
    g.font = '17px monospace';
    g.fillStyle = '#c4d2f5';
    g.fillText(`Overrun on WAVE ${s.wave} · ${s.kills} kills`, cx, 248);
  }
  g.font = 'bold 30px monospace';
  glow(g, '#ffe95e', 12);
  g.fillStyle = '#ffe95e';
  g.fillText(`SCORE ${s.score}`, cx, 300);
  noGlow(g);
  g.font = '15px monospace';
  g.fillStyle = '#8fa3d8';
  g.fillText(s.newBest ? '★ NEW BEST RUN ★' : `BEST ${Math.max(s.best, s.score)}`, cx, 332);
  if (Math.floor(s.time * 2) % 2 === 0) {
    g.font = 'bold 20px monospace';
    g.fillStyle = '#ffffff';
    g.fillText('PRESS R OR CLICK TO RETRY', cx, 392);
  }
}

function drawPause(g) {
  g.fillStyle = 'rgba(4,6,16,0.7)';
  g.fillRect(0, 0, FIELD.width, FIELD.height);
  g.textAlign = 'center';
  g.font = 'bold 46px monospace';
  glow(g, '#29e6ff', 16);
  g.fillStyle = '#9df2ff';
  g.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
  noGlow(g);
  g.font = '16px monospace';
  g.fillStyle = '#8fa3d8';
  g.fillText('P / ENTER to resume · R to restart', FIELD.width / 2, FIELD.height / 2 + 30);
}

function drawTouchControls(g, s, input) {
  const m = input.touchMove;
  if (m.active) {
    g.globalAlpha = 0.35;
    g.strokeStyle = '#9df2ff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(m.sx, m.sy, 52, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.6;
    g.fillStyle = '#9df2ff';
    g.beginPath();
    g.arc(m.sx + Math.max(-52, Math.min(52, m.dx)), m.sy + Math.max(-52, Math.min(52, m.dy)), 22, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  // Dash button (bottom-right); main.js hit-tests taps against dashRect.
  const bx = FIELD.width - 76;
  const by = FIELD.height - 150;
  const ready = s.player && s.player.dashCd <= 0;
  g.globalAlpha = 0.5;
  g.fillStyle = ready ? '#29e6ff' : '#33415f';
  g.beginPath();
  g.arc(bx, by, 40, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = '#06121f';
  g.font = 'bold 15px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DASH', bx, by);
  g.textBaseline = 'top';
  s.dashRect = { x: bx - 48, y: by - 48, w: 96, h: 96 };
}

export function fitView(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const scale = Math.min(cssW / FIELD.width, cssH / FIELD.height);
  const ox = (cssW - FIELD.width * scale) / 2;
  const oy = (cssH - FIELD.height * scale) / 2;
  return { dpr, cssW, cssH, scale, ox, oy };
}

export function renderFrame(g, world, input, particles, view, time) {
  const s = world.state;
  s.view = { scale: view.scale, ox: view.ox, oy: view.oy };
  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  // Letterbox.
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, view.cssW, view.cssH);
  g.translate(view.ox, view.oy);
  g.scale(view.scale, view.scale);
  // Screen shake.
  if (s.shake > 0 && (s.screen === SCREEN_PLAY)) {
    const a = Math.random() * Math.PI * 2;
    g.translate(Math.cos(a) * s.shake * 0.6, Math.sin(a) * s.shake * 0.6);
  }
  particles.drawBackground(g, FIELD.width, FIELD.height, time);

  const inWorld = s.screen === SCREEN_PLAY || s.screen === SCREEN_PAUSE || s.screen === SCREEN_UPGRADE;
  if (inWorld || s.screen === SCREEN_OVER || s.screen === SCREEN_WIN) {
    // Pickups.
    for (const k of s.pickups) {
      glow(g, k.kind === 'shard' ? '#7dffb0' : '#ff8a5e', 10);
      g.fillStyle = k.kind === 'shard' ? '#7dffb0' : '#ff8a5e';
      g.save();
      g.translate(k.x, k.y);
      g.rotate(time * 3);
      const r = k.kind === 'shard' ? 6 : 9;
      g.fillRect(-r / 2, -r / 2, r, r);
      g.restore();
      noGlow(g);
    }
    // Enemy telegraphs under bodies.
    for (const e of s.enemies) {
      if (!e.dead) drawTelegraph(g, e, s.player);
    }
    // Enemies.
    for (const e of s.enemies) {
      if (!e.dead) drawEnemyShape(g, e);
    }
    // Enemy bullets.
    for (const b of s.ebullets) {
      glow(g, '#ff2e63', 12);
      g.fillStyle = '#ff8a9e';
      g.beginPath();
      g.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      g.fill();
      noGlow(g);
    }
    // Player bullets.
    for (const b of s.bullets) {
      glow(g, b.crit ? '#ffe95e' : '#29e6ff', 10);
      g.fillStyle = b.crit ? '#ffe95e' : '#bdf6ff';
      g.save();
      g.translate(b.x, b.y);
      g.rotate(Math.atan2(b.vy, b.vx));
      g.fillRect(-9, -2, 18, 4);
      g.restore();
      noGlow(g);
    }
    // Player (only while flying — end screens show the panel, not the ship).
    const p = s.player;
    if (p && inWorld) {
      if (s.screen !== SCREEN_OVER) {
        drawShip(g, p.x, p.y, p.angle, PLAYER.radius, '#37f2ff', p.invuln, p.dashTimer > 0);
        if (p.shield > 0) {
          g.globalAlpha = 0.25 + 0.1 * Math.sin(time * 6);
          g.strokeStyle = '#29e6ff';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(p.x, p.y, PLAYER.radius + 9, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
    }
    particles.drawWorld(g);
  } else {
    particles.drawWorld(g);
  }

  if (s.screen === SCREEN_PLAY || s.screen === SCREEN_PAUSE) drawHud(g, s);
  if (s.screen === SCREEN_TITLE) drawTitle(g, s, input);
  if (s.screen === SCREEN_UPGRADE) {
    drawHud(g, s);
    drawUpgrade(g, s);
  }
  if (s.screen === SCREEN_OVER) drawEnd(g, s, false);
  if (s.screen === SCREEN_WIN) drawEnd(g, s, true);
  if (s.screen === SCREEN_PAUSE) drawPause(g);
  if (input.usingTouch && (s.screen === SCREEN_PLAY)) drawTouchControls(g, s, input);

  // Mute hint (bottom-center, clear of bars and dash readout).
  g.textAlign = 'center';
  g.font = '12px monospace';
  g.fillStyle = '#4a5a86';
  g.fillText(s.muted ? 'M: UNMUTE' : 'M: MUTE', FIELD.width / 2, FIELD.height - 18);
}
