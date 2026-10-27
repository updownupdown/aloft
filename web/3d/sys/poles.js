// The ends of the Earth: the world's north and south edges (earth.js NORTH, SOUTH) are the pack
// ice and, in the south, the coast of Antarctica. The last few kilometres are a place of their
// own: the air turns pale, the lights dance overhead all night whatever the weather, and reaching
// the ice edge is a find (a landmark). Near the very edge stands the pole: a tall see-through wall
// of blue hatching. Fly through it and you cross over the top of the world, as on a globe: the
// screen fades, and you come out on the far side of the pole (the opposite longitude, at the
// same distance from the edge), flying away from it (James, 2026-10-23).
import { NORTH, SOUTH, EARTH, latLon, wrapX } from '../earth.js';
import { height, WATER } from '../world.js';
import { mix3, smooth } from '../util.js';

export const POLES = {
  near: 5000,       // metres from the edge where the pale air begins
  edge: 1200,       // metres from the edge: the ice edge, found here
  wall: 500,        // metres from the edge: the pole, a wall you can fly through
  show: 3500,       // the wall shows within this distance
  out: 1.2,         // seconds: fading out, then (black) the crossing, then back in over `back`
  back: 1.4,
};

// the place at the opposite longitude on the same row (the map's longitudes are not evenly
// spaced: oceans narrowed, Europe enlarged, so it is looked up, not half the world away)
export function farSide(x, z) {
  const want = latLon(x, z)[1] + 180, off = l => Math.abs(((l - want) % 360 + 540) % 360 - 180);
  let best = x, bd = 1e9;
  for (let s = 0; s < EARTH.W; s += 250) { const q = wrapX(x + s), d = off(latLon(q, z)[1]); if (d < bd) { bd = d; best = q; } }
  for (let s = -250; s <= 250; s += 25) { const q = wrapX(best + s), d = off(latLon(q, z)[1]); if (d < bd) { bd = d; best = q; } }
  return best;
}

export function polesSystem(G) {
  const b = G.b, P = POLES, ui = document.getElementById('ui3') || document.body;
  let k = 0, side = 0, d = 1e9, cross = null;
  G.poleWind = [0, 0];
  ui.insertAdjacentHTML('beforeend', `<div class="pole3"></div><style>
    .pole3 { position: fixed; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity ${P.out}s ease-in; z-index: 5; }
    .pole3.on { opacity: 1; pointer-events: auto; }
    .pole3.back { transition: opacity ${P.back}s ease-out; }
  </style>`);
  const veil = ui.querySelector('.pole3');
  const EDGES = { n: { name: 'The Edge of the Northern Ice', note: 'Where the world ends in ice: the pole just beyond, the lights burn all night.' },
    s: { name: 'The Edge of the Southern Ice', note: 'Antarctica: ice ridges, mountains and the southern lights, the pole just beyond.' } };
  const SAID = {
    n: ['Over the top of the world! You crossed the North Pole: every way from here is south.', 'The North Pole again. Out on the far side of the world, heading south.'],
    s: ['Over the bottom of the world! You crossed the South Pole: every way from here is north.', 'The South Pole again. Out on the far side of the world, heading north.'],
  };
  G.hud.tip('poles', () => k > .3, 'The end of the world: ice, pale air and the pole, a blue wall ahead. Fly through it to cross over the top of the world. Look up at night.');
  function find(key, z) {
    const J = G.journey; if (!J || J.found['ice-' + key]) return;
    const e = EDGES[key], l = { id: 'ice-' + key, name: e.name, kind: 'sight', x: b.p[0], y: Math.max(height(b.p[0], z), WATER), z };
    J.found[l.id] = { name: e.name, x: Math.round(l.x), z: Math.round(z), note: `${e.note} Reached on ${G.date?.text || `day ${G.day}`}.` };
    G.hud.name(e.name, 'south'); G.hud.glint(e.name, e.note, 'south'); G.audio.learned?.();
    G.emit('landmark', l);
  }
  // the crossing: the HUD and the thumbs go, black, over the pole, and back
  function begin(key) {
    cross = { t: 0, key, moved: false };
    G.noControl = true; G.hud.hide(true);
    veil.classList.remove('back'); veil.classList.add('on');
  }
  function over() {
    const north = cross.key === 'n', dEdge = P.wall + 220;
    const x = farSide(b.p[0], b.p[2]), z = north ? NORTH + dEdge : SOUTH - dEdge;
    const g = Math.max(height(x, z), WATER);
    b.p = [x, Math.max(b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER), 25) + g, z];
    b.yaw += Math.PI;   // still flying away from the pole: a turn about, on the flat map
    if (b.from) b.from = null;
    b.state = b.state === 'fly' ? 'fly' : b.state; b.snapCam = true;
    G.systems.clock?.reseason?.();
    cross.moved = true;
  }
  function end() {
    G.noControl = false; G.hud.hide(false);
    const n = G.flags.poles = (G.flags.poles || 0) + 1, s = SAID[cross.key];
    G.hud.say(n === 1 ? s[0] : s[1], { kind: 'event', secs: 6, icon: 'south' });
    cross = null;
  }
  return {
    id: 'poles',
    update(dt) {
      const z = b.p[2], dn = z - NORTH, ds = SOUTH - z;
      side = dn < ds ? 1 : -1;   // +1: near the north edge
      d = Math.min(dn, ds);
      k = smooth(P.near, 0, d);
      G.poleWind = [0, 0];
      if (k > .1 && G.aurora < k) G.aurora = Math.max(G.aurora, k * .9);
      if (d < P.edge) find(side > 0 ? 'n' : 's', side > 0 ? NORTH + P.edge * .5 : SOUTH - P.edge * .5);
      if (cross) {
        cross.t += dt;
        if (!cross.moved && cross.t > P.out + .15) { over(); veil.classList.add('back'); veil.classList.remove('on'); }
        if (cross.moved && cross.t > P.out + .15 + P.back) end();
      } else if (d < P.wall && b.state !== 'perch' && !G.ages?.gap()) begin(side > 0 ? 'n' : 's');   // (or the gap in the aurora: sys/ages.js)
      if (d < 40) b.p[2] = side > 0 ? NORTH + 40 : SOUTH - 40;   // (never off the world, whatever happens)
    },
    scene(S) {
      if (k < .01) return;
      const day = G.light?.daylight ?? 1, white = [.9, .93, .96].map(v => v * (.25 + .75 * day));
      // (light enough that the ridges and mountains of the ice still read)
      S.horizon = mix3(S.horizon, white, k * .55); S.zenith = mix3(S.zenith, white, k * .3); S.cloud = mix3(S.cloud, white, k * .5);
      S.fogDen = (S.fogDen || .0042) + k * k * .0016;
      if (S.aurora != null) S.aurora = Math.max(S.aurora, k * (G.light?.night || 0));
      wall(S);
    },
  };

  // The pole: a tall wall of blue hatching across the world, near the edge, fading in as you come
  // near and out to either side of you (only the piece round the camera is drawn)
  function wall(S) {
    const cam = S.cam, wz = side > 0 ? NORTH + P.wall : SOUTH - P.wall, dist = Math.abs(cam[2] - wz);
    const a0 = smooth(P.show, P.show * .3, dist); if (a0 < .01) return;
    const R = S.ribbon ||= [], H = 760, y0 = -6, gap = 24, wide = 6, span = 1900;
    const night = G.light?.night || 0, col = mix3([.22, .48, .98], [.45, .7, 1], night);
    const fade = s => a0 * Math.max(0, 1 - Math.abs(s - cam[0]) / span);
    const v = (s, y, a) => R.push(s, y, wz, col[0], col[1], col[2], a);
    const quad = (s0, s1, s2, s3, ya, yb, a) => {   // (s0, ya) (s1, ya) (s2, yb) (s3, yb)
      const p = [[s0, ya], [s1, ya], [s2, yb], [s3, yb]].map(([s, y]) => [s, y, fade(s) * a * (1 - .5 * (y - y0) / H)]);
      for (const i of [0, 1, 2, 0, 2, 3]) v(...p[i]);
    };
    // a faint sheet, a brighter foot and brow, then the hatching (45 degrees)
    const s0 = cam[0] - span, s1 = cam[0] + span;
    quad(s0, s1, s1, s0, y0, y0 + H, .07);
    quad(s0, s1, s1, s0, y0, y0 + 5, .35);
    quad(s0, s1, s1, s0, y0 + H - 4, y0 + H, .3);
    const first = Math.floor((s0 - H) / gap) * gap;
    for (let u = first; u < s1; u += gap) quad(u, u + wide, u + wide + H, u + H, y0, y0 + H, .34);
  }
}
