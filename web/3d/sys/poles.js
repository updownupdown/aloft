// The ends of the Earth: the world's north and south edges (earth.js NORTH, SOUTH) are the pack
// ice, and past it nothing. Not a wall: the last few kilometres are a place of their own. The
// air turns white and the horizon goes, a cold wind blows steadily back toward the middle of the
// world, the lights dance overhead all night whatever the weather, and reaching the ice edge is a
// find (a landmark, a postcard). Further, the wind is too strong to beat: the bird is turned back.
import { NORTH, SOUTH } from '../earth.js';
import { height, WATER } from '../world.js';
import { mix3, smooth } from '../util.js';

export const POLES = {
  near: 5000,       // metres from the edge where the white begins
  edge: 1200,       // metres from the edge: the ice edge, found here
  push: 9,          // the wind back at the very edge, m/s
};

export function polesSystem(G) {
  const b = G.b, P = POLES;
  let k = 0, side = 0;
  G.poleWind = [0, 0];
  const EDGES = { n: { name: 'The Edge of the Northern Ice', note: 'Where the world ends in ice: the wind turns you back, the lights burn all night.' },
    s: { name: 'The Edge of the Southern Ice', note: 'Antarctica: pack ice to the end of the world, and the southern lights.' } };
  G.hud.tip('poles', () => k > .3, 'The end of the world: ice, white air and a wind that turns you back. Look up at night.');
  function find(key, z) {
    const J = G.journey; if (!J || J.found['ice-' + key]) return;
    const e = EDGES[key], l = { id: 'ice-' + key, name: e.name, kind: 'sight', x: b.p[0], y: Math.max(height(b.p[0], z), WATER), z };
    J.found[l.id] = { name: e.name, x: Math.round(l.x), z: Math.round(z), note: `${e.note} Reached on ${G.date?.text || `day ${G.day}`}.` };
    G.hud.name(e.name); G.hud.glint(e.name, e.note, 'south'); G.audio.learned?.();
    G.emit('landmark', l);
  }
  return {
    id: 'poles',
    update(dt) {
      const z = b.p[2], dn = z - NORTH, ds = SOUTH - z;
      side = dn < ds ? 1 : -1;   // +1: the wind blows south (+z), away from the north edge
      const d = Math.min(dn, ds);
      k = smooth(P.near, 0, d);
      const push = P.push * smooth(P.near * .6, 0, d) + (d < 300 ? 12 * smooth(300, 0, d) : 0);
      G.poleWind = [0, side * push];
      if (k > .1 && G.aurora < k) G.aurora = Math.max(G.aurora, k * .9);
      if (d < P.edge) find(side > 0 ? 'n' : 's', side > 0 ? NORTH + P.edge * .5 : SOUTH - P.edge * .5);
      if (d < 40) { b.p[2] = side > 0 ? NORTH + 40 : SOUTH - 40; }   // and no further
    },
    scene(S) {
      if (k < .01) return;
      const day = G.light?.daylight ?? 1, white = [.9, .93, .96].map(v => v * (.25 + .75 * day));
      S.horizon = mix3(S.horizon, white, k * .8); S.zenith = mix3(S.zenith, white, k * .45); S.cloud = mix3(S.cloud, white, k * .5);
      S.fogDen = (S.fogDen || .0042) + k * k * .006;
      if (S.aurora != null) S.aurora = Math.max(S.aurora, k * (G.light?.night || 0));
    },
  };
}
