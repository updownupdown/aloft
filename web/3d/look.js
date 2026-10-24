// Look tests (Settings > Advanced > Look tests): the graphics ideas still on trial, a switch each
// with its price in the sub; each with `def` compiles a #define into the shaders (render.js
// R.relook). Settled 10-24 (James): kept for good, with no switch, D layered blue ridges, E sunset
// undersides and G the glory (render.js, clouds.js); taken out A wind waves, B dew, F dappled
// light, real shadows, smooth shading, land detail and the grain choice (the grain is Paper).
// T mirror reflections has no switch: Settings > Graphics > Ultra turns it on (app.js).
// ?look=foam (or ?look=all) tries them for one visit without saving.
import { store } from './util.js';

export const LOOKS = [
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections' },
  { id: 'foam', letter: 'C', def: 'L_FOAM', label: 'Shore foam', sub: 'soft broken foam lapping in and out along lake shores and coasts, made wide to be seen (it can be dialled back). Cost: under 0.1 ms (two noise reads a near water pixel)' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  const ultra = () => G.gfx?.preset === 'ultra';
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : L.ultra ? ultra() : !!store.get('look.' + L.id, false);
  R.relook?.();
  const set = (id, v) => {
    if (R.look[id] === v) return;
    R.look[id] = v; if (!forced && !LOOKS.find(L => L.id === id).ultra) store.set('look.' + id, v);
    R.relook?.(); G.emit('look', R.look);
  };
  G.on('gfx', () => { if (!forced) set('reflect', ultra()); });
  for (const L of LOOKS.filter(l => !l.ultra)) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set(L.id, v) });
  G.dev?.add({ id: 'look-tests-ag', area: 'Settings and performance', title: 'Look tests: shore foam (C) still on trial; blue ridges, sunset undersides and the glory kept', how: 'Settings > Advanced > Look tests. Shores for foam; far hills by day, sunset clouds, mist below you with the sun behind.' });
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
