// Look tests (Settings > Advanced > Look tests): every idea from the graphics study (A-R, and the
// ones it turned down) behind a switch, so each can be tried on the phone and kept or dropped.
// Once James has picked, the kept ones lose their switch and the rest go, with their code.
// R.look[id] is on or off; a switch with `def` compiles a #define into the shaders (render.js
// R.relook), `chunks` rebuilds the ground (the bake is in world.js chunkMesh, env.look).
// ?look=air,grade (or ?look=all) tries some without saving.
import { store } from './util.js';
import { env } from './world.js';

export const LOOKS = [
  { id: 'hollow', letter: 'A', def: 'L_HOLLOW', chunks: true, label: 'Hollow light', sub: 'hollows and the ground under trees a little darker, baked into the ground; soft dark patches under ruins and stones' },
  { id: 'hills', letter: 'B', def: 'L_HILLS', chunks: true, label: 'Hill shadows', sub: 'hills cast their shadows on the land when the sun is low (baked from the hills round each spot; ground builds slower)' },
  { id: 'air', letter: 'C', def: 'L_AIR', label: 'Aerial haze', sub: 'thinner haze; far land fades to the sky’s blue, warm toward the sun and cool away' },
  { id: 'grade', letter: 'D', def: 'L_GRADE', label: 'Colour grade', sub: 'soft highlights, warm shadows, a tint for each time of day' },
  { id: 'backlight', letter: 'E', def: 'L_BACK', label: 'Backlit leaves and rims', sub: 'leaves and feathers glow with the sun behind them; animals get a rim of light' },
  { id: 'coverage', letter: 'F', def: 'L_A2C', label: 'Smooth fades', sub: 'leaves and far trees fade by alpha to coverage instead of the checker dither' },
  { id: 'rings', letter: 'G', label: 'Soft rings', sub: 'rings of mist as soft volumes, like the clouds (needs Clouds: Soft, Faceted or Billowing)' },
  { id: 'weather', letter: 'H', def: 'L_WEATHER', label: 'Weather', sub: 'rain shafts, lightning inside the clouds, wet ground with a sheen, snow on rocks, roofs and ruins' },
  { id: 'sky', letter: 'I', def: 'L_SKY', label: 'Scattering sky', sub: 'a sky that glows round the sun, the pink Belt of Venus and the Earth’s shadow at dusk and dawn' },
  { id: 'water', letter: 'J', def: 'L_WATER', label: 'Sky-matched water', sub: 'clearer shallows with caustics, a wet band of shore, the horizon glowing in the sea' },
  { id: 'hue', letter: 'K', def: 'L_HUE', label: 'Land hue drift', sub: 'the land’s colour drifts slowly across the country; grass and flowers take the same drift' },
  { id: 'animals', letter: 'L', def: 'L_ANIMALS', label: 'Animal shading', sub: 'darker backs and paler bellies, a soft shadow under each, a glint in the eye' },
  { id: 'worn', letter: 'M', def: 'L_WORN', label: 'Weathered buildings', sub: 'damp dark bases, moss on the tops, rain streaks and ivy on the walls' },
  { id: 'softfx', letter: 'N', def: 'L_SOFTFX', label: 'Softer effects', sub: 'motes fade near the camera; your shadow blurs as you climb' },
  { id: 'impostors', letter: 'O', def: 'L_IMPOSTOR', label: 'Far-tree pictures', sub: 'far trees drawn as pictures of the near ones (impostors) instead of simple meshes' },
  { id: 'shadows', letter: 'P', def: 'L_SHADOW', label: 'Real shadows', sub: 'a shadow map 240 m across round you: trees, rocks, ruins and you cast true shadows (costly)' },
  { id: 'post', letter: 'Q', def: 'L_POST', label: 'Render to texture', sub: 'clouds meet the land softly, a gentle glow round bright things, clouds at half resolution (costly)' },
  { id: 'perf', letter: 'R', def: 'L_PERF', label: 'Perf trims', sub: 'props off screen skipped, a lighter aurora; should look the same' },
  { id: 'smooth', letter: 'S', def: 'L_SMOOTH', chunks: true, label: 'Smooth shading', sub: 'turned down in the study: rounded hills and crowns instead of facets' },
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', label: 'Mirror reflections', sub: 'turned down: the water mirrors the hills, trees and clouds (draws the world twice)' },
  { id: 'shafts', letter: 'U', def: 'L_SHAFTS', label: 'Light shafts', sub: 'turned down: sunbeams through the clouds and trees, toward the sun (costly)' },
  { id: 'detail', letter: 'V', def: 'L_DETAIL', label: 'Land detail', sub: 'turned down: fine soft mottling on the ground close by, like a texture' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : !!store.get('look.' + L.id, false);
  const sync = () => { env.look = LOOKS.filter(L => L.chunks && R.look[L.id]).map(L => L.id).join(','); };
  sync();
  R.relook?.();
  const set = (ids, v) => {
    let chunks = false;
    for (const id of ids) { const L = LOOKS.find(l => l.id === id); if (R.look[id] === v) continue; R.look[id] = v; if (!forced) store.set('look.' + id, v); chunks ||= L.chunks; }
    sync(); R.relook?.(); if (chunks) R.dropChunks();
    G.emit('look', R.look);
  };
  for (const L of LOOKS) G.menu.toggle('play', { label: `${L.letter}. ${L.label}`, sub: L.sub, group: 'looks', get: () => R.look[L.id], set: v => set([L.id], v) });
  G.menu.button('play', { label: 'All look tests on', sub: 'every switch above at once (heavy)', group: 'looks', onClick: () => { set(LOOKS.map(L => L.id), true); for (const f of G.menu.opens) f(); } });
  G.menu.button('play', { label: 'All look tests off', sub: 'the game as it was', group: 'looks', onClick: () => { set(LOOKS.map(L => L.id), false); for (const f of G.menu.opens) f(); } });
  G.dev?.add({ id: 'look-tests', area: 'Settings and performance', title: 'Look tests: every idea from the graphics study behind a switch', how: 'Settings > Advanced > Look tests. Try each in day, dusk, rain and over water; Dev tools > Frame cost shows the price. ?look=all turns them all on for one visit.' });
}

// D, the colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
export const GRADE_GLSL = `
uniform vec3 uGradeT;
vec3 grade(vec3 c) {
#ifdef L_GRADE
  c = c * (1. + c * .12) / (1. + c * .32);
  float l = dot(c, vec3(.3, .55, .15));
  c = mix(c, c * vec3(1.04, 1., .93) + vec3(.014, .009, 0.), 1. - smoothstep(.1, .5, l));
  c *= uGradeT * 1.07;
#endif
  return c;
}`;
const DAY = [1.015, 1, .975], GOLD = [1.07, .99, .86], NIGHT = [.93, .98, 1.06];
// the tint: a touch warm by day, golden with the sun low, cool at night
export function gradeTint(S) {
  const el = (S.sunSky || S.sun)[1], gold = Math.max(0, 1 - Math.abs(el - .06) / .22), n = S.night || 0;
  return DAY.map((v, k) => { const g = v + (GOLD[k] - v) * gold; return g + (NIGHT[k] - g) * n; });
}
