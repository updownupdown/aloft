// Look tests (Settings > Advanced > Look tests): the graphics study's ideas still being tried, each
// behind a switch, with its price in the sub. A-N and R were kept (James, 10-23) and are now just the
// game (their code has no switch); P and T are Graphics: Ultra (no switch, app.js); the rest go
// when James has picked, kept or dropped with their code.
// R.look[id] is on or off; a switch with `def` compiles a #define into the shaders (render.js
// R.relook), `chunks` rebuilds the ground (the bake is in world.js lookBakes, env.look).
// ?look=post,shadows (or ?look=all) tries some without saving.
import { store } from './util.js';
import { env } from './world.js';

export const LOOKS = [
  { id: 'impostors', letter: 'O', def: 'L_IMPOSTOR', label: 'Far-tree pictures', sub: 'far trees drawn as pictures of the near ones (impostors) instead of simple meshes. Cost: about free (fewer vertices, more see-through pixels; the pictures are drawn once). Concerns: flatter far trees, they ignore each tree’s turn, the season tint is approximate' },
  { id: 'shadows', letter: 'P', def: 'L_SHADOW', ultra: true, label: 'Real shadows', sub: 'a shadow map 240 m across round you: trees, rocks, ruins and you cast true shadows. Cost: high, about 1.5 to 3 ms a frame (the scene drawn again from the sun). Concerns: shadows end at 240 m, some flicker on slopes (acne), none at night' },
  { id: 'post', letter: 'Q', def: 'L_POST', label: 'Render to texture', sub: 'clouds meet the land softly, a gentle glow round bright things, clouds at half resolution. Cost: about 1 to 3 ms a frame and some memory (an offscreen picture, copies and a blur). Concerns: memory on the phone; motes are drawn over the clouds' },
  { id: 'smooth', letter: 'S', def: 'L_SMOOTH', chunks: true, label: 'Smooth shading', sub: 'turned down in the study: rounded hills and crowns instead of facets. Cost: free in frames; the ground builds a little slower. Concerns: it goes against the low-poly look' },
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections', sub: 'turned down: the water mirrors the hills, trees and clouds. Cost: very high, 40 to 80% more a frame (the world drawn twice). Concerns: the price; only over water' },
  { id: 'shafts', letter: 'U', def: 'L_SHAFTS', label: 'Light shafts', sub: 'turned down: sunbeams through the clouds and trees, toward the sun. Cost: high, about 1 to 3 ms (it needs the Render to texture pipeline, and 24 depth reads a pixel at quarter size). Concerns: only looking toward the sun; can look smeary' },
  { id: 'detail', letter: 'V', def: 'L_DETAIL', label: 'Land detail', sub: 'turned down: fine soft mottling on the ground close by, like a texture. Cost: low, a few noise reads a ground pixel close by. Concerns: it reads as a texture, against the low-poly look' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  // (the ultra ones, P and T, have no switch: Settings > Graphics > Ultra turns them on, app.js)
  const ultra = () => G.gfx?.preset === 'ultra';
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : L.ultra ? ultra() : !!store.get('look.' + L.id, false);
  const sync = () => { env.look = LOOKS.filter(L => L.chunks && R.look[L.id]).map(L => L.id).join(','); };   // (smooth shading's bake)
  sync();
  R.relook?.();
  const set = (ids, v) => {
    let chunks = false;
    for (const id of ids) { const L = LOOKS.find(l => l.id === id); if (R.look[id] === v) continue; R.look[id] = v; if (!forced && !L.ultra) store.set('look.' + id, v); chunks ||= L.chunks; }
    sync(); R.relook?.(); if (chunks) R.dropChunks();
    G.emit('look', R.look);
  };
  G.on('gfx', () => { if (!forced) set(LOOKS.filter(L => L.ultra).map(L => L.id), ultra()); });
  const TESTS = LOOKS.filter(L => !L.ultra);
  for (const L of TESTS) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set([L.id], v) });
  G.menu.button('play', { label: 'All look tests on', sub: 'every switch above at once (heavy)', group: 'looks', onClick: () => { set(TESTS.map(L => L.id), true); for (const f of G.menu.opens) f(); } });
  G.menu.button('play', { label: 'All look tests off', sub: 'the game as it was', group: 'looks', onClick: () => { set(TESTS.map(L => L.id), false); for (const f of G.menu.opens) f(); } });
  G.dev?.add({ id: 'look-tests', area: 'Settings and performance', title: 'Look tests: every idea from the graphics study behind a switch', how: 'Settings > Advanced > Look tests (O, Q, S, U, V; A-N and R are kept, P and T are Graphics: Ultra). Try each in day, dusk, rain and over water; Dev tools > Frame cost shows the price. ?look=all turns them all on for one visit.' });
}

// The colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
export const GRADE_GLSL = `
uniform vec3 uGradeT;
vec3 grade(vec3 c) {
  c = c * (1. + c * .12) / (1. + c * .32);
  float l = dot(c, vec3(.3, .55, .15));
  c = mix(c, c * vec3(1.04, 1., .93) + vec3(.014, .009, 0.), 1. - smoothstep(.1, .5, l));
  c *= uGradeT * 1.07;
  return c;
}`;
const DAY = [1.015, 1, .975], GOLD = [1.07, .99, .86], NIGHT = [.93, .98, 1.06];
// the tint: a touch warm by day, golden with the sun low, cool at night
export function gradeTint(S) {
  const el = (S.sunSky || S.sun)[1], gold = Math.max(0, 1 - Math.abs(el - .06) / .22), n = S.night || 0;
  return DAY.map((v, k) => { const g = v + (GOLD[k] - v) * gold; return g + (NIGHT[k] - g) * n; });
}
