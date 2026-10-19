// The field guide: a page for each kind of animal the hawk has seen, kept across journeys. The
// first time one is drawn on screen near enough to make out, its picture is cut from that very
// frame, washed onto a little round of paper, and noted with the day, the season and the place.
// The drawing code only calls sight(); the cutting happens once, right after the frame is drawn.
import { SPECIES } from './songs.js';

const NOTES = {
  deer: ['White-tailed deer', 'Grazes the forest edge at dawn and dusk, and flags its white tail as it bolts.'],
  heron: ['Great blue heron', 'Stands still in the shallows for minutes at a time, then spears a fish in one strike.'],
  squirrel: ['Eastern gray squirrel', 'Buries nuts all autumn; the ones it never digs up grow into oaks.'],
  mouse: ['Meadow vole', 'A red-tail\'s favourite meal: it runs in hidden tunnels through the grass.'],
  fish: ['Pumpkinseed sunfish', 'Rises to snap insects off the surface on calm evenings.'],
  crow: ['American crow', 'Crows gang up to chase hawks away from their trees, calling the whole neighbourhood in.'],
  monarch: ['Monarch butterfly', 'Flies thousands of miles south each autumn to the same few mountain forests.'],
  kingbird: ['Eastern kingbird', 'Its Latin name means tyrant of tyrants: it chases hawks, crows and herons away from its nest.'],
  broadwing: ['Broad-winged hawk', 'Migrates in great kettles of hundreds, riding one thermal after another all the way to South America.'],
  sharpie: ['Sharp-shinned hawk', 'A small hawk of the woods that hunts songbirds; it flies flap-flap-glide.'],
  kestrel: ['American kestrel', 'The smallest falcon here; it hovers over fields on rapid wingbeats, watching for grasshoppers.'],
  redtail: ['Red-tailed hawk', 'Your own kind: the brick-red tail comes with the first full year.'],
  osprey: ['Osprey', 'Dives feet first for fish, and flies with a kink in its long wings like a gull.'],
  eagle: ['Bald eagle', 'Would rather steal a fish than catch one; ospreys and hawks are its usual victims.'],
  bison: ['American bison', 'The largest animal on the prairie. Its hooves flush grasshoppers for hawks that follow the herd.'],
  bear: ['American black bear', 'Wades into the run in late summer to catch fish leaping upstream.'],
  grizzly: ['Grizzly bear', 'Stands at the top of a falls and lets the leaping salmon come to its jaws.'],
};
const SONG = { Chickadee: 'Says its own name, chick-a-dee-dee-dee, and stays all winter.', Robin: 'One of the first to sing at dawn, a cheery up-and-down carol.',
  Warbler: 'A bright scrap of yellow that sings a rising run of notes.', Wren: 'Tiny, loud, and always with its tail cocked high.',
  Thrush: 'Its flute-like song echoes through the trees at dawn and dusk.', Finch: 'Bounces through the air on looping flights, calling as it goes.',
  Owl: 'Hunts by sound in the dark, on wings that make no noise.', Lark: 'Sings while hanging high in the air over open fields.',
  Cardinal: 'Male and female both sing; red all year round.', Meadowlark: 'Sings its flute-like phrases from a fence post or a tall weed.',
  'Red-winged blackbird': 'Flashes red shoulders and calls conk-la-ree from the reeds.', 'Mourning dove': 'Its low, sad cooing carries far on still mornings.',
  'Blue jay': 'A clever mimic that can copy the scream of a red-shouldered hawk.', 'Song sparrow': 'Each male knows up to a dozen songs and takes turns with them.',
  'White-throated sparrow': 'Whistles Old Sam Peabody, Peabody, Peabody.', Veery: 'Its spiralling, downward song sounds like a voice in a drainpipe.' };

// every page in the guide, in field-guide order: the songbirds, then the larger life
export const PAGES = [
  ...SPECIES.map(sp => ({ key: 'sp' + sp.id, name: sp.name, note: SONG[sp.name] || '', hint: sp.hint })),
  ...Object.entries(NOTES).map(([key, [name, note]]) => ({ key, name, note })),
];

const want = new Map();
let seen = null;
const loadSeen = store => seen || (seen = store.get('guide', {}));

// called while drawing: the animal `key` is at world x, y, about r world units across
export function sight(G, key, x, y, r) {
  if (!seen || seen[key] || want.has(key) || G.paused) return;
  const cx = x - G.cam.x, cy = y - G.cam.y;
  if (cx < r || cy < r || cx > G.view.w - r || cy > G.view.h - r * .6) return;   // well inside the frame
  if (r * 2 * G.view.s < 14) return;   // too far away to make out
  want.set(key, { x, y, r });
}

// after the frame: cut each new sighting from the canvas onto its round of paper
export function captureSightings(G, canvas, store, note) {
  loadSeen(store);
  if (!want.size) return [];
  const got = [], px = G.view.px;
  for (const [key, w] of want) {
    const S = 120, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), side = w.r * 2.3 * px;
    x.fillStyle = '#f4eee1'; x.fillRect(0, 0, S, S);
    // the picture, fading out at its edge like a wash that ran dry
    const m = document.createElement('canvas'); m.width = m.height = S;
    const mx = m.getContext('2d');
    mx.drawImage(canvas, (w.x - G.cam.x) * px - side / 2, (w.y - w.r * .35 - G.cam.y) * px - side / 2, side, side, 0, 0, S, S);
    mx.globalCompositeOperation = 'destination-in';
    const g = mx.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S * .5); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = g; mx.fillRect(0, 0, S, S);
    x.drawImage(m, 0, 0);
    try { seen[key] = { src: c.toDataURL('image/jpeg', .7), note }; got.push(key); } catch { /* a tainted canvas: try another time */ }
  }
  want.clear();
  if (got.length) store.set('guide', seen);
  return got;
}

export const pageName = key => PAGES.find(p => p.key === key)?.name || key;
// the guide for the journal: every page, with its picture and first sighting once seen (those first)
export function guidePages(store) {
  const s = loadSeen(store);
  const all = PAGES.map(p => ({ ...p, seen: s[p.key] || null }));
  return [...all.filter(p => p.seen), ...all.filter(p => !p.seen)];
}
