// Where the hawk is headed: a thin line along the path it would fly with no change, ending in a
// small ring where that path meets the ground. The line takes the colour of what it is lined up
// with: red for a mouse you are diving at, green for a perch you would land on, faint ink for
// anything else. Tucking the wings to dive focuses it: the line reaches further and darkens.
// The three nearest limbs ahead get small pale rings, green on the one you are lined up with;
// mice are marked red only while you dive at one. Perched or standing, the perches a hop away
// get green rings: tap one to hop across. Aiming is forgiving: a dive leans toward its mouse, and a slow
// approach lined up with a perch is drawn onto it.
import { height, WATER, treesNear, perchesOf, solidsNear, ringsNear } from '../world.js';
import { FLY, fwd, hopPerches, hopTo } from '../flight.js';
import { clamp, smooth } from '../util.js';

const T = 2.6, STEPS = 16, g = 9.8;
const COL = { ring: [.3, .58, 1], near: [.9, .9, .84], prey: [.8, .24, .16], perch: [.28, .64, .34], soft: [.36, .52, .3], fast: [.72, .52, .18], ink: [.2, .18, .16] };

// a flat ring lying level (or, with y null, draped on the ground), drawn into the ribbon. With
// tilt it leans up toward the camera so that from level with it, it still reads as a ring
function flatRing(S, x, y, z, r, w, col, a, tilt = 0, N = 28) {
  const R = S.ribbon ||= [], c = S.cam, dh = Math.hypot(c[0] - x, c[2] - z) || 1;
  const tx = (c[0] - x) / dh, tz = (c[2] - z) / dh, ct = Math.cos(tilt), st = Math.sin(tilt);
  const at = (rr, i) => {
    const t = i / N * 6.283, u = Math.cos(t) * rr, v = Math.sin(t) * rr;   // u across the view, v toward the camera
    const px = x + tz * u + tx * v * ct, pz = z - tx * u + tz * v * ct;
    return [px, y == null ? Math.max(height(px, pz), WATER) + .12 : y + v * st, pz, ...col, a];
  };
  for (let i = 0; i < N; i++) {
    const o0 = at(r + w / 2, i), o1 = at(r + w / 2, i + 1), i0 = at(r - w / 2, i), i1 = at(r - w / 2, i + 1);
    R.push(...o0, ...o1, ...i1, ...o0, ...i1, ...i0);
  }
}

export function aimSystem(G) {
  const b = G.b;
  G.aim = { focus: 0, target: null, impact: null, path: [], perches: [], perch: null, mode: 'ink' };
  G.hud.tip('aim', () => b.state === 'fly' && G.t > 20, 'The line shows where you are headed: red on a mouse you dive at, green on a perch. Tuck your wings to dive and it focuses.');
  // tap a hop ring (on screen, within a thumb's width) to hop to it
  G.input.onTap = (x, y) => {
    const hs = G.aim.hops; if (!hs?.length || !G.R.vp || G.menu?.open) return false;
    const m = G.R.vp, W = innerWidth, H = innerHeight; let best = null, bd = Math.min(W, H) * .09;
    for (const h of hs) {
      const p = h.p, X = m[0] * p.x + m[4] * (p.y + .12) + m[8] * p.z + m[12], Y = m[1] * p.x + m[5] * (p.y + .12) + m[9] * p.z + m[13], w = m[3] * p.x + m[7] * (p.y + .12) + m[11] * p.z + m[15];
      if (w < .3) continue;
      const d = Math.hypot((X / w * .5 + .5) * W - x, (.5 - Y / w * .5) * H - y);
      if (d < bd) { bd = d; best = h; }
    }
    return !!best && hopTo(b, best, G.E);
  };
  // perches in front of the hawk, nearest first (limbs and stone tops, never treetops)
  function perchesAhead() {
    const out = [], f = fwd(b);
    const add = p => {
      const dx = p.x - b.p[0], dy = p.y - b.p[1], dz = p.z - b.p[2], d = Math.hypot(dx, dy, dz);
      if (d < 2 || d > 45 || (dx * f[0] + dz * f[2]) / Math.hypot(dx, dz) < .55 || dy > 6) return;
      out.push({ p, d });
    };
    for (const t of treesNear(b.p[0], b.p[2], 46)) for (const p of perchesOf(t)) if (!p.top) add(p);
    for (const o of solidsNear(b.p[0], b.p[2], 46)) add(o.perch);
    return out.sort((a, q) => a.d - q.d).slice(0, 8).map(o => o.p);
  }
  return {
    id: 'aim',
    update(dt) {
      const A = G.aim;
      A.focus += ((b.state === 'fly' ? b.tuck : 0) - A.focus) * Math.min(1, dt * 5);
      A.path = []; A.impact = null; A.target = null; A.perch = null; A.ring = null; A.mode = 'ink';
      A.hops = b.state !== 'fly' && b.settle <= 0 && !(b.eating > 0) && !G.menu?.open ? hopPerches(b) : [];
      if (b.state !== 'fly' || b.s < 3) { A.perches = []; return; }
      // fly the path ahead with today's bank and pitch held
      const yawRate = clamp(g * Math.tan(b.roll) / Math.max(b.s * (1 - .65 * b.tuck), 5), -1.9, 1.9);
      let yaw = b.yaw, p = [...b.p];
      const horizon = T + A.focus * 3.5, n = STEPS + Math.round(A.focus * 10), dt2 = horizon / n;
      A.path.push([...p]);
      for (let i = 1; i <= n; i++) {
        yaw += yawRate * dt2;
        const f = [Math.sin(yaw) * Math.cos(b.gamma), Math.sin(b.gamma), -Math.cos(yaw) * Math.cos(b.gamma)];
        p = [p[0] + f[0] * b.s * dt2, p[1] + (f[1] * b.s + b.lift + b.vy) * dt2, p[2] + f[2] * b.s * dt2];
        const gy = Math.max(height(p[0], p[2]), WATER);
        if (p[1] <= gy + .3) { A.impact = [p[0], gy, p[2]]; A.path.push([p[0], gy + .3, p[2]]); break; }
        A.path.push(p);
      }
      // perches: lined up if the path passes close to one (of the nearest few, the three ringed)
      const ahead = b.s < 22 ? perchesAhead() : [];
      let bestP = null, bpd = 1e9;
      for (const q of ahead) for (const s of A.path) {
        const d = Math.hypot(s[0] - q.x, s[1] - q.y - .2, s[2] - q.z);
        if (d < 4.5 && d < bpd) { bpd = d; bestP = q; }
      }
      // a mouse near where you would come down, or in a cone ahead while diving
      const mice = G.systems.food?.mice;
      if (mice) {
        let best = null, bd = 1e9; const f = fwd(b);
        for (const m of mice.values()) {
          const dx = m.x - b.p[0], dy = m.y - b.p[1], dz = m.z - b.p[2], d = Math.hypot(dx, dy, dz);
          if (d > 90 || d < 1) continue;
          const nearImpact = A.impact ? Math.hypot(m.x - A.impact[0], m.z - A.impact[2]) : 1e9;
          const cone = (dx * f[0] + dy * f[1] + dz * f[2]) / d;
          const score = nearImpact < 8 + A.focus * 10 ? nearImpact : cone > .92 - A.focus * .14 ? 20 + (1 - cone) * 100 : 1e9;
          if (score < bd) { bd = score; best = m; }
        }
        // keep a mouse you are already diving at, unless it gets well away from the line
        // (with some give: once locked, a looser tuck keeps it, so a wobble doesn't drop it)
        const hold = A.lock ? .12 : .25;
        if (A.lock && mice.has(A.lock.id) && A.focus > hold && (!best || bd > 6)) best = A.lock;
        A.target = best; A.lock = A.focus > hold ? best : null;
        // a pull toward the mouse while diving at it, firmer the tighter the tuck
        if (best && A.focus > .2) {
          const want = Math.atan2(best.x - b.p[0], -(best.z - b.p[2])), dy = Math.atan2(best.y + .3 - b.p[1], Math.hypot(best.x - b.p[0], best.z - b.p[2]));
          const k = Math.min(1, A.focus * dt * 3.4);
          b.yaw += Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)) * k;
          b.gamma += (Math.max(-1.3, dy) - b.gamma) * k;
        }
      }
      A.perches = ahead.slice(0, 3);
      if (bestP && !A.perches.includes(bestP)) A.perches[2] = bestP;
      // a ring the path flies through (crosses its plane inside its radius): blue
      const live = G.systems.rings?.live;
      for (const r of ringsNear(b.p[0], b.p[2], 80)) {
        if (live && !live(r)) continue;
        const nx = -Math.sin(r.yaw), nz = Math.cos(r.yaw);
        for (let i = 1; i < A.path.length && !A.ring; i++) {
          const p0 = A.path[i - 1], p1 = A.path[i], d0 = (p0[0] - r.x) * nx + (p0[2] - r.z) * nz, d1 = (p1[0] - r.x) * nx + (p1[2] - r.z) * nz;
          if (Math.sign(d0) === Math.sign(d1)) continue;
          const t = d0 / (d0 - d1), q = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t];
          if (Math.hypot(q[0] - r.x, q[1] - r.y, q[2] - r.z) < r.r * .9) A.ring = r;
        }
        if (A.ring) break;
      }
      if (A.target && A.focus > .25) A.mode = 'prey';
      else if (A.ring) A.mode = 'ring';
      else if (bestP) {
        A.mode = 'perch'; A.perch = bestP;
        // slow and lined up: drawn gently onto it
        if (b.s < FLY.landS + 5) {
          const want = Math.atan2(bestP.x - b.p[0], -(bestP.z - b.p[2])), k = Math.min(1, dt * (1.2 + b.flare * 1.5));
          b.yaw += Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)) * k;
          const hd = Math.hypot(bestP.x - b.p[0], bestP.z - b.p[2]), dy = Math.atan2(bestP.y + .4 - b.p[1], Math.max(hd, 1));
          b.gamma += (clamp(dy, -.6, .4) - b.gamma) * k * .6;
        }
      } else if (A.impact) A.mode = b.s < FLY.landS ? 'soft' : 'fast';
    },
    scene(S) {
      const A = G.aim, cam = S.cam, f = A.focus;
      // rings on the nearest perches ahead, green on the one you are lined up with; perched, green
      // rings on the perches a hop away
      const ring = (q, on, col, k = 1) => flatRing(S, q.x, q.y + .1, q.z, (on ? .55 : .4) * k * (1 + Math.sin(G.t * 4) * (on ? .06 : 0)), (on ? .14 : .1) * k, col, on ? .95 : .55, .7);
      for (const q of A.perches || []) ring(q, q === A.perch && A.mode === 'perch', q === A.perch && A.mode === 'perch' ? COL.perch : COL.near);
      for (const h of A.hops || []) ring(h.p, true, COL.perch, 1.6);   // bigger: they are to be tapped
      if (A.path.length < 2) return;
      // the line: a thin ribbon facing the camera, fading in near the hawk and out at the far end
      const col = COL[A.mode], P = A.path, R = S.ribbon ||= [];
      const strong = A.mode === 'prey' || A.mode === 'perch' || A.mode === 'ring' ? 1 : .55 + f * .3;
      let prev = null;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)];
        const dir = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], to = [cam[0] - p[0], cam[1] - p[1], cam[2] - p[2]];
        let sx = dir[1] * to[2] - dir[2] * to[1], sy = dir[2] * to[0] - dir[0] * to[2], sz = dir[0] * to[1] - dir[1] * to[0];
        const sl = Math.hypot(sx, sy, sz) || 1, w = Math.hypot(...to) * (.0016 + f * .0008);
        sx *= w / sl; sy *= w / sl; sz *= w / sl;
        const t = i / (P.length - 1), a = smooth(0, .12, t) * (1 - t * .6) * .75 * strong;
        const L = [p[0] - sx, p[1] - sy, p[2] - sz, ...col, a], Rr = [p[0] + sx, p[1] + sy, p[2] + sz, ...col, a];
        if (prev) R.push(...prev[0], ...prev[1], ...Rr, ...prev[0], ...Rr, ...L);
        prev = [L, Rr];
      }
      // where it ends: a ring on the ground, on the mouse, or nothing (the perch has its own)
      let c = A.impact;
      if (A.mode === 'prey') c = [A.target.x, A.target.y, A.target.z];
      if (A.mode === 'perch' || A.mode === 'ring' || !c) return;
      const prey = A.mode === 'prey', r = (prey ? 1.1 : 2.2) * (1 - f * .55) * (prey ? 1 + Math.sin(G.t * 6) * .08 : 1);
      flatRing(S, c[0], prey ? c[1] + .12 : null, c[2], r, prey ? .22 : .12 + f * .1, col, prey ? .9 : .5 + f * .3);
    },
  };
}
