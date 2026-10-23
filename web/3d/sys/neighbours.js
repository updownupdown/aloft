// The neighbours: a resident pair of your own kind (a red-tail pair for the hawk) holds one valley a little way from home. They circle
// over it by day; come in low and they rise, call and see you off, harrying you (a little
// stamina) until you leave or climb high over. Their valley shows on the Map. One spring in a
// while it comes free: the pair is gone and the valley is yours if you want it.
import { height, WATER, ih } from '../world.js';
import { PIG } from '../facet.js';
import { BIRD } from '../hawk.js';
import { birdKey } from '../icons.js';
import { kind } from './story.js';

export const NEIGHBOURS = {
  r: 380,           // the valley's radius, metres
  high: 120,        // pass this high over the ground and they let you be
  harry: .05,       // stamina per second while they see you off (more than gliding wins back)
  freeChance: .25,  // each new year, the chance their valley comes free
};

// the deepest valley floor in a ring 1.4-2.6 km from where you began: the lowest ground against its surroundings
function findValley([HX, HZ]) {
  let best = null;
  for (let i = 0; i < 28; i++) {
    const a = ih(i, 3, 611) * 6.283, d = 1400 + ih(i, 4, 612) * 1200;
    const x = HX + Math.cos(a) * d, z = HZ + Math.sin(a) * d, y = height(x, z);
    if (y < WATER + 3 || y > 80) continue;
    let rim = 0; for (let k = 0; k < 8; k++) rim += height(x + Math.cos(k * .785) * 320, z + Math.sin(k * .785) * 320);
    const score = rim / 8 - y;
    if (!best || score > best.score) best = { x, z, score };
  }
  return best || { x: HX + 1800, z: HZ - 600 };
}

export function neighboursSystem(G) {
  const b = G.b, H = G.hud, N = NEIGHBOURS;
  const V = findValley(G.home || [G.b.p[0], G.b.p[2]]);
  const st = { free: false, met: false, freeYear: 0 };
  const pair = [0, 1].map(i => ({ p: [V.x, height(V.x, V.z) + 60, V.z], yaw: 0, phase: i * Math.PI }));
  let chase = 0, callT = 0, told = false;

  const inValley = () => Math.hypot(b.p[0] - V.x, b.p[2] - V.z) < N.r;
  const low = () => b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER) < N.high;

  G.mapPlaces = ((prev) => () => [...(prev?.() || []), st.free
    ? { x: V.x, z: V.z, name: 'The empty valley', note: 'The neighbours have gone. Their valley is free.', col: PIG.meadow }
    : { x: V.x, z: V.z, name: 'The neighbours’ valley', note: `A${'aeiou'.includes(kind()[2][0]) ? 'n' : ''} ${kind()[2]} pair holds it. Pass high over, or they see you off.`, col: PIG.berry }])(G.mapPlaces);

  G.dev?.add({ id: 'neighbours', area: 'Wildlife', round: 'R8 F3', pr: 182, title: 'The neighbours: a red-tail pair holds one valley',
    how: 'Map: the neighbours’ valley. Fly in under 120 m and they rise, call and harry you; pass high over and they let you be. One spring it may come free. Try it puts you there.',
    go: () => { b.state = 'fly'; b.perch = null; b.p = [V.x + 60, height(V.x + 60, V.z) + 40, V.z]; b.s = 12; b.yaw = -Math.PI / 2; } });

  G.on('newYear', y => {
    if (st.free || ih(y || 1, 5, 613) > N.freeChance) return;
    st.free = true; st.freeYear = y || 1;
    H.toast('The neighbours’ valley stands empty this spring. The pair has gone, and it is yours if you want it.', 7);
  });

  function fly(dt) {
    const day = (G.light?.daylight ?? 1) > .2, g = height(V.x, V.z);
    chase += ((b.state === 'fly' || b.state === 'perch') && inValley() && low() && day ? 1 : -1) * dt / 1.5;
    chase = Math.max(0, Math.min(1, chase));
    for (const h of pair) {
      // home: circling high over the valley floor; chasing: tight round you, a little above
      const a = G.t * .18 + h.phase, home = [V.x + Math.cos(a) * 70, g + 70 + Math.sin(a * .7) * 8, V.z + Math.sin(a) * 70];
      const c = G.t * 1.1 + h.phase, ax = b.p[0] + Math.sin(b.yaw) * 22, az = b.p[2] - Math.cos(b.yaw) * 22;   // round a point just ahead of you, where you see them
      const near = [ax + Math.cos(c) * 10, b.p[1] - .5 + Math.sin(c * 1.7) * 1.5, az + Math.sin(c) * 10];
      const goal = chase > .05 ? near : home, k = Math.min(1, dt * (chase > .05 ? 1.6 : .5));
      const dx = goal[0] - h.p[0], dz = goal[2] - h.p[2];
      if (Math.hypot(dx, dz) > .3) h.yaw = Math.atan2(dz, dx);   // facing the way it moves
      for (let j = 0; j < 3; j++) h.p[j] += (goal[j] - h.p[j]) * k;
    }
    if (chase > .6) {
      b.stamina = Math.max(0, b.stamina - N.harry * dt);
      if ((callT -= dt) <= 0) { callT = 2.5 + Math.random() * 2; G.audio.call?.(BIRD, false, null, .8); }
      if (!told) { told = true; if (st.met) H.tally('The neighbours rise to see you off', birdKey(BIRD)); else H.say(`A${'aeiou'.includes(kind()[2][0]) ? 'n' : ''} ${kind()[2]} pair rises, calling: this valley is theirs. Climb high over it, or go round.`, { kind: 'warn', secs: 5, icon: 'climb' }); st.met = true; G.emit('neighbours'); }
    } else if (chase < .1 && told) { told = false; }
  }

  return {
    id: 'neighbours',
    update(dt) { if (!st.free) fly(dt); else chase = 0; },
    scene(S) {
      if (st.free) return;
      // drawn with your mate's shapes (story.js), so they are always your own kind
      for (const h of pair) {
        if (Math.hypot(h.p[0] - S.cam[0], h.p[2] - S.cam[2]) > 1500) continue;
        const beat = Math.sin(G.t * 1.3 + h.phase) > .85, ph = (G.t * 7 + h.phase) % 2;
        (S.props[!beat ? 'hawkGlide' : ph < 1 ? 'hawkUp' : 'hawkDown'] ||= []).push(h.p[0], h.p[1], h.p[2], .62, h.yaw, .55, 0, 0);
        G.sight?.(kind()[1], h.p[0], h.p[1], h.p[2], .9);
      }
    },
    save: () => ({ ...st }),
    load(o) { Object.assign(st, o || {}); },
    valley: V,
    get chase() { return chase; }, pair,
  };
}
