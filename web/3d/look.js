// Look tests (Settings > Advanced > Look tests): the graphics ideas still being tried, behind a
// switch each, with its price in the sub (James, 10-24: A to D), and a choice of grains. The rest
// were settled: kept ones are just the game now, with no switch; P and T are Settings > Graphics >
// Ultra (app.js); smooth shading and land detail were tried and taken out (10-24).
// R.look[id] is on or off; a switch with `def` compiles a #define into the shaders (render.js R.relook).
// ?look=crowns (or ?look=all, or ?look=A,C) tries them for one visit without saving.
import { store } from './util.js';

export const LOOKS = [
  { id: 'shadows', letter: 'P', def: 'L_SHADOW', ultra: true, label: 'Real shadows' },
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections' },
  { id: 'crowns', letter: 'A', def: 'L_CROWNS', label: 'Fluffy crowns', sub: 'leafy edges cut into the tree crowns where they turn away from you, and clumps of light and shade in the leaves. Cost: low, a little noise a leaf pixel. Concerns: up close the cut edges can show the crown\'s darker inside' },
  { id: 'grass', letter: 'B', label: 'Grass near you', sub: 'patches of real blades swaying in the meadows within about 30 m, growing in from nothing as you come near. Cost: medium, up to a few hundred more clumps to draw near the ground. Concerns: battery when flying low over grassland' },
  { id: 'soft', letter: 'C', label: 'Soft distance', sub: 'far hills a little soft, like a camera lens, the near world sharp. Cost: high for a phone, about 1 to 3 ms a frame (the picture drawn offscreen, then blurred by depth). Concerns: memory; far grain softened' },
  { id: 'paint', letter: 'D', def: 'L_PAINT', label: 'Painterly light', sub: 'a warmer glow where the sun hits and where light turns to shade, and shadows tinted by the sky. Cost: very low. Concerns: dusk may read too orange' },
];

// the grains (Settings > Advanced > Look tests > Grain): [cell in CSS px (0: one screen pixel),
// strength, blue (fine and even, no clumps) or white, moving with each frame]
export const GRAINS = [
  ['off', 'Off', [0, 0, 0, 0]],
  ['paper', 'Paper', [0, .05, 0, 0], 'the first grain: white noise on every screen pixel (finest on a phone)'],
  ['fine', 'Fine', [1, .075, 1, 0], 'blue noise, one CSS pixel, light (the grain of build 228)'],
  ['strong', 'Strong', [1, .16, 1, 0], 'blue noise, one CSS pixel, clearly there'],
  ['coarse', 'Coarse', [2, .14, 1, 0], 'blue noise in two-pixel grains, like rough paper'],
  ['film', 'Film', [1, .12, 1, 1], 'blue noise that moves every frame, like film'],
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
  // the grain: one of GRAINS, render.js R.draw turns it into uGrain
  const gq = new URLSearchParams(location.search).get('grain');
  R.grain = GRAINS.find(g => g[0] === (gq || store.get('grain', 'strong'))) ? gq || store.get('grain', 'strong') : 'strong';
  G.menu.choice('play', { label: 'Grain', group: 'looks', options: GRAINS.map(g => [g[0], g[1]]), get: () => R.grain,
    set: v => { R.grain = v; store.set('grain', v); }, sub: v => GRAINS.find(g => g[0] === v)?.[3] || 'no grain' });
  for (const L of LOOKS.filter(l => !l.ultra)) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set([L.id], v) });
  G.dev?.add({ id: 'look-tests', area: 'Settings and performance', title: 'Look tests: the graphics ideas still on trial', how: 'Settings > Advanced > Look tests. Try each in day, dusk, rain and over water; Dev tools > Frame cost shows the price.' });
}

// The colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
export const GRADE_GLSL = `
uniform vec3 uGradeT;
// the grain over everything (GRAINS; uGrain: cell in device pixels, strength, blue, frame seed).
// Blue is white noise with its neighbours' mean taken off, so it is fine and even with no clumps
float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
uniform vec4 uGrain;
float grain() {
  if (uGrain.y <= 0.) return 1.;
  vec2 p = floor(gl_FragCoord.xy / max(uGrain.x, 1.)) + uGrain.w * vec2(37., 17.);
  float b = uGrain.z > .5 ? gh(p) - .25 * (gh(p + vec2(1, 0)) + gh(p - vec2(1, 0)) + gh(p + vec2(0, 1)) + gh(p - vec2(0, 1))) : gh(p) - .5;
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
