// Landmarks drawn in the world (where they stand is world.js landmarksNear): standing stones,
// cairns, a ruined tower, the lighthouse on the sea cliffs (dark now, like every lamp: nobody
// keeps it; the farms and villages are sys/ruins.js), and
// waterfalls spilling over the cliffs with mist at their feet. The giant oaks and willows are
// trees (world.js treesIn). Finding them and the journal belong to journey.js.
import { landmarksNear, rocksNear, fencesNear, brookOf, height, height0, WATER, PAL, GROUND, GROUND_SET, setGroundDetail } from '../world.js';
import { store } from '../util.js';
import { builder, blob, prism, tube, reseed, rnd } from '../shapes.js';

const STONE = [.6, .59, .56], STONE2 = [.5, .5, .49], WEAR = [.44, .42, .39];

function stones() {
  reseed(61); const B = builder();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.283, h = 2.6 + (i * 37 % 10) / 10 * 1.8, x = Math.cos(a) * 8, z = Math.sin(a) * 8;
    prism(B, x, z, .55, .42, -.4, h, 7, i % 3 ? STONE : STONE2);
  }
  prism(B, 0, 0, .9, .8, -.3, .5, 8, WEAR);     // the low altar stone
  return B.out();
}
function cairn() {
  reseed(62); const B = builder();
  for (let i = 0; i < 6; i++) blob(B, Math.sin(i * 2.1) * .2, .35 + i * .42, Math.cos(i * 1.7) * .2, .75 - i * .09, STONE, STONE2, [1, .6, 1], 2);
  return B.out();
}
function tower() {
  reseed(63); const B = builder(), N = 9, W = [.66, .62, .56], D = [.4, .37, .34];
  for (let i = 0; i < N; i++) {
    const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283, h = 22 - (i * 5 % 7) * 1.6 - (i > 5 ? 6 : 0);
    const p = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    for (const r of [4, 3.3]) { B.tri(p(a0, r, -.5), p(a1, r, -.5), p(a1, r * .92, h), r > 3.5 ? W : D); B.tri(p(a0, r, -.5), p(a1, r * .92, h), p(a0, r * .92, h), r > 3.5 ? W : D); }
    B.tri(p(a0, 3.68, h), p(a1, 3.68, h), p(a1, 3.03, h), W); B.tri(p(a0, 3.68, h), p(a1, 3.03, h), p(a0, 3.03, h), W);
    // the wall's broken ends, closing the gap between its faces where the next piece stands lower
    for (const a of [a0, a1]) { B.tri(p(a, 4, -.5), p(a, 3.68, h), p(a, 3.3, -.5), W); B.tri(p(a, 3.3, -.5), p(a, 3.68, h), p(a, 3.03, h), W); }
    if (i % 3 === 1) { const y = 9 + i; B.tri(p(a0 + .2, 4.02, y), p(a0 + .3, 4.02, y), p(a0 + .3, 4.02, y + 2), D); B.tri(p(a0 + .2, 4.02, y), p(a0 + .3, 4.02, y + 2), p(a0 + .2, 4.02, y + 2), D); }
  }
  return B.out();
}
function lighthouse() {
  reseed(64); const B = builder(), white = [.86, .84, .78], red = [.62, .28, .22], dark = [.2, .2, .22], glass = [.2, .25, .28], gone = [.07, .08, .09];
  const bands = [[-1, 5, white], [5, 9, red], [9, 15, white], [15, 19, red]];
  for (const [y0, y1, c] of bands) prism(B, 0, 0, 3.2 - y0 * .04, 3.2 - y1 * .04, y0, y1, 10, c);
  prism(B, 0, 0, 3.3, 3.2, -1, .8, 10, WEAR);                  // weathered dark round its foot
  prism(B, 0, 0, 2.8, 2.8, 19, 19.6, 10, dark);                // the gallery
  // the lantern, long dark: dull panes, two of them broken out
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283, b = (i + 1) / 8 * 6.283, P = (t, y) => [Math.cos(t) * 1.6, y, Math.sin(t) * 1.6], col = i === 2 || i === 5 ? gone : glass;
    B.tri(P(a, 19.6), P(b, 19.6), P(b, 22), col); B.tri(P(a, 19.6), P(b, 22), P(a, 22), col);
  }
  prism(B, 0, 0, 1.9, .2, 22, 24.5, 8, dark);                  // the cap
  return B.out();
}
// a waterfall: a ribbon of white water laid over the cliff face from the lip downhill, built
// once per waterfall from the ground's own profile (local coordinates, +x downhill)
// out: how far the curtain hangs clear of the face down the sheer part (a ledge behind it, sys/hidden.js)
function fallsMesh(l, out = 0) {
  const B = builder(), W = [.86, .92, .95], W2 = [.76, .86, .92], w = l.w || 3.2, pts = [];
  let s = -3, y0 = height0(l.x - l.dx * 3, l.z - l.dz * 3);
  pts.push([s, y0 + .5]);
  for (s = 0; s < 120; s += 1.5) {
    const y = height0(l.x + l.dx * s, l.z + l.dz * s);
    pts.push([s + (out && y0 - y >= 1 ? out : 0), y + .7]);
    if (s > 6 && y0 - y < 1) break;     // the fall has reached the bottom: it runs out flat
    y0 = y;
  }
  const yTop = pts[0][1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, ya] = pts[i], [b, yb] = pts[i + 1], ww = w * (1 + i * .02);
    B.tri([a, ya - yTop, -ww], [b, yb - yTop, -ww], [b, yb - yTop, ww], i & 1 ? W : W2);
    B.tri([a, ya - yTop, -ww], [b, yb - yTop, ww], [a, ya - yTop, ww], i & 1 ? W2 : W);
  }
  brook(B, l, yTop, w);
  return { tris: B.out(), top: yTop, foot: [l.x + l.dx * pts[pts.length - 1][0], l.z + l.dz * pts[pts.length - 1][0]] };
}
// what feeds a fall (James 10-28: never a fall from nowhere): its brook (world.js brookOf) back from the lip to the
// spring pool it rises from (local coordinates as fallsMesh)
function brook(B, l, yTop, w) {
  const C = [.5, .66, .74], C2 = [.58, .73, .8], P = brookOf(l);
  const loc = (px, pz) => { const X = px - l.x, Z = pz - l.z; return [l.dx * X + l.dz * Z, -l.dz * X + l.dx * Z]; };
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, az, ay] = P[i], [bx, bz, by] = P[i + 1], k = i / P.length, wa = w * (.8 - .45 * k), wb = w * (.8 - .45 * (i + 1) / P.length);
    const [a0, a1] = loc(ax, az), [b0, b1] = loc(bx, bz), tx = b0 - a0, tz = b1 - a1, tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
    const A = [a0 + nx * wa, ay + .22 - yTop, a1 + nz * wa], A2 = [a0 - nx * wa, ay + .22 - yTop, a1 - nz * wa];
    const Bq = [b0 + nx * wb, by + .22 - yTop, b1 + nz * wb], B2 = [b0 - nx * wb, by + .22 - yTop, b1 - nz * wb];
    B.tri(A, Bq, B2, i & 1 ? C : C2); B.tri(A, B2, A2, i & 1 ? C2 : C);
  }
  // the spring's pool, level, at the brook's head (sunk a little so its rim meets the ground)
  const [hx, hz, hy] = P[P.length - 1], [c0, c1] = loc(hx, hz), r = l.part ? 0 : Math.min(3.2 + w * .5, Math.hypot(c0, c1) - 1.5);
  if (r) { const yp = hy + .18 - yTop, n = 9; for (let i = 0; i < n; i++) { const a = i / n * 6.283, b = (i + 1) / n * 6.283; B.tri([c0, yp, c1], [c0 + Math.cos(b) * r, yp, c1 + Math.sin(b) * r], [c0 + Math.cos(a) * r, yp, c1 + Math.sin(a) * r], i & 1 ? C : C2); } }
}

// rocks of the open country (world.js rocksNear), all unit height: a granite tor of stacked
// slabs, a red hoodoo (a stepped pillar with a pale cap stone), a lumpy boulder
function tor() {
  reseed(65); const B = builder(), g = PAL.granite, g2 = [.52, .51, .5];
  prism(B, 0, 0, .75, .66, -.1, .3, 10, g); prism(B, .05, .02, .62, .55, .3, .55, 10, g2);
  prism(B, -.04, .03, .5, .42, .55, .78, 8, g); prism(B, .02, -.02, .36, .3, .78, 1, 8, g2);
  return B.out();
}
function hoodoo() {
  reseed(66); const B = builder(), r = PAL.redrock, o = PAL.ochre;
  prism(B, 0, 0, .3, .2, -.05, .35, 10, r); prism(B, 0, 0, .2, .14, .35, .62, 10, o); prism(B, 0, 0, .15, .12, .62, .88, 10, r);
  prism(B, .02, 0, .28, .22, .88, 1, 10, PAL.buff);
  return B.out();
}
function boulder() {
  reseed(67); const B = builder();
  blob(B, 0, .3, 0, .5, PAL.granite, [.55, .55, .53], [1.1, .9, .9], 2);
  return B.out();
}

// a lava rock: a dark, sharp lump
function lava() {
  reseed(68); const B = builder();
  blob(B, 0, .3, 0, .5, PAL.lava, PAL.lava2, [1.2, .8, 1], 2);
  return B.out();
}
// a natural arch (world.js archLegs: legs .42 either side of the middle, the span on top to .85)
function arch() {
  reseed(69); const B = builder(), r = PAL.redrock, o = PAL.ochre;
  for (const k of [-1, 1]) { prism(B, .42 * k, 0, .15, .12, -.1, .3, 10, r); prism(B, .42 * k, 0, .12, .11, .3, .6, 10, o); }
  const P = t => [Math.cos(t) * .42, .58 + Math.sin(t) * .22, 0];
  for (let i = 0; i < 9; i++) { const a = Math.PI * i / 9, b = Math.PI * (i + 1) / 9; tube(B, P(a), P(b), .1 - Math.sin(a) * .02, i % 3 ? r : o); }
  blob(B, 0, .82, 0, .1, PAL.buff, o, [2.4, .5, 1.1], 2);
  return B.out();
}
// a sea stack (the landmark): a stout mass of rock the sea cut off the cliff, in uneven tiers that
// lean and step in, ledges for the seabirds, a cap of turf
function stack() {
  reseed(70); const B = builder(), dark = [.42, .4, .37];
  prism(B, 0, 0, .34, .3, -.05, .2, 9, dark); prism(B, .02, .01, .3, .26, .2, .45, 9, PAL.rock);
  prism(B, .05, -.02, .25, .21, .45, .7, 8, PAL.granite); prism(B, .07, -.01, .2, .17, .7, .95, 8, PAL.rock);
  blob(B, -.16, .24, .14, .16, PAL.rock, dark, [1, 1.3, 1], 1); blob(B, .2, .12, -.12, .14, dark, dark, [1.1, 1, 1], 1);
  blob(B, .07, .95, -.01, .17, PAL.moss, PAL.moss, [1, .3, 1], 1);
  return B.out();
}
// a skerry: a low hump of rock just off the shore (unit height, about four times as wide), dark and
// wet at its foot where the sea washes it
function skerry() {
  reseed(71); const B = builder(), dark = [.38, .37, .35], wet = [.3, .31, .3];
  blob(B, 0, .3, 0, .6, PAL.rock, dark, [2.4, 1.1, 1.7], 1);
  blob(B, .6, .22, .4, .45, PAL.granite, dark, [1.7, 1, 1.4], 1);
  blob(B, -.7, .15, -.3, .4, dark, wet, [1.8, .9, 1.3], 1);
  blob(B, .2, .62, -.15, .3, PAL.rock2, PAL.rock, [2.2, 1.3, 1.6], 1);
  return B.out();
}

// ---- old human traces (no people) ----
// a box from its middle bottom, l long (along x), h high, w wide, turned a
function box(B, x, y, z, l, h, w, a, col, top = col) {
  const c = Math.cos(a), s = Math.sin(a), P = (u, v, t) => [x + c * u - s * t, y + v, z + s * u + c * t];
  const q = (p0, p1, p2, p3, k) => { B.tri(p0, p1, p2, k); B.tri(p0, p2, p3, k); };
  const L = l / 2, W = w / 2;
  q(P(-L, 0, -W), P(L, 0, -W), P(L, h, -W), P(-L, h, -W), col); q(P(L, 0, W), P(-L, 0, W), P(-L, h, W), P(L, h, W), col);
  q(P(-L, 0, W), P(-L, 0, -W), P(-L, h, -W), P(-L, h, W), col); q(P(L, 0, -W), P(L, 0, W), P(L, h, W), P(L, h, -W), col);
  q(P(-L, h, -W), P(L, h, -W), P(L, h, W), P(-L, h, W), top);
}
// a fire lookout: four splayed legs with braces, a cabin with a pyramid roof and a railed walk
// an old mine on a hillside (+x downhill): the adit's timber mouth into the slope, a headframe with its
// wheel over the shaft, a tin-roofed shed, the tip of grey spoil down the slope, ore carts on a rail
function mine() {
  reseed(83); const B = builder(), T = [.42, .34, .26], T2 = [.34, .27, .2], SP = [.5, .48, .45], SP2 = [.44, .42, .4], TIN = [.5, .38, .3], RAIL = [.3, .26, .22];
  // the adit: posts and a lintel, dark inside, the hill's rock round it
  for (const w of [-1.4, 1.4]) box(B, -4, -1, w, .4, 4.2, .4, 0, T);
  box(B, -4, 3, 0, .5, .5, 3.6, 0, T2); box(B, -4.5, -1, 0, .3, 4, 2.4, 0, [.06, .06, .06]);
  blob(B, -6, 1, 0, 3.5, [.46, .44, .4], [.4, .38, .35], [1, 1, 1.4], 1);
  // the rail and a cart out to the tip
  for (const w of [-.5, .5]) box(B, 3, -.1, w, 14, .15, .12, 0, RAIL);
  box(B, 5, .2, 0, 1.6, 1, 1.1, 0, [.36, .3, .26]);
  // the headframe: an A of timber over the shaft, the wheel at the top
  for (const [a, b] of [[[-1.6, 0, -1.6], [-.4, 12, -.4]], [[1.6, 0, -1.6], [.4, 12, -.4]], [[-1.6, 0, 1.6], [-.4, 12, .4]], [[1.6, 0, 1.6], [.4, 12, .4]], [[4.5, 0, 0], [.3, 11, 0]]])
    tube(B, [a[0] + 1, a[1] - .5, a[2] - 5], [b[0] + 1, b[1], b[2] - 5], .2, T);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, c = i / 12 * 6.283 + .52; tube(B, [1 + Math.cos(a) * 1.4, 12 + Math.sin(a) * 1.4, -5], [1 + Math.cos(c) * 1.4, 12 + Math.sin(c) * 1.4, -5], .09, T2); }
  // the shed
  box(B, 1, -.5, 5, 6, 3.4, 4, 0, [.46, .4, .34], TIN);
  B.tri([-2, 2.9, 3], [4, 2.9, 3], [4, 4.2, 5], TIN); B.tri([-2, 2.9, 3], [4, 4.2, 5], [-2, 4.2, 5], TIN); B.tri([4, 2.9, 7], [-2, 2.9, 7], [-2, 4.2, 5], TIN); B.tri([4, 2.9, 7], [-2, 4.2, 5], [4, 4.2, 5], TIN);
  // the spoil tip, down the slope
  blob(B, 13, -1, 0, 5.5, SP, SP2, [1.5, .6, 1.1], 1); blob(B, 18, -3, 2, 4, SP2, SP, [1.3, .5, 1], 1);
  return B.out();
}
function lookout() {
  reseed(82); const B = builder(), wood = [.5, .42, .33], wood2 = [.42, .35, .28], cab = [.62, .55, .44], win = [.3, .35, .4], roof = [.36, .3, .26];
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [i, j] of legs) tube(B, [i * 2.6, -.5, j * 2.6], [i * 1.5, 14, j * 1.5], .14, wood);
  for (let k = 0; k < 4; k++) {
    const [i, j] = legs[k], [i2, j2] = legs[(k + 1) % 4];
    for (const y of [3.5, 7.5, 11]) { const r = 2.6 - y / 14.5 * 1.1; tube(B, [i * r, y, j * r], [i2 * r, y, j2 * r], .07, wood2); }
    tube(B, [i * 2.4, 1.5, j * 2.4], [i2 * 1.8, 9.5, j2 * 1.8], .05, wood2);
  }
  box(B, 0, 13.8, 0, 4.6, .25, 4.6, 0, wood);       // the walk
  box(B, 0, 14.05, 0, 3.2, 2.4, 3.2, 0, cab, wood); // the cabin
  for (let k = 0; k < 4; k++) box(B, Math.cos(k * 1.5708) * 1.62, 14.9, Math.sin(k * 1.5708) * 1.62, .05, 1, 2.2, k * 1.5708, win);
  for (let k = 0; k < 4; k++) { const [i, j] = legs[k], [i2, j2] = legs[(k + 1) % 4]; B.tri([i * 2.25, 16.4, j * 2.25], [i2 * 2.25, 16.4, j2 * 2.25], [0, 17.8, 0], k & 1 ? roof : [.3, .25, .22]); }
  for (let k = 0; k < 4; k++) { const [i, j] = legs[k], [i2, j2] = legs[(k + 1) % 4]; tube(B, [i * 2.25, 15, j * 2.25], [i2 * 2.25, 15, j2 * 2.25], .04, wood2); }
  return B.out();
}
// one run of fence or wall, built once along the ground (coordinates from its first post)
function fenceMesh(f) {
  reseed(85); const B = builder(), [ox, , oz] = f.posts[0], P = f.posts.map(([x, y, z, h]) => [x - ox, y, z - oz, h]);
  if (f.kind === 'fence') {
    const wood = [.46, .4, .32], wood2 = [.38, .32, .26], wire = [.44, .3, .22];
    P.forEach(([x, y, z], i) => prism(B, x, z, .08, .065, y - .3, y + 1.3 - (i % 3) * .06, 5, i & 1 ? wood : wood2));
    for (let i = 0; i + 1 < P.length; i++) for (const h of [.55, 1.05]) {
      const [x0, y0, z0] = P[i], [x1, y1, z1] = P[i + 1];
      B.tri([x0, y0 + h, z0], [x1, y1 + h, z1], [x1, y1 + h - .03, z1], wire); B.tri([x0, y0 + h, z0], [x1, y1 + h - .03, z1], [x0, y0 + h - .03, z0], wire);
    }
  } else {
    // dry stone, laid in uneven courses to the height at each post (world.js), with stones fallen
    // off the low, tumbled stretches lying in the grass on either side
    const st = [.58, .56, .52], st2 = [.5, .49, .46], st3 = [.64, .62, .57], moss = [.44, .42, .39], cols = [st, st2, st3];
    let n = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const [x0, y0, z0, h0] = P[i], [x1, y1, z1, h1] = P[i + 1], a = Math.atan2(z1 - z0, x1 - x0), L = Math.hypot(x1 - x0, z1 - z0);
      const sx = -Math.sin(a), sz = Math.cos(a);
      for (let k = 0; k < 5; k++) {
        const t = (k + .5) / 5, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - .15;
        const top = (h0 + (h1 - h0) * t) * (.85 + rnd() * .3) + .15;
        // courses: big footing stones, then smaller ones, each a little off line
        let yy = y, c = 0;
        while (yy < y + top - .08 && c < 4) {
          const ch = Math.min(y + top - yy, .2 + rnd() * .16), w = .62 - c * .1, off = (rnd() - .5) * .08;
          box(B, x + sx * off, yy, z + sz * off, L / 5 * (.75 + rnd() * .45), ch, w, a + (rnd() - .5) * .25, cols[n++ % 3], (n % 4) ? cols[n % 3] : moss);
          yy += ch * .96; c++;
        }
      }
      // fallen stones beside the low stretches
      const low = Math.min(h0, h1) < .4 ? 4 : rnd() < .25 ? 1 : 0;
      for (let k = 0; k < low; k++) {
        const t = rnd(), side = rnd() < .5 ? -1 : 1, d = .6 + rnd() * 1.4, x = x0 + (x1 - x0) * t + sx * side * d, z = z0 + (z1 - z0) * t + sz * side * d;
        box(B, x, y0 + (y1 - y0) * t - .12, z, .3 + rnd() * .25, .16 + rnd() * .12, .22 + rnd() * .2, rnd() * 6.28, cols[n++ % 3], (n % 3) ? cols[n % 3] : moss);
      }
    }
  }
  return { tris: B.out(), at: f.posts[0] };
}

export function landsSystem(G) {
  const R = G.R;
  // Settings > Ground detail: Low, Medium or High facets (GROUND); a pick rebuilds the ground
  G.menu.choice('play', { label: 'Ground detail', options: GROUND.map(g => [g[0], g[1]]), get: () => GROUND_SET,
    sub: n => `The ground's facets: ${GROUND.find(g => g[0] === n)?.[2] ?? ''}`,
    set: n => { setGroundDetail(n); store.set('ground', n); R.dropChunks(); } });
  // Settings > Graphics (G.gfx level 0..2) picks the ground too, until the row above is used
  G.on('gfx', lv => {
    if (store.get('ground', null) !== null) return;
    const n = [16, 32, 32][lv] ?? 32; if (n !== GROUND_SET) { setGroundDetail(n); R.dropChunks(); }
  });
  R.shape('lm_stones', stones()); R.shape('lm_cairn', cairn()); R.shape('lm_tower', tower()); R.shape('lm_lighthouse', lighthouse());
  R.shape('rock_tor', tor()); R.shape('rock_hoodoo', hoodoo()); R.shape('rock_boulder', boulder());
  R.shape('rock_lava', lava()); R.shape('rock_arch', arch()); R.shape('rock_stack', stack()); R.shape('rock_skerry', skerry());
  R.shape('lm_lookout', lookout()); R.shape('lm_mine', mine());
  const fenceOf = new Map();   // run id -> { shape, at }
  const fenceShape = f => {
    let m = fenceOf.get(f.id);
    if (!m) { m = fenceMesh(f); m.shape = 'fence_' + f.id; R.shape(m.shape, m.tris); fenceOf.set(f.id, m); }
    return m;
  };
  const fallsOf = new Map();   // landmark id -> { shape, top, foot }
  const fall = l => { const out = G.hidden?.curtain(l) || 0, k = l.id + (out ? 'c' : ''); let f = fallsOf.get(k); if (!f) { f = fallsMesh(l, out); f.shape = 'lm_falls_' + k; R.shape(f.shape, f.tris); fallsOf.set(k, f); } return f; };
  let near = [], rocks = [], fences = [], nearT = 0;
  return {
    id: 'lands',
    update(dt) {
      if ((nearT -= dt) <= 0) { nearT = 1; near = landmarksNear(G.b.p[0], G.b.p[2], 700); rocks = rocksNear(G.b.p[0], G.b.p[2], 520); fences = fencesNear(G.b.p[0], G.b.p[2], 330); }
      // the fire mountain smokes from its cone
      for (const l of near) if (l.kind === 'volcano' && Math.hypot(l.x - G.b.p[0], l.z - G.b.p[2]) < 900 && Math.random() < dt * 10) {
        const a = Math.random() * 6.283, r = Math.random() * 6;
        G.part([l.x + Math.cos(a) * r, l.y + 1, l.z + Math.sin(a) * r], [(Math.random() - .5) * 2 + 1.5, 4 + Math.random() * 3, (Math.random() - .5) * 2], 6, Math.random() < .3 ? [.45, .42, .4] : [.85, .84, .82], 1.5 + Math.random() * 1.5);
      }
      // spray and mist at the foot of each waterfall close by
      for (const l of near) if (l.kind === 'falls' && Math.hypot(l.x - G.b.p[0], l.z - G.b.p[2]) < 220 && Math.random() < dt * 14) {
        const [bx, bz] = fall(l).foot, by = Math.max(height(bx, bz), WATER) + .4;
        G.part([bx + (Math.random() - .5) * 3, by, bz + (Math.random() - .5) * 3], [(Math.random() - .5) * 2, 1 + Math.random() * 2, (Math.random() - .5) * 2], 1.4, [.92, .95, .97], .25);
      }
    },
    scene(S) {
      const cam = S.cam;
      for (const o of rocks) if (Math.abs(o.x - cam[0]) < 480 && Math.abs(o.z - cam[2]) < 480) (S.props['rock_' + o.kind] ||= []).push(o.x, o.y - .3, o.z, o.s, o.yaw, .5, 0, 0);
      for (const f of fences) { const m = fenceShape(f); (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[2], 1, 0, .5, 0, 0); }
      for (const l of near) {
        if (Math.hypot(l.x - cam[0], l.z - cam[2]) > 600) continue;
        if (l.kind === 'lookout') (S.props.lm_lookout ||= []).push(l.x, l.y - .2, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'mine') (S.props.lm_mine ||= []).push(l.x, l.y, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'stack') (S.props.rock_stack ||= []).push(l.x, l.y - .3, l.z, l.h, l.yaw, .5, 0, 0);
        if (l.kind === 'stones') (S.props.lm_stones ||= []).push(l.x, l.y, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'cairn') (S.props.lm_cairn ||= []).push(l.x, l.y - .3, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'tower') (S.props.lm_tower ||= []).push(l.x, l.y - .5, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'arch') (S.props.rock_arch ||= []).push(l.x, l.y - .5, l.z, l.h, l.yaw, .5, 0, 0);
        if (l.kind === 'falls') { const f = fall(l); (S.props[f.shape] ||= []).push(l.x, f.top, l.z, 1, Math.atan2(l.dz, l.dx), .5, 0, 0); }
        if (l.kind === 'lighthouse') {
          (S.props.lm_lighthouse ||= []).push(l.x, l.y - .8, l.z, 1, 0, .5, 0, 0);
        }
      }
    },
  };
}
