// Look tests (Settings > Advanced > Look tests): the graphics ideas on trial (James, 10-24: A to G),
// a switch each with its price in the sub; P real shadows and T mirror reflections are Settings >
// Graphics > Ultra (app.js). Each look with `def` compiles a #define into the shaders (render.js
// R.relook). Settled before: flat far trees kept; smooth shading, land detail, the first A to D and
// the grain choice taken out; the grain is Paper. ?look=wind (or ?look=all, or ?look=A,C) tries
// them for one visit without saving.
import { store } from './util.js';

export const LOOKS = [
  { id: 'shadows', letter: 'P', def: 'L_SHADOW', ultra: true, label: 'Real shadows' },
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections' },
  { id: 'wind', letter: 'A', def: 'L_WIND', label: 'Wind waves on the meadows', sub: 'pale waves of wind rolling downwind across far grassland, quicker in a strong wind. Cost: about 0.1 to 0.2 ms a frame (two noise reads a ground pixel)' },
  { id: 'dew', letter: 'B', def: 'L_DEW', label: 'Dew at dawn', sub: 'tiny glints in the grass near you in the early morning, brightest looking toward the low sun; none after rain or in snow. Cost: under 0.1 ms (one hash a near ground pixel)' },
  { id: 'foam', letter: 'C', def: 'L_FOAM', label: 'Shore foam', sub: 'soft broken foam lapping in and out along lake shores and coasts. Cost: under 0.1 ms (two noise reads a near water pixel)' },
  { id: 'ridges', letter: 'D', def: 'L_RIDGES', label: 'Layered blue ridges', sub: 'far ridges a little cooler and paler with each distance, like an ink-wash painting, by day. Cost: about 0.05 ms' },
  { id: 'underglow', letter: 'E', def: 'L_UNDERGLOW', label: 'Sunset clouds lit from below', sub: 'at sunrise and sunset the clouds\' bases glow warm. Cost: almost none (a few sums a cloud pixel)' },
  { id: 'dapple', letter: 'F', def: 'L_DAPPLE', label: 'Dappled light under trees', sub: 'moving patches of sun and shade round you when you are low in a wood or perched. Cost: about 0.1 to 0.2 ms, only in woods (two noise reads a near pixel)' },
  { id: 'glory', letter: 'G', def: 'L_GLORY', label: 'Halo on the mist', sub: 'rings of colour round your shadow\'s point on mist or cloud below you, with the sun behind. Cost: about 0.05 ms, only on mist or cloud seen from above' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  // (the ultra ones, P and T, have no switch: Settings > Graphics > Ultra turns them on, app.js)
  const ultra = () => G.gfx?.preset === 'ultra';
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : L.ultra ? ultra() : !!store.get('look.' + L.id, false);
  R.relook?.();
  const set = (ids, v) => {
    let changed = false;
    for (const id of ids) { const L = LOOKS.find(l => l.id === id); if (R.look[id] === v) continue; R.look[id] = v; changed = true; if (!forced && !L.ultra) store.set('look.' + id, v); }
    if (changed) { R.relook?.(); G.emit('look', R.look); }
  };
  G.on('gfx', () => { if (!forced) set(LOOKS.filter(L => L.ultra).map(L => L.id), ultra()); });
  for (const L of LOOKS.filter(l => !l.ultra)) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set([L.id], v) });
  G.dev?.add({ id: 'look-tests-ag', area: 'Settings and performance', title: 'Look tests A to G: wind waves, dew, shore foam, blue ridges, sunset undersides, dappled light, halo on the mist', how: 'Settings > Advanced > Look tests. Try each where it shows (meadows, dawn, shores, far hills, sunset, woods, above mist); Dev tools > Frame cost shows the price.' });
}

// The colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
export const GRADE_GLSL = `
uniform vec3 uGradeT;
// the grain over everything: white noise on every screen pixel, a paper grain (James, 10-24:
// Paper). uGrain.y is its strength (render.js: a little stronger on dense phone screens)
float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
uniform vec4 uGrain;
float grain() { return 1. + (gh(floor(gl_FragCoord.xy)) - .5) * uGrain.y; }
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
