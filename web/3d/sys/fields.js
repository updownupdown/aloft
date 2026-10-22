// Hunting with your head (round eight A1, A3, A4, A5): clues that tell you where the food is.
// A1 signs to read from the air: a mouse's track across fresh snow to its hole, and the grazed
// rings where hares feed. (Vole runways were removed: James found the pale lines confusing.)
// A3 the hay meadows (each farm's paddock) through the year: short and open in early spring,
// tall by midsummer (a still mouse in it can't be made out), laid flat by a storm, mown in
// autumn with bales left lying. A4 a fox mousing the field edges at dusk and dawn: where it
// pounces there are voles, and now and then it flushes one into the open for you. A5 wary
// fields: let a few mice get away in one meadow and the rest there stay on edge all day.
// Reads the mice from food.js (G.mouseCells, the live ones in G.systems.food.mice); gives it
// G.grassCover and G.wary.
import { height, groundAt, forest, ih, fbm, env, WATER } from '../world.js';
import { settlementsNear } from '../settle.js';
import { builder, blob, reseed } from '../shapes.js';
import { clamp, smooth } from '../util.js';
import { DAY } from '../sky.js';

export const FIELDS = { signs: 130, signsHigh: 260, meadow: 300, misses: 3, fox: 280, foxSpeed: 2.3 };
// each farm's paddock in its own frame (settle.js layout: u along the farm, w across)
const PADDOCK = { u0: -20, u1: 18, w0: -66, w1: -38 };

// ---- shapes ----
// a clump of hay: long thin blades, green at the foot, seed heads at the tips
function hayShape(laid) {
  reseed(laid ? 53 : 51); const B = builder(), g1 = [.6, .66, .36], g2 = [.7, .7, .4], tip = [.86, .78, .5];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * 6.283 + i * .9, r = .05 + (i % 4) * .09, h = .9 + (i % 5) * .1, x = Math.cos(a) * r, z = Math.sin(a) * r, w = .05;
    const lean = laid ? [.95 + (i % 3) * .12, .14, (i % 5 - 2) * .1] : [Math.cos(a) * .16, h, Math.sin(a) * .16];
    const m = [x + lean[0] * .6, lean[1] * .6, z + lean[2] * .6], t = [x + lean[0], lean[1], z + lean[2]];
    B.tri([x - w * Math.sin(a), 0, z + w * Math.cos(a)], [x + w * Math.sin(a), 0, z - w * Math.cos(a)], m, i % 2 ? g1 : g2);
    B.tri([m[0] - w * .8 * Math.sin(a), m[1], m[2] + w * .8 * Math.cos(a)], [m[0] + w * .8 * Math.sin(a), m[1], m[2] - w * .8 * Math.cos(a)], t, tip);
  }
  return B.out();
}
// a round bale of hay lying on its side
function baleShape() {
  const B = builder(), side = [.8, .7, .44], end = [.72, .6, .36], N = 8, r = .7, L = 1.2;
  for (let i = 0; i < N; i++) {
    const a = i / N * 6.283, b = (i + 1) / N * 6.283, p = (q, x) => [x, r + Math.sin(q) * r, Math.cos(q) * r];
    B.tri(p(a, -L / 2), p(b, -L / 2), p(b, L / 2), side); B.tri(p(a, -L / 2), p(b, L / 2), p(a, L / 2), side);
    B.tri([-L / 2, r, 0], p(b, -L / 2), p(a, -L / 2), end); B.tri([L / 2, r, 0], p(a, L / 2), p(b, L / 2), end);
  }
  return B.out();
}
// a red fox, along +x: trotting, or arched in the air for its pounce
function foxShape(pounce) {
  reseed(pounce ? 61 : 59); const B = builder(), fur = [.78, .42, .2], pale = [.92, .86, .76], dark = [.22, .16, .13];
  const lift = pounce ? .25 : 0, tilt = pounce ? -.35 : 0;
  blob(B, 0, .36 + lift, 0, .24, fur, pale, [1.7, .75, .8]);                                    // body
  blob(B, .4, .46 + lift + tilt * -.3, 0, .13, fur, pale, [1.3, .9, .9]);                         // head
  blob(B, .55, .43 + lift + tilt * -.3, 0, .06, fur, pale, [1.6, .7, .7]);                        // muzzle
  for (const s of [-1, 1]) B.tri([.4, .55 + lift, .05 * s], [.44, .55 + lift, .1 * s], [.42, .68 + lift, .07 * s], dark);   // ears
  for (const [x, z] of [[.22, .08], [.22, -.08], [-.2, .08], [-.2, -.08]]) {                       // legs, black socks
    const fx = pounce ? x + (x > 0 ? .22 : -.2) : x, fy = pounce ? lift + .1 : 0;
    B.tri([x - .03, .3 + lift, z], [x + .03, .3 + lift, z], [fx, fy, z], dark); B.tri([x, .3 + lift, z - .03], [x, .3 + lift, z + .03], [fx, fy, z], dark);
  }
  blob(B, -.5, .34 + lift * 1.2, 0, .12, fur, fur, [2.2, .8, .8]);                                 // brush
  blob(B, -.78, .32 + lift * 1.3, 0, .06, pale, pale, [1.4, 1, 1]);                                // its white tip
  return B.out();
}

export function fieldsSystem(G) {
  const b = G.b, R = G.R, H = G.hud;
  R.shape('hay', hayShape(false)); R.shape('hayLaid', hayShape(true)); R.shape('bale', baleShape());
  R.shape('fox', foxShape(false)); R.shape('foxP', foxShape(true));
  G.guide?.page('fox', 'Red fox', 'Hunts voles by ear: it stands stock still, head cocked, then leaps high and comes down on them with its forepaws.');
  const once = (id, msg, secs = 5) => { if (!G.flags[id]) { G.flags[id] = 1; H.toast(msg, secs); } };

  // ---- A3 the hay meadows ----
  const farms = () => settlementsNear(b.p[0], b.p[2], FIELDS.fox + 200, false).filter(S => S.kind === 'farm');
  const frame = S => { const c = Math.cos(S.yaw), s = Math.sin(S.yaw); return { c, s, at: (u, w) => [S.x + c * u - s * w, S.z + s * u + c * w], uw: (x, z) => [c * (x - S.x) + s * (z - S.z), -s * (x - S.x) + c * (z - S.z)] }; };
  let laid = 0, laidYaw = 0;
  // how tall the hay stands (0..1) and whether it is mown, by the season and the day in it
  function hay() {
    const s = G.season || { i: 0, d: 0 }, d = (s.d || 0) + (G.tod || 0);
    if (s.i === 3) return { h: .15 + d / 8 * .5, mown: false };              // spring: short, open, growing
    if (s.i === 0) return { h: .65 + .35 * Math.min(1, d / 3), mown: false };  // summer: tall by midsummer
    if (s.i === 1) return d < 2 ? { h: .95, mown: false } : { h: .18, mown: true };   // autumn: mown after the first days
    return { h: .1, mown: true };                                             // winter: stubble
  }
  const inPaddock = (S, x, z) => { const [u, w] = frame(S).uw(x, z); return u > PADDOCK.u0 && u < PADDOCK.u1 && w > PADDOCK.w0 && w < PADDOCK.w1; };
  // a still mouse in tall standing hay is hidden from the aim (food.js m.cover)
  let near = [], nearAt = null;
  G.grassCover = (x, z) => {
    const H0 = hay(); if (H0.mown || H0.h < .6 || laid > .4) return 0;
    for (const S of near) if (inPaddock(S, x, z)) return H0.h * (1 - laid);
    return 0;
  };

  // ---- A5 wary fields ----
  const meadowKey = (x, z) => Math.floor(x / FIELDS.meadow) * 100003 + Math.floor(z / FIELDS.meadow);
  let misses = new Map(), wary = new Set(), waryDay = 0;
  G.wary = (x, z) => (wary.has(meadowKey(x, z)) ? 1 : 0);
  G.on('escaped', m => {
    if (G.day !== waryDay) { waryDay = G.day; misses.clear(); wary.clear(); }
    const k = meadowKey(m.hx, m.hz), n = (misses.get(k) || 0) + 1; misses.set(k, n);
    if (n === FIELDS.misses) { wary.add(k); H.toast('The mice in this meadow have grown wary: they freeze and dive at the first sign of you. Try another farm.', 5); }
  });
  G.on('newDay', () => { misses.clear(); wary.clear(); });

  // ---- A4 the fox ----
  let fox = null, foxT = 0;
  const mice = () => G.systems.food?.mice;
  function mouseHomesNear(x, z, r) {
    const C = 48, out = [];
    if (!G.mouseCells) return out;
    for (let cz = Math.floor((z - r) / C); cz <= Math.floor((z + r) / C); cz++) for (let cx = Math.floor((x - r) / C); cx <= Math.floor((x + r) / C); cx++)
      for (const m of G.mouseCells(cx, cz)) if (Math.hypot(m.hx - x, m.hz - z) < r) out.push(m);
    return out;
  }
  function spawnFox() {
    const fs = farms().filter(S => Math.hypot(S.x - b.p[0], S.z - b.p[2]) < FIELDS.fox);
    if (!fs.length) return;
    const S = fs[Math.floor(ih(G.day, Math.round(G.tod * 3), 601) * fs.length)], F = frame(S);
    // its round: just outside the paddock fence, corner to corner
    const pad = 2, cs = [[PADDOCK.u0 - pad, PADDOCK.w1 + pad], [PADDOCK.u1 + pad, PADDOCK.w1 + pad], [PADDOCK.u1 + pad, PADDOCK.w0 - pad], [PADDOCK.u0 - pad, PADDOCK.w0 - pad]].map(([u, w]) => F.at(u, w));
    const [x, z] = cs[0];
    fox = { S, cs, leg: 0, x, z, y: groundAt(x, z), yaw: 0, mode: 'trot', t: 6 + Math.random() * 6, from: null, to: null, pounces: 0 };
  }
  function foxStep(dt) {
    const f = fox, hd = Math.hypot(f.x - b.p[0], f.z - b.p[2]);
    // the hawk landing near sends it off at a run, and it doesn't come back tonight
    if (f.mode !== 'flee' && b.state !== 'fly' && hd < 16) { f.mode = 'flee'; f.yaw = Math.atan2(f.z - b.p[2], f.x - b.p[0]); f.t = 8; }
    const go = sp => {
      const nx = f.x + Math.cos(f.yaw) * sp * dt, nz = f.z + Math.sin(f.yaw) * sp * dt;
      if (height(nx, nz) > .8) { f.x = nx; f.z = nz; } else f.yaw += 1.5;
      f.y = groundAt(f.x, f.z);
    };
    if (f.mode === 'flee') { go(7); if ((f.t -= dt) <= 0) fox = null; return; }
    if (f.mode === 'pounce') {
      f.t += dt / 1.1; const k = Math.min(1, f.t);
      f.x = f.from[0] + (f.to[0] - f.from[0]) * k; f.z = f.from[1] + (f.to[1] - f.from[1]) * k;
      f.y = groundAt(f.x, f.z) + Math.sin(k * Math.PI) * 1.3;
      if (k >= 1) {
        f.mode = 'trot'; f.t = 7 + Math.random() * 8; f.pounces++;
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; G.part([f.x, f.y + .2, f.z], [Math.cos(a) * 1.6, 1 + Math.random(), Math.sin(a) * 1.6], .7, [.6, .66, .36], .09); }
        // a vole close by bolts out across the open: your chance
        const M = mice(); let best = null, bd = 7;
        if (M) for (const m of M.values()) { const d = Math.hypot(m.x - f.x, m.z - f.z); if (d < bd && !(m.hidden > 0) && !(m.dig > 0)) { bd = d; best = m; } }
        if (best && Math.random() < .7) { best.flee = 2.6; best.freeze = 0; best.bolt = false; best.seen = 3; best.yaw = Math.atan2(best.x - f.x, -(best.z - f.z)); }
        if (hd < 140) once('fox', 'A fox, mousing along the field edge. Where it pounces there are voles, and sometimes it flushes one into the open.', 6);
      }
      return;
    }
    if (f.mode === 'listen') {
      if ((f.t -= dt) <= 0) { f.mode = 'pounce'; f.t = 0; f.from = [f.x, f.z]; }
      return;
    }
    // trotting the field edge; now and then it stops, listening toward a vole's home, then leaps
    const [tx, tz] = f.cs[(f.leg + 1) % 4];
    f.yaw = Math.atan2(tz - f.z, tx - f.x); go(FIELDS.foxSpeed);
    if (Math.hypot(tx - f.x, tz - f.z) < 1) f.leg = (f.leg + 1) % 4;
    if ((f.t -= dt) <= 0) {
      const homes = mouseHomesNear(f.x, f.z, 9);
      const h = homes[0], a = h ? Math.atan2(h.hz - f.z, h.hx - f.x) : f.yaw + (Math.random() - .5) * 2, r = h ? Math.min(3.5, Math.hypot(h.hz - f.z, h.hx - f.x)) : 2.5;
      f.yaw = a; f.to = [f.x + Math.cos(a) * r, f.z + Math.sin(a) * r]; f.mode = 'listen'; f.t = 1.4 + Math.random();
    }
  }

  // ---- A1 signs ----
  const paths = new Map();   // mouse id -> its snow track (fixed by hash)
  function pathsOf(m) {
    let p = paths.get(m.id); if (p) return p;
    const walk = (x, z, a, n, step, seed) => { const out = [[x, z]]; for (let i = 0; i < n; i++) { a += (ih(m.id, seed + i, 611) - .5) * 1.1; x += Math.cos(a) * step; z += Math.sin(a) * step; out.push([x, z]); } return out; };
    const ta = ih(m.id, 9, 614) * 6.283, track = walk(m.bx + Math.cos(ta) * 9, m.bz + Math.sin(ta) * 9, ta + Math.PI, 7, 1.2, 70);
    track.push([m.bx, m.bz]);
    p = { track }; paths.set(m.id, p); if (paths.size > 600) paths.delete(paths.keys().next().value);
    return p;
  }
  const snowAt = (x, z, y) => { const line = env.snowLine; return smooth(line - 5, line + 25, y + fbm(x / 40, z / 40, 7, 2) * 12); };
  function strip(out, pts, w, col, a) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, sx = -dz / l * w, sz = dx / l * w;
      const y0 = groundAt(x0, z0) + .1, y1 = groundAt(x1, z1) + .1, e = (i === 0 || i === pts.length - 2) ? .5 : 1;
      const v = [[x0 - sx, y0, z0 - sz], [x1 - sx, y1, z1 - sz], [x1 + sx, y1, z1 + sz], [x0 - sx, y0, z0 - sz], [x1 + sx, y1, z1 + sz], [x0 + sx, y0, z0 + sz]];
      for (const q of v) out.push(q[0], q[1], q[2], col[0], col[1], col[2], a * e);
    }
  }
  function ring(out, x, z, r, w, col, a) {
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283, p = (q, rr) => { const px = x + Math.cos(q) * rr, pz = z + Math.sin(q) * rr; return [px, groundAt(px, pz) + .1, pz]; };
      for (const q of [p(a0, r - w), p(a1, r - w), p(a1, r + w), p(a0, r - w), p(a1, r + w), p(a0, r + w)]) out.push(q[0], q[1], q[2], col[0], col[1], col[2], a);
    }
  }

  G.dev?.add({ id: 'r8-signs', title: 'Signs to read: tracks in snow, grazed rings', area: 'Food and water', round: 'R8 A1',
    how: 'Fly 20 to 120 m over open grass near a farm: in snow a track leads to a mouse hole; hares graze rings.', go: () => toFarm(60) });
  G.dev?.add({ id: 'r8-hay', title: 'Hay meadows through the year', area: 'Food and water', round: 'R8 A3',
    how: "Each farm's paddock: short in spring, tall in summer (still mice hide in it), laid flat after a storm, mown with bales in autumn.", go: () => toFarm(30) });
  G.dev?.add({ id: 'r8-fox', title: 'A fox mousing at dusk', area: 'Wildlife', round: 'R8 A4',
    how: 'At dusk or dawn near a farm, a fox trots the paddock edge and pounces where voles are; it can flush one for you.', go: () => { G.tod = .66; toFarm(35); fox = null; foxT = 0; } });
  G.dev?.add({ id: 'r8-wary', title: 'Wary fields', area: 'Food and water', round: 'R8 A5',
    how: 'Let three mice get away in one meadow and the rest there freeze and dive much sooner, until the next day.', go: () => { wary.add(meadowKey(b.p[0], b.p[2])); waryDay = G.day; H.toast('This meadow is wary now (dev).', 2); } });
  function toFarm(up) {
    const S = settlementsNear(b.p[0], b.p[2], 3000, false).filter(S => S.kind === 'farm').sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
    if (!S) { H.toast('No farm within 3 km', 2); return; }
    const [x, z] = frame(S).at(0, -52), [fx, fz] = frame(S).at(0, -52 + 70);   // over the paddock's edge, looking across it
    b.state = 'fly'; b.p = [fx, height(fx, fz) + up, fz]; b.yaw = Math.atan2(x - fx, -(z - fz)); b.s = 10; b.gamma = 0;
  }

  return {
    id: 'fields',
    dbg: () => ({ fox, near: near.length, laid, hay: hay() }),
    update(dt) {
      if (!nearAt || Math.hypot(b.p[0] - nearAt[0], b.p[2] - nearAt[1]) > 40) { near = farms(); nearAt = [b.p[0], b.p[2]]; }
      // a storm lays the standing hay flat; it lifts again over a day or so
      const H0 = hay();
      if ((G.storm || 0) > .6 && !H0.mown && H0.h > .5) { laid = Math.min(1, laid + dt * .5); laidYaw = Math.atan2(.25, 1); }
      else laid = Math.max(0, laid - dt / (DAY * 1.3));
      // the fox: out at dusk and dawn near a farm, not in rain
      const dusk = (G.tod > .64 && G.tod < .8) || (G.tod > .2 && G.tod < .29);
      if (fox) { foxStep(dt); if (fox && (!dusk || Math.hypot(fox.x - b.p[0], fox.z - b.p[2]) > FIELDS.fox + 120)) fox = null; }
      else if (dusk && (G.rain || 0) < .3 && (foxT -= dt) <= 0) { foxT = 20; spawnFox(); }
      if (b.state === 'fly' && near.some(S => inPaddock(S, b.p[0], b.p[2])) && H0.h > .6 && !H0.mown && laid < .4) once('hay', 'Tall hay: a mouse keeping still in it is hidden. Wait for one to move or squeak, or hunt where the grass is short.', 6);
      if (laid > .6) once('hayLaid', 'The storm has laid the hay flat: the mice in it have nowhere to hide for a while.', 5);
    },
    scene(S) {
      const cam = S.cam, above = cam[1] - Math.max(height(cam[0], cam[2]), WATER);
      // the hay and the bales
      const H0 = hay(), snowy = env.snow > .45;
      if (above < 160 && !snowy) for (const F0 of near) {
        if (Math.hypot(F0.x - cam[0], F0.z - cam[2]) > 220) continue;
        const F = frame(F0), turn = G.season?.i === 0 ? smooth(4, 8, (G.season.d || 0)) * .6 : G.season?.i === 1 ? .7 : 0;
        if (H0.h > .2) {
          const P = S.props[laid > .5 ? 'hayLaid' : 'hay'] ||= [], st = 1.6;
          for (let u = PADDOCK.u0 + 1; u < PADDOCK.u1; u += st) for (let w = PADDOCK.w0 + 1; w < PADDOCK.w1; w += st) {
            const j = ih(Math.round(u * 3 + F0.x), Math.round(w * 3 + F0.z), 620), [x, z] = F.at(u + (j - .5) * 1.6, w + (ih(Math.round(u), Math.round(w), 621) - .5) * 1.6);
            if (height(x, z) < 1 || forest(x, z) > .3) continue;
            P.push(x, groundAt(x, z) - .05, z, H0.h * (1 + j * .4), laid > .5 ? F0.yaw + laidYaw + (j - .5) * .5 : j * 6.283, j, turn, 0);
          }
        }
        if (H0.mown && G.season?.i === 1) for (let i = 0; i < 5; i++) {
          const [x, z] = F.at(PADDOCK.u0 + 5 + ih(i, F0.x | 0, 622) * 28, PADDOCK.w0 + 5 + ih(i, F0.z | 0, 623) * 18);
          (S.props.bale ||= []).push(x, groundAt(x, z) - .05, z, 1, ih(i, 3, 624) * 6.283, .5, 0, 0);
        }
      }
      // the fox
      if (fox && Math.hypot(fox.x - cam[0], fox.z - cam[2]) < 260) {
        (S.props[fox.mode === 'pounce' ? 'foxP' : 'fox'] ||= []).push(fox.x, fox.y, fox.z, 1.25, -fox.yaw, .5, 0, 0);
        if (Math.hypot(fox.x - cam[0], fox.z - cam[2]) < 70) G.sight?.('fox', fox.x, fox.y + .4, fox.z, .5);
      }
      // A1 signs: read best from the air, not too high
      if (above > FIELDS.signsHigh) return;
      const vis = smooth(4, 30, above), out = S.surface ||= [], r = FIELDS.signs, C = 48;
      if (G.mouseCells) for (let cz = Math.floor((cam[2] - r) / C); cz <= Math.floor((cam[2] + r) / C); cz++) for (let cx = Math.floor((cam[0] - r) / C); cx <= Math.floor((cam[0] + r) / C); cx++) {
        for (const m of G.mouseCells(cx, cz)) {
          const d = Math.hypot(m.hx - cam[0], m.hz - cam[2]); if (d > r) continue;
          const y = height(m.hx, m.hz), fade = vis * smooth(r, r * .7, d), p = pathsOf(m);
          if (snowAt(m.hx, m.hz, y) > .5) {
            strip(out, p.track, .16, [.48, .55, .68], .6 * fade);
            (S.props.burrow ||= []).push(m.bx, groundAt(m.bx, m.bz) + .02, m.bz, 1.3, 0, .5, 0, 0);
          }
        }
      }
      for (const o of G.prey || []) if (o.kind === 'jackrabbit' || o.kind === 'rabbit' || o.kind === 'marmot') {
        const d = Math.hypot(o.hx - cam[0], o.hz - cam[2]); if (d > r) continue;
        ring(out, o.hx, o.hz, 3.6, .6, [.86, .84, .56], .18 * vis * smooth(r, r * .7, d));
      }
    },
  };
}
