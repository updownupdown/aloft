// Songbird species: their songs (staff lines 0 bottom to 4 top), where and when they sing,
// and what singing their song back to the world does once you have learned it.
import { hx } from './util.js';

export const SPECIES = [
  { name: 'Chickadee', winter: true, notes: [4, 2], gap: .42, body: '#8a8a80', cap: '#2a2a2a', breast: '#efe6d0', biomes: ['forest', 'cliffs'], times: ['dawn', 'day', 'dusk'], power: 'worms come up around you', powerKey: 'worms', hint: 'Forests and cliffs, by day' },
  { name: 'Robin', notes: [2, 3, 2, 4, 3], gap: .28, body: '#6a5a4a', cap: '#3a3028', breast: '#d8703a', biomes: ['meadow', 'marsh', 'lakeland'], times: ['dawn', 'day'], power: 'a flock of small birds follows you', powerKey: 'flock', hint: 'Meadows and marsh, mornings' },
  { name: 'Warbler', notes: [0, 1, 2, 3, 4], gap: .18, body: '#a8a040', cap: '#6a7030', breast: '#f0d840', biomes: ['lakeland', 'marsh'], times: ['day'], power: 'a storm calms for a while', powerKey: 'calm', hint: 'Lakeland, in the daytime' },
  { name: 'Wren', winter: true, notes: [3, 3, 3, 1, 0, 2], gap: .16, body: '#8a6440', cap: '#6a4a30', breast: '#c8a070', biomes: ['cliffs', 'forest', 'meadow'], times: ['dawn', 'day', 'dusk'], power: 'nearby bushes ripen with berries', powerKey: 'ripen', hint: 'Cliffs and forest edges' },
  { name: 'Thrush', notes: [1, 3, 4, 2], gap: .34, body: '#7a6448', cap: '#5a4a38', breast: '#e8d8b8', biomes: ['forest', 'lakeland'], times: ['dawn', 'dusk'], power: 'another hawk comes to lead you', powerKey: 'companion', hint: 'Forests, at dawn and dusk' },
  { name: 'Finch', notes: [2, 4, 2, 4, 3, 1], gap: .2, body: '#a04a40', cap: '#c03a3a', breast: '#e89080', biomes: ['meadow', 'marsh'], times: ['day'], power: 'a tailwind carries you', powerKey: 'tailwind', hint: 'Meadows, in the daytime' },
  { name: 'Owl', winter: true, notes: [1, 0, 0, 1, 0], gap: .5, body: '#7a6a58', cap: '#5a4c3e', breast: '#d8c8a8', biomes: ['forest', 'cliffs', 'lakeland'], times: ['night'], power: 'the night grows bright', powerKey: 'night', hint: 'Forests and cliffs, only at night', voice: 3 },
  { name: 'Lark', notes: [2, 3, 4, 3, 4, 4, 2], gap: .13, body: '#9a8460', cap: '#7a6648', breast: '#e8dcc0', biomes: ['meadow'], times: ['dawn'], power: 'your wings feel fresh', powerKey: 'lark', hint: 'Meadows, only at dawn' },
].map((s, i) => ({ ...s, id: i, voice: s.voice ?? i, cols: { body: hx(s.body), cap: hx(s.cap), breast: hx(s.breast) } }));

export function timeOfDay(tod) { return tod < .2 || tod > .8 ? 'night' : tod < .33 ? 'dawn' : tod > .68 ? 'dusk' : 'day'; }

// which species lives in a songbird tree: chosen from those native to its biome
export function speciesFor(bio, seed) {
  const pool = SPECIES.filter(s => s.biomes.includes(bio));
  return pool[Math.floor(seed * pool.length) % pool.length];
}
// is it out and singing right now? (nobody sings in a storm; most leave for the winter)
export const active = (sp, tod, storm, winter = 0) => storm < .6 && sp.times.includes(timeOfDay(tod)) && (winter < .5 || !!sp.winter);
