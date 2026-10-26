// The lands of Aloft come in patches, like a quilt: the ground is cut into cells about a
// kilometre across (their edges warped so no line is straight), each cell gets one biome by a
// seeded roll, and neighbouring biomes blend over a band about 200 m wide. The roll is weighted
// by the real Earth under the cell (earth.js): a cell in the Sahara rolls dunes and now and then
// a salt pan, one in western Europe forest, meadow or lakeland (PALETTE), and a land that the
// real place doesn't have is left out of the roll (FITS: no canyons in the Sahara).
// A biome is its ground (h: height in m at x, z), its colours (c), how wooded it is (forest),
// and flags for the shared touches (rock on steep ground, snow up high, sand at the shore).
// Trees, rocks and flora read the biome too (world.js, sys/flora.js).
import { ih, fbm, ridged, softRidged, smooth, clamp } from './noise.js';
import { lakeAt, byGrain, earthBiome, continentAt, latLon, coastDist } from './earth.js';

export const BIOME_CELL = 950, BLEND = 210;

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const PAL = {
  sand: hex('#d9c08e'), meadow: hex('#9bb067'), meadow2: hex('#b8b56a'), wood: hex('#6f8f4e'), moss: hex('#57794a'),
  rock: hex('#8f8577'), rock2: hex('#a79c8a'), snow: hex('#f1ece0'), mud: hex('#7d6a4c'),
  bark: hex('#5c4632'), leaf: hex('#5f8a45'), leaf2: hex('#7a9a48'), leafA: hex('#c08a34'), pine: hex('#3e6446'), pine2: hex('#4f7556'),
  ring: hex('#e2a93a'), reed: hex('#b3a35e'), reed2: hex('#8f9a55'), heath: hex('#9a8a62'), heather: hex('#8c6f78'),
  dune: hex('#e2c48c'), dune2: hex('#d4a86c'), redrock: hex('#b4643e'), ochre: hex('#cf9152'), buff: hex('#dcb882'), scrub: hex('#a39a5c'),
  moor: hex('#8e8a5a'), heather2: hex('#9a6d82'), granite: hex('#9a9690'),
  birchFloor: hex('#a9b56c'), fern: hex('#7e9a4c'), duff: hex('#6a7a40'), alpine: hex('#8fa36a'), scree: hex('#9d9a92'),
  fjord: hex('#6b8a52'), clay1: hex('#cdb79c'), clay2: hex('#b98a7e'), clay3: hex('#e6d6bc'), clay4: hex('#9f8a9c'), clay5: hex('#d6b58a'),
  salt: hex('#e6dfd0'), salt2: hex('#d3c9b4'), straw: hex('#cdb46a'), straw2: hex('#b9a259'), savGreen: hex('#9fa35a'),
  lush: hex('#77a553'), lush2: hex('#8db35c'), lime: hex('#bdb6a4'), lime2: hex('#a7a291'),
  lava: hex('#3e3a39'), lava2: hex('#55504b'), ash: hex('#77695f'), rust: hex('#8a5a44'),
  swamp: hex('#5f7647'), swamp2: hex('#6f7a46'),
  // the lands of the Earth
  ice: hex('#e4ecf0'), ice2: hex('#a8c3d3'), nunatak: hex('#55524f'), tundra: hex('#9c9a70'), tundra2: hex('#a88a62'), lichen: hex('#c2bf9a'), taiga: hex('#4f6b44'), taiga2: hex('#62794c'),
  steppe: hex('#bcae74'), steppe2: hex('#a2a47c'), maquis: hex('#a8a061'), maquis2: hex('#6c7843'), rain: hex('#3f7a3e'), rain2: hex('#2d6236'),
  // the trees of the new lands
  birch: hex('#e9e4d8'), birchLeaf: hex('#9bb84f'), birchLeaf2: hex('#b4c35a'), redBark: hex('#8a4a32'), redLeaf: hex('#3f5f3c'),
  acacia: hex('#7d8a3c'), acacia2: hex('#93993f'), cactus: hex('#5f8a4f'), cactus2: hex('#729a58'), joshua: hex('#6d7f45'), mangrove: hex('#4f7a46'),
};
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const pick = (cols, i) => cols[((i % cols.length) + cols.length) % cols.length];

// shared shapes
function AMERICAS(c) { return c === 'n-america' || c === 's-america'; }
const stepped = (h, step, a = .7, b = .9) => { const t = h / step, f = t - Math.floor(t); return (Math.floor(t) + smooth(a, b, f)) * step; };
// a winding river line (0 on the river): canyons and fjords cut down along it
export const riverLine = (x, z, s, scale) => Math.abs(fbm(x / scale, z / scale, s, 2) + fbm(x / (scale / 4), z / (scale / 4), s + 2, 1) * .08);
// limestone towers standing out of the karst lowland, one maybe per 90 m cell
function towers(x, z) {
  const C = 90, gx0 = Math.floor(x / C), gz0 = Math.floor(z / C); let h = 0;
  for (let gz = gz0 - 1; gz <= gz0 + 1; gz++) for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
    if (ih(gx, gz, 301) > .62) continue;
    const cx = (gx + .2 + ih(gx, gz, 302) * .6) * C, cz = (gz + .2 + ih(gx, gz, 303) * .6) * C, r = 13 + ih(gx, gz, 304) * 15;
    const d = Math.hypot(x - cx, z - cz) / r; if (d > 1.15) continue;
    const H = 32 + ih(gx, gz, 305) * 50;
    h = Math.max(h, H * smooth(1.15, .8, d) * (1 - .22 * d * d));
  }
  return h;
}

// how common each biome is, n = northness and s = southness (0..1)
export const BIOMES = {
  meadow: {
    label: 'the meadows', forest: -.15,
    h: (x, z, B) => 13 + B.big * 30 + B.mid * 10,
    c: (x, y, z) => mixc(mixc(PAL.meadow, PAL.meadow2, smooth(-.35, .35, fbm(x / 70, z / 70, 11, 2))), PAL.moss, smooth(.1, .5, fbm(x / 25, z / 25, 12, 2)) * .45),
  },
  forest: {
    label: 'the woods', forest: .32,
    h: (x, z, B) => 16 + B.big * 34 + B.mid * 13,
    c: (x, y, z) => mixc(mixc(PAL.meadow, PAL.wood, .6), PAL.moss, smooth(.1, .5, fbm(x / 25, z / 25, 12, 2)) * .5),
  },
  lakeland: {
    label: 'the lakelands', forest: .05, lakes: 1,
    h: (x, z, B) => 12 + B.big * 30 + B.mid * 10 - 13 * smooth(-.05, -.45, B.big),
    c: (x, y, z) => mixc(mixc(PAL.meadow, PAL.meadow2, smooth(-.35, .35, fbm(x / 70, z / 70, 11, 2))), PAL.wood, smooth(-.1, .4, fbm(x / 220, z / 220, 9, 2)) * .6),
  },
  birch: {
    label: 'the birch woods', forest: .3,
    h: (x, z, B) => 18 + B.big * 26 + B.mid * 12,
    c: (x, y, z) => mixc(PAL.birchFloor, PAL.fern, smooth(-.2, .4, fbm(x / 30, z / 30, 21, 2)) * .6),
  },
  redwood: {
    label: 'the giant woods', forest: .4,
    h: (x, z, B) => 26 + B.big * 44 + B.mid * 18,
    c: (x, y, z) => mixc(PAL.duff, PAL.moss, smooth(-.2, .4, fbm(x / 22, z / 22, 22, 2)) * .7),
  },
  moor: {
    label: 'the moors', forest: -.55,
    h: (x, z, B) => 22 + B.big * 14 - Math.abs(B.mid) * 6,
    c: (x, y, z) => mixc(PAL.moor, PAL.heather2, smooth(0, .4, fbm(x / 30, z / 30, 15, 2)) * .55),
  },
  // The ranges' ridges run the way the real range does (the bake's grain: the Andes north to south,
  // the Himalaya east to west): the ridged noise stretched along that bearing (option D)
  mountains: {
    label: 'the high country', forest: 0, high: 1,
    h: (x, z, B) => 30 + B.big * 30 + B.mid * 12 + ranged(x, z, 260, 4, 3, .08) ** 2 * 160,
    c: (x, y, z) => mixc(PAL.meadow, PAL.heath, smooth(40, 110, y) * .6),
  },
  alpine: {
    label: 'the snowy peaks', forest: -.2, high: 1, peaks: 1,
    h: (x, z, B) => 70 + B.big * 40 + B.mid * 16 + ranged(x, z, 330, 41, 3, .06) ** 2.2 * 270 + softRidged(x / 90, z / 90, 42, 2, .15) ** 2 * 8,
    c: (x, y, z, st) => mixc(mixc(PAL.alpine, PAL.heath, smooth(60, 140, y)), PAL.scree, smooth(.15, .3, st) * smooth(90, 150, y)),
  },
  cliffs: {
    label: 'the cliffs', forest: -.1, high: 1, cliff: 1,
    h: (x, z, B) => {
      const h = 45 + B.big * 40 + B.mid * 14 + softRidged(x / 300, z / 300, 43, 2) ** 2 * 90;
      return h + smooth(-.2, .12, fbm(x / 650, z / 650, 64, 2)) * .85 * (stepped(Math.max(0, h), 24, .78, .96) - h);
    },
    c: (x, y, z) => mixc(PAL.meadow, PAL.heath, smooth(30, 100, y) * .6),
  },
  fjord: {
    label: 'the fjords', forest: .1, high: .5, coast: 1, cliff: .7,
    h: (x, z, B) => {
      const plat = 92 + B.big * 34 + B.mid * 12 + softRidged(x / 210, z / 210, 44, 2) ** 2 * 60, cl = riverLine(x, z, 45, 800);
      return plat + (-15 - plat) * smooth(.13, .055, cl);
    },
    c: (x, y, z) => mixc(PAL.fjord, PAL.moss, smooth(-.2, .4, fbm(x / 30, z / 30, 23, 2)) * .5),
  },
  coast: {
    label: 'the coast', forest: -.25, coast: 1, shore: 1,
    h: (x, z, B) => 12 + B.big * 14 + B.mid * 6,
    c: (x, y, z) => mixc(PAL.heath, PAL.heather, smooth(.1, .5, fbm(x / 40, z / 40, 14, 2)) * .6),
  },
  desert: {
    label: 'the dunes', forest: -.95, dry: 1, ownRock: 1, noSnow: 1, sandy: 1,
    // mesas: tall red-banded buttes in the Americas, lower sandstone plateaus elsewhere
    h: (x, z, B, e) => {
      const along = x * .8 + z * .6 + fbm(x / 400, z / 400, 76, 2) * 60;
      const dunes = 14 + B.big * 10 + (1 - Math.abs(Math.sin(along / 34))) ** 1.5 * 7 + Math.sin(along / 11 + B.mid * 4) * .8;
      const mesa = stepped(40 + B.big * 30 + B.mid * 10, 16);
      return dunes + smooth(.35, .6, fbm(x / 700, z / 700, 77, 2)) * (mesa - dunes) * (AMERICAS(e?.cont) ? .8 : .4);
    },
    c: (x, y, z, st, e) => {
      const flat = mixc(mixc(PAL.dune, PAL.dune2, smooth(-.3, .3, fbm(x / 60, z / 60, 16, 2))), PAL.scrub, smooth(.25, .55, fbm(x / 25, z / 25, 17, 2)) * .4);
      return mixc(flat, pick(AMERICAS(e?.cont) ? [PAL.redrock, PAL.ochre, PAL.buff, PAL.dune2] : [PAL.ochre, PAL.buff, PAL.dune2, PAL.buff], Math.floor((y + fbm(x / 90, z / 90, 18, 1) * 3) / 4.5)), smooth(.12, .3, st));
    },
  },
  canyon: {
    label: 'the canyonlands', forest: -.8, dry: 1, ownRock: 1, noSnow: 1,
    h: (x, z, B) => {
      const h = stepped(62 + B.big * 30 + B.mid * 10, 16), cl = riverLine(x, z, 73, 950), cut = smooth(.11, .035, cl);
      const floor = -1.5 - smooth(.035, 0, cl), wall = smooth(.11, .06, cl);
      return h + cut * ((floor - h) * wall + (floor - h) * (1 - wall) * .45);
    },
    c: (x, y, z, st) => {
      const flat = mixc(PAL.ochre, PAL.scrub, smooth(.1, .5, fbm(x / 30, z / 30, 19, 2)) * .5);
      return mixc(flat, pick([PAL.redrock, PAL.ochre, PAL.buff, PAL.redrock, PAL.dune2], Math.floor((y + fbm(x / 90, z / 90, 18, 1) * 3) / 4.5)), smooth(.12, .3, st));
    },
  },
  badlands: {
    label: 'the badlands', forest: -.95, dry: 1, ownRock: 1, noSnow: 1,
    h: (x, z, B) => 10 + B.big * 8 + softRidged(x / 115, z / 115, 46, 3, .1) ** 2 * 36 * (.6 + .4 * smooth(-.4, .3, fbm(x / 500, z / 500, 47, 2))) + Math.abs(fbm(x / 28, z / 28, 48, 1)) * 2.5,
    // bands of grey, pink, cream and lilac clay
    c: (x, y, z) => pick([PAL.clay1, PAL.clay2, PAL.clay3, PAL.clay4, PAL.clay5, PAL.clay2], Math.floor((y + fbm(x / 120, z / 120, 49, 1) * 4) / 3.2)),
  },
  saltflat: {
    label: 'the salt flats', forest: -1.3, dry: 1, noSnow: 1, flat: 1,
    h: (x, z, B) => 1.7 + fbm(x / 400, z / 400, 97, 2) * .5 + B.fine * .06,
    // a crust cracked into plates
    c: (x, y, z) => mixc(PAL.salt, PAL.salt2, ih(Math.floor((x + fbm(x / 20, z / 20, 98, 1) * 6) / 14), Math.floor((z + fbm(z / 20, x / 20, 99, 1) * 6) / 14), 312) * .7),
  },
  savanna: {
    label: 'the savanna', forest: -.55, noSnow: 1,
    h: (x, z, B) => 12 + B.big * 12 + B.mid * 4,
    c: (x, y, z) => mixc(mixc(PAL.straw, PAL.straw2, smooth(-.3, .3, fbm(x / 50, z / 50, 24, 2))), PAL.savGreen, smooth(.2, .6, fbm(x / 140, z / 140, 25, 2)) * .6),
  },
  karst: {
    label: 'the stone forest', forest: .12, ownRock: 1,
    h: (x, z, B) => {
      const low = 2.4 + B.mid * 1.6 + fbm(x / 90, z / 90, 98, 2) * 1.6 - 3.6 * smooth(-.25, -.45, fbm(x / 300, z / 300, 99, 2));
      return low + towers(x, z);
    },
    c: (x, y, z, st) => mixc(mixc(PAL.lush, PAL.lush2, smooth(-.3, .3, fbm(x / 40, z / 40, 26, 2))), mixc(PAL.lime, PAL.lime2, ih(x | 0, z | 0, 27)), smooth(.25, .45, st)),
  },
  volcano: {
    label: 'the fire mountain', forest: -.4, ownRock: 1,
    // a caldera: a ring of ash slopes round a crater lake, a smoking cone in the middle, old
    // lava fields all round
    h: (x, z, B, e) => {
      const r = Math.hypot(x - e.cx, z - e.cz) * (1 + fbm(x / 200, z / 200, 313, 2) * .12), rim = 150 + fbm(x / 120, z / 120, 314, 2) * 30;
      const out = 10 + B.big * 6 + Math.abs(fbm(x / 26, z / 26, 315, 2)) * 2.2 + rim * Math.exp(-(((r - 210) / (r > 210 ? 190 : 60)) ** 2));
      return r < 210 ? Math.max(out * smooth(140, 210, r) - 8 * smooth(200, 150, r), 34 * smooth(55, 0, r) - 8) : out;
    },
    c: (x, y, z, st) => {
      const old = mixc(mixc(PAL.lava, PAL.lava2, smooth(-.2, .2, fbm(x / 18, z / 18, 316, 2))), PAL.moss, smooth(.15, .5, fbm(x / 90, z / 90, 317, 2)) * .7);
      return mixc(old, mixc(PAL.ash, PAL.rust, smooth(.1, .4, fbm(x / 40, z / 40, 318, 1))), smooth(25, 60, y));
    },
  },
  swamp: {
    label: 'the mangrove swamp', forest: .15, lakes: .5, marsh: .6, noSnow: 1,
    h: (x, z) => .45 + fbm(x / 40, z / 40, 99, 2) * 1.7 + fbm(x / 180, z / 180, 100, 2) * 1.3,
    c: (x, y, z) => mixc(PAL.swamp, PAL.swamp2, smooth(-.3, .3, fbm(x / 20, z / 20, 28, 2))),
  },
  // ---- the lands the Earth needed ----
  ice: {
    label: 'the ice', forest: -2.5, ownRock: 1, flat: 1, cliff: .7,
    h: (x, z, B, e) => e?.cont === 'antarctica' ? antarctic(x, z, B) : 18 + B.big * 26 + B.mid * 7 + softRidged(x / 420, z / 420, 51, 2) ** 2 * 36,
    // blue ice on the steep faces; high up, dark rock where the mountains break through
    c: (x, y, z, st) => mixc(mixc(mixc(PAL.ice, PAL.snow, smooth(-.3, .3, fbm(x / 60, z / 60, 52, 2))), PAL.ice2, smooth(.12, .3, st) * .8),
      PAL.nunatak, smooth(.38, .6, st) * smooth(70, 120, y)),
  },
  tundra: {
    label: 'the tundra', forest: -1.4, lakes: .6,
    h: (x, z, B) => 9 + B.big * 12 + B.mid * 4 - 10 * smooth(-.08, -.42, B.big) - 3.5 * smooth(.25, .5, fbm(x / 110, z / 110, 53, 2)),
    c: (x, y, z) => mixc(mixc(PAL.tundra, PAL.tundra2, smooth(-.2, .4, fbm(x / 50, z / 50, 54, 2)) * .7), PAL.lichen, smooth(.25, .55, fbm(x / 14, z / 14, 55, 1)) * .5),
  },
  taiga: {
    label: 'the taiga', forest: .4, lakes: .4,
    h: (x, z, B) => 15 + B.big * 26 + B.mid * 10 - 10 * smooth(-.1, -.45, B.big),
    c: (x, y, z) => mixc(PAL.taiga, PAL.taiga2, smooth(-.2, .4, fbm(x / 26, z / 26, 56, 2)) * .6),
  },
  steppe: {
    label: 'the steppe', forest: -.95, noSnow: .4,
    h: (x, z, B) => 14 + B.big * 14 + B.mid * 3,
    c: (x, y, z) => mixc(mixc(PAL.steppe, PAL.steppe2, smooth(-.3, .3, fbm(x / 60, z / 60, 57, 2))), PAL.straw, smooth(.2, .6, fbm(x / 150, z / 150, 58, 2)) * .4),
  },
  maquis: {
    label: 'the Mediterranean hills', forest: -.2, noSnow: .7,
    h: (x, z, B) => 18 + B.big * 30 + B.mid * 13 + softRidged(x / 240, z / 240, 59, 2) ** 2 * 30,
    c: (x, y, z) => mixc(PAL.maquis, PAL.maquis2, smooth(.05, .45, fbm(x / 16, z / 16, 60, 2)) * .65),
  },
  rainforest: {
    label: 'the rainforest', forest: .75, noSnow: 1,
    h: (x, z, B) => 12 + B.big * 28 + B.mid * 14,
    c: (x, y, z) => mixc(PAL.rain, PAL.rain2, smooth(-.2, .4, fbm(x / 24, z / 24, 62, 2)) * .7),
  },
  marsh: {
    label: 'the reed marshes', forest: -.3, marsh: 1,
    h: (x, z) => .55 + fbm(x / 55, z / 55, 68, 2) * 2.6 + fbm(x / 260, z / 260, 69, 2) * 1.8,
    c: (x, y, z) => mixc(PAL.reed, PAL.reed2, smooth(-.3, .3, fbm(x / 18, z / 18, 13, 2))),
  },
};
export const BIOME_NAMES = Object.keys(BIOMES);

// which biome a cell is, and where its middle lies on the ground (the cells are laid out in
// warped space; cx, cz is the real point that warps to the cell's centre, near enough)
const warpX = (x, z) => fbm(x / 700, z / 700, 91, 2) * 260, warpZ = (x, z) => fbm(x / 700 + 5.3, z / 700, 92, 2) * 260;
const cells = new Map();
export function clearBiomeCache() { cells.clear(); }
// what each kind of Earth country rolls, by weight (the baked biome from earth.js -> lands)
export const PALETTE = {
  sea: [['coast', 1]], seaTropic: [['swamp', .5], ['rainforest', .5]],
  ice: [['ice', 1]], tundra: [['tundra', 6], ['moor', .8]], taiga: [['taiga', 6], ['birch', 1.5], ['lakeland', .8]], birch: [['birch', 5], ['taiga', 1.5], ['lakeland', 1]],
  forest: [['forest', 5], ['meadow', 2.5], ['lakeland', .8]], meadow: [['meadow', 5], ['forest', 2], ['lakeland', .6]], lakeland: [['lakeland', 5], ['forest', 1.5], ['birch', .6]],
  moor: [['moor', 5], ['cliffs', .5], ['meadow', .6]], coast: [['coast', 4], ['cliffs', 1], ['meadow', 1]], cliffs: [['cliffs', 4], ['coast', 1.5]],
  fjord: [['fjord', 5], ['mountains', 1], ['birch', .6]], mountains: [['mountains', 5], ['alpine', 1], ['forest', .6]], alpine: [['alpine', 5], ['mountains', 2]],
  sequoia: [['redwood', 3], ['mountains', 2]], redwood: [['redwood', 5], ['forest', 1]], steppe: [['steppe', 6], ['meadow', 1], ['badlands', .15], ['saltflat', .08]],
  maquis: [['maquis', 5], ['meadow', .8], ['cliffs', .4], ['karst', .15]], desert: [['desert', 7], ['canyon', .4], ['badlands', .4], ['saltflat', .4]],
  canyon: [['canyon', 5], ['desert', 1], ['badlands', 1]], badlands: [['badlands', 5], ['steppe', 1], ['canyon', .5]], saltflat: [['saltflat', 4], ['desert', 1.5]],
  savanna: [['savanna', 7], ['steppe', .4]], rainforest: [['rainforest', 7], ['swamp', .6], ['karst', .2]], swamp: [['swamp', 5], ['rainforest', 1.5]],
  marsh: [['marsh', 5], ['lakeland', .6]], karst: [['karst', 5], ['rainforest', 1], ['forest', .5]], volcano: [['volcano', 3], ['mountains', 1.5]],
};
// The lands a cell may roll besides its own Earth biome's, where the real place has them
// (w: { cont, lat, lon, coast } of the cell): canyons and badlands are the American West's (and
// the Gobi's), tower karst southern Europe's and Asia's, mangroves keep to tropical shores
const FITS = {
  canyon: w => AMERICAS(w.cont),
  badlands: w => AMERICAS(w.cont) || (w.cont === 'asia' && w.lat > 35),
  karst: w => w.cont === 'europe' || w.cont === 'asia',
  swamp: w => w.coast < 4000 && Math.abs(w.lat) < 30,
};
// the land nearest a point out at sea: its Earth biome and continent (a ring of looks)
function landNear(x, z) {
  for (const r of [900, 1800, 2700]) for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, e = earthBiome(px, pz);
    if (e !== 'sea') return { e, cont: continentAt(px, pz) };
  }
  return null;
}
// whether most of the land round a point (sixteen looks out to 1.2 km) is desert
const DRY_LANDS = new Set(['desert', 'saltflat', 'badlands', 'canyon']);
function dryRound(x, z) {
  let dry = 0, land = 0;
  for (const r of [600, 1200]) for (let i = 0; i < 8; i++) { const e = earthBiome(x + Math.cos(i * Math.PI / 4) * r, z + Math.sin(i * Math.PI / 4) * r); if (e !== 'sea') { land++; if (DRY_LANDS.has(e)) dry++; } }
  return dry * 2 >= land && dry > 0;
}
// what a shore cell (its middle out at sea) is on its land side: dunes by the deserts, grass by
// the savanna, ice by the ice (no beach in Antarctica), mangroves and rainforest on the wet tropical
// coasts, the coast elsewhere
const DRY_SHORE = { desert: 'desert', saltflat: 'desert', canyon: 'desert', badlands: 'desert', savanna: 'savanna', steppe: 'steppe', ice: 'ice' };
const STRETCH = 4, TRIG = Array.from({ length: 16 }, (_, q) => [Math.cos(q / 16 * Math.PI), Math.sin(q / 16 * Math.PI)]);
function ranged(x, z, k, seed, oct, soft) {
  return byGrain(x, z, th => {
    if (th < 0) return softRidged(x / k, z / k, seed, oct, soft);
    const [c, s] = TRIG[Math.round(th / Math.PI * 16) % 16], a = x * c + z * s, b = -x * s + z * c;
    return softRidged(a / (k * STRETCH), b / k, seed, oct, soft);
  });
}
// The rare lands the bake places on purpose, at the real place (tower karst, a salt flat, the
// redwoods...): a cell of one is that land for certain, not a roll of its palette (option A3). Not
// the fire mountains: each cell of one is a whole caldera, so they keep their roll
const SITE_LANDS = new Set(['karst', 'saltflat', 'badlands', 'canyon', 'cliffs', 'marsh', 'redwood', 'sequoia']);
// and the shores of tower karst are karst too, out to its islands (Ha Long); a fire mountain's
// island is a fire mountain (F);
// world.js tells which real island a point is on (isleOf: its kind, 'volcano', 'atoll', 'high')
const SITE_SHORES = new Set(['karst']);
let isleOf = null;
export const setIsleOf = f => { isleOf = f; };
function cellAt(gx, gz) {
  const key = gx * 100003 + gz; let c = cells.get(key); if (c) return c;
  const wcx = (gx + .15 + ih(gx, gz, 321) * .7) * BIOME_CELL, wcz = (gz + .15 + ih(gx, gz, 322) * .7) * BIOME_CELL;
  let cx = wcx, cz = wcz;
  for (let i = 0; i < 3; i++) { const nx = wcx - warpX(cx, cz), nz = wcz - warpZ(cx, cz); cx = nx; cz = nz; }
  let e = earthBiome(cx, cz), cont = continentAt(cx, cz);
  const [lat, lon] = latLon(cx, cz), w = { cont, lat, lon, coast: coastDist(cx, cz) };
  let pal = PALETTE[e] || PALETTE.forest;
  if (e === 'swamp' && dryRound(cx, cz)) e = 'desert';   // no mangroves on the desert coasts (the Namib, the Red Sea)
  if (e === 'sea') {
    const l = landNear(cx, cz), lake = lakeAt(cx, cz);
    if (l) w.cont = cont = l.cont;
    pal = l && SITE_SHORES.has(l.e) ? [[l.e, 1]]
      // a great lake's shores are the land round it (a salt lake's a salt flat), not a sea coast
      : lake && l ? (lake.salt ? [['saltflat', 1]] : (PALETTE[l.e] || PALETTE.forest).filter(p => !SITE_LANDS.has(p[0])))
      : l && DRY_SHORE[l.e] ? [[DRY_SHORE[l.e], 1]] : lat < -60 ? [['ice', 1]] : Math.abs(lat) < 24 ? PALETTE.seaTropic : PALETTE.sea;
    if (isleOf?.(cx, cz) === 'volcano') pal = [['volcano', 1]];
  } else if (SITE_LANDS.has(e)) pal = [pal[0]];
  pal = pal.filter((p, i) => i === 0 || !FITS[p[0]] || FITS[p[0]](w));
  let tot = 0; for (const p of pal) tot += p[1];
  let r = ih(gx, gz, 323) * tot, name = pal[0][0];
  for (const p of pal) if ((r -= p[1]) < 0) { name = p[0]; break; }
  c = { gx, gz, wcx, wcz, cx, cz, name, b: BIOMES[name], earth: e, cont, lat, lon };
  cells.set(key, c); if (cells.size > 3000) cells.delete(cells.keys().next().value);
  return c;
}
// the cells whose middles lie in a box
export function cellsNear(x, z, r) {
  const out = [], m = 300, a = Math.floor((x - r - m) / BIOME_CELL), b = Math.floor((x + r + m) / BIOME_CELL), c = Math.floor((z - r - m) / BIOME_CELL), d = Math.floor((z + r + m) / BIOME_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const e = cellAt(gx, gz); if (Math.abs(e.cx - x) < r && Math.abs(e.cz - z) < r) out.push(e); }
  return out;
}
// the biomes at a point with their weights (summing to 1), strongest first:
// [{ name, b, w, cx, cz, gx, gz, cont, lat, lon }] (cont: the cell's continent, earth.js)
// Antarctica (only its coast is on the strip): at the shore, pressure ridges where the ice is
// pushed up in broken walls of packed snow, in rows along the coast; inland the ice climbs, and
// mountains break through it, higher toward the pole (James, 2026-10-23)
function antarctic(x, z, B) {
  const inl = coastDist(x, z), w = fbm(x / 300, z / 300, 57, 2);
  const along = (x * .5 + z * .87) / 21 + w * 7 + fbm(x / 90, z / 90, 58, 2) * 2.5;
  const rows = (1 - Math.abs(Math.sin(along))) ** 3 * (.4 + .6 * smooth(-.25, .25, fbm(x / 120, z / 120, 59, 2)));
  const blocks = ridged(x / 34, z / 34, 60, 2) ** 3;
  const coast = smooth(20, 120, inl) * (1 - smooth(600, 1200, inl)) * (rows * 20 + blocks * 9) * (.6 + .4 * blocks);
  const up = smooth(300, 2600, inl), range = smooth(-.15, .35, fbm(x / 900, z / 900, 61, 2)) * .7 + .3;
  const peaks = softRidged(x / 230, z / 230, 62, 3, .05) ** 2.2 * 260 * range * smooth(500, 1800, inl);
  return 12 + B.big * 6 + B.mid * 3 + up * 70 + coast + peaks + Math.abs(fbm(x / 26, z / 26, 63, 1)) * 2 * (1 - up);
}

export function blend(x, z) {
  const wx = x + warpX(x, z), wz = z + warpZ(x, z);
  const gx0 = Math.floor(wx / BIOME_CELL), gz0 = Math.floor(wz / BIOME_CELL);
  const near = []; let d1 = 1e9;
  for (let gz = gz0 - 1; gz <= gz0 + 1; gz++) for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
    const c = cellAt(gx, gz), d = Math.hypot(wx - c.wcx, wz - c.wcz);
    near.push([d, c]); if (d < d1) d1 = d;
  }
  const out = []; let tot = 0;
  for (const [d, c] of near) { const w = smooth(BLEND, 0, d - d1); if (w > .002) { out.push({ name: c.name, b: c.b, w, cx: c.cx, cz: c.cz, gx: c.gx, gz: c.gz, cont: c.cont, lat: c.lat, lon: c.lon }); tot += w; } }
  for (const e of out) e.w /= tot;
  return out.sort((a, b) => b.w - a.w);
}
// how much of each kind of country a point is (summed over the biomes)
export function weightOf(bl, key) { let s = 0; for (const e of bl) s += e.w * (e.b[key] || 0); return s; }
export const share = (bl, name) => { let s = 0; for (const e of bl) if (e.name === name) s += e.w; return s; };
// one biome for a point, rolled by its weights (so the edges between lands mingle)
export function rollBiome(bl, r) { for (const e of bl) if ((r -= e.w) < 0) return e; return bl[0]; }
// the continent a point's land belongs to (its strongest cell's; at sea, the nearest shore's)
export const realmAt = (x, z) => blend(x, z)[0].cont;
export { clamp };
