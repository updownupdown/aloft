// Larger life that is only there to be seen: a heron fishing at some ponds that lifts off
// when the hawk comes close, and deer at the forest edge at dawn and dusk that bolt when
// you fly over. Where they stand is a pure function of the world; only what has been
// startled today is kept, in G.fauna.
import { TAU, hash, C, shade } from './util.js';
import * as W from './world.js';
import { wash, stroke, ellP, circP, lift, stamp, put } from './paint.js';
import { timeOfDay } from './songs.js';

export const createFauna = () => ({ herons: new Map(), deer: new Map() });

/* ---------- herons ---------- */
export const heronOf = p => {
  if (hash(p.k * 4.4 + 2) > .32 || p.w < 40) return null;
  const side = hash(p.k * 6.2) < .5 ? -1 : 1;
  return { k: p.k, side, x: side < 0 ? p.x0 + 5 : p.x1 - 5, y: p.waterY + 1 };
};
function updateHerons(G, dt, audio) {
  const b = G.bird, F = G.fauna.herons;
  for (const p of W.pondsIn(G.cam.x - 200, G.cam.x + G.view.w + 200)) {
    if (W.frozen(p)) continue;
    const h = heronOf(p); if (!h) continue;
    const id = p.k + ':' + G.day;
    let st = F.get(id);
    if (!st) {
      const near = Math.abs(b.x - h.x) < 85 && b.y > h.y - 130 && (b.state !== 'fly' || b.s > 55 || b.y > h.y - 60);
      if (near) { st = { t: 0, x: h.x, y: h.y - 6, dir: Math.sign(h.x - b.x) || -h.side, ph: 0 }; F.set(id, st); audio.heron(); }
      continue;
    }
    st.t += dt; st.ph += dt * 5.5;
    // a heavy take-off: a few slow beats climbing away, then it levels out and goes
    const climb = st.t < 3 ? -34 : -8;
    st.x += st.dir * (st.t < 1 ? 20 : 70) * dt; st.y += climb * dt;
  }
  if (F.size > 40) F.clear();
}
function drawHerons(ctx, G, P) {
  const F = G.fauna.herons;
  for (const p of W.pondsIn(G.cam.x - 200, G.cam.x + G.view.w + 200)) {
    if (W.frozen(p)) continue;
    const h = heronOf(p); if (!h) continue;
    const st = F.get(p.k + ':' + G.day);
    if (st) { if (st.t < 14) heronFlying(ctx, st, P, G); continue; }
    const fishing = Math.sin(G.t * .35 + p.k) > .55, face = -h.side;
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(face, 1);
    put(ctx, stamp('heron' + (fishing ? 1 : 0), P.heron.join(), -10, -32, 14, 2, G.view.spx * 1.5, x => {
      const col = P.heron, dk = shade(col, .7);
      stroke(x, [[-1, -11], [-1.5, 0]], dk, .8, .7, 1); stroke(x, [[2, -11], [2.5, 0]], dk, .8, .7, 2);
      wash(x, ellP(0, -14, 7.5, 4.2, -.15), col, .75, { passes: 2, amp: .5, seed: 3, rim: .4 });
      wash(x, [[-6, -14], [-11, -10], [-10.5, -8.5], [-5, -11.5]], dk, .7, { passes: 1, amp: .3, seed: 4, rim: .3 });   // folded wing tips and tail
      // the neck: up and alert, or stretched down over the water
      const neck = fishing ? [[4, -17], [8, -19], [11, -16], [12, -11]] : [[4, -17], [5, -24], [7, -29], [8, -30]];
      stroke(x, neck, col, .8, 2.6, 5); stroke(x, neck, col, .5, 1.6, 6);
      const hx = neck[3][0], hy = neck[3][1];
      wash(x, ellP(hx, hy, 3.2, 1.9, fishing ? .9 : .1), col, .8, { passes: 1, amp: .3, seed: 7, rim: .4 });
      lift(x, ellP(hx - .2, hy + .6, 2.2, .8, fishing ? .9 : .1), P.paper, .5);
      wash(x, [[hx - 1.5, hy - 2.2], [hx + 1.2, hy - 1.4], [hx - 1, hy - .6]], dk, .9, { passes: 1, amp: .1, seed: 8, rim: 0 });   // crest
      const bill = fishing ? [[hx + 1, hy + 1.5], [hx + 3.5, hy + 8]] : [[hx + 2.5, hy], [hx + 9, hy + 1.5]];
      stroke(x, bill, P.beak, .9, 1.1, 9);
      x.fillStyle = C(P.birdFar); x.beginPath(); x.arc(hx + 1.2, hy - .4, .55, 0, TAU); x.fill();
    }));
    ctx.restore();
  }
}
function heronFlying(ctx, st, P, G) {
  const lv = Math.round((Math.sin(st.ph) + 1) * 2), fl = (lv / 2 - 1) * 9;
  ctx.save(); ctx.translate(st.x, st.y); ctx.scale(st.dir, 1);
  put(ctx, stamp('heronfly' + lv, P.heron.join(), -16, -14, 24, 12, G.view.spx * 1.2, x => {
    const col = P.heron, dk = shade(col, .7);
    wash(x, [[2, 0], [-6, -2 - fl], [-14, -5 - fl * 1.2], [-13, -2.5 - fl], [-4, 2]], dk, .6, { passes: 1, amp: .5, seed: 11, rim: .3 });
    wash(x, ellP(0, 1, 7, 3, -.1), col, .75, { passes: 2, amp: .5, seed: 12, rim: .4 });
    stroke(x, [[-5, 3], [-13, 5.5]], dk, .7, .8, 13);   // trailing legs
    // the neck pulled back into an S, the head laid against the shoulders
    stroke(x, [[5, 0], [9, -3], [12, -1]], col, .85, 2.6, 14);
    wash(x, ellP(12.5, -1.5, 3, 1.8, 0), col, .8, { passes: 1, amp: .3, seed: 15, rim: .4 });
    stroke(x, [[15, -1.5], [22, -1]], P.beak, .9, 1.1, 16);
    wash(x, [[3, -1], [-4, -4 - fl * 1.1], [-12, -8 - fl * 1.3], [-11, -5 - fl], [-2, 1]], col, .8, { passes: 1, amp: .5, seed: 17, rim: .4 });
  }));
  ctx.restore();
}

/* ---------- deer ---------- */
const DC = 700;
export const deerOf = i => {
  if (hash(i * 7.7 + 3) > .4) return null;
  const x = i * DC + 80 + hash(i * 2.9) * (DC - 160), bio = W.biomeAt(x).name;
  if (bio !== 'forest' && bio !== 'meadow') return null;
  if (W.pondNear(x, 1.6) || Math.abs(W.groundY(x + 8) - W.groundY(x - 8)) > 6 || W.treesIn(x - 36, x + 36).length) return null;
  return { i, x, y: W.groundY(x), face: hash(i * 5.3) < .5 ? -1 : 1 };
};
const deerOut = G => { const p = timeOfDay(G.tod); return (p === 'dawn' || p === 'dusk') && G.sea.winter < .8 && G.storm < .5; };
function updateDeer(G, dt, audio, once) {
  if (!deerOut(G)) return;
  const b = G.bird, F = G.fauna.deer;
  for (let i = Math.floor((G.cam.x - 200) / DC); i <= Math.ceil((G.cam.x + G.view.w + 200) / DC); i++) {
    const d = deerOf(i); if (!d) continue;
    const id = i + ':' + G.day;
    let st = F.get(id);
    if (!st) {
      const near = Math.abs(b.x - d.x) < 75 && b.y > d.y - 110 && (b.state !== 'fly' || b.s > 45);
      if (near) { st = { t: 0, x: d.x, dir: Math.sign(d.x - b.x) || d.face }; F.set(id, st); audio.snort(); once('deer', 'A deer at the forest edge. They graze at dawn and dusk, and bolt when a hawk sweeps low.'); }
      continue;
    }
    st.t += dt; st.x += st.dir * 95 * dt;
  }
  if (F.size > 40) F.clear();
}
function drawDeer(ctx, G, P) {
  if (!deerOut(G)) return;
  const F = G.fauna.deer, col = P.deer;
  for (let i = Math.floor((G.cam.x - 200) / DC); i <= Math.ceil((G.cam.x + G.view.w + 200) / DC); i++) {
    const d = deerOf(i); if (!d) continue;
    const st = F.get(i + ':' + G.day);
    if (st && st.t > 5) continue;
    let x = d.x, face = d.face, pose, hop = 0;
    if (st) { x = st.x; face = st.dir; pose = 2 + (Math.floor(st.t * 5) % 2); hop = Math.abs(Math.sin(st.t * 7.5)) * 5; }
    else pose = Math.sin(G.t * .22 + i) > .3 ? 0 : 1;   // grazing, or head up listening
    const y = W.groundY(Math.round(x));
    ctx.save(); ctx.translate(x, y - hop); ctx.scale(face, 1);
    put(ctx, stamp('deer' + pose, col.join(), -16, -24, 16, 1, G.view.spx * 1.3, c => {
      const dk = shade(col, .72), run = pose >= 2, a = pose === 3 ? 1 : 0;
      // legs: standing, or stretched fore and aft in a bound
      const legs = run ? [[[-6, -8], [-10 + a * 3, 0]], [[-4, -8], [-7 + a * 2, 0]], [[6, -8], [10 - a * 2, 0]], [[4, -8], [8 - a, 0]]] : [[[-6, -8], [-6.5, 0]], [[-4, -8], [-3.5, 0]], [[5, -8], [5.5, 0]], [[3, -8], [3, 0]]];
      for (const [l, j] of legs.map((l, j) => [l, j])) stroke(c, l, dk, .85, 1.3, 20 + j);
      wash(c, ellP(0, -12, 9.5, 4.6, run ? .08 : 0), col, .8, { passes: 2, amp: .6, seed: 21, rim: .4 });
      lift(c, ellP(1, -10.5, 6, 2, 0), P.paper, .3);   // paler belly
      lift(c, ellP(-8.5, -13, 1.6, 1.8, 0), P.paper, .7);   // white rump
      stroke(c, [[-9.5, -13], [-11.5, -10]], dk, .8, 1, 25);   // tail
      // neck and head: down to graze, or up and alert
      const neck = pose === 0 ? [[7, -13], [12, -8], [14, -3]] : [[7, -14], [10.5, -21], [12, -24]];
      stroke(c, neck, col, .85, 3.2, 26);
      const hx = neck[2][0], hy = neck[2][1], tilt = pose === 0 ? .9 : .15;
      wash(c, ellP(hx + 1.2, hy, 3.4, 1.7, tilt), col, .85, { passes: 1, amp: .3, seed: 27, rim: .4 });
      stroke(c, [[hx - 1, hy - 1.5], [hx - 2.5, hy - 4.5]], dk, .8, .9, 28); stroke(c, [[hx, hy - 1.5], [hx + .5, hy - 4.8]], dk, .8, .9, 29);   // ears
      c.fillStyle = C(P.birdFar, .9); c.beginPath(); c.arc(hx + .4, hy - .3, .5, 0, TAU); c.fill();
      c.fillStyle = C(P.birdFar, .9); c.beginPath(); c.arc(hx + 4 * Math.cos(tilt), hy + 4 * Math.sin(tilt) * .5, .6, 0, TAU); c.fill();   // nose
    }));
    ctx.restore();
  }
}

export function updateFauna(G, dt, { audio, once }) { updateHerons(G, dt, audio); updateDeer(G, dt, audio, once); }
export function drawFauna(ctx, G, P) { drawDeer(ctx, G, P); drawHerons(ctx, G, P); }
