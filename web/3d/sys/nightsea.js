// Night crossings: out of sight of land after dark, steer by the stars. The sky turns about its
// pole, which stands as high above the horizon as you are far from the equator (render.js uPole):
// the pole star due north in the northern half of the world, the Southern Cross pointing to the
// south pole in the other (the real stars, stars.js). Look at a constellation for a moment and
// its stars brighten, with faint lines between them. Skim low over the sea at night and the
// plankton glows in your wake.
import { height, WATER, latAt, coastDist } from '../world.js';
import { CONSTELLATIONS, CENTRES, SPANS, skyDir } from '../stars.js';

// gaze: how long to look before a constellation lights, how fast it comes and goes (s), and how
// near the middle of the view it must be (radians, on top of its own size)
const GAZE = { hold: 1.6, rise: 1.4, fall: 3, near: .2 };

export function nightSeaSystem(G) {
  const b = G.b;
  let lat = 0, glowT = 0, glow = [];   // the wake's glow: [x, z, age, life]
  const gaze = new Float32Array(CONSTELLATIONS.length), held = new Float32Array(CONSTELLATIONS.length);
  const named = new Set();
  let lastT = 0;
  G.on('wrap', dx => { for (const g of glow) g[0] += dx; });
  G.hud.tip('stars', () => b.state === 'fly' && (G.light.night || 0) > .6 && coastDist(b.p[0], b.p[2]) < -2500,
    'Out of sight of land at night, steer by the stars. North of the equator the pole star stands due north, as high above the sea as you are far from the equator, and the sky turns about it; south of it, the long arm of the Southern Cross points to the south pole of the sky.');
  // which constellation is in the middle of the view, above the horizon, on a clear night
  function lookUp(S) {
    const dt = Math.min(.1, Math.max(0, S.time - lastT)); lastT = S.time;
    const f = [S.look[0] - S.cam[0], S.look[1] - S.cam[1], S.look[2] - S.cam[2]], fl = Math.hypot(...f) || 1;
    let pick = -1, best = 1;
    if ((S.night || 0) > .5 && (S.overcast || 0) < .5) for (let i = 0; i < CENTRES.length; i++) {
      const c = skyDir(CENTRES[i], S.pole, S.starA || 0); if (c[1] < .1) continue;
      const a = Math.acos(Math.min(1, (f[0] * c[0] + f[1] * c[1] + f[2] * c[2]) / fl)) / (GAZE.near + SPANS[i] * .6);
      if (a < best) { best = a; pick = i; }
    }
    let any = false;
    for (let i = 0; i < gaze.length; i++) {
      held[i] = i === pick ? held[i] + dt : 0;
      gaze[i] = held[i] > GAZE.hold ? Math.min(1, gaze[i] + dt / GAZE.rise) : Math.max(0, gaze[i] - dt / GAZE.fall);
      if (gaze[i] > 0) any = true;
      if (gaze[i] > .6 && !named.has(i)) { named.add(i); G.hud.name(CONSTELLATIONS[i].name, 'sleep'); }
    }
    S.gaze = any ? gaze : null;
  }
  return {
    id: 'nightsea',
    update(dt) {
      lat = latAt(b.p[0], b.p[2]);
      for (const g of glow) g[2] += dt;
      glow = glow.filter(g => g[2] < g[3]);
      // the plankton: a glow in the wake, skimming low over the sea at night
      if ((G.light.night || 0) < .5 || b.state !== 'fly' || b.p[1] - WATER > 3.2 || height(b.p[0], b.p[2]) > -1) return;
      glowT += dt * (4 + b.s * 1.2);
      for (; glowT > 1; glowT--) { const s = (Math.random() - .5) * 1.4; if (glow.length < 240) glow.push([b.p[0] + Math.cos(b.yaw) * s, b.p[2] + Math.sin(b.yaw) * s, 0, 2.2 + Math.random() * 1.5]); }
      if (!G.flags.plankton) { G.flags.plankton = 1; G.hud.glint('Plankton', 'The sea glows where you skim it: plankton, lit by your passing.', 'how'); }
    },
    scene(S) {
      const r = lat * Math.PI / 180;
      S.pole = [0, Math.sin(r), -Math.cos(r)];
      lookUp(S);
      // it flares as the wake passes, then fades (on the water, so no particles that fall)
      for (const [x, z, a, l] of glow) { const k = Math.min(1, a * 4) * (1 - a / l); S.motes.push(x, WATER + .05, z, .35 * k, .95 * k, k, .2); }
    },
  };
}
