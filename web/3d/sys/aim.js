// Where the hawk is headed: a thin line along the path it would fly with no change, ending in a
// small ring where that path meets the ground. The line takes the colour of what it is lined up
// with: red for a mouse you are diving at, green for a perch you would land on, faint ink for
// anything else. Tucking the wings to dive focuses it: the line reaches further and darkens.
// Perches ahead are marked with small green rings so you can aim for them; mice are marked red
// only while you dive at one. Aiming is forgiving: a dive leans toward its mouse, and a slow
// approach lined up with a perch is drawn onto it.
import { height, WATER, treesNear, perchesOf, solidsNear } from '../world.js';
import { FLY, fwd } from '../flight.js';
import { clamp, smooth } from '../util.js';

const T = 2.6, STEPS = 16, g = 9.8;
const COL = { prey: [.8, .24, .16], perch: [.28, .64, .34], soft: [.36, .52, .3], fast: [.72, .52, .18], ink: [.2, .18, .16] };

export function aimSystem(G) {
  const b = G.b;
  G.aim = { focus: 0, target: null, impact: null, path: [], perches: [], perch: null, mode: 'ink' };
  G.hud.tip('aim', () => b.state === 'fly' && G.t > 20, 'The line shows where you are headed: red on a mouse you dive at, green on a perch. Tuck your wings to dive and it focuses.');
  // perches in front of the hawk, nearest first (limbs before treetops)
  function perchesAhead() {
    const out = [], f = fwd(b);
    const add = p => {
      const dx = p.x - b.p[0], dy = p.y - b.p[1], dz = p.z - b.p[2], d = Math.hypot(dx, dy, dz);
      if (d < 2 || d > 45 || (dx * f[0] + dz * f[2]) / Math.hypot(dx, dz) < .55 || dy > 6) return;
      out.push({ p, d: d + (p.top ? 4 : 0) });
    };
    for (const t of treesNear(b.p[0], b.p[2], 46)) for (const p of perchesOf(t)) add(p);
    for (const o of solidsNear(b.p[0], b.p[2], 46)) add(o.perch);
    return out.sort((a, q) => a.d - q.d).slice(0, 8).map(o => o.p);
  }
  return {
    id: 'aim',
    update(dt) {
      const A = G.aim;
      A.focus += ((b.state === 'fly' ? b.tuck : 0) - A.focus) * Math.min(1, dt * 5);
      A.path = []; A.impact = null; A.target = null; A.perch = null; A.mode = 'ink';
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
      // perches: lined up if the path passes close to one
      A.perches = b.s < 22 ? perchesAhead() : [];
      let bestP = null, bpd = 1e9;
      for (const q of A.perches) for (const s of A.path) {
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
        if (A.lock && mice.has(A.lock.id) && A.focus > .25 && (!best || bd > 6)) best = A.lock;
        A.target = best; A.lock = A.focus > .25 ? best : null;
        // a pull toward the mouse while diving at it, firmer the tighter the tuck
        if (best && A.focus > .2) {
          const want = Math.atan2(best.x - b.p[0], -(best.z - b.p[2])), dy = Math.atan2(best.y + .3 - b.p[1], Math.hypot(best.x - b.p[0], best.z - b.p[2]));
          const k = Math.min(1, A.focus * dt * 3.4);
          b.yaw += Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)) * k;
          b.gamma += (Math.max(-1.3, dy) - b.gamma) * k;
        }
      }
      if (A.target && A.focus > .25) A.mode = 'prey';
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
      // green rings on the perches ahead; the one you are lined up with is brighter
      for (const q of A.perches || []) {
        const on = q === A.perch, d = Math.hypot(q.x - cam[0], q.y - cam[1], q.z - cam[2]), N = on ? 12 : 8, r = on ? .55 : .4;
        for (let i = 0; i < N; i++) {
          const a = i / N * 6.283 + G.t * (on ? 1.6 : .4);
          S.motes.push(q.x + Math.cos(a) * r, q.y + .12, q.z + Math.sin(a) * r, ...COL.perch, d * (on ? .0036 : .0022));
        }
      }
      if (A.path.length < 2) return;
      // the line: a thin ribbon facing the camera, fading in near the hawk and out at the far end
      const col = COL[A.mode], P = A.path, R = S.ribbon ||= [];
      const strong = A.mode === 'prey' || A.mode === 'perch' ? 1 : .55 + f * .3;
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
      if (A.mode === 'perch' || !c) return;
      const d = Math.hypot(c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]), r = (A.mode === 'prey' ? .9 : 2.2) * (1 - f * .55), N = 16;
      for (let i = 0; i < N; i++) {
        const a = i / N * 6.283 + G.t * (A.mode === 'prey' ? 1.5 : .3), x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r;
        S.motes.push(x, Math.max(height(x, z), WATER) + .15, z, ...col, d * (.003 + f * .003) * (A.mode === 'prey' ? 1.3 : .8));
      }
    },
  };
}
