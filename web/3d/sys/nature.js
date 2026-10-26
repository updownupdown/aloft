// The real natural wonders' own pieces (realplaces.js lays the places and their shapes in the
// ground; world.js makes each a landmark): a geyser's sinter mound and its plume every minute or
// so, the Perito Moreno's wall of blue ice, the Giant's Causeway's basalt columns stepping into the
// sea (Fingal's Cave a hall of them with a mouth to the sea), and the white terraces' pools. Each is
// a mesh made once for its place (it follows the ground there) and drawn while near.
import { height, WATER, env } from '../world.js';
import { realPlaces } from '../realplaces.js';
import { builder, reseed, rnd } from '../shapes.js';

const NEAR = 1600, ERUPT = { oldfaithful: [75, 7], geysir: [55, 5] };   // [every s, lasting s]
const SINTER = [.86, .83, .76], SINTER2 = [.78, .72, .62], RUST = [.74, .48, .28], VENT = [.42, .7, .76];
const BASALTS = [[.24, .23, .23], [.3, .29, .28], [.2, .2, .21], [.34, .32, .3]];
const ICE = [.86, .93, .97], ICE2 = [.62, .8, .92], ICE3 = [.46, .66, .82], BASALT = [.24, .23, .23], BASALT2 = [.32, .31, .3];

// a builder whose points are given in world metres but kept relative to the place (drawn at it):
// float32 far from the origin would shake the edges
function near0(P) {
  const B = builder();
  return { tri: (p, q, r, col, j) => B.tri([p[0] - P.x, p[1], p[2] - P.z], [q[0] - P.x, q[1], q[2] - P.z], [r[0] - P.x, r[1], r[2] - P.z], col, j), out: B.out };
}
// a hexagonal column, flat topped (the Causeway's stepping stones)
function hex(B, x, z, r, y0, y1, col, col2) {
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, b = (i + 1) / 6 * Math.PI * 2;
    const p0 = [x + Math.cos(a) * r, y0, z + Math.sin(a) * r], p1 = [x + Math.cos(b) * r, y0, z + Math.sin(b) * r];
    const q0 = [p0[0], y1, p0[2]], q1 = [p1[0], y1, p1[2]];
    B.tri(p0, q1, p1, i & 1 ? col : col2, (rnd() - .5) * .1); B.tri(p0, q0, q1, i & 1 ? col : col2, (rnd() - .5) * .1);
    B.tri(q0, [x, y1, z], q1, col2, .05);
  }
}
// local frame of a place: s along its yaw, w across; returns world (x, z)
const at = (P, s, w) => [P.x + s * Math.cos(P.yaw) - w * Math.sin(P.yaw), P.z + s * Math.sin(P.yaw) + w * Math.cos(P.yaw)];

function geyserMesh(P) {
  reseed(701); const B = near0(P), y = height(P.x, P.z);
  // a low mound of sinter in rings, rust-orange where the warm water runs off, the vent in the middle
  const ring = (r0, r1, h0, h1, col) => { for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, b = (i + 1) / 18 * 6.283, j = 1 + (rnd() - .5) * .12; B.tri([P.x + Math.cos(a) * r0, y + h0, P.z + Math.sin(a) * r0], [P.x + Math.cos(b) * r1 * j, y + h1, P.z + Math.sin(b) * r1 * j], [P.x + Math.cos(a) * r1 * j, y + h1, P.z + Math.sin(a) * r1 * j], col); B.tri([P.x + Math.cos(a) * r0, y + h0, P.z + Math.sin(a) * r0], [P.x + Math.cos(b) * r0, y + h0, P.z + Math.sin(b) * r0], [P.x + Math.cos(b) * r1 * j, y + h1, P.z + Math.sin(b) * r1 * j], col); } };
  ring(2.2, 6, 1.4, .6, SINTER); ring(6, 11, .6, .1, SINTER2); ring(11, 15, .1, -.4, RUST); ring(0, 2.2, 1.1, 1.4, VENT);
  return B.out();
}
function glacierMesh(P) {
  // a wall of ice across the water: a ragged blue face with seracs on top, climbing back into the hills
  reseed(702); const B = near0(P), W = P.r, H = P.h, back = 220;
  const pts = []; for (let i = 0; i <= 26; i++) { const w = -W + i / 26 * W * 2; pts.push(w); }
  for (let i = 0; i < pts.length - 1; i++) {
    const w0 = pts[i], w1 = pts[i + 1], h0 = H * (.8 + rnd() * .35), h1 = H * (.8 + rnd() * .35), f0 = (rnd() - .5) * 6, f1 = (rnd() - .5) * 6;
    const [ax, az] = at(P, f0, w0), [bx, bz] = at(P, f1, w1), [cx, cz] = at(P, -back, w0 * .7), [dx, dz] = at(P, -back, w1 * .7);
    const ya = WATER - 3, ta = WATER + h0, tb = WATER + h1, gc = Math.max(height(cx, cz), WATER) + H * 1.3, gd = Math.max(height(dx, dz), WATER) + H * 1.3;
    const face = rnd() < .5 ? ICE2 : ICE3;
    B.tri([ax, ya, az], [bx, tb, bz], [bx, ya, bz], face); B.tri([ax, ya, az], [ax, ta, az], [bx, tb, bz], face);
    // the top: seracs, then the long white tongue back up the valley
    const [mx, mz] = at(P, -12, (w0 + w1) / 2), my = WATER + Math.max(h0, h1) + 4 + rnd() * 5;
    B.tri([ax, ta, az], [mx, my, mz], [bx, tb, bz], ICE);
    B.tri([ax, ta, az], [cx, gc, cz], [mx, my, mz], rnd() < .5 ? ICE : ICE2); B.tri([mx, my, mz], [cx, gc, cz], [dx, gd, dz], ICE); B.tri([mx, my, mz], [dx, gd, dz], [bx, tb, bz], rnd() < .5 ? ICE : ICE2);
  }
  return B.out();
}
function columnsMesh(P) {
  // basalt columns in a honeycomb, highest at the cliff foot, stepping down into the sea
  reseed(703); const B = near0(P), r = 2.2, cave = P.o.cave;
  const cells = [];
  for (let i = -16; i <= 16; i++) for (let j = -26; j <= 26; j++) {
    const s = j * r * 1.5, w = (i + (j & 1) * .5) * r * Math.sqrt(3);
    if (Math.hypot(s, w) > P.r) continue;
    const [x, z] = at(P, s + P.r * .45, w), g = height(x, z);
    // the causeway: from the cliff (s < 0) down to the water and out under it
    let top = Math.max(g, WATER) + .1 + Math.max(0, -s / P.r) * 2.6 + rnd() * 1.4 + (rnd() < .15 ? 1.2 : 0);
    if (cave) top = Math.max(top, WATER + .6 + (Math.abs(w) > 9 ? 16 + rnd() * 4 : rnd() * 1.4));
    cells.push([x, z, Math.min(g, WATER) - 2.5, top]);
  }
  for (const [x, z, y0, y1] of cells) { const k = Math.floor(rnd() * 4); hex(B, x, z, r * .97, y0, y1, BASALTS[k], BASALTS[(k + 1) % 4]); }
  if (cave) {
    // Fingal's: a roof of columns over the hall, its mouth to the sea
    for (let k = -14; k <= 14; k++) {
      const [x0, z0] = at(P, k * 1.6, -10), [x1, z1] = at(P, k * 1.6, 10), [x2, z2] = at(P, (k + 1) * 1.6, 10), [x3, z3] = at(P, (k + 1) * 1.6, -10), y = WATER + 18 + Math.sin(k * 1.7) * .6;
      B.tri([x0, y, z0], [x1, y + 1.5, z1], [x2, y + 1.5, z2], BASALT2); B.tri([x0, y, z0], [x2, y + 1.5, z2], [x3, y, z3], BASALT);
      B.tri([x0, y - .1, z0], [x2, y + 1.4, z2], [x1, y + 1.4, z1], BASALT); B.tri([x0, y - .1, z0], [x3, y - .1, z3], [x2, y + 1.4, z2], BASALT2);
    }
  }
  return B.out();
}

export function natureSystem(G) {
  const { R, b } = G, made = new Map();
  let near = [], look = 0;
  const shape = P => {
    let m = made.get(P.id);
    if (!m) {
      const tris = P.form === 'geyser' ? geyserMesh(P) : P.form === 'glacier' ? glacierMesh(P) : P.form === 'columns' ? columnsMesh(P) : null;
      m = tris ? 'nat_' + P.key : '';
      if (m) R.shape(m, tris);
      made.set(P.id, m);
    }
    return m;
  };
  // the Causeway's and the cave's columns are stepping stones to land on (their tops)
  env.solids.push((x, z, r, out) => {
    for (const P of near) if (P.form === 'columns' && Math.hypot(P.x - x, P.z - z) < P.r + r + 20) {
      const y = Math.max(height(P.x, P.z), WATER) + .8;
      out.push({ x: P.x, z: P.z, r: 2.5, y0: y - 3, top: y, perch: { x: P.x, y, z: P.z, top: true } });
    }
  });
  G.dev?.add({ id: 'real-wonders', title: 'Real wonders: Uluru, Victoria Falls, the Causeway...', how: 'Fast-travel to each from the Map once found, or Try it here for the nearest.', area: 'world', go: () => { const P = realPlaces().slice().sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (P) G.travelTo?.(P.x + 120, P.z + 120); } });
  return {
    id: 'nature',
    update(dt) {
      if ((look -= dt) <= 0) { look = 1; near = realPlaces().filter(P => Math.abs(P.x - b.p[0]) < NEAR && Math.abs(P.z - b.p[2]) < NEAR); }
      // the geysers blow on their own clocks (the same for everyone: from the game clock)
      for (const P of near) {
        const e = ERUPT[P.key]; if (!e) continue;
        const t = (G.clock || G.t) % e[0];
        if (t < e[1] && Math.hypot(P.x - b.p[0], P.z - b.p[2]) < 900) {
          const y = height(P.x, P.z) + 1.4, k = t < 1 ? t : t > e[1] - 1.5 ? (e[1] - t) / 1.5 : 1;
          for (let i = 0; i < 26 * dt * k * 10 && i < 14; i++) G.part([P.x + (Math.random() - .5), y, P.z + (Math.random() - .5)], [(Math.random() - .5) * 1.6, 6 + Math.random() * 3.5, (Math.random() - .5) * 1.6], 3.2 + Math.random(), [.93, .95, .97], .22 + Math.random() * .14);
        } else if (Math.random() < dt * 3 && Math.hypot(P.x - b.p[0], P.z - b.p[2]) < 500) {
          G.part([P.x, height(P.x, P.z) + 1.4, P.z], [(Math.random() - .5) * .4, .8 + Math.random() * .6, (Math.random() - .5) * .4], 3, [.9, .92, .94], .18);   // a wisp of steam between
        }
      }
    },
    scene(S) {
      for (const P of near) {
        const m = shape(P); if (!m) continue;
        (S.props[m] ||= []).push(P.x, 0, P.z, 1, 0, .5, 0, 0);
      }
    },
  };
}
