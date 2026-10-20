// Where the hawk is headed: a faint line of dots along the path it would fly with no change,
// and a small ring where that path meets the ground. Tucking the wings to dive focuses it:
// the dots draw in and darken and the ring tightens. When the ring falls near a mouse it
// settles on it, and while diving the hawk leans gently toward it, so aiming is forgiving.
// The ring turns sage when touching down there would be a soft landing, ochre if fast.
import { height, WATER } from '../world.js';
import { FLY, fwd } from '../flight.js';
import { clamp, smooth } from '../util.js';

const T = 2.6, STEPS = 13, g = 9.8;

export function aimSystem(G) {
  const b = G.b;
  G.aim = { focus: 0, target: null, impact: null };
  G.hud.tip('aim', () => b.state === 'fly' && G.t > 20, 'The faint dots show where you are headed. Tuck your wings to dive and they focus on a spot.');
  return {
    id: 'aim',
    update(dt) {
      const A = G.aim;
      A.focus += ((b.state === 'fly' ? b.tuck : 0) - A.focus) * Math.min(1, dt * 5);
      A.path = []; A.impact = null; A.target = null;
      if (b.state !== 'fly' || b.s < 3) return;
      // fly the path ahead with today's bank and pitch held
      const yawRate = clamp(g * Math.tan(b.roll) / Math.max(b.s, 5), -1.9, 1.9);
      let yaw = b.yaw, p = [...b.p];
      const horizon = T + A.focus * 3.5, n = STEPS + Math.round(A.focus * 10), dt2 = horizon / n;
      for (let i = 1; i <= n; i++) {
        yaw += yawRate * dt2;
        const f = [Math.sin(yaw) * Math.cos(b.gamma), Math.sin(b.gamma), -Math.cos(yaw) * Math.cos(b.gamma)];
        p = [p[0] + f[0] * b.s * dt2, p[1] + (f[1] * b.s + b.lift + b.vy) * dt2, p[2] + f[2] * b.s * dt2];
        const gy = Math.max(height(p[0], p[2]), WATER);
        if (p[1] <= gy + .3) { A.impact = [p[0], gy, p[2]]; break; }
        A.path.push(p);
      }
      // a mouse near where you would come down, or in a narrow cone ahead while diving
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
    },
    scene(S) {
      const A = G.aim; if (!A.path?.length && !A.impact) return;
      const f = A.focus, cam = S.cam, ink = [.24 - f * .08, .15 - f * .06, .1 - f * .04];
      // the dots: very faint and sparse in a glide, firmer when focused
      for (let i = 1; i < A.path.length; i++) {
        const p = A.path[i], d = Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]);
        const fade = smooth(0, 3, i) * (1 - i / (A.path.length + 2) * (1 - f));
        S.motes.push(p[0], p[1], p[2], ...ink, d * (.0035 + f * .003) * fade);
      }
      let c = A.impact;
      if (A.target) c = [A.target.x, A.target.y, A.target.z];
      else if (G.perchMark && b.flare > .3) c = null;   // the perch has its own mark
      if (!c) return;
      const soft = b.s < FLY.landS, col = A.target ? [.66, .32, .2] : soft ? [.36, .52, .3] : [.72, .52, .18];
      const d = Math.hypot(c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]), r = (A.target ? .9 : 2.2) * (1 - f * .55), N = 14;
      for (let i = 0; i < N; i++) {
        const a = i / N * 6.283 + G.t * (A.target ? 1.5 : .3), x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r;
        S.motes.push(x, Math.max(height(x, z), WATER) + .15, z, ...col, d * (.004 + f * .003));
      }
    },
  };
}
