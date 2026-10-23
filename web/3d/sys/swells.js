// Swells and dynamic soaring, the North Pacific's way across (earth.js OCEANS 'soaring'). Long
// rollers run downwind; the wind blowing up each one's face rises off it, so a bird skimming low
// along the windward slope rides on it (env.lifts). Over the swells the wind is slow at the water
// and quick a few metres up: climbing while heading into the wind, or diving while running with
// it, the bird gains airspeed from the change, the albatross's way of crossing an ocean without a
// beat (a weave: up into the wind, turn, down with it, turn). Whitecaps mark the crests near by.
// Other open oceans have a gentler swell and no such wind (SWELL.elsewhere).
import { height, WATER, WIND, env } from '../world.js';
import { oceanAt, toXZ } from '../earth.js';
import { fwd } from '../flight.js';
import { clamp } from '../util.js';

export const SWELL = {
  L: 95, c: 12, A: 1.8,              // wavelength (m), speed downwind (m/s), height of the rise (m)
  lift: 2.6, liftH: 7,               // lift off the windward face at the water, fading by liftH m up
  wind: 9, gradH: 3,                 // the sea wind (m/s, at least) and how quickly it builds with height
  gain: 1.2, lose: .35, top: 30,     // how much of the gradient becomes speed (and is lost the wrong way); no effect above top m
  elsewhere: .35,                    // the swell and its wind over other oceans
};
const WL = Math.hypot(WIND[0], WIND[2]), WX = WIND[0] / WL, WZ = WIND[2] / WL;
const K = 2 * Math.PI / SWELL.L;

export function swellsSystem(G) {
  const b = G.b, H = G.hud;
  let sea = 0, seaT = 0, ocean = null, gainT = 0, said = false;
  // the swell's phase at (x, z): crests where sin = 1
  const phase = (x, z) => (x * WX + z * WZ - SWELL.c * G.t) * K;
  // the swell lifts the air off each windward face (the side the wind meets: the back of the wave)
  env.lifts.push((x, y, z) => {
    if (sea < .01) return 0;
    const agl = y - WATER - SWELL.A * Math.sin(phase(x, z));
    if (agl > SWELL.liftH * 3) return 0;
    const face = Math.max(0, -Math.cos(phase(x, z)));   // rising toward a crest as the wind sees it
    return sea * SWELL.lift * face * Math.exp(-Math.max(0, agl) / SWELL.liftH);
  });
  H.tip('swells', () => b.state === 'fly' && sea > .5 && b.p[1] - WATER < 40,
    'Ocean swells: skim the windward face for lift, then weave: climb turning into the wind, dive turning with it. Each turn gives back speed, the albatross way.');
  G.dev?.add({ id: 'swells', area: 'Flight', round: 'Earth', title: 'Dynamic soaring over the North Pacific swells: lift off swell faces, speed from the wind gradient', how: 'Fly low over the North Pacific: weave up into the wind and down with it. Try it puts you there.',
    go: () => { const [x, z] = toXZ(38, -165); Object.assign(b, { state: 'fly', p: [x, WATER + 12, z], s: 14, vy: 0, gamma: 0, perch: null, tree: null, settle: 0, snapCam: true }); } });

  return {
    id: 'swells',
    update(dt) {
      if ((seaT -= dt) <= 0) {   // which ocean, now and then
        seaT = .5; ocean = oceanAt(b.p[0], b.p[2]);
        const want = !ocean || height(b.p[0], b.p[2]) > WATER - 2 ? 0 : ocean.travel === 'soaring' ? 1 : SWELL.elsewhere;
        sea = want;
      }
      if (b.state !== 'fly' || sea < .01 || !b.prev) return;
      // dynamic soaring: the sea wind grows with height; climbing into it, or diving with it, the
      // bird meets faster air and gains airspeed, the other way round it loses some
      const agl = b.p[1] - WATER;
      if (agl > SWELL.top) return;
      const U = Math.max(SWELL.wind, (G.windK ?? .3) * 6) * sea, grad = U / (Math.max(0, agl) + SWELL.gradH);
      const f = fwd(b), into = -(f[0] * WX + f[2] * WZ) / (Math.hypot(f[0], f[2]) || 1);   // 1 heading into the wind
      const vy = (b.p[1] - b.prev[1]) / Math.max(dt, 1e-3);
      const ds = grad * vy * into * dt * (1 - clamp((agl - SWELL.top * .6) / (SWELL.top * .4), 0, 1));
      b.s = clamp(b.s + (ds > 0 ? ds * SWELL.gain : ds * SWELL.lose), 0, 46);
      gainT = ds > .002 ? gainT + dt : Math.max(0, gainT - dt * .5);
      if (gainT > 1.5 && !said && !G.flags.dynSoar) { said = true; G.flags.dynSoar = 1; H.glint('Dynamic soaring', 'The wind gives you speed as you climb into it: dynamic soaring, the albatross way.', 'glide'); H.did('swells'); }
    },
    scene(S) {
      if (sea < .05) return;
      // whitecaps: broken pale lines along the crests near the bird, moving downwind with them
      const out = S.surface ||= [], cx = b.p[0], cz = b.p[2];
      if (Math.hypot(S.cam[0] - cx, S.cam[2] - cz) > 220 || S.cam[1] - WATER > 400) return;
      const along0 = cx * WX + cz * WZ, cross0 = -cx * WZ + cz * WX, shift = SWELL.c * G.t + SWELL.L / 4;
      const n0 = Math.ceil((along0 - 160 - shift) / SWELL.L), n1 = Math.floor((along0 + 160 - shift) / SWELL.L);
      for (let n = n0; n <= n1; n++) {
        const s = shift + n * SWELL.L;
        for (let cr = Math.floor((cross0 - 150) / 9) * 9; cr < cross0 + 150; cr += 9) {
          const h = Math.sin(cr * .37 + n * 4.1) * .5 + .5; if (h < .35) continue;   // broken: whitecaps come and go along a crest
          const len = 3 + h * 6, a = (.22 + .3 * h) * sea, w = .45 + .5 * h;
          const p0 = [s * WX - cr * WZ, s * WZ + cr * WX], p1 = [s * WX - (cr + len) * WZ, s * WZ + (cr + len) * WX];
          if (height(p0[0], p0[1]) > WATER - 1) continue;
          const y = WATER + .03, nx = WX * w, nz = WZ * w, v = (x, z, al) => out.push(x, y, z, .95, .97, 1, al);
          const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
          v(p0[0], p0[1], 0); v(p1[0], p1[1], 0); v(m[0] - nx, m[1] - nz, a);   // the foam spills down the lee side
          v(p0[0], p0[1], 0); v(p1[0], p1[1], 0); v(m[0] + nx * .4, m[1] + nz * .4, a * .6);
        }
      }
    },
  };
}
