// The caves' roofs and what it is like inside (caves.js places them and cuts the hollows; options H2
// and H4 to H8 of the geography study). The roof is a mesh made once for each cave near the bird: on
// top the hill's own surface and colour (from above nothing shows but the mouth), beneath it dim rock,
// blue ice or wet stone, a step down at its edges (the mouth, a lava tube's fallen-in holes). The bird
// keeps under the roof inside (flight.js, camera.js); a tarn's pool is fresh water to drink; each is
// found the first time the bird is inside, kept with the hidden places (sys/hidden.js).
import { groundColour, placeName, normalAt, WATER } from '../world.js';
import { cavesNear, local, roofUnder, vault, floorAt, ground0, ROOF_OUT } from '../caves.js';
import { builder, reseed, rnd } from '../shapes.js';
import { ih } from '../noise.js';

const NEAR = 700, STEP = 1.5, LIFT = .15;   // drawn this near; the roof's grid (m); its top a hair over the hill
const UNDER = { cave: [.22, .2, .19], icecave: [.42, .58, .72], seacave: [.17, .19, .19], tube: [.16, .14, .14], adit: [.2, .17, .14], tunnel: [.24, .22, .2] };
const NAMES = { cave: 'a cave in the hill', icecave: 'a cave in the blue ice', seacave: 'a sea cave', tube: 'a tunnel the lava left', cenote: 'a sunken pool', tarn: 'a high tarn', adit: 'a tunnel into the hollow hill', tunnel: 'a tunnel through the hill' };
export const CAVE_KINDS = { cave: 'caves', icecave: 'ice caves', seacave: 'sea caves', tube: 'lava tunnels', cenote: 'sunken pools', tarn: 'high tarns', adit: 'old tunnels', tunnel: 'long tunnels' };

// a cave's roof: on a grid over its box, a cell is roofed when its middle is; its corners take the
// roof's underside (forced: the edge cells still need one) and the hill's top
function roofMesh(cv) {
  const B = builder(), nx = Math.ceil((cv.x1 - cv.x0) / STEP), nz = Math.ceil((cv.z1 - cv.z0) / STEP), ox = cv.x0, oz = cv.z0;
  const IN = new Uint8Array(nx * nz), V = new Map(), col = UNDER[cv.kind] || UNDER.cave;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = ox + (i + .5) * STEP, z = oz + (j + .5) * STEP;
    IN[j * nx + i] = roofUnder(cv, x, z) != null ? 1 : 0;
  }
  // a corner: [x, under, z, top, colour of the top]
  const corner = (i, j) => {
    const k = j * (nx + 1) + i; let v = V.get(k); if (v) return v;
    const x = ox + i * STEP, z = oz + j * STEP, q = local(cv, x, z), top = ground0(x, z);
    const under = Math.min(vault(cv, q, x, z), top - .5);
    // past the hollow's side the top sinks into the hill (no flicker where the two lie together)
    const t = top + LIFT - Math.max(0, Math.min(1, (q.d - q.w) / ROOF_OUT)) * .6;
    v = [x - ox, under, z - oz, t, groundColour(x, top, z, normalAt(x, z)[1])];
    V.set(k, v); return v;
  };
  const at = (v, y) => [v[0], y, v[2]];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!IN[j * nx + i]) continue;
    const a = corner(i, j), b = corner(i, j + 1), c = corner(i + 1, j), d = corner(i + 1, j + 1);
    // the top (normals up), the underside (normals down)
    B.tri(at(a, a[3]), at(b, b[3]), at(c, c[3]), a[4]); B.tri(at(c, c[3]), at(b, b[3]), at(d, d[3]), d[4]);
    B.tri(at(a, a[1]), at(c, c[1]), at(b, b[1]), col, -.05); B.tri(at(c, c[1]), at(d, d[1]), at(b, b[1]), col, .05);
    // a face down from the top to the underside where the roof ends (the mouth, a hole)
    const edge = (p, q, open) => { if (!open) return; B.tri(at(p, p[3]), at(p, p[1]), at(q, q[1]), col, .1); B.tri(at(p, p[3]), at(q, q[1]), at(q, q[3]), col, .1); };
    edge(a, c, j === 0 || !IN[(j - 1) * nx + i]); edge(d, b, j === nz - 1 || !IN[(j + 1) * nx + i]);
    edge(b, a, i === 0 || !IN[j * nx + i - 1]); edge(c, d, i === nx - 1 || !IN[j * nx + i + 1]);
  }
  return B.out();
}

// what grows in the dark: stalactites from the roof and stalagmites from the floor (icicles in the
// ice), a few to each couple of metres of passage, kept short over the middle where the bird flies,
// and glow-worms, faint blue-green points on the roof deep in, twinkling
const FORM = { cave: [.3, .27, .24], icecave: [.66, .82, .93], seacave: [.25, .27, .26], tube: [.2, .17, .16] };
const RICH = { cave: [.55, .4], icecave: [.7, .12], seacave: [.25, 0], tube: [.3, 0] };   // stalactites, stalagmites per try
const GLOW = { cave: 1, tube: .7, seacave: .6, adit: .8 };
// a cluster of spikes: h > 0 standing up, h < 0 hanging down (unit length)
function spikes(col, h) {
  const B = builder();
  reseed(h > 0 ? 7 : 11);
  for (const [ox, oz, r, l] of [[0, 0, .2, 1], [.22, .08, .1, .55], [-.12, .2, .08, .4], [.05, -.22, .07, .3]]) {
    const n = 5, P = Array.from({ length: n }, (_, i) => { const a = i / n * 6.283 + rnd(); return [ox + Math.cos(a) * r, 0, oz + Math.sin(a) * r]; }), tip = [ox + (rnd() - .5) * .05, h * l, oz + (rnd() - .5) * .05];
    for (let i = 0; i < n; i++) { const p0 = P[i], p1 = P[(i + 1) % n], j = (rnd() - .5) * .16; if (h > 0) B.tri(p0, tip, p1, col, j); else B.tri(p1, tip, p0, col, j); }
  }
  return B.out();
}
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
function formations(cv) {
  const out = { up: [], down: [], glow: [] }, rich = RICH[cv.kind], P = cv.pts, H = hash(cv.id), gk = GLOW[cv.kind] || 0;
  if (!rich && !gk) return out;
  let n = 0;
  for (let k = 0; k + 1 < P.length; k++) {
    const a = P[k], b = P[k + 1], L = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(L / 1.6);
    for (let i = 0; i < steps; i++) for (let j = 0; j < 3; j++, n++) {
      const t = (i + ih(H, n, 971)) / steps, w = a.w + (b.w - a.w) * t, o = (ih(H, n, 972) * 2 - 1) * w, ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
      const x = a.x + (b.x - a.x) * t - uz * o, z = a.z + (b.z - a.z) * t + ux * o, q = local(cv, x, z);
      if (q.d > q.w * .92) continue;
      const fl = floorAt(cv, q, x, z), roof = vault(cv, q, x, z), room = roof - fl, side = q.d / q.w, r = ih(H, n, 973), yaw = r * 40;
      if (room < 1.4 || q.t < .08) continue;   // not out in the mouth's daylight
      const keep = side < .45 ? .18 : .4;   // short over the middle
      if (rich && r < rich[0]) out.down.push(x, roof + .15, z, Math.min(room * keep, .4 + ih(H, n, 974) * 1.8), yaw, ih(H, n, 975), 0, 0);
      else if (rich && r < rich[0] + rich[1] && side > .4 && fl > (cv.kind === 'seacave' ? .3 : -1e9)) out.up.push(x, fl - .1, z, Math.min(room * .35, .35 + ih(H, n, 976) * 1.5), yaw, ih(H, n, 977), 0, 0);
      if (gk && q.t > .3 && ih(H, n, 978) < gk * .45) out.glow.push(x, roof - .4, z, ih(H, n, 979) * 6.283);
    }
  }
  return out;
}

export function cavesSystem(G) {
  const { R, b } = G, made = new Map(), forms = new Map();
  for (const k in FORM) { R.shape('stalag_' + k, spikes(FORM[k], 1)); R.shape('stalac_' + k, spikes(FORM[k], -1)); }
  let near = [], look = 0;
  const shape = cv => {
    if (cv.open) return '';
    let m = made.get(cv.id);
    if (m == null) {
      const tris = roofMesh(cv);
      m = tris.length ? 'cave_' + cv.id : '';
      if (m) R.shape(m, tris);
      made.set(cv.id, m);
      if (made.size > 120) made.delete(made.keys().next().value);
    }
    return m;
  };
  // a cave is found the first time the bird is inside it: under its roof, down in a sunken pool,
  // or by a tarn's water
  const inside = cv => {
    if (b.inCave?.id === cv.id) return true;
    const q = local(cv, b.p[0], b.p[2]);
    if (cv.kind === 'cenote') return q.d < q.w && b.p[1] < 1.5;
    if (cv.kind === 'tarn') return q.d < cv.pool.r + 3 && b.p[1] < cv.pool.y + 4 && b.state !== 'fly';
    return false;
  };
  G.caves = { near: () => near, NAMES };
  G.dev?.add({ id: 'caves', title: 'Caves, sea caves, lava tunnels, sunken pools, tarns, old tunnels', area: 'World', round: 'study', how: 'Fly into a cave mouth in the steep ridge lands, the ice, the sea cliffs, under a fire mountain\'s lava, into an old mine or a railway tunnel: the roof keeps the hill on top. Sunken pools in the Yucatán, tarns high in the peaks (fresh water). Try it puts you at the nearest mouth.',
    go: () => { const L = cavesNear(b.p[0], b.p[2], 20000).sort((p, q) => Math.hypot(p.mouth.x - b.p[0], p.mouth.z - b.p[2]) - Math.hypot(q.mouth.x - b.p[0], q.mouth.z - b.p[2])); const cv = L[0]; if (!cv) { G.hud.say('None within reach of here.', { kind: 'warn', secs: 3 }); return; } G.travelTo(cv.mouth.x + cv.mouth.dx * 30, cv.mouth.z + cv.mouth.dz * 30); } });
  return {
    id: 'caves',
    update(dt) {
      if ((look -= dt) <= 0) {
        look = .8; near = cavesNear(b.p[0], b.p[2], NEAR);
        // the tarns' pools: fresh water (food.js drinks from G.tarns like a rain pool)
        G.tarns = []; for (const cv of near) if (cv.pool) G.tarns.push(cv.pool.x, cv.pool.y, cv.pool.z, cv.pool.r, 0, .5, 0, 0);
      }
      for (const cv of near) if (!cv.found && inside(cv)) {
        cv.found = true;
        const name = `${NAMES[cv.kind]}, ${placeName(cv.mouth.x, cv.mouth.z)}`;
        G.hidden?.find({ kind: cv.kind, id: cv.id, name });
      }
    },
    scene(S) {
      const cam = S.cam;
      for (const cv of near) {
        if (Math.abs(cv.x0 - cam[0]) > NEAR + 300 || Math.abs(cv.z0 - cam[2]) > NEAR + 300) continue;
        const m = shape(cv);
        if (m) (S.props[m] ||= []).push(cv.x0, 0, cv.z0, 1, 0, .5, 0, 0);
        if (cv.pool) (S.props.pool ||= []).push(cv.pool.x, cv.pool.y, cv.pool.z, cv.pool.r, 0, .5, 0, 0);
        // inside, close by: the formations and the glow-worms
        if (cv.open || Math.hypot(cv.mouth.x - cam[0], cv.mouth.z - cam[2]) > 140) continue;
        let f = forms.get(cv.id); if (!f) { f = formations(cv); forms.set(cv.id, f); if (forms.size > 60) forms.delete(forms.keys().next().value); }
        if (f.up.length) (S.props['stalag_' + cv.kind] ||= []).push(...f.up);
        if (f.down.length) (S.props['stalac_' + cv.kind] ||= []).push(...f.down);
        const g = f.glow;
        for (let i = 0; i < g.length; i += 4) {
          const tw = .6 + .4 * Math.sin(G.t * (.7 + (g[i + 3] % 1) * .8) + g[i + 3] * 9);
          S.motes.push(g[i], g[i + 1], g[i + 2], .5 * tw, 1 * tw, 1 * tw, .1);
        }
      }
    },
  };
}
