// Larger life that is only there to be seen: a heron fishing at some ponds that lifts off
// when the hawk comes close, deer at the forest edge at dawn and dusk that bolt when
// you fly over, and squirrels in the broadleaf trees that scold you from the trunk. Where they stand is a pure function of the world; only what has been
// startled today is kept, in G.fauna.
import { TAU, hash, C, shade } from './util.js';
import * as W from './world.js';
import { wash, stroke, strokes, ellP, circP, lift, stamp, put } from './paint.js';
import { timeOfDay } from './songs.js';
import { sight } from './guide.js';

export const createFauna = () => ({ herons: new Map(), deer: new Map(), squirrels: new Map() });

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
    sight(G, 'heron', h.x, h.y - 12, 22);
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
    if (!st) sight(G, 'deer', x, y - 8, 22);
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

/* ---------- squirrels ---------- */
// Some broadleaf trees have a squirrel. Its day is a loop of time: forage in the grass by the
// tree, dash to the trunk, climb to a branch and sit, then back down. A hawk coming close
// sends it up the trunk, scolding, to hide in the leaves for a while.
export const squirrelTree = t => !t.ever && t.type !== 3 && t.bio !== 'marsh' && t.bio !== 'cliffs' && hash(t.i * 13.1 + 2) < .3;
const squirrelsOut = G => G.storm < .6 && G.tod > .24 && G.tod < .78;
export function squirrelPos(t, G) {
  const per = 18 + 8 * hash(t.i), u = ((G.t + hash(t.i * 3) * per) % per) / per, side = hash(t.i * 5.7) < .5 ? -1 : 1;
  const trunk = t.x + side * Math.max(2, t.h * .035), br = t.branches[0];
  const sit = { x: t.x + br.x1 * .45 + t.lean * -br.y0, y: t.y + br.y0 + (br.y1 - br.y0) * .45 - 1.3 };
  const fx = t.x + side * (16 + 12 * Math.sin(G.t * .5 + t.i)), up = t.y - t.h * .36;
  if (u < .45) { const run = Math.sin(G.t * 1.7 + t.i) > .2; return { x: fx, y: W.groundY(fx), pose: run ? 1 : 0, dir: Math.cos(G.t * .5 + t.i) > 0 ? side : -side }; }
  if (u < .52) { const k = (u - .45) / .07, x = fx + (trunk - fx) * k; return { x, y: W.groundY(x), pose: 1, dir: Math.sign(trunk - fx) || 1 }; }
  if (u < .62) { const k = (u - .52) / .1; return { x: trunk, y: t.y + (up - t.y) * k, pose: 2, dir: side }; }
  if (u < .66) { const k = (u - .62) / .04, x = trunk + (sit.x - trunk) * k; return { x, y: up + (sit.y - up) * k, pose: 1, dir: Math.sign(sit.x - trunk) || 1 }; }
  if (u < .88) return { x: sit.x, y: sit.y, pose: 0, dir: Math.sin(G.t * .3 + t.i) > 0 ? 1 : -1 };
  if (u < .92) { const k = (u - .88) / .04, x = sit.x + (trunk - sit.x) * k; return { x, y: sit.y + (up - sit.y) * k, pose: 1, dir: Math.sign(trunk - sit.x) || 1 }; }
  const k = (u - .92) / .08; return { x: trunk, y: up + (t.y - up) * k, pose: 3, dir: side };
}
function updateSquirrels(G, dt, audio, once) {
  if (!squirrelsOut(G)) return;
  const b = G.bird, F = G.fauna.squirrels;
  for (const t of W.treesIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
    if (!squirrelTree(t)) continue;
    const st = F.get(t.i);
    if (st) { if (G.t - st.t0 > 24) F.delete(t.i); continue; }
    const q = squirrelPos(t, G), d = Math.hypot(q.x - b.x, q.y - b.y);
    if (d < 70 && (b.state !== 'fly' || b.s > 40)) {
      F.set(t.i, { t0: G.t, x: q.x, y: q.y, top: t.y - t.h * .74, trunk: t.x + (q.x < t.x ? -1 : 1) * Math.max(2, t.h * .035) });
      audio.chatter?.(); once('squirrel', 'A squirrel, scolding you from the trunk. They come back down once the coast is clear.');
    }
  }
  if (F.size > 60) F.clear();
}
function drawSquirrels(ctx, G, P) {
  if (!squirrelsOut(G)) return;
  const F = G.fauna.squirrels, col = P.squirrel;
  for (const t of W.treesIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
    if (!squirrelTree(t)) continue;
    const st = F.get(t.i);
    let q, alpha = 1;
    if (st) {
      // a dash to the trunk and straight up into the leaves, then gone
      const e = G.t - st.t0;
      if (e < .35) q = { x: st.x + (st.trunk - st.x) * e / .35, y: st.y, pose: 1, dir: Math.sign(st.trunk - st.x) || 1 };
      else { const k = Math.min(1, (e - .35) / 1.2); q = { x: st.trunk, y: st.y + (st.top - st.y) * k, pose: 2, dir: 1 }; alpha = 1 - Math.max(0, (e - 1.6) / .6); }
      if (alpha <= 0) continue;
    } else q = squirrelPos(t, G);
    const flick = q.pose === 0 && Math.sin(G.t * 9 + t.i) > .85 ? 1 : 0;
    if (q.pose === 0) sight(G, 'squirrel', q.x, q.y + 2, 11);
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1.25, 1.25);
    if (q.pose >= 2) ctx.rotate(q.pose === 2 ? -Math.PI / 2 : Math.PI / 2); else ctx.scale(q.dir, 1);
    put(ctx, stamp('squirrel' + Math.min(q.pose, 2) + flick, col.join(), -12, -13, 7, 2, G.view.spx * 2, c => {
      const dk = shade(col, .72);
      if (q.pose === 0) {
        // sitting up, the tail curled up its back like a question mark
        wash(c, [[-1.4, -.5], [-4.2, -3], [-4.6 - flick, -7.5], [-3.6 - flick, -10.5], [-1.4 - flick * .5, -11], [-1.6, -9], [-3, -7.4], [-2.6, -3.6], [-.2, -1.6]], col, .7, { passes: 2, amp: .3, seed: 41 + flick, rim: .35 });
        wash(c, ellP(.2, -3.4, 2.1, 3, -.25, 12), col, .82, { passes: 2, amp: .25, seed: 42, rim: .4 });
        lift(c, ellP(1, -3.2, 1, 2, -.25, 10), P.paper, .45);
        wash(c, circP(1.4, -6.9, 1.6, 10), col, .85, { passes: 2, amp: .2, seed: 43, rim: .4 });
        wash(c, [[.6, -8.2], [.4, -9.6], [1.4, -8.4]], dk, .85, { passes: 1, amp: .1, seed: 44, rim: 0 });
        stroke(c, [[1.4, -4.4], [2.5, -5.2]], dk, .8, .6, 45);   // paws held up
        c.fillStyle = C(P.birdFar); c.beginPath(); c.arc(2, -7.2, .35, 0, TAU); c.fill();
        return;
      }
      // running (or climbing, turned upright): stretched out, the tail streaming behind
      wash(c, [[-2.4, -1.6], [-6, -3], [-9.6, -6.2], [-11, -9.4], [-8.6, -8.6], [-6.6, -5.6], [-2.8, -3.2]], col, .65, { passes: 2, amp: .3, seed: 46, rim: .35 });
      wash(c, ellP(0, -1.9, 3.4, 1.7, -.08, 12), col, .82, { passes: 2, amp: .25, seed: 47, rim: .4 });
      wash(c, circP(3.4, -2.6, 1.5, 10), col, .85, { passes: 2, amp: .2, seed: 48, rim: .4 });
      wash(c, [[2.8, -3.8], [2.6, -5.1], [3.6, -4]], dk, .85, { passes: 1, amp: .1, seed: 49, rim: 0 });
      strokes(c, [[[2, -.8], [3.2, .4]], [[-2, -.8], [-3.4, .3]]], dk, .8, .6, 50);
      c.fillStyle = C(P.birdFar); c.beginPath(); c.arc(4, -2.9, .33, 0, TAU); c.fill();
    }), alpha);
    ctx.restore();
  }
}

export function updateFauna(G, dt, { audio, once }) { updateHerons(G, dt, audio); updateDeer(G, dt, audio, once); updateSquirrels(G, dt, audio, once); }
export function drawFauna(ctx, G, P) { drawDeer(ctx, G, P); drawHerons(ctx, G, P); drawSquirrels(ctx, G, P); }
