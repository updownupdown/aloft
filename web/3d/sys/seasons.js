// The seasons on the ground, near the hawk: ice along the shallow edges of lakes when it is
// cold, leaf litter under the broadleaves and leaves falling through autumn, blossom petals
// under the trees in spring, and puddles in the hollows after rain. (The trees going bare and
// the snow on their needles are in render.js; the ground's own season colours in world.js.)
// Placed by hash on a grid around the hawk, refreshed when it has moved or the day changes.
import { height, groundAt, groundNormal, treesNear, ih, env } from '../world.js';
import { builder, reseed } from '../shapes.js';

const R = 100, STEP = 5;

// a flat irregular plate (ice, a puddle), unit radius, lying on y = 0
function plate(col, col2, n = 9) {
  reseed(53); const B = builder(), P = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.283, r = .7 + ((i * 37) % 11) / 11 * .4; P.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
  for (let i = 0; i < n; i++) B.tri([0, .01, 0], P[(i + 1) % n], P[i], i % 3 ? col : col2);
  return B.out();
}
// a scatter of flat little leaves or petals on the ground, about 2 m across
function scatter(cols, n, size, seed) {
  reseed(seed); const B = builder();
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r = Math.sqrt(i / n), x = Math.cos(a) * r, z = Math.sin(a) * r, t = i * 1.7, y = .01 + (i % 3) * .004;
    const c = Math.cos(t) * size, s = Math.sin(t) * size;
    B.tri([x - c, y, z - s], [x - s * .45, y + .01, z + c * .45], [x + c, y, z + s], cols[i % cols.length]);
    B.tri([x - c, y, z - s], [x + c, y, z + s], [x + s * .45, y + .01, z - c * .45], cols[(i + 1) % cols.length]);
  }
  return B.out();
}

export function seasonsSystem(G) {
  const b = G.b;
  G.R.shape('ice', plate([.8, .87, .9], [.72, .81, .86]));
  G.R.shape('puddle', plate([.55, .64, .7], [.62, .7, .76], 8));
  G.R.shape('litter', scatter([[.78, .45, .18], [.62, .3, .14], [.86, .64, .26], [.5, .36, .2]], 26, .07, 61));
  G.R.shape('petals', scatter([[.96, .84, .88], [.98, .94, .95], [.9, .72, .8]], 30, .045, 67));
  let from = null, ice = [], litter = [], petals = [], puddles = [], fallers = [];

  function place() {
    const s = G.season || {}, cold = env.snow > .42 && s.name !== 'summer', x0 = b.p[0], z0 = b.p[2];
    ice = []; litter = []; petals = []; puddles = []; fallers = [];
    const wet = (G.wet || 0) > .05 || (G.rain || 0) > .3;
    for (let gz = Math.floor((z0 - R) / STEP); gz <= Math.floor((z0 + R) / STEP); gz++) for (let gx = Math.floor((x0 - R) / STEP); gx <= Math.floor((x0 + R) / STEP); gx++) {
      const x = (gx + .2 + ih(gx, gz, 501) * .6) * STEP, z = (gz + .2 + ih(gx, gz, 502) * .6) * STEP;
      if (Math.hypot(x - x0, z - z0) > R) continue;
      const h = height(x, z);
      // ice: thickest where the water is shallowest, and more of it the colder it gets
      if (cold && h < -.05 && h > -2.2 && ih(gx, gz, 503) < (1 + h / 2.2) * 1.4 * Math.min(1, (env.snow - .4) * 2.5)) ice.push(x, .04, z, 3 + ih(gx, gz, 504) * 2.2, ih(gx, gz, 505) * 6.28, ih(gx, gz, 506), 0, 0);
      // puddles in level hollows while the ground is wet
      else if (wet && h > 1 && ih(gx, gz, 507) < .06 && groundNormal(x, z)[1] > .97) puddles.push(x, groundAt(x, z) + .03, z, .8 + ih(gx, gz, 508) * 1.2, ih(gx, gz, 509) * 6.28, ih(gx, gz, 510), 0, 0);
    }
    // under the broadleaves: litter in autumn (and leaves coming down), petals in spring
    if (s.name === 'autumn' || (s.name === 'spring' && s.d >= 2 && s.d < 6)) {
      for (const t of treesNear(x0, z0, R)) {
        if (!(t.look === 0 || t.look === 2 || (t.look == null && t.kind === 0)) || ih(t.id, 0, 511) > .7) continue;
        for (let k = 0; k < 2; k++) {
          const a = ih(t.id, k, 512) * 6.28, r = t.s * (.08 + ih(t.id, k, 513) * .2), x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
          if (groundNormal(x, z)[1] < .8) continue;
          (s.name === 'autumn' ? litter : petals).push(x, groundAt(x, z), z, 1 + t.s * .06, a * 3, ih(t.id, k, 514), 0, 0);
        }
        if (s.name === 'autumn' && fallers.length < 60 * 4) fallers.push(t.x, t.y + t.s * .6, t.z, t.s);
      }
    }
  }

  return {
    id: 'seasons',
    update() {
      const key = (G.season?.i ?? 0) + ':' + (G.season?.d ?? 0) + ':' + ((G.wet || 0) > .05 || (G.rain || 0) > .3);
      if (!from || from.key !== key || Math.hypot(b.p[0] - from.x, b.p[2] - from.z) > 30) { place(); from = { x: b.p[0], z: b.p[2], key }; }
    },
    scene(S) {
      const add = (name, a) => { if (a.length) (S.props[name] ||= []).push(...a); };
      add('ice', ice); add('puddle', puddles); add('litter', litter); add('petals', petals);
      // a few leaves drifting down from each broadleaf in autumn (the 'leaf' shape is air.js's)
      if (fallers.length) {
        const L = S.props.leaf ||= [], late = .4 + Math.min(1, (G.season?.d || 0) / 6) * .6;
        for (let i = 0; i < fallers.length; i += 4) {
          const [tx, ty, tz, ts] = [fallers[i], fallers[i + 1], fallers[i + 2], fallers[i + 3]], n = ih(i, 0, 520) < late ? 2 : 0;
          for (let k = 0; k < n; k++) {
            const ph = (G.t * .08 + ih(i, k, 521)) % 1, a = ih(i, k, 522) * 6.28, r = ts * .25 + ph * 3;
            const y = ty - ph * ts * .65, sway = Math.sin(G.t * 2 + i + k) * .8;
            L.push(tx + Math.cos(a) * r + sway, y, tz + Math.sin(a) * r, .35, G.t * 2.5 + i + k, ih(i, k, 523), .5, 0);
          }
        }
      }
    },
  };
}
