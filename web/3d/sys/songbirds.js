// Songbirds in 3D: their low-poly bodies (one perched shape and two wingbeat frames per
// species, coloured from songs.js), which habitat a spot is, and which trees hold a songbird.
// A songbird tree is fixed by the tree's id, like everything else in the world; the species
// is drawn from those native to its habitat.
import { SPECIES } from '../../src/songs.js';
import { forest, treesNear, perchesOf, ih, biomeAt } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';

const c01 = c => c.map(v => v / 255);
const dark = (c, k) => c.map(v => v * k);

// Model space: metres, beak along +x, y up. Instances turn it by yaw - PI/2 (as the mice).
// wings: 'fold' (sitting), 'up' and 'down' (two frames of a wingbeat)
function birdShape(sp, wings) {
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
export function pushBird(S, sp, x, y, z, heading, flying = false, beat = 0) {
  const w = !flying ? 'fold' : Math.sin(beat) > 0 ? 'up' : 'down';
  (S.props[`sb${sp.id}${w}`] ||= []).push(x, y, z, 1.7, heading - Math.PI / 2, .5, 0, 0);
}

// habitat, in the 2D game's biome names (a ridge counts as mountains; coast birds are the marsh's)
export function habitat(x, z) {
  const n = biomeAt(x, z).name;
  return n === 'ridge' ? 'mountains' : n === 'coast' ? 'marsh' : n;
}

// which trees near (x, z) hold a songbird, and where it sits: the end of a broadleaf's low
// limb, or the tip of a pine. Woods have one in twenty-five; a lone meadow tree, one in five.
const cache = new Map();
export function songTreesNear(x, z, r) {
  const out = [];
  for (const t of treesNear(x, z, r)) {
    let s = cache.get(t.id);
    if (s === undefined) {
      s = null;
      const share = forest(t.x, t.z) > .32 ? .04 : .2;
      if (ih(t.id, 3, 91) < share) {
        const bio = habitat(t.x, t.z), pool = SPECIES.filter(q => q.biomes.includes(bio));
        const sp = pool[Math.floor(ih(t.id, 4, 92) * pool.length)], ps = perchesOf(t), p = ps[ps.length - 1];
        // a little to one side of the perch, so a hawk landing there does not sit on it
        const a = t.yaw + 1.6;
        s = { id: t.id, sp, tree: t, bio, x: p.x + Math.cos(a) * .35, y: p.y + .02, z: p.z + Math.sin(a) * .35, heading: ih(t.id, 5, 93) * 6.283 };
      }
      cache.set(t.id, s);
      if (cache.size > 4000) cache.delete(cache.keys().next().value);
    }
    if (s) out.push(s);
  }
  return out;
}
