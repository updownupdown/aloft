// Look tests (Settings > Advanced > Look tests): the graphics study's ideas still being tried, behind
// a switch each, with its price in the sub. The rest were settled (James, 10-23 and 10-24): kept
// ones are just the game now, with no switch; P and T are Settings > Graphics > Ultra (app.js).
// R.look[id] is on or off; a switch with `def` compiles a #define into the shaders (render.js R.relook).
// ?look=detail (or ?look=all) tries them for one visit without saving.
import { store } from './util.js';

export const LOOKS = [
  { id: 'shadows', letter: 'P', def: 'L_SHADOW', ultra: true, label: 'Real shadows' },
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections' },
  { id: 'detail', letter: 'V', def: 'L_DETAIL', on: true, label: 'Land detail', sub: 'soft organic mottling over the ground, patches of light and dark grass, earth and stone, finer up close. Cost: low, a few noise reads a ground pixel. Concerns: it reads as texture rather than pure low poly' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  // (the ultra ones, P and T, have no switch: Settings > Graphics > Ultra turns them on, app.js)
  const ultra = () => G.gfx?.preset === 'ultra';
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : L.ultra ? ultra() : !!store.get('look.' + L.id, !!L.on);
  R.relook?.();
  const set = (ids, v) => {
    for (const id of ids) { const L = LOOKS.find(l => l.id === id); if (R.look[id] === v) continue; R.look[id] = v; if (!forced && !L.ultra) store.set('look.' + id, v); }
    R.relook?.();
    G.emit('look', R.look);
  };
  G.on('gfx', () => { if (!forced) set(LOOKS.filter(L => L.ultra).map(L => L.id), ultra()); });
  for (const L of LOOKS.filter(l => !l.ultra)) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set([L.id], v) });
  G.dev?.add({ id: 'look-tests', area: 'Settings and performance', title: 'Look tests: the graphics ideas still on trial', how: 'Settings > Advanced > Look tests. Try each in day, dusk, rain and over water; Dev tools > Frame cost shows the price.' });
}

// The colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
export const GRADE_GLSL = `
uniform vec3 uGradeT;
// the grain over everything (James, 10-24: "blue noise... grain and realism"): white noise with its
// neighbours' mean taken off, so it is fine and even with no clumps (blue-ish), in cells of about
// one CSS pixel (uGrain.x device pixels), so a phone's dense screen shows it as a desktop does
float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
uniform vec2 uGrain;
float grain() {
  vec2 p = floor(gl_FragCoord.xy / max(uGrain.x, 1.));
  float b = gh(p) - .25 * (gh(p + vec2(1, 0)) + gh(p - vec2(1, 0)) + gh(p + vec2(0, 1)) + gh(p - vec2(0, 1)));
  return 1. + b * uGrain.y;
}
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
