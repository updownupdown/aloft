// The ages of the same Earth (W1 of the gameplay study): the land is the same function of (x, z), but
// the sea stands lower or higher, the snow comes lower or never, the trees thin or are gone, and the
// light has other colours. One age at a time, chosen before anything is built (so world.js, earth.js,
// look.js and main.js read it as constants), from ?age= or the save; sys/ages.js moves you between
// them through the doors of light in the deep caves (W4), the gap in the aurora (W3), and back.
// The land is low (half of it under 13 m, the deep sea floor near -35 m), so the levels are small.
import { store } from './util.js';

export const AGES = {
  earth: { name: 'Now', sea: 0, snow: 0, trees: 1 },
  ice: { name: 'The Ice', short: 'Ice', sea: -14, snow: -120, snowLat: [38, 9], trees: .35, tint: [.95, 1, 1.07], desat: .18, sky: [.82, .9, .98], skyK: .35, ground: [.86, .9, .94, .14],
    note: 'The seas low and the snow down to the hills: the old land bridges stand dry (Doggerland, Sunda, the Channel), and the ice is on every height.', col: '#9cb6cf' },
  drowned: { name: 'The Drowned', short: 'Drowned', sea: 9, snow: 40, trees: 1, tint: [.96, 1, 1.03], desat: .05, sky: [.68, .8, .84], skyK: .25,
    note: 'The sea up into every valley: the lowlands gone, the hills made islands, the old villages under the water.', col: '#4f8f96' },
  red: { name: 'The Red Age', short: 'Red', sea: -900, snow: 5000, trees: 0, tint: [1.12, .9, .78], desat: .45, sky: [.86, .6, .5], skyK: .6, ground: [.62, .34, .22, .55],
    note: 'An Earth long dry: no sea, no snow, no trees, only rust and the shape of the land; the beds of the oceans open to fly across.', col: '#b25a3a',
    skip: ['sealifeSystem', 'driftSystem', 'islesSystem', 'nightSeaSystem', 'oceanSystem', 'floraSystem', 'bushesSystem', 'berriesSystem', 'crittersSystem', 'faunaSystem', 'huntersSystem', 'raptorsSystem', 'neighboursSystem', 'fieldsSystem'] },
  shore: { name: 'The Other Shore', short: 'Other Shore', sea: 22, snow: 60, trees: 1, tint: [1, .95, 1.08], desat: -.08, sky: [.6, .55, .86], skyK: .4, ground: [.42, .6, .62, .22], aurora: .8,
    note: 'Through the gap in the aurora: a shore of small hills standing out of a high, still sea, in colours the world has not got, the lights burning every night.', col: '#8a6fc0' },
};
// the systems that only belong to the present: they go in every other age
const PRESENT = ['visitorsSystem'];
const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const want = qs.get('age') || store.get('age', 'earth');
export const AGE_ID = AGES[want] ? want : 'earth';
export const AGE = AGES[AGE_ID];
// the snow line's shift at a latitude: the Ice's sheets come lower the further from the equator
export const ageSnow = lat => AGE.snow - (AGE.snowLat ? Math.max(0, Math.abs(lat) - AGE.snowLat[0]) * AGE.snowLat[1] : 0);
export const AGE_SKIP = new Set(AGE_ID === 'earth' ? [] : [...PRESENT, ...(AGE.skip || [])]);
export const ageName = id => AGES[id || 'earth']?.name || 'another age';
