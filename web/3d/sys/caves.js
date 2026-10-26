// The caves' roofs and what it is like inside (caves.js places them and cuts the hollows; options H2
// and H4 to H8 of the geography study). The roof is a mesh made once for each cave near the bird: on
// top the hill's own surface and colour (from above nothing shows but the mouth), beneath it dim rock,
// blue ice or wet stone, a step down at its edges (the mouth, a lava tube's fallen-in holes). The bird
// keeps under the roof inside (flight.js, camera.js); a tarn's pool is fresh water to drink; each is
// found the first time the bird is inside, kept with the hidden places (sys/hidden.js).
import { groundColour, placeName, normalAt, WATER } from '../world.js';
import { cavesNear, local, roofUnder, ground0, ROOF_OUT } from '../caves.js';
import { builder } from '../shapes.js';

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
    const kk = Math.min(1, q.d / q.w), under = Math.min(q.f + q.c * (.78 + .22 * (1 - kk * kk)), top - .5);
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

export function cavesSystem(G) {
  const { R, b } = G, made = new Map();
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
      }
    },
  };
}
