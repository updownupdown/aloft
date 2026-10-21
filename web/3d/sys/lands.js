// Landmarks drawn in the world (where they stand is world.js landmarksNear): standing stones,
// cairns, a ruined tower, the lighthouse on the sea cliffs (its lamp turns at night), and
// waterfalls spilling over the cliffs with mist at their feet. The giant oaks and willows are
// trees (world.js treesIn). Finding them, postcards and the journal belong to journey.js.
import { landmarksNear, rocksNear, fencesNear, height, WATER, WIND, PAL, GROUND, GROUND_SET, setGroundDetail } from '../world.js';
import { mix3, store } from '../util.js';
import { builder, blob, prism, tube, reseed, rnd } from '../shapes.js';

const STONE = [.6, .59, .56], STONE2 = [.5, .5, .49], MOSS = [.45, .52, .36];

function stones() {
  reseed(61); const B = builder();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.283, h = 2.6 + (i * 37 % 10) / 10 * 1.8, x = Math.cos(a) * 8, z = Math.sin(a) * 8;
    prism(B, x, z, .55, .42, -.4, h, 7, i % 3 ? STONE : STONE2);
  }
  prism(B, 0, 0, .9, .8, -.3, .5, 8, MOSS);     // the low altar stone
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
    if (i % 3 === 1) { const y = 9 + i; B.tri(p(a0 + .2, 4.02, y), p(a0 + .3, 4.02, y), p(a0 + .3, 4.02, y + 2), D); B.tri(p(a0 + .2, 4.02, y), p(a0 + .3, 4.02, y + 2), p(a0 + .2, 4.02, y + 2), D); }
  }
  return B.out();
}
function lighthouse() {
  reseed(64); const B = builder(), white = [.95, .93, .88], red = [.75, .25, .2], dark = [.2, .2, .22], lamp = [1.2, 1.1, .8];
  const bands = [[-1, 5, white], [5, 9, red], [9, 15, white], [15, 19, red]];
  for (const [y0, y1, c] of bands) prism(B, 0, 0, 3.2 - y0 * .04, 3.2 - y1 * .04, y0, y1, 10, c);
  prism(B, 0, 0, 2.8, 2.8, 19, 19.6, 10, dark);                // the gallery
  prism(B, 0, 0, 1.6, 1.6, 19.6, 22, 8, lamp);                 // the lantern
  prism(B, 0, 0, 1.9, .2, 22, 24.5, 8, dark);                  // the cap
  return B.out();
}
// a waterfall: a ribbon of white water laid over the cliff face from the lip downhill, built
// once per waterfall from the ground's own profile (local coordinates, +x downhill)
function fallsMesh(l) {
  const B = builder(), W = [.86, .92, .95], W2 = [.76, .86, .92], w = 3.2, pts = [];
  let s = -3, y0 = height(l.x - l.dx * 3, l.z - l.dz * 3);
  pts.push([s, y0 + .5]);
  for (s = 0; s < 120; s += 1.5) {
    const y = height(l.x + l.dx * s, l.z + l.dz * s);
    pts.push([s, y + .7]);
    if (s > 6 && y0 - y < 1) break;     // the fall has reached the bottom: it runs out flat
    y0 = y;
  }
  const yTop = pts[0][1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, ya] = pts[i], [b, yb] = pts[i + 1], ww = w * (1 + i * .02);
    B.tri([a, ya - yTop, -ww], [b, yb - yTop, -ww], [b, yb - yTop, ww], i & 1 ? W : W2);
    B.tri([a, ya - yTop, -ww], [b, yb - yTop, ww], [a, ya - yTop, ww], i & 1 ? W2 : W);
  }
  return { tris: B.out(), top: yTop, foot: [l.x + l.dx * pts[pts.length - 1][0], l.z + l.dz * pts[pts.length - 1][0]] };
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
// a sea stack: a pillar of rock standing in the water, a cap of turf on top
function stack() {
  reseed(70); const B = builder();
  prism(B, 0, 0, .15, .13, -.05, .5, 10, PAL.rock); prism(B, .01, 0, .13, .11, .5, .96, 10, PAL.granite);
  prism(B, .01, 0, .112, .09, .96, 1, 10, PAL.moss);
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
// an old barn: weathered red boards, a grey gable roof with a ridge to perch on, a dark door
function barn() {
  reseed(81); const B = builder(), red = [.6, .26, .2], red2 = [.52, .22, .18], roof = [.42, .42, .44], roof2 = [.36, .36, .38], dark = [.2, .15, .13], white = [.85, .82, .76];
  box(B, 0, -.5, 0, 12, 5.5, 8, 0, red);
  for (const k of [-1, 1]) {   // the gable ends and the two roof slopes
    B.tri([6 * k, 5, -4], [6 * k, 5, 4], [6 * k, 8.2, 0], red2);
    const e = [[-6.4, 4.8, 4.4 * k], [6.4, 4.8, 4.4 * k], [6.4, 8.3, 0], [-6.4, 8.3, 0]];
    B.tri(e[0], e[1], e[2], k > 0 ? roof : roof2); B.tri(e[0], e[2], e[3], k > 0 ? roof : roof2);
  }
  box(B, 6.02, -.4, 0, .05, 4, 3.2, 0, dark); box(B, 6.05, 3.7, 0, .06, .2, 3.4, 0, white);   // the big door and its lintel
  box(B, -6.02, 5.2, 0, .05, 1.2, 1.2, 0, dark);   // the hay loft hatch
  box(B, 0, 8.2, 0, 13, .2, .3, 0, roof2);          // the ridge
  return B.out();
}
// a fire lookout: four splayed legs with braces, a cabin with a pyramid roof and a railed walk
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
// a farm wind pump: a lattice tower, a platform, the tail vane (the wheel turns: windWheel)
function windmill() {
  reseed(83); const B = builder(), iron = [.42, .4, .38], iron2 = [.5, .46, .42], rust = [.55, .35, .24];
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [i, j] of legs) tube(B, [i * 1.5, -.5, j * 1.5], [i * .35, 11, j * .35], .06, iron);
  for (let k = 0; k < 4; k++) { const [i, j] = legs[k], [i2, j2] = legs[(k + 1) % 4]; for (const y of [2, 5, 8]) { const r = 1.5 - y / 11.5 * 1.15; tube(B, [i * r, y, j * r], [i2 * r, y, j2 * r], .035, iron2); } }
  box(B, 0, 10.9, 0, 1.3, .15, 1.3, 0, rust);
  tube(B, [0, 11.6, 0], [-2.6, 11.6, 0], .05, iron);
  B.tri([-1.8, 11.2, 0], [-3, 12.4, 0], [-3, 11.1, 0], rust);
  tube(B, [0, 11, 0], [.35, 11.6, 0], .08, iron);
  return B.out();
}
// the wheel, in a few turned copies (a prop can only turn about the vertical), drawn by phase
const WHEEL_STEPS = 6;
function windWheel(k) {
  reseed(84); const B = builder(), blade = [.68, .64, .58], blade2 = [.55, .5, .46], N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i + k / WHEEL_STEPS) / N * 6.283, b = a + .32, c = Math.cos, s = Math.sin;
    B.tri([.4, c(a) * .35, s(a) * .35], [.5, c(a) * 1.9, s(a) * 1.9], [.5, c(b) * 1.9, s(b) * 1.9], i & 1 ? blade : blade2);
    B.tri([.4, c(a) * .35, s(a) * .35], [.5, c(b) * 1.9, s(b) * 1.9], [.4, c(b) * .35, s(b) * .35], i & 1 ? blade : blade2);
  }
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
    const st = [.58, .56, .52], st2 = [.5, .49, .46], st3 = [.64, .62, .57], moss = [.46, .5, .36], cols = [st, st2, st3];
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
  // Settings > Ground detail: steps through the facet sizes and rebuilds the ground
  const gname = () => { const g = GROUND.find(g => g[0] === GROUND_SET); return `${g[1]}: ${g[2]}`; };
  const gEl = G.menu.button('play', { label: 'Ground detail', sub: gname(), group: 'app', onClick: el => {
    const i = GROUND.findIndex(g => g[0] === GROUND_SET), n = GROUND[(i + 1) % GROUND.length][0];
    setGroundDetail(n); store.set('ground', n); R.dropChunks(); el.querySelector('em').textContent = gname();
  } });
  G.menu.onOpen(() => { gEl.querySelector('em').textContent = gname(); });
  // Settings > Graphics (G.gfx level 0..2) picks the ground too, until the row above is used
  G.on('gfx', lv => {
    if (store.get('ground', null) !== null) return;
    const n = [16, 32, 32][lv] ?? 32; if (n !== GROUND_SET) { setGroundDetail(n); R.dropChunks(); }
  });
  R.shape('lm_stones', stones()); R.shape('lm_cairn', cairn()); R.shape('lm_tower', tower()); R.shape('lm_lighthouse', lighthouse());
  R.shape('rock_tor', tor()); R.shape('rock_hoodoo', hoodoo()); R.shape('rock_boulder', boulder());
  R.shape('rock_lava', lava()); R.shape('rock_arch', arch()); R.shape('rock_stack', stack());
  R.shape('lm_barn', barn()); R.shape('lm_lookout', lookout()); R.shape('lm_windmill', windmill());
  for (let k = 0; k < WHEEL_STEPS; k++) R.shape('lm_wheel' + k, windWheel(k));
  const fenceOf = new Map();   // run id -> { shape, at }
  const fenceShape = f => {
    let m = fenceOf.get(f.id);
    if (!m) { m = fenceMesh(f); m.shape = 'fence_' + f.id; R.shape(m.shape, m.tris); fenceOf.set(f.id, m); }
    return m;
  };
  const fallsOf = new Map();   // landmark id -> { shape, top, foot }
  const fall = l => { let f = fallsOf.get(l.id); if (!f) { f = fallsMesh(l); f.shape = 'lm_falls_' + l.id; R.shape(f.shape, f.tris); fallsOf.set(l.id, f); } return f; };
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
      const cam = S.cam, L = G.light;
      for (const o of rocks) if (Math.abs(o.x - cam[0]) < 480 && Math.abs(o.z - cam[2]) < 480) (S.props['rock_' + o.kind] ||= []).push(o.x, o.y - .3, o.z, o.s, o.yaw, .5, 0, 0);
      for (const f of fences) { const m = fenceShape(f); (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[2], 1, 0, .5, 0, 0); }
      for (const l of near) {
        if (Math.hypot(l.x - cam[0], l.z - cam[2]) > 600) continue;
        if (l.kind === 'barn') (S.props.lm_barn ||= []).push(l.x, l.y - .3, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'lookout') (S.props.lm_lookout ||= []).push(l.x, l.y - .2, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'stack') (S.props.rock_stack ||= []).push(l.x, l.y - .3, l.z, l.h, l.yaw, .5, 0, 0);
        if (l.kind === 'windmill') {
          // the wheel faces into the wind and turns with it
          const wy = Math.atan2(-WIND[2], -WIND[0]), k = Math.floor(G.t * (2 + (G.windK ?? .3) * 6)) % WHEEL_STEPS;
          (S.props.lm_windmill ||= []).push(l.x, l.y - .3, l.z, 1, wy, .5, 0, 0);
          (S.props['lm_wheel' + k] ||= []).push(l.x, l.y - .3, l.z, 1, wy, .5, 0, 0);
        }
        if (l.kind === 'stones') (S.props.lm_stones ||= []).push(l.x, l.y, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'cairn') (S.props.lm_cairn ||= []).push(l.x, l.y - .3, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'tower') (S.props.lm_tower ||= []).push(l.x, l.y - .5, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'arch') (S.props.rock_arch ||= []).push(l.x, l.y - .5, l.z, l.h, l.yaw, .5, 0, 0);
        if (l.kind === 'falls') { const f = fall(l); (S.props[f.shape] ||= []).push(l.x, f.top, l.z, 1, Math.atan2(l.dz, l.dx), .5, 0, 0); }
        if (l.kind === 'lighthouse') {
          (S.props.lm_lighthouse ||= []).push(l.x, l.y - .8, l.z, 1, 0, .5, 0, 0);
          // at dusk and night the lamp shines and its beam sweeps the sea
          const lit = 1 - L.daylight * .85;
          if (lit > .2) {
            const top = [l.x, l.y + 20, l.z], a = G.t * .9;
            S.motes.push(...top, 1, .95, .7, 2.2 * lit);
            // two soft shafts of light either way: discs packed so close they run together,
            // widening and fading into the sky with distance
            for (const side of [0, Math.PI]) {
              const c = Math.cos(a + side), s = Math.sin(a + side);
              for (let d = 1.5; d < 190;) {
                const r = .7 + d * .055, f = 1 - d / 190;
                S.motes.push(top[0] + c * d, top[1] - d * .05, top[2] + s * d, ...mix3(S.horizon, [1, .95, .78], lit * f * f * (side ? .45 : .7)), r);
                d += Math.max(.5, r * .45);
              }
            }
          }
        }
      }
    },
  };
}
