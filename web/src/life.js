// Other life in the world: mice and fish to hunt, flocks of small birds that scatter from a
// diving hawk, songbirds that fly in to answer you, and other hawks (a companion who leads
// you to thermals and food, and your own fledgling).
import { clamp, lerp, hash } from './util.js';
import * as W from './world.js';
import { createBird, pose } from './bird.js';
import { SPECIES } from './songs.js';

/* ---------- prey: positions are a function of time, so nothing needs storing ---------- */
export function mousePos(m, t) {
  const ph = t * .45 + m.seed * 2.3, x = m.x + Math.sin(ph) * 16;
  // mice pop up out of the grass now and then
  const up = Math.sin(t * .21 + m.seed * 1.7);
  return { x, y: W.groundY(x), dir: Math.cos(ph) > 0 ? 1 : -1, show: clamp((up + .2) * 3, 0, 1), run: Math.abs(Math.cos(ph)) };
}
export function fishPos(f, p, t) {
  const sp = .18 + .12 * hash(f.seed), ph = t * sp + f.seed * 1.9;
  const x = lerp(p.x0 + 6, p.x1 - 6, .5 + .45 * Math.sin(ph));
  const y = Math.min(p.waterY + 4 + 2.5 * Math.sin(t * .6 + f.seed), W.pondBed(x, p) - 2);
  return { x, y, dir: Math.cos(ph) > 0 ? 1 : -1 };
}

/* ---------- a flock of small birds (boids) ---------- */
export function updateFlock(G, dt, audio, once) {
  const b = G.bird, { w } = G.view;
  const follow = G.followT > 0;
  if (!G.boids.length) {
    G.nextBoids -= dt;
    if (G.nextBoids <= 0 || follow) {
      G.nextBoids = 25 + Math.random() * 30;
      const dir = follow ? b.face : (Math.random() < .5 ? 1 : -1), x = follow ? b.x - b.face * 140 : (dir > 0 ? G.cam.x - 60 : G.cam.x + w + 60);
      const sp = SPECIES[(Math.random() * 6) | 0], n = 7 + (Math.random() * 6 | 0), y = W.groundY(x) - 150 - Math.random() * 60;
      G.flockGoal = { x: x + dir * 40, y, vx: dir * 55 };
      for (let i = 0; i < n; i++) G.boids.push({ x: x + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 20, vx: dir * 50, vy: 0, ph: Math.random() * 6, col: sp.cols.body, wing: sp.cols.cap, seed: i });
    }
    return;
  }
  const goal = G.flockGoal;
  if (follow) { goal.x = b.x - b.face * 30; goal.y = b.y - 25; }
  else {
    goal.x += goal.vx * dt;
    goal.y += (W.groundY(goal.x) - 160 + Math.sin(G.t * .3) * 30 - goal.y) * dt * .5;
  }
  // a hawk diving through the flock scatters it
  const diving = b.state === 'fly' && b.g < -.35 && b.s > 90;
  let cx = 0, cy = 0, vx = 0, vy = 0;
  for (const o of G.boids) { cx += o.x; cy += o.y; vx += o.vx; vy += o.vy; }
  const n = G.boids.length; cx /= n; cy /= n; vx /= n; vy /= n;
  if (!follow && Math.hypot(cx - b.x, cy - b.y) < 110 && (diving || Math.hypot(cx - b.x, cy - b.y) < 35)) {
    if (G.scatterT <= 0) { audio.rustle(); once('scatter', 'The flock scatters from a diving hawk. Give it a moment and it gathers again.'); }
    G.scatterT = 2.5;
  }
  G.scatterT = Math.max(0, G.scatterT - dt);
  for (const o of G.boids) {
    let ax = (cx - o.x) * .6 + (vx - o.vx) * .8 + (goal.x - o.x) * .7, ay = (cy - o.y) * .6 + (vy - o.vy) * .8 + (goal.y - o.y) * .7;
    for (const q of G.boids) {
      if (q === o) continue; const dx = o.x - q.x, dy = o.y - q.y, d2 = dx * dx + dy * dy;
      if (d2 < 100 && d2 > .01) { ax += dx / d2 * 900; ay += dy / d2 * 900; }
    }
    if (G.scatterT > 0) {
      const dx = o.x - b.x, dy = o.y - b.y, d = Math.max(8, Math.hypot(dx, dy));
      ax += dx / d * 900 * G.scatterT / 2.5 + (hash(o.seed + G.t | 0) - .5) * 300; ay += dy / d * 600 * G.scatterT / 2.5;
    }
    const gy = W.groundY(o.x); if (o.y > gy - 40) ay -= (o.y - gy + 40) * 8;
    ay += Math.sin(G.t * 3 + o.seed) * 30;
    o.vx += ax * dt; o.vy += ay * dt;
    const s = Math.hypot(o.vx, o.vy), max = G.scatterT > 0 ? 170 : follow ? 130 : 85;
    if (s > max) { o.vx *= max / s; o.vy *= max / s; }
    o.x += o.vx * dt; o.y += o.vy * dt; o.ph += dt * (o.vy < -10 || G.scatterT > 0 ? 26 : 14);
  }
  // the flock moves on; once it is well out of sight it is gone
  if (!follow && Math.abs(cx - (G.cam.x + w / 2)) > w * 1.6) G.boids = [];
}

/* ---------- a songbird answering your song: flies in, perches, sings ---------- */
export function callVisitor(G, sp) {
  const b = G.bird;
  let best = null, bd = 1e9;
  for (const p of W.perchesIn(b.x - 160, b.x + 160)) {
    if (p.occupied || p === b.perch) continue;
    const d = Math.abs(Math.hypot(p.x - b.x, p.y - b.y) - 60);
    if (d < bd) { bd = d; best = p; }
  }
  if (G.visitor?.perch) G.visitor.perch.occupied = false;
  const side = Math.random() < .5 ? -1 : 1;
  G.visitor = { sp, perch: best, x: b.x + side * 260, y: b.y - 120, t: 0, sx: b.x + side * 260, sy: b.y - 120, stay: 22, sang: false, leaving: false };
  if (best) best.occupied = true;
}
export function updateVisitor(G, dt, sing) {
  const v = G.visitor; if (!v) return;
  v.t += dt;
  const target = v.perch && !v.leaving ? { x: v.perch.x, y: v.perch.y - 3.4 } : { x: v.sx + (v.sx - G.bird.x) * 2, y: v.sy - 200 };
  if (!v.perch && !v.leaving) { target.x = G.bird.x - (v.sx - G.bird.x); target.y = G.bird.y - 60; }
  const dx = target.x - v.x, dy = target.y - v.y, d = Math.hypot(dx, dy), sp = Math.min(110, d * 2);
  v.flying = d > 1.5;
  if (v.flying) { v.x += dx / d * sp * dt; v.y += dy / d * sp * dt; v.dir = dx > 0 ? 1 : -1; }
  else if (!v.sang) { v.sang = true; sing(v); }
  if (!v.perch && !v.sang && d < 30) { v.sang = true; sing(v); v.leaving = true; }
  if (v.sang && !v.leaving && v.t > v.stay) { v.leaving = true; if (v.perch) v.perch.occupied = false; }
  if (v.leaving && v.t > v.stay + 6) { if (v.perch) v.perch.occupied = false; G.visitor = null; }
}

/* ---------- other hawks ---------- */
export function makeHawk(x, y, kind) {
  const h = createBird(x, y); h.kind = kind; h.life = 0; h.flapT = 0; h.vxs = 0; h.vys = 0; h.scale = kind === 'young' ? .72 : .92;
  return h;
}
// where a companion wants to be: the next thermal ahead if the air is rising, else food or water
function companionGoal(G, h) {
  const b = G.bird, dir = G.goalDir || 1;
  if (W.env.thermal > .3) {
    const th = W.thermalsIn(b.x - 200, b.x + 1600 * dir).filter(t => (t.c - b.x) * dir > -150).sort((a, c) => Math.abs(a.c - b.x) - Math.abs(c.c - b.x))[0];
    if (th) return { x: th.c + Math.sin(G.t * .9) * th.w * .5, y: Math.min(b.y - 30, th.y1 - 60 + Math.sin(G.t * .5) * 40), circle: true };
  }
  if (G.thirst < 55) { const p = W.pondsIn(b.x - 300, b.x + 1500 * dir)[0]; if (p) return { x: p.c, y: p.waterY - 90 }; }
  if (G.hunger < 55) {
    for (const bu of W.bushesIn(b.x, b.x + 1200 * dir)) if (bu.berries.some(be => !G.berryGone(be.id))) return { x: bu.x, y: bu.y - 90 };
  }
  return { x: b.x + dir * 90, y: b.y - 40 + Math.sin(G.t * .7) * 20 };
}
export function updateHawk(G, h, dt) {
  const b = G.bird;
  h.life += dt;
  let T;
  if (h.kind === 'young') T = b.state === 'fly' ? { x: b.x - b.face * 40, y: b.y - 18 + Math.sin(G.t * 1.3) * 8 } : { x: b.x + Math.sin(G.t * .6) * 50, y: b.y - 55 + Math.sin(G.t * .9) * 12, circle: true };
  else if (h.life > 150) T = { x: h.x + h.face * 400, y: h.y - 300 };
  else T = companionGoal(G, h);
  const dx = T.x - h.x, dy = T.y - h.y, d = Math.hypot(dx, dy) || 1;
  const want = Math.min(h.kind === 'young' ? 150 : 115, 30 + d * 1.1);
  h.vxs += (dx / d * want - h.vxs) * Math.min(1, dt * 1.5); h.vys += (dy / d * want - h.vys) * Math.min(1, dt * 1.5);
  h.x += h.vxs * dt; h.y += h.vys * dt;
  const gy = W.groundY(h.x); if (h.y > gy - 30) { h.y = gy - 30; h.vys = Math.min(0, h.vys); }
  if (Math.abs(h.vxs) > 8) { const f = h.vxs > 0 ? 1 : -1; if (f !== h.face && h.turnT <= 0) { h.face = f; h.turnT = .32; } }
  h.s = Math.hypot(h.vxs, h.vys); h.g = Math.atan2(-h.vys, Math.abs(h.vxs) + 1);
  h.circling = !!T.circle; h.air = T.circle ? 30 : 0;
  h.flapT -= dt; if (h.vys < -25 && h.flapT <= 0 && !T.circle) { h.flapLeft = 2; h.flapT = 1.2; }
  h.turnT = Math.max(0, h.turnT - dt);
  pose(h, dt, G);
  return !(h.kind === 'companion' && h.life > 150 && Math.abs(h.x - b.x) > 900);
}
