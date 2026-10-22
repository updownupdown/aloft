// Songbirds in 3D: their low-poly bodies (one perched shape and two wingbeat frames per
// species, coloured from songs.js), which habitat a spot is, and which trees hold a songbird.
// A songbird tree is fixed by the tree's id, like everything else in the world; the species
// is drawn from those native to its habitat.
import { SPECIES } from '../../src/songs.js';
import { forest, treesNear, perchesOf, ih, biomeAt, rocksNear, landmarksNear, groundAt, WATER } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { continentAt } from '../earth.js';

const c01 = c => c.map(v => v / 255);
const dark = (c, k) => c.map(v => v * k);

// Model space: metres, beak along +x, y up. Instances turn it by yaw - PI/2 (as the mice).
// wings: 'fold' (sitting), 'up' and 'down' (two frames of a wingbeat)
export function birdShape(sp, wings) {
  reseed(31 + sp.id * 7);
  const B = builder(), L = sp.look, s = L.size;
  const body = c01(sp.cols.body), cap = c01(sp.cols.cap), breast = c01(sp.cols.breast), bill = [.25, .2, .16];
  const fly = wings !== 'fold';
  blob(B, 0, .075 * s, 0, .055 * s, body, dark(body, .9), [1.5, .95, .95]);             // back
  blob(B, .02 * s, .062 * s, 0, .047 * s, breast, breast, [1.3, .95, 1]);                 // breast and belly
  const hr = (L.owl ? .05 : .034) * s, hx = (L.owl ? .045 : .07) * s, hy = (L.owl ? .12 : .115) * s;
  blob(B, hx, hy, 0, hr, cap, L.bib ? cap : body, [1.1, 1, 1]);                           // head
  if (L.bib) blob(B, hx + .01 * s, hy - .03 * s, 0, .022 * s, cap, cap);                   // a chickadee's bib
  if (L.owl) { for (const z of [-1, 1]) blob(B, hx + hr * .7, hy + .005, z * hr * .45, hr * .3, breast, breast); }   // facial discs
  // bill: a little cone forward
  const bl = .03 * s * L.bill, bw = .009 * s * (L.thick ? 1.6 : 1), by = hy - (L.owl ? .015 : .005) * s, bx = hx + hr * .85;
  B.tri([bx, by + bw, 0], [bx + bl, by, 0], [bx, by - bw, bw], bill); B.tri([bx, by + bw, 0], [bx, by - bw, -bw], [bx + bl, by, 0], bill);
  B.tri([bx, by - bw, bw], [bx + bl, by, 0], [bx, by - bw, -bw], bill);
  if (L.crest) B.tri([hx - hr * .3, hy + hr * .8, 0], [hx - hr * 1.5, hy + hr * 1.6, 0], [hx + hr * .2, hy + hr * .5, 0], cap);
  if (L.spots) for (let i = 0; i < 6; i++) { const a = i * 1.1, x = .03 * s + Math.cos(a) * .012, y = .05 * s + Math.sin(a) * .012; B.tri([x, y, .041 * s], [x + .008, y - .006, .042 * s], [x - .004, y - .009, .042 * s], dark(body, .55)); }
  // tail: a flat fan back and up (cocked for a wren)
  const tl = .085 * s * L.tail * (L.owl ? .6 : 1), ty = .08 * s, cock = (L.tail > 1.4 ? .7 : .25) * tl;
  B.tri([-.06 * s, ty, -.012], [-.06 * s - tl, ty + cock, -.022], [-.06 * s - tl, ty + cock, .022], dark(body, .85));
  B.tri([-.06 * s, ty, -.012], [-.06 * s - tl, ty + cock, .022], [-.06 * s, ty, .012], dark(body, .85));
  // wings: folded along the sides, or spread for flight
  const wc = dark(body, .8), span = .14 * s * (L.owl ? 1.3 : 1);
  for (const z of [-1, 1]) {
    if (!fly) { B.tri([.04 * s, .09 * s, z * .045 * s], [-.08 * s, .085 * s, z * .04 * s], [-.02 * s, .055 * s, z * .052 * s], wc); continue; }
    const tipY = wings === 'up' ? .09 * s + span * .6 : .06 * s - span * .45, mid = wings === 'up' ? .1 * s + span * .25 : .07 * s - span * .1;
    B.tri([.04 * s, .085 * s, z * .03 * s], [-.04 * s, .085 * s, z * .03 * s], [-.005 * s, mid, z * span * .55], wc);
    B.tri([.025 * s, mid, z * span * .55], [-.035 * s, mid, z * span * .55], [-.03 * s, tipY, z * span], dark(wc, .85));
  }
  if (!fly) for (const z of [-1, 1]) B.tri([.0, .03 * s, z * .01], [.01, 0, z * .012], [-.01, 0, z * .012], [.3, .25, .2]);   // legs
  return B.out();
}

export function registerSongbirds(R) {
  for (const sp of SPECIES) for (const w of ['fold', 'up', 'down']) R.shape(`sb${sp.id}${w}`, birdShape(sp, w));
}
// one instance (8 floats) of a songbird: perched, or flying with its wings mid-beat
export function pushBird(S, sp, x, y, z, heading, flying = false, beat = 0, scale = 1.7) {
  const w = !flying ? 'fold' : Math.sin(beat) > 0 ? 'up' : 'down';
  (S.props[`sb${sp.id}${w}`] ||= []).push(x, y, z, scale, heading - Math.PI / 2, .5, 0, 0);
}

// habitat, in the 2D game's biome names (a ridge counts as mountains; coast birds are the marsh's;
// canyon birds are the cliffs', and the open lands share the meadow's; each newer land borrows
// the nearest of the old ones)
const HABITAT = {
  ridge: 'mountains', alpine: 'mountains', coast: 'marsh', swamp: 'marsh', canyon: 'cliffs', badlands: 'cliffs', fjord: 'cliffs', volcano: 'cliffs',
  desert: 'meadow', moor: 'meadow', savanna: 'meadow', saltflat: 'meadow', birch: 'forest', redwood: 'forest', karst: 'forest',
  taiga: 'forest', rainforest: 'forest', tundra: 'meadow', steppe: 'meadow', maquis: 'meadow', ice: 'marsh',
};
export function habitat(x, z) {
  const n = biomeAt(x, z).name;
  return HABITAT[n] || n;
}

// the land itself, in the 3D biome names (desert, canyon, redwood ...)
export const land = (x, z) => biomeAt(x, z).name;

// Where songbirds sit near (x, z): trees (the end of a broadleaf's low limb, or the tip of a
// pine; woods have one in twenty-five, a lone tree one in five), the tops of rocks in the
// canyons and the high country, and the wet rocks by a waterfall. Each spot is fixed by what it
// sits on, like everything else. A spot's species: one of the birds of its continent and its land
// (src/songs.js cont and lands); none at sea or on the ice.
const cache = new Map();
const keep = (k, s) => { cache.set(k, s); if (cache.size > 5000) cache.delete(cache.keys().next().value); return s; };
// a pick by weight: birds that sing only at night take half a share, so the day woods stay full,
// and so do the mimics, so they stay a find
const weight = q => q.times.every(t => t === 'night') || q.mimic ? .5 : 1;
function pickW(pool, u) {
  let w = u * pool.reduce((a, q) => a + weight(q), 0);
  for (const q of pool) if ((w -= weight(q)) < 0) return q;
  return pool[pool.length - 1];
}
// the birds of a continent's land that sit on this kind of spot (a rock bird sits on bare ground
// too, where there are no rocks), cached by continent, land and spot
const owners = new Map();
function own(x, z, spot) {
  const c = continentAt(x, z), raw = land(x, z), k = c + raw + spot;
  if (!owners.has(k)) owners.set(k, c ? SPECIES.filter(q => q.cont.includes(c) && q.lands.includes(raw) && ((q.spot || 'tree') === spot || spot === 'ground' && q.spot === 'rock')) : []);
  return owners.get(k);
}
function treeSpot(t) {
  if (ih(t.id, 3, 91) >= (forest(t.x, t.z) > .32 ? .04 : .2)) return null;
  const raw = land(t.x, t.z), bio = HABITAT[raw] || raw, pool = own(t.x, t.z, 'tree');
  if (!pool.length) return null;
  const sp = pickW(pool, ih(t.id, 4, 92)), ps = perchesOf(t), p = ps[ps.length - 1];
  // a little to one side of the perch, so a hawk landing there does not sit on it
  const a = t.yaw + 1.6;
  // one tree bird in six is a young one, still learning its song (smaller; out of winter only)
  return { id: t.id, ph: ih(t.id, 7, 95) * 99, sp, tree: t, bio, young: ih(t.id, 8, 107) < .16, x: p.x + Math.cos(a) * .35, y: p.y + .02, z: p.z + Math.sin(a) * .35, heading: ih(t.id, 5, 93) * 6.283 };
}
// the top of a rock (as solidsNear has it: rocks are drawn .3 m sunk)
const TOP = { tor: 1, hoodoo: 1, boulder: .75 };
function rockSpot(o) {
  if (!TOP[o.kind] || ih(o.id, 3, 96) >= .35) return null;
  const pool = own(o.x, o.z, 'rock'); if (!pool.length) return null;
  const sp = pool[Math.floor(ih(o.id, 4, 97) * pool.length)], a = ih(o.id, 5, 98) * 6.283, r = o.kind === 'hoodoo' ? .05 : .3;
  return { id: 'r' + o.id, ph: ih(o.id, 7, 99) * 99, sp, rock: o, x: o.x + Math.cos(a) * r * o.s * .3, y: o.y - .3 + o.s * TOP[o.kind] + .02, z: o.z + Math.sin(a) * r * o.s * .3, heading: a + 1.2 };
}
// on the bare ground of the high slopes (one maybe per 48 m cell)
const GCELL = 48;
function groundSpot(gx, gz) {
  if (ih(gx, gz, 101) >= .07) return null;
  const x = (gx + .2 + ih(gx, gz, 102) * .6) * GCELL, z = (gz + .2 + ih(gx, gz, 103) * .6) * GCELL;
  const pool = own(x, z, 'ground'); if (!pool.length) return null;
  const y = groundAt(x, z); if (y < 2) return null;
  return { id: 'g' + gx + '_' + gz, ph: ih(gx, gz, 104) * 99, sp: pool[Math.floor(ih(gx, gz, 105) * pool.length)], x, y: y + .02, z, heading: ih(gx, gz, 106) * 6.283 };
}
// by a waterfall: on the lowest ground round its foot, just above the pool
function fallsSpot(l) {
  const pool = SPECIES.filter(q => q.spot === 'falls'); if (!pool.length) return null;
  let best = null;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.283, r = 8 + (i % 3) * 7, x = l.x + Math.cos(a) * r, z = l.z + Math.sin(a) * r, y = groundAt(x, z);
    if (!best || y < best.y) best = { x, y, z };
  }
  return { id: 'f' + l.id, ph: 7, sp: pool[0], x: best.x, y: Math.max(best.y, WATER + .15) + .02, z: best.z, heading: Math.atan2(l.x - best.x, -(l.z - best.z)) };
}
// the world wrapped round (main.js 'wrap'): the spots were cached at the old x
export const clearSpots = () => cache.clear();
export function songTreesNear(x, z, r) {
  const out = [];
  for (const t of treesNear(x, z, r)) {
    const s = cache.has(t.id) ? cache.get(t.id) : keep(t.id, treeSpot(t));
    if (s) out.push(s);
  }
  for (const o of rocksNear(x, z, r)) {
    const k = 'r' + o.id, s = cache.has(k) ? cache.get(k) : keep(k, rockSpot(o));
    if (s && Math.hypot(s.x - x, s.z - z) < r) out.push(s);
  }
  const a = Math.floor((x - r) / GCELL), b = Math.floor((x + r) / GCELL), c = Math.floor((z - r) / GCELL), d = Math.floor((z + r) / GCELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) {
    const k = 'g' + gx + '_' + gz, s = cache.has(k) ? cache.get(k) : keep(k, groundSpot(gx, gz));
    if (s && Math.hypot(s.x - x, s.z - z) < r) out.push(s);
  }
  for (const l of landmarksNear(x, z, r)) if (l.kind === 'falls') {
    const k = 'f' + l.id, s = cache.has(k) ? cache.get(k) : keep(k, fallsSpot(l));
    if (s && Math.hypot(s.x - x, s.z - z) < r) out.push(s);
  }
  return out;
}
