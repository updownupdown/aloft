// Migration night. Hawks travel by day and roost at night, but most songbirds migrate in the
// dark. On clear nights in autumn and spring, a hawk awake on its perch hears thousands of thin
// flight calls passing overhead, and sees tiny shapes crossing the moon.
import { TAU, clamp, hash, C } from './util.js';
import { nightness } from './palette.js';

export const createNight = () => ({ birds: [], callT: 2, next: 0 });
export const migrating = G => nightness(G.tod) > .5 && Math.max(G.sea.autumn, G.sea.spring) > .4 && G.overcast < .45 && G.storm < .3 && !G.roost;
// the moon's place on the screen, as render.js's celestial() puts it
export function moonAt(G, w, h) {
  const a = ((G.tod + .25) % 1) / .5;
  if (a < 0 || a > 1) return null;
  return { x: w * (.08 + .84 * a), y: h * .7 - Math.sin(a * Math.PI) * h * .58, r: 10 };
}

// the calls: a thrush's thin buzzy "zeep", a warbler's high "tsip", a sparrow's "seet", a
// veery's falling "veer": each one short and soft, from somewhere overhead
const CALLS = [
  A => A.tone?.({ f: 6800, f2: 8200, dur: .07, vol: .025, type: 'sine' }),
  A => A.tone?.({ f: 7600, f2: 7000, dur: .05, vol: .022, type: 'sine', vib: 400, vibF: 90 }),
  A => A.tone?.({ f: 5200, f2: 6400, dur: .12, vol: .02, type: 'triangle', vib: 250, vibF: 70 }),
  A => A.tone?.({ f: 3200, f2: 2400, dur: .22, vol: .02, type: 'sine', vib: 60, vibF: 40 }),
];

export function updateNight(G, dt, { audio, once }) {
  const N = G.night, { w, h } = G.view.scr, on = migrating(G), dir = G.sea.spring > G.sea.autumn ? -1 : 1;
  if (on) {
    if ((N.callT -= dt) <= 0) {
      // a flurry at times, then a lull
      N.callT = Math.random() < .25 ? .08 + Math.random() * .2 : .4 + Math.random() * 1.6;
      CALLS[(Math.random() * CALLS.length) | 0](audio);
      if (G.bird.state === 'perch') once('nightmig', 'Listen: songbirds migrate at night. Those thin calls are thousands of them passing overhead, and you can see them cross the moon.', 6);
    }
    if ((N.next -= dt) <= 0) {
      N.next = .3 + Math.random() * 1.2;
      const m = moonAt(G, w, h), overMoon = m && Math.random() < .35;
      const y = overMoon ? m.y + (Math.random() - .5) * m.r * 1.6 : 8 + Math.random() * h * .45;
      N.birds.push({ x: dir > 0 ? -8 : w + 8, y, v: (overMoon ? 20 : 14 + Math.random() * 14) * dir, ph: Math.random() * TAU, s: .5 + Math.random() * .5, dy: (Math.random() - .5) * 3 });
    }
  }
  for (const b of N.birds) { b.x += b.v * dt; b.y += b.dy * dt; b.ph += dt * 14; }
  N.birds = N.birds.filter(b => b.x > -12 && b.x < w + 12);
}
// tiny dark shapes on the sky layer (screen space), drawn after the moon so they cross in front
export function drawNight(ctx, G, P) {
  const N = G.night; if (!N.birds.length) return;
  const night = nightness(G.tod);
  ctx.save(); ctx.strokeStyle = C(P.birdFar, .75 * night); ctx.lineCap = 'round';
  for (const b of N.birds) {
    const f = Math.sin(b.ph) * 1.1 * b.s, sz = 1.6 * b.s + .6;
    ctx.lineWidth = .45 + .25 * b.s;
    ctx.beginPath(); ctx.moveTo(b.x - sz, b.y - f); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + sz, b.y - f); ctx.stroke();
  }
  ctx.restore();
}
