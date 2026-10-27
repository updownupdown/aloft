// Look tests (Settings > Advanced > Look tests): ideas on trial, a switch each with its price in
// the sub (an entry with `sub` gets a switch; with `def` it compiles a #define into the shaders,
// render.js R.relook). None on trial now. T mirror reflections follows Ultra (app.js) and C shore
// foam High and Ultra (James 10-25), with no switch. Kept for good, no switch: D layered blue
// ridges, E sunset undersides, G the glory (10-24); from the performance study V the ground's light
// per vertex, N noise from a picture, K trees one-sided, O trees before the ground, H your shadow
// has your shape, S sun glare, W soft dark corners (10-26), M half-precision colours (LP_GLSL),
// L cheaper far clouds (clouds.js), X far horizons (render.js rings[2], the layered haze) (10-27).
// Taken out: A wind waves, B dew, F dappled light, J long evening shadows, real shadows, smooth
// shading, land detail, the grain choice.
// ?look=foam (or ?look=all) tries them for one visit without saving.
import { store } from './util.js';

export const LOOKS = [
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections' },
  { id: 'foam', letter: 'C', def: 'L_FOAM', high: true, label: 'Shore foam' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  const ultra = () => G.gfx?.preset === 'ultra', high = () => (G.gfx?.level ?? 1) >= 2;
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : L.ultra ? ultra() : L.high ? high() : !!store.get('look.' + L.id, false);
  R.relook?.();
  const set = (id, v) => {
    if (R.look[id] === v) return;
    const L = LOOKS.find(l => l.id === id); R.look[id] = v; if (!forced && L.sub) store.set('look.' + id, v);
    R.relook?.(); G.emit('look', R.look);
  };
  for (const L of LOOKS.filter(l => l.sub)) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set(L.id, v) });
  G.on('gfx', () => { if (!forced) { set('reflect', ultra()); set('foam', high()); } });
  G.dev?.add({ id: 'look-tests-ag', area: 'Settings and performance', title: 'Shore foam at High and Ultra (no switch); blue ridges, sunset undersides and the glory kept', how: 'Settings > Graphics > High, then a lake shore or coast. Far hills by day, sunset clouds, mist below you with the sun behind.' });
}

// The colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
// LP: the precision colours are worked in, mediump (half floats, about twice as fast on a phone's
// GPU; M, James 10-27), while positions and distances stay highp
export const LP_GLSL = `
#ifndef LP
#define LP mediump
#endif`;
export const GRADE_GLSL = `${LP_GLSL}
uniform LP vec3 uGradeT;
// the grain over everything: white noise on every screen pixel, a paper grain (James, 10-24:
// Paper). uGrain.y is its strength (render.js: a little stronger on dense phone screens)
float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
uniform vec4 uGrain;
LP float grain() { return 1. + (gh(floor(gl_FragCoord.xy)) - .5) * uGrain.y; }
LP vec3 grade(LP vec3 c) {
  c = c * (1. + c * .12) / (1. + c * .32);
  float l = dot(c, vec3(.3, .55, .15));
  c = mix(c, c * vec3(1.04, 1., .93) + vec3(.014, .009, 0.), 1. - smoothstep(.1, .5, l));
  c *= uGradeT * 1.07;
  // the corners a touch darker, as a lens does (uGrain.zw is the screen's size, render.js)
  c *= 1. - .2 * smoothstep(.3, .78, length(gl_FragCoord.xy / max(uGrain.zw, vec2(1.)) - .5));
  return c;
}`;
const DAY = [1.015, 1, .975], GOLD = [1.07, .99, .86], NIGHT = [.93, .98, 1.06];
// the tint: a touch warm by day, golden with the sun low, cool at night
export function gradeTint(S) {
  const el = (S.sunSky || S.sun)[1], gold = Math.max(0, 1 - Math.abs(el - .06) / .22), n = S.night || 0;
  return DAY.map((v, k) => { const g = v + (GOLD[k] - v) * gold; return g + (NIGHT[k] - g) * n; });
}
