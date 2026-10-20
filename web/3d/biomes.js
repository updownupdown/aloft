// The lands of Aloft come in patches, like a quilt: the ground is cut into cells about a
// kilometre across (their edges warped so no line is straight), each cell gets one biome by a
// seeded roll, and neighbouring biomes blend over a band about 200 m wide. Every biome is
// found everywhere, but deserts, canyons and savanna lean south and snowy peaks, fjords and
// birch woods lean north. Past JOURNEY.marsh the wintering marsh takes over.
// A biome is its ground (h: height in m at x, z), its colours (c), how wooded it is (forest),
// and flags for the shared touches (rock on steep ground, snow up high, sand at the shore).
// Trees, rocks and flora read the biome too (world.js, sys/flora.js).
import { ih, fbm, ridged, smooth, clamp } from './noise.js';

export const JOURNEY = { home: 0, marsh: 9000 };
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
  // the trees of the new lands
  birch: hex('#e9e4d8'), birchLeaf: hex('#9bb84f'), birchLeaf2: hex('#b4c35a'), redBark: hex('#8a4a32'), redLeaf: hex('#3f5f3c'),
  acacia: hex('#7d8a3c'), acacia2: hex('#93993f'), cactus: hex('#5f8a4f'), cactus2: hex('#729a58'), joshua: hex('#6d7f45'), mangrove: hex('#4f7a46'),
};
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const pick = (cols, i) => cols[((i % cols.length) + cols.length) % cols.length];

// shared shapes
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
    w: () => 1, label: 'the meadows', forest: -.15,
    h: (x, z, B) => 13 + B.big * 30 + B.mid * 10,
    c: (x, y, z) => mixc(mixc(PAL.meadow, PAL.meadow2, smooth(-.35, .35, fbm(x / 70, z / 70, 11, 2))), PAL.moss, smooth(.1, .5, fbm(x / 25, z / 25, 12, 2)) * .45),
  },
  forest: {
    w: () => 1.1, label: 'the woods', forest: .32,
    h: (x, z, B) => 16 + B.big * 34 + B.mid * 13,
    c: (x, y, z) => mixc(mixc(PAL.meadow, PAL.wood, .6), PAL.moss, smooth(.1, .5, fbm(x / 25, z / 25, 12, 2)) * .5),
  },
  lakeland: {
    w: () => .75, label: 'the lakelands', forest: .05, lakes: 1,
    h: (x, z, B) => 12 + B.big * 30 + B.mid * 10 - 13 * smooth(-.05, -.45, B.big),
    c: (x, y, z) => mixc(mixc(PAL.meadow, PAL.meadow2, smooth(-.35, .35, fbm(x / 70, z / 70, 11, 2))), PAL.wood, smooth(-.1, .4, fbm(x / 220, z / 220, 9, 2)) * .6),
  },
  birch: {
    w: (n) => .35 + n * .9, label: 'the birch woods', forest: .3,
    h: (x, z, B) => 18 + B.big * 26 + B.mid * 12,
    c: (x, y, z) => mixc(PAL.birchFloor, PAL.fern, smooth(-.2, .4, fbm(x / 30, z / 30, 21, 2)) * .6),
  },
  redwood: {
    w: () => .5, label: 'the giant woods', forest: .4,
    h: (x, z, B) => 26 + B.big * 44 + B.mid * 18,
    c: (x, y, z) => mixc(PAL.duff, PAL.moss, smooth(-.2, .4, fbm(x / 22, z / 22, 22, 2)) * .7),
  },
  moor: {
    w: () => .6, label: 'the moors', forest: -.55,
    h: (x, z, B) => 22 + B.big * 14 - Math.abs(B.mid) * 6,
    c: (x, y, z) => mixc(PAL.moor, PAL.heather2, smooth(0, .4, fbm(x / 30, z / 30, 15, 2)) * .55),
  },
  mountains: {
    w: (n) => .5 + n * .4, label: 'the high country', forest: 0, high: 1,
    h: (x, z, B) => 30 + B.big * 30 + B.mid * 12 + ridged(x / 260, z / 260, 4, 3) ** 2 * 160,
    c: (x, y, z) => mixc(PAL.meadow, PAL.heath, smooth(40, 110, y) * .6),
  },
  alpine: {
    w: (n) => .12 + n * 1.3, label: 'the snowy peaks', forest: -.2, high: 1, peaks: 1,
    h: (x, z, B) => 70 + B.big * 40 + B.mid * 16 + ridged(x / 330, z / 330, 41, 3) ** 2.2 * 270 + ridged(x / 90, z / 90, 42, 2) ** 2 * 18,
    c: (x, y, z, st) => mixc(mixc(PAL.alpine, PAL.heath, smooth(60, 140, y)), PAL.scree, smooth(.15, .3, st) * smooth(90, 150, y)),
  },
  cliffs: {
    w: () => .55, label: 'the cliffs', forest: -.1, high: 1,
    h: (x, z, B) => {
      const h = 45 + B.big * 40 + B.mid * 14 + ridged(x / 300, z / 300, 43, 2) ** 2 * 90;
      return h + smooth(-.2, .12, fbm(x / 650, z / 650, 64, 2)) * .85 * (stepped(Math.max(0, h), 24, .78, .96) - h);
    },
    c: (x, y, z) => mixc(PAL.meadow, PAL.heath, smooth(30, 100, y) * .6),
  },
  fjord: {
    w: (n) => .12 + n * .8, label: 'the fjords', forest: .1, high: .5, coast: 1,
    h: (x, z, B) => {
      const plat = 92 + B.big * 34 + B.mid * 12 + ridged(x / 210, z / 210, 44, 2) ** 2 * 60, cl = riverLine(x, z, 45, 800);
      return plat + (-15 - plat) * smooth(.13, .055, cl);
    },
    c: (x, y, z) => mixc(PAL.fjord, PAL.moss, smooth(-.2, .4, fbm(x / 30, z / 30, 23, 2)) * .5),
  },
  coast: {
    w: () => .6, label: 'the coast', forest: -.25, coast: 1,
    // a bay of sea in the middle of the cell, ringed by sea cliffs (sandy coves in places)
    h: (x, z, B, e) => {
      const R = 330 + ih(e.gx, e.gz, 311) * 120, d = Math.hypot(x - e.cx, z - e.cz) / R + fbm(x / 160, z / 160, 63, 2) * .12;
      const cove = smooth(.1, .4, fbm(x / 300, z / 300, 67, 1)), sea = cove > .5 ? smooth(1.08, .9, d) : smooth(1, .965, d);
      const land = 16 + B.big * 14 + B.mid * 6 + 24 * smooth(1.5, 1, d) * (1 - cove);
      return land * (1 - sea) - 16 * sea;
    },
    c: (x, y, z) => mixc(PAL.heath, PAL.heather, smooth(.1, .5, fbm(x / 40, z / 40, 14, 2)) * .6),
  },
  desert: {
    w: (n, s) => .1 + s * 1.3, label: 'the dunes', forest: -.95, dry: 1, ownRock: 1, noSnow: 1, sandy: 1,
    h: (x, z, B) => {
      const along = x * .8 + z * .6 + fbm(x / 400, z / 400, 76, 2) * 60;
      const dunes = 14 + B.big * 10 + (1 - Math.abs(Math.sin(along / 34))) ** 1.5 * 7 + Math.sin(along / 11 + B.mid * 4) * .8;
      const mesa = stepped(40 + B.big * 30 + B.mid * 10, 16);
      return dunes + smooth(.35, .6, fbm(x / 700, z / 700, 77, 2)) * (mesa - dunes) * .8;
    },
    c: (x, y, z, st) => {
      const flat = mixc(mixc(PAL.dune, PAL.dune2, smooth(-.3, .3, fbm(x / 60, z / 60, 16, 2))), PAL.scrub, smooth(.25, .55, fbm(x / 25, z / 25, 17, 2)) * .4);
      return mixc(flat, pick([PAL.redrock, PAL.ochre, PAL.buff, PAL.dune2], Math.floor((y + fbm(x / 90, z / 90, 18, 1) * 3) / 4.5)), smooth(.12, .3, st));
    },
  },
  canyon: {
    w: (n, s) => .08 + s * 1.1, label: 'the canyonlands', forest: -.8, dry: 1, ownRock: 1, noSnow: 1,
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
    w: (n, s) => .12 + s * .7, label: 'the badlands', forest: -.95, dry: 1, ownRock: 1, noSnow: 1,
    h: (x, z, B) => 10 + B.big * 8 + ridged(x / 115, z / 115, 46, 3) ** 2 * 36 * (.6 + .4 * smooth(-.4, .3, fbm(x / 500, z / 500, 47, 2))) + Math.abs(fbm(x / 28, z / 28, 48, 1)) * 2.5,
    // bands of grey, pink, cream and lilac clay
    c: (x, y, z) => pick([PAL.clay1, PAL.clay2, PAL.clay3, PAL.clay4, PAL.clay5, PAL.clay2], Math.floor((y + fbm(x / 120, z / 120, 49, 1) * 4) / 3.2)),
  },
  saltflat: {
    w: (n, s) => .08 + s * .45, label: 'the salt flats', forest: -1.3, dry: 1, noSnow: 1, flat: 1,
    h: (x, z, B) => 1.7 + fbm(x / 400, z / 400, 97, 2) * .5 + B.fine * .06,
    // a crust cracked into plates
    c: (x, y, z) => mixc(PAL.salt, PAL.salt2, ih(Math.floor((x + fbm(x / 20, z / 20, 98, 1) * 6) / 14), Math.floor((z + fbm(z / 20, x / 20, 99, 1) * 6) / 14), 312) * .7),
  },
  savanna: {
    w: (n, s) => .15 + s * .9, label: 'the savanna', forest: -.55, noSnow: 1,
    h: (x, z, B) => 12 + B.big * 12 + B.mid * 4,
    c: (x, y, z) => mixc(mixc(PAL.straw, PAL.straw2, smooth(-.3, .3, fbm(x / 50, z / 50, 24, 2))), PAL.savGreen, smooth(.2, .6, fbm(x / 140, z / 140, 25, 2)) * .6),
  },
  karst: {
    w: () => .45, label: 'the stone forest', forest: .12, ownRock: 1,
    h: (x, z, B) => {
      const low = 2.4 + B.mid * 1.6 + fbm(x / 90, z / 90, 98, 2) * 1.6 - 3.6 * smooth(-.25, -.45, fbm(x / 300, z / 300, 99, 2));
      return low + towers(x, z);
    },
    c: (x, y, z, st) => mixc(mixc(PAL.lush, PAL.lush2, smooth(-.3, .3, fbm(x / 40, z / 40, 26, 2))), mixc(PAL.lime, PAL.lime2, ih(x | 0, z | 0, 27)), smooth(.25, .45, st)),
  },
  volcano: {
    w: () => .22, label: 'the fire mountain', forest: -.4, ownRock: 1,
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
    w: (n, s) => .2 + s * .35, label: 'the mangrove swamp', forest: .15, lakes: .5, marsh: .6, noSnow: 1,
    h: (x, z) => .45 + fbm(x / 40, z / 40, 99, 2) * 1.7 + fbm(x / 180, z / 180, 100, 2) * 1.3,
    c: (x, y, z) => mixc(PAL.swamp, PAL.swamp2, smooth(-.3, .3, fbm(x / 20, z / 20, 28, 2))),
  },
  marsh: {
    w: () => 0, label: 'the wintering marsh', forest: -.3, marsh: 1,
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
function cellAt(gx, gz) {
  const key = gx * 100003 + gz; let c = cells.get(key); if (c) return c;
  const wcx = (gx + .15 + ih(gx, gz, 321) * .7) * BIOME_CELL, wcz = (gz + .15 + ih(gx, gz, 322) * .7) * BIOME_CELL;
  let cx = wcx, cz = wcz;
  for (let i = 0; i < 3; i++) { const nx = wcx - warpX(cx, cz), nz = wcz - warpZ(cx, cz); cx = nx; cz = nz; }
  const s = smooth(-2500, 7000, cz), n = 1 - s;
  let name;
  if (Math.hypot(wcx, wcz) < BIOME_CELL * .75 || (gx === 0 && gz === 0)) name = 'lakeland';   // home: woods and lakes
  else {
    let tot = 0; const ws = BIOME_NAMES.map(k => { const w = BIOMES[k].w(n, s); tot += w; return w; });
    let r = ih(gx, gz, 323) * tot; name = BIOME_NAMES[BIOME_NAMES.length - 1];
    for (let i = 0; i < ws.length; i++) if ((r -= ws[i]) < 0) { name = BIOME_NAMES[i]; break; }
  }
  c = { gx, gz, wcx, wcz, cx, cz, name, b: BIOMES[name] };
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
// [{ name, b, w, cx, cz, gx, gz }]
export function blend(x, z) {
  const wx = x + warpX(x, z), wz = z + warpZ(x, z);
  const gx0 = Math.floor(wx / BIOME_CELL), gz0 = Math.floor(wz / BIOME_CELL);
  const near = []; let d1 = 1e9;
  for (let gz = gz0 - 1; gz <= gz0 + 1; gz++) for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
    const c = cellAt(gx, gz), d = Math.hypot(wx - c.wcx, wz - c.wcz);
    near.push([d, c]); if (d < d1) d1 = d;
  }
  const out = []; let tot = 0;
  for (const [d, c] of near) { const w = smooth(BLEND, 0, d - d1); if (w > .002) { out.push({ name: c.name, b: c.b, w, cx: c.cx, cz: c.cz, gx: c.gx, gz: c.gz }); tot += w; } }
  // the wintering marsh, a broad band across the far south
  const m = smooth(JOURNEY.marsh - 500, JOURNEY.marsh + 150, z + fbm(x / 900, z / 1300, 61, 2) * 320);
  for (const e of out) e.w = e.w / tot * (1 - m);
  if (m > .002) out.push({ name: 'marsh', b: BIOMES.marsh, w: m, cx: x, cz: JOURNEY.marsh + 2000, gx: 0, gz: 1e6 });
  return out.sort((a, b) => b.w - a.w);
}
// how much of each kind of country a point is (summed over the biomes)
export function weightOf(bl, key) { let s = 0; for (const e of bl) s += e.w * (e.b[key] || 0); return s; }
export const share = (bl, name) => { let s = 0; for (const e of bl) if (e.name === name) s += e.w; return s; };
// one biome for a point, rolled by its weights (so the edges between lands mingle)
export function rollBiome(bl, r) { for (const e of bl) if ((r -= e.w) < 0) return e; return bl[0]; }
export { clamp };
