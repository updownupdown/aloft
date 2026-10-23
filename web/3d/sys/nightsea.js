// Night crossings: out of sight of land after dark, steer by the stars. The sky turns about its
// pole, which stands as high above the horizon as you are far from the equator (render.js uPole):
// the pole star due north in the northern half of the world, the Southern Cross pointing to the
// south pole in the other. Skim low over the sea at night and the plankton glows in your wake.
import { height, WATER, latAt, coastDist } from '../world.js';

const MARK = { pole: 2.2, cross: [1.7, 1.2, 1.3, .9] };

export function nightSeaSystem(G) {
  const b = G.b;
  let lat = 0, latM = 0, glowT = 0, glow = [];   // the wake's glow: [x, z, age, life]
  const nrm = v => { const l = Math.hypot(...v) || 1; return v.map(q => q / l); };
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  // the marks in the sky's own frame (the sky turns them with it; render.js)
  function marks(l) {
    const r = l * Math.PI / 180, ax = [0, Math.sin(r), -Math.cos(r)];
    if (l >= 0) return { marks: [...ax, 0, 0, 0, 0, 0, 0, 0, 0, 0], k: [MARK.pole, 0, 0, 0] };
    // the Cross: about 30 degrees from the south pole of the sky, its long arm pointing at it
    const sp = ax.map(q => -q), c0 = nrm([Math.sin(.5), sp[1] * Math.cos(.5), sp[2] * Math.cos(.5)]);
    const e1 = nrm(c0.map((q, i) => q - sp[i] * dot(c0, sp))), e2 = nrm([c0[1] * e1[2] - c0[2] * e1[1], c0[2] * e1[0] - c0[0] * e1[2], c0[0] * e1[1] - c0[1] * e1[0]]);
    const at = (a, c) => nrm(c0.map((q, i) => q + e1[i] * a + e2[i] * c));
    return { marks: [...at(-.05, 0), ...at(.055, 0), ...at(-.005, .04), ...at(.01, -.034)], k: MARK.cross };
  }
  let M = marks(0);
  G.on('wrap', dx => { for (const g of glow) g[0] += dx; });
  G.hud.tip('stars', () => b.state === 'fly' && (G.light.night || 0) > .6 && coastDist(b.p[0], b.p[2]) < -2500,
    'Out of sight of land at night, steer by the stars. North of the equator the pole star stands due north, as high above the sea as you are far from the equator, and the sky turns about it; south of it, the long arm of the Southern Cross points to the south pole of the sky.');
  return {
    id: 'nightsea',
    update(dt) {
      lat = latAt(b.p[0], b.p[2]);
      for (const g of glow) g[2] += dt;
      glow = glow.filter(g => g[2] < g[3]);
      if (Math.abs(lat - latM) > .5 || Math.sign(lat) !== Math.sign(latM)) { latM = lat; M = marks(lat); }
      // the plankton: a glow in the wake, skimming low over the sea at night
      if ((G.light.night || 0) < .5 || b.state !== 'fly' || b.p[1] - WATER > 3.2 || height(b.p[0], b.p[2]) > -1) return;
      glowT += dt * (4 + b.s * 1.2);
      for (; glowT > 1; glowT--) { const s = (Math.random() - .5) * 1.4; if (glow.length < 240) glow.push([b.p[0] + Math.cos(b.yaw) * s, b.p[2] + Math.sin(b.yaw) * s, 0, 2.2 + Math.random() * 1.5]); }
      if (!G.flags.plankton) { G.flags.plankton = 1; G.hud.glint('Plankton', 'The sea glows where you skim it: plankton, lit by your passing.', 'how'); }
    },
    scene(S) {
      const r = lat * Math.PI / 180;
      S.pole = [0, Math.sin(r), -Math.cos(r)];
      S.marks = M.marks; S.markK = M.k;
      // it flares as the wake passes, then fades (on the water, so no particles that fall)
      for (const [x, z, a, l] of glow) { const k = Math.min(1, a * 4) * (1 - a / l); S.motes.push(x, WATER + .05, z, .35 * k, .95 * k, k, .2); }
    },
  };
}
