// Songbird species: their songs, where and when they sing, and what singing their song back
// to the world does once you have learned it. A song is a run of syllables, each a pitch
// (`notes`, 0 bottom to 4 top) and a kind (`kinds`), written from the real bird's song (`words`)
// as a sonogram reads it: u a note sliding up, d sliding down, r a steady held whistle, l a trill
// or buzz (a rolled note), c a short chip. On the note pad they are swipes up, down, right and
// left, and a tap.
// `look` shapes the drawing so each reads by silhouette at phone size: size, how high the
// tail cocks, a crest, a round owl head, how stubby the bill is, spots on the breast.
const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const SPECIES = [
  { name: 'Chickadee', winter: true, notes: [4, 2], kinds: 'rr', gap: 0.42, words: 'fee-bee: two clear whistles, the second lower', body: '#8a8a80', cap: '#2a2a2a', breast: '#efe6d0', biomes: ['forest', 'cliffs', 'mountains'], times: ['dawn', 'day', 'dusk'], power: 'worms come up around you', powerKey: 'worms', hint: 'Forests and cliffs, by day', look: { size: .85, bib: 1 } },
  { name: 'Robin', notes: [2, 3, 2, 4, 3], kinds: 'ududd', gap: 0.28, words: 'cheerily, cheer-up, cheerio: rich whistled phrases rising and falling', body: '#6a5a4a', cap: '#3a3028', breast: '#d8703a', biomes: ['meadow', 'marsh', 'lakeland'], times: ['dawn', 'day'], power: 'a flock of small birds follows you', powerKey: 'flock', hint: 'Meadows and marsh, mornings', look: { size: 1.05 } },
  { name: 'Warbler', notes: [2, 2, 2, 3, 3, 4], kinds: 'uuuccu', gap: 0.17, words: 'sweet-sweet-sweet, I\'m so sweet: quick sweet notes, rising at the end', body: '#a8a040', cap: '#6a7030', breast: '#f0d840', biomes: ['lakeland', 'marsh'], times: ['day'], power: 'a storm calms for a while', powerKey: 'calm', hint: 'Lakeland, in the daytime', look: { size: .8, bill: 1.2 } },
  { name: 'Wren', winter: true, notes: [3, 1, 3, 1, 3, 1], kinds: 'dcdcdc', gap: 0.17, words: 'tea-kettle, tea-kettle, tea-kettle: a loud rolling chant', body: '#8a6440', cap: '#6a4a30', breast: '#c8a070', biomes: ['cliffs', 'mountains', 'forest', 'meadow'], times: ['dawn', 'day', 'dusk'], power: 'nearby bushes ripen with berries', powerKey: 'ripen', hint: 'Cliffs and forest edges', look: { size: .72, tail: 1.8, bill: 1.1 } },
  { name: 'Thrush', notes: [1, 3, 4, 2], kinds: 'rrrl', gap: 0.34, words: 'ee-oh-lay: fluted notes rising, then a soft trill', body: '#7a6448', cap: '#5a4a38', breast: '#e8d8b8', biomes: ['forest', 'lakeland'], times: ['dawn', 'dusk'], power: 'another hawk comes to lead you', powerKey: 'companion', hint: 'Forests, at dawn and dusk', look: { size: 1.12, spots: 1 } },
  { name: 'Finch', notes: [2, 4, 2, 4, 3, 0], kinds: 'ucdccl', gap: 0.18, words: 'a bright warble of notes, ending in a burry buzz', body: '#a04a40', cap: '#c03a3a', breast: '#e89080', biomes: ['meadow', 'marsh'], times: ['day'], power: 'a tailwind carries you', powerKey: 'tailwind', hint: 'Meadows, in the daytime', look: { size: .9, bill: .55, thick: 1 } },
  { name: 'Owl', winter: true, notes: [1, 0, 0, 1, 0], kinds: 'rrrrd', gap: 0.5, words: 'hoo, hoo-hoo, hoo, hoo: deep soft hoots', body: '#7a6a58', cap: '#5a4c3e', breast: '#d8c8a8', biomes: ['forest', 'cliffs', 'mountains', 'lakeland'], times: ['night'], power: 'the night grows bright (and once you know it, you see better at night)', powerKey: 'night', hint: 'Forests and cliffs, only at night', voice: 6, look: { size: 1.5, owl: 1 } },
  { name: 'Lark', notes: [2, 3, 4, 3, 4, 4, 2], kinds: 'cclccll', gap: 0.13, words: 'a high tinkling run of chips and trills', body: '#9a8460', cap: '#7a6648', breast: '#e8dcc0', biomes: ['meadow'], times: ['dawn'], power: 'your wings feel fresh', powerKey: 'lark', hint: 'Meadows, only at dawn', look: { size: .95, crest: 1 } },
  { name: 'Cardinal', winter: true, notes: [4, 4, 4, 2, 2, 2], kinds: 'dddcuc', gap: 0.3, words: 'cheer, cheer, cheer, birdy-birdy-birdy: loud slurred whistles, then quick lower ones', body: '#a8342c', cap: '#8a2a24', breast: '#c0403a', biomes: ['forest', 'meadow'], times: ['dawn', 'day', 'dusk'], power: 'a warm glow: your health grows faster', powerKey: 'warm', hint: 'Forest edges and meadows, all year', look: { size: 1.05, crest: 1, bill: .8, thick: 1 } },
  { name: 'Meadowlark', notes: [4, 2, 3, 1, 0], kinds: 'rddcl', gap: 0.26, words: 'a flute-like tumble of notes ending in a gurgle', body: '#9a8458', cap: '#6a5a40', breast: '#e8c040', biomes: ['meadow'], times: ['dawn', 'day'], power: 'mice come out into the open', powerKey: 'mice', hint: 'Meadows, mornings and day', look: { size: 1.05, tail: .7, bill: 1.3 } },
  { name: 'Red-winged blackbird', notes: [0, 1, 4], kinds: 'ucl', gap: 0.2, words: 'conk-la-ree: two hard notes and a high buzzing trill', body: '#2a2624', cap: '#1e1a18', breast: '#2e2a26', biomes: ['marsh', 'lakeland'], times: ['dawn', 'day'], power: 'fish rise to the surface', powerKey: 'fish', hint: 'Marsh and lake reeds, by day', look: { size: 1, bill: 1.2 } },
  { name: 'Mourning dove', winter: true, notes: [1, 3, 1, 0, 0], kinds: 'udrrd', gap: 0.5, words: 'coo-OOO-oo-oo-oo: soft coos, the second higher', body: '#a89888', cap: '#988878', breast: '#c8b4a0', biomes: ['meadow', 'cliffs', 'mountains'], times: ['dawn', 'day', 'dusk'], power: 'dew on the grass eases your thirst', powerKey: 'dew', hint: 'Meadows and cliffs, all day', look: { size: 1.1, tail: 1.3, bill: .7 } },
  { name: 'Blue jay', winter: true, notes: [4, 4, 2], kinds: 'ddr', gap: 0.3, words: 'jay, jay: harsh loud screams, then a whistled note', body: '#5a7ab0', cap: '#4a6aa0', breast: '#e8e8e0', biomes: ['forest'], times: ['day'], power: 'it shows you where a keepsake lies', powerKey: 'glint', hint: 'Forests, in the daytime', look: { size: 1.1, crest: 1 } },
  { name: 'Song sparrow', winter: true, notes: [2, 2, 2, 4, 3, 1, 0], kinds: 'rrrlcld', gap: 0.14, words: 'maids-maids-maids, put on your tea-kettle: three clear notes, a buzz, a trill', body: '#8a6a50', cap: '#7a5a40', breast: '#e0d4c0', biomes: ['meadow', 'marsh'], times: ['dawn', 'day'], power: 'every songbird near you sings, whatever the hour', powerKey: 'sing', hint: 'Meadows and marsh, by day', look: { size: .9, spots: 1 } },
  { name: 'White-throated sparrow', notes: [0, 3, 3, 3, 3], kinds: 'rrrrr', gap: 0.4, words: 'old Sam Peabody, Peabody: a pure low whistle, then higher ones', body: '#8a6a4a', cap: '#3a3028', breast: '#d8d0c4', biomes: ['forest', 'lakeland'], times: ['dawn', 'dusk'], power: 'thermals rise stronger for a while', powerKey: 'lift', hint: 'Forests and lakes, dawn and dusk', look: { size: .92 } },
  { name: 'Veery', notes: [4, 3, 2, 1, 0], kinds: 'ddddd', gap: 0.22, words: 'a breezy downward spiral of rolling notes', body: '#a87a50', cap: '#9a6c44', breast: '#efe0c8', biomes: ['forest', 'lakeland'], times: ['dusk'], power: 'the evening lingers', powerKey: 'dusk', hint: 'Forests, only at dusk', look: { size: 1, spots: 1 } },
  // round six: birds of the newer lands (`lands`: the 3D biome names, `spot`: where they sit,
  // a tree unless 'rock', 'ground' or 'falls'), and the night singers, out only after dark.
  // `echo`: it answers only a song that echoes off rock around you.
  { name: 'Cactus wren', winter: true, notes: [1, 1, 1, 1, 1, 1], kinds: 'cccccc', gap: 0.12, words: 'cha-cha-cha-cha-cha: a harsh, low chugging, like an engine that will not start', body: '#7a5a3c', cap: '#5a3a24', breast: '#e8dcc8', biomes: [], lands: ['desert', 'savanna', 'saltflat'], times: ['dawn', 'day'], power: 'a cactus fruit splits open, and its juice eases your thirst', powerKey: 'juice', hint: 'Deserts, on the cactus', voice: 16, look: { size: 1.05, spots: 1, tail: 1.3, bill: 1.3 } },
  { name: 'Canyon wren', winter: true, notes: [4, 4, 4, 3, 3, 2, 2, 1, 0], kinds: 'ddddddddl', gap: 0.13, words: 'a cascade of sweet whistles tumbling down the scale, ending in a buzz', body: '#8a5a34', cap: '#7a6a5a', breast: '#f0ece4', biomes: [], lands: ['canyon', 'badlands'], spot: 'rock', echo: true, times: ['dawn', 'day', 'dusk'], power: 'warm air rises off the canyon walls and lifts you', powerKey: 'updraft', hint: 'Canyons and badlands, on the rocks (it answers only where your song echoes)', voice: 17, look: { size: .78, bill: 1.6, tail: 1.2 } },
  { name: 'Ptarmigan', winter: true, notes: [1, 0, 0, 0, 0], kinds: 'lcccc', gap: 0.16, words: 'arr, ka-ka-ka-ka: a dry, croaking rattle', body: '#d8d4cc', cap: '#8a7a64', breast: '#f2f0ec', biomes: [], lands: ['alpine', 'mountains'], spot: 'ground', times: ['dawn', 'day', 'dusk'], power: 'the cold cannot reach you: hunger and thirst come slower', powerKey: 'hardy', hint: 'High peaks, on the bare slopes', voice: 18, look: { size: 1.5, tail: .6, bill: .6, thick: 1 } },
  { name: 'Dipper', winter: true, notes: [3, 4, 3, 2, 4, 3, 2], kinds: 'lulucld', gap: 0.16, words: 'a loud, bubbling warble of trills and whistles, over the roar of the water', body: '#4a4a50', cap: '#5a4a40', breast: '#4e4e54', biomes: [], lands: [], spot: 'falls', echo: true, times: ['dawn', 'day', 'dusk'], power: 'it shows you fish in the clear pool, and you catch one', powerKey: 'clear', hint: 'Waterfalls, on the wet rocks (it answers only where your song echoes)', voice: 19, look: { size: .95, tail: .6 } },
  { name: 'Bellbird', notes: [2, 4, 3, 0], kinds: 'rrrr', gap: 0.5, words: 'tong ... tink ... tong: pure ringing notes, like a struck bell', body: '#5a7a3a', cap: '#4a5a6a', breast: '#8a9a50', biomes: [], lands: ['redwood'], times: ['dawn', 'day'], power: 'its bells ring toward a place you have not found yet', powerKey: 'bells', hint: 'Redwood groves, mornings', voice: 20, look: { size: 1.05 } },
  { name: 'Nightingale', notes: [2, 2, 2, 2, 4, 1, 3], kinds: 'uuuullc', gap: 0.22, words: 'piu, piu, piu, piu, swelling, then a rich trill and a chuckle', body: '#8a6a4c', cap: '#7a5c40', breast: '#d8c8b0', biomes: ['forest', 'lakeland', 'marsh'], times: ['night'], power: 'fireflies rise around you and light the dark', powerKey: 'fireflies', hint: 'Thickets by water, only at night', voice: 21, look: { size: .95, tail: 1.2 } },
  { name: 'Whip-poor-will', notes: [2, 0, 4], kinds: 'ucu', gap: 0.16, words: 'whip-poor-WILL: three notes, over and over, the last loudest', body: '#6a5a48', cap: '#5a4a3a', breast: '#a89070', biomes: ['forest', 'meadow'], times: ['night'], power: 'moths flutter up in the dark, and you eat a few', powerKey: 'moths', hint: 'Open woods, only at night', voice: 22, look: { size: 1.15, bill: .4, tail: 1.1 } },
  { name: 'Tawny owl', winter: true, notes: [4, 3, 0, 0, 1, 0], kinds: 'urrrrd', gap: 0.45, words: 'ke-wick ... hoo, hoo-hoo-hoooo: one calls, its mate answers', body: '#8a5a34', cap: '#7a4c2c', breast: '#c89a6a', biomes: ['forest'], times: ['night'], power: 'a hush falls: mice freeze where they stand', powerKey: 'hush', hint: 'Old woods, only at night (a pair, calling to each other)', voice: 23, look: { size: 1.45, owl: 1 } },
  // round eight: the mimics (added last, so the ids of the others stay as saved). They sing no song of their own to learn, only pieces of the songs
  // around them (yours included), each in its own bird's voice.
  { name: 'Starling', mimic: true, winter: true, notes: [2, 4, 1, 3], kinds: 'ldcu', gap: 0.2, words: 'a rambling medley: snatches of other birds\' songs, clicks and whistles', body: '#2a2c34', cap: '#24262e', breast: '#3a3c46', biomes: ['meadow', 'lakeland'], times: ['dawn', 'day', 'dusk'], power: 'nothing of its own: listen for pieces of songs you do not know', powerKey: 'mimic', hint: 'Meadows and lakes by day; it borrows the songs around it', voice: 5, look: { size: 1, bill: 1.3, spots: 1, tail: .8 } },
  { name: 'Mockingbird', mimic: true, winter: true, notes: [3, 1, 4, 2], kinds: 'rcdu', gap: 0.22, words: 'phrase after phrase of other birds\' songs, each sung two or three times', body: '#8a8a86', cap: '#7a7a76', breast: '#e8e8e2', biomes: [], lands: ['savanna', 'desert', 'swamp', 'coast', 'marsh'], times: ['dawn', 'day', 'dusk'], power: 'nothing of its own: listen for pieces of songs you do not know', powerKey: 'mimic', hint: 'Down south, in the savanna, desert, swamp and on the coast; it borrows the songs around it', voice: 1, look: { size: 1.05, tail: 1.5 } },
].map((s, i) => ({ ...s, id: i, voice: s.voice ?? i, cols: { body: hx(s.body), cap: hx(s.cap), breast: hx(s.breast) }, look: { size: 1, tail: 1, bill: 1, ...s.look } }));

// Dialects (round eight): a species sings its own song in its home land (its first land), and in
// every other land a version of it, fixed by the species and the land: an extra note at the end,
// a trill for one of its whistles (or a whistle for a chip), or one note a step higher or lower.
// Each version is a song of its own to learn; `dkey` names it ('species id:land').
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
const hs = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
export const homeLand = sp => sp.lands?.[0] || sp.biomes[0];
const versions = new Map();
export function dialect(sp, land) {
  const key = sp.id + ':' + land;
  if (versions.has(key)) return versions.get(key);
  const notes = [...sp.notes], kinds = [...sp.kinds], u = hs(sp.name + land), v = hs(land + sp.name), i = Math.floor(v * notes.length);
  let how = null;
  if (land !== homeLand(sp) && !sp.mimic) {
    const w = kinds.indexOf('r'), c = kinds.indexOf('c');
    if (u < .34 && notes.length < 9) {
      const last = notes[notes.length - 1], n = last < 4 && (v < .5 || last === 0) ? last + 1 : last - 1;
      notes.push(n); kinds.push(v < .5 ? 'c' : 'l'); how = `an extra ${v < .5 ? 'chip' : 'trill'} at the end`;
    } else if (u < .67 && (w >= 0 || c >= 0)) {
      if (w >= 0) { kinds[w] = 'l'; how = `a trill for its ${ORD[w]} note, where the others whistle`; }
      else { kinds[c] = 'r'; how = `a whistle for its ${ORD[c]} note, where the others chip`; }
    } else {
      const up = notes[i] < 4 && (v * 7 % 1 < .5 || notes[i] === 0);
      notes[i] += up ? 1 : -1; how = `its ${ORD[i]} note a step ${up ? 'higher' : 'lower'}`;
    }
  }
  const song = Object.assign(Object.create(sp), { base: sp, land, dkey: key, how, notes, kinds: kinds.join('') });
  versions.set(key, song);
  return song;
}

export function timeOfDay(tod) { return tod < .2 || tod > .8 ? 'night' : tod < .33 ? 'dawn' : tod > .68 ? 'dusk' : 'day'; }

// which species lives in a songbird tree: chosen from those native to its biome
export function speciesFor(bio, seed) {
  const pool = SPECIES.filter(s => s.biomes.includes(bio));
  return pool[Math.floor(seed * pool.length) % pool.length];
}
// is it out and singing right now? (nobody sings in a storm; most leave for the winter)
export const active = (sp, tod, storm, winter = 0) => storm < .6 && sp.times.includes(timeOfDay(tod)) && (winter < .5 || !!sp.winter);
