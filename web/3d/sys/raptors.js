// The river of raptors (round eight F1): one day each autumn, hundreds of broad-winged hawks
// stream south past you, kettle after kettle. In each kettle they circle up a strong thermal
// together; from its top they peel off in a long line and glide down to the next, 700 m on.
// Join them: the kettles lift you as well, and the glide line between them carries a gentle
// lift of its own, so the miles south go by in company.
// Each hawk follows one path (climb the kettle, glide to the next) at its own place along it, so
// the stream is a pure function of time; only those near the camera are drawn.
import { height, env, ih, WATER } from '../world.js';
import { smooth, clamp } from '../util.js';
import { broadwing } from './critshapes.js';

export const RAPTORS = {
  gap: 700, per: 34, cycle: 95, climb: .58,   // metres between kettles, hawks per kettle, seconds a hawk takes kettle to kettle, share of it spent climbing
  low: 120, high: 430, r: 44, lift: 4.6, line: .7,   // kettle bottom and top over the ground, its radius and lift; the glide line's lift
  near: 1700, day: [.3, .68],
};

export function raptorsSystem(G) {
  const b = G.b, H = G.hud;
  G.R.shape('broadwing', broadwing());
  G.guide?.page('broadwing', 'Broad-winged hawk', 'Crosses a continent each autumn in flocks of thousands, circling up one thermal after another and gliding on south.');
  const once = (id, msg, secs = 5) => { if (!G.flags[id]) { G.flags[id] = 1; H.toast(msg, secs); } };
  let force = 0, lane = null;   // lane: { x, day } the line of the stream this day

  // the day: one in each autumn (the year's eight days), by hash; daytime only
  const theDay = () => {
    const s = G.season || {};
    if (force === G.day) return true;
    return s.i === 1 && (s.d || 0) === 1 + Math.floor(ih(Math.floor((G.day - 1) / 32), 0, 703) * 5);
  };
  const on = () => theDay() && G.tod > RAPTORS.day[0] && G.tod < RAPTORS.day[1];
  // kettle c sits at z = c * gap on the lane, wandering a little east and west
  const kettle = c => { const x = lane.x + (ih(c, lane.day, 704) - .5) * 260, z = c * RAPTORS.gap, g = Math.max(height(x, z), WATER); return { x, z, g }; };
  // where hawk i is now: climbing kettle c in a spiral, or gliding from its top to the next
  function hawkAt(i, t) {
    const p = t / RAPTORS.cycle + i / RAPTORS.per, c = Math.floor(p), f = p - c, k0 = kettle(c);
    const r = RAPTORS.r * (.45 + .55 * ih(i, 1, 705)), dh = (ih(i, 2, 706) - .5) * 40;
    if (f < RAPTORS.climb) {
      const u = f / RAPTORS.climb, a = u * 6.283 * 5 + ih(i, 3, 707) * 6.283 * (ih(i, 4, 708) < .5 ? 1 : -1);
      return { p: [k0.x + Math.cos(a) * r, k0.g + RAPTORS.low + (RAPTORS.high - RAPTORS.low) * u + dh, k0.z + Math.sin(a) * r], yaw: a + Math.PI / 2 };
    }
    const k1 = kettle(c + 1), u = (f - RAPTORS.climb) / (1 - RAPTORS.climb), side = (ih(i, 5, 709) - .5) * 30;
    const y0 = k0.g + RAPTORS.high + dh, y1 = k1.g + RAPTORS.low + dh;
    return { p: [k0.x + (k1.x - k0.x) * u + side, y0 + (y1 - y0) * u, k0.z + (k1.z - k0.z) * u], yaw: Math.atan2(k1.z - k0.z, k1.x - k0.x) };
  }
  // the kettles' strong thermals near the hawk, and a gentle lift down each glide line
  function kettlesNear() {
    const out = [], c0 = Math.floor((b.p[2] - 1500) / RAPTORS.gap), c1 = Math.floor((b.p[2] + 1500) / RAPTORS.gap);
    for (let c = c0; c <= c1; c++) { const k = kettle(c); out.push({ x: k.x, z: k.z, r: RAPTORS.r * 1.2, w: RAPTORS.lift, top: k.g + RAPTORS.high + 40, id: 6e7 + c, kettle: true, until: G.t + 3 }); }
    return out;
  }
  env.lifts.push((x, y, z) => {
    if (!lane || !on()) return 0;
    const c = Math.floor(z / RAPTORS.gap), k0 = kettle(c), k1 = kettle(c + 1), u = clamp((z - k0.z) / (k1.z - k0.z), 0, 1);
    const lx = k0.x + (k1.x - k0.x) * u, ly = k0.g + RAPTORS.high + (k1.g + RAPTORS.low - k0.g - RAPTORS.high) * u;
    return RAPTORS.line * smooth(70, 20, Math.abs(x - lx)) * smooth(90, 30, Math.abs(y - ly));
  });

  G.dev?.add({ id: 'r8-raptors', title: 'River of raptors', area: 'Wildlife', round: 'R8 F1', how: 'One autumn day a year, daytime: hundreds of hawks stream south in kettles. Ride their thermals and glide south with them.',
    go: () => { force = G.day; lane = null; if (!on()) G.tod = .4; } });

  return {
    id: 'raptors',
    update() {
      if (!on()) { lane = null; return; }
      // the stream passes within sight of wherever you were when it began
      if (!lane || lane.day !== G.day) lane = { x: Math.round(b.p[0] / 50) * 50 + (ih(G.day, 1, 710) - .5) * 500, day: G.day };
      env.thermals = env.thermals.filter(t => !t.kettle).concat(kettlesNear());
      if (Math.abs(b.p[0] - lane.x) < 600) once('raptors' + Math.floor((G.day - 1) / 32), 'A river of raptors: hundreds of hawks streaming south, kettle after kettle. Join a kettle and glide on with them.', 7);
      if (b.inThermal && b.p[1] - height(b.p[0], b.p[2]) > 80 && Math.abs(b.p[0] - lane.x) < 200) once('raptorsJoin' + G.day, 'You circle up among them, wingtip to wingtip. From the top, follow their line south.', 5);
    },
    scene(S) {
      if (!lane || !on()) return;
      const cam = S.cam, P = S.props.broadwing ||= [], N = RAPTORS.near;
      if (Math.abs(cam[0] - lane.x) > N + 300) return;
      const t = G.clock, base = t / RAPTORS.cycle;
      const c0 = Math.floor((cam[2] - N) / RAPTORS.gap) - 1, c1 = Math.floor((cam[2] + N) / RAPTORS.gap);
      for (let c = c0; c <= c1; c++) {
        const i0 = Math.ceil((c - base) * RAPTORS.per), i1 = Math.floor((c + 1 - base) * RAPTORS.per);
        for (let i = i0; i <= i1; i++) {
          const h = hawkAt(i, t), d = Math.hypot(h.p[0] - cam[0], h.p[2] - cam[2]);
          if (d > N) continue;
          P.push(h.p[0], h.p[1], h.p[2], 1.6 + d / 160, h.yaw, .5, 0, 0);   // larger with distance, so a kettle reads as a swirl of birds, not specks
          if (d < 90) G.sight?.('broadwing', h.p[0], h.p[1], h.p[2], .9);
        }
      }
    },
  };
}
