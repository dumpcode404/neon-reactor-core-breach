// Pooled particles, shockwave rings, floating combat text and the starfield.
// All rendering-state only; the world spawns effects through this module.

export function createParticles() {
  const parts = [];
  const rings = [];
  const texts = [];
  const stars = [];

  for (let i = 0; i < 140; i += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      z: 0.25 + Math.random() * 0.75,
      tw: Math.random() * Math.PI * 2,
    });
  }

  return {
    clear() {
      parts.length = 0;
      rings.length = 0;
      texts.length = 0;
    },
    burst(x, y, color, count, speed, life, size) {
      for (let i = 0; i < count; i += 1) {
        if (parts.length > 900) parts.shift();
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.9);
        parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: life * (0.6 + Math.random() * 0.7),
          age: 0,
          color,
          size: size * (0.6 + Math.random() * 0.8),
        });
      }
    },
    trail(x, y, color, size) {
      if (parts.length > 900) parts.shift();
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        life: 0.35, age: 0, color, size,
      });
    },
    ring(x, y, color, maxR, life) {
      if (rings.length > 40) rings.shift();
      rings.push({ x, y, color, maxR, life, age: 0 });
    },
    text(x, y, str, color, size) {
      if (texts.length > 40) texts.shift();
      texts.push({ x, y, str, color, size: size || 15, age: 0, life: 0.9 });
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 2.2 * dt;
        p.vy *= 1 - 2.2 * dt;
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        rings[i].age += dt;
        if (rings[i].age >= rings[i].life) rings.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.age += dt;
        t.y -= 46 * dt;
        if (t.age >= t.life) texts.splice(i, 1);
      }
      for (const s of stars) s.tw += dt * 2;
    },
    drawBackground(g, w, h, time) {
      g.fillStyle = '#070a16';
      g.fillRect(0, 0, w, h);
      for (const s of stars) {
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(s.tw + s.x * 20));
        g.fillStyle = `rgba(140,170,255,${a.toFixed(3)})`;
        const sz = s.z * 2.2;
        g.fillRect(s.x * w, s.y * h, sz, sz);
      }
      // Reactor grid glow.
      g.strokeStyle = 'rgba(46,80,180,0.28)';
      g.lineWidth = 1;
      const step = 64;
      g.beginPath();
      for (let x = (time * 12) % step; x < w; x += step) {
        g.moveTo(x, 0);
        g.lineTo(x, h);
      }
      for (let y = 0; y < h; y += step) {
        g.moveTo(0, y);
        g.lineTo(w, y);
      }
      g.stroke();
      // Core glow at center.
      const core = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.55);
      core.addColorStop(0, 'rgba(40,60,160,0.20)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = core;
      g.fillRect(0, 0, w, h);
    },
    drawWorld(g) {
      for (const p of parts) {
        const k = 1 - p.age / p.life;
        g.globalAlpha = k;
        g.fillStyle = p.color;
        g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      g.globalAlpha = 1;
      for (const r of rings) {
        const k = r.age / r.life;
        g.globalAlpha = 1 - k;
        g.strokeStyle = r.color;
        g.lineWidth = 3 * (1 - k) + 1;
        g.beginPath();
        g.arc(r.x, r.y, r.maxR * (0.2 + 0.8 * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.textAlign = 'center';
      for (const t of texts) {
        const k = 1 - t.age / t.life;
        g.globalAlpha = Math.min(1, k * 2);
        g.font = `bold ${t.size}px monospace`;
        g.fillStyle = t.color;
        g.fillText(t.str, t.x, t.y);
      }
      g.globalAlpha = 1;
    },
  };
}
