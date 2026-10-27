// What the finds add up to (James, 2026-10-26: "we want random finds to add up to something"; K2 to K8
// of the gameplay study). Owns Journal > Things > Keepsakes, the shelf every find goes on.
// - Sets (K2): the keepsakes fall into small named sets, each a life once lived (the keeper's things,
//   the village, the hill farm, the sea notes...). The shelf shows each with its count and named gaps;
//   a finished set gives the bird that finishes it a step of growth and the whole journey a sense.
// - Treasures are senses (K3): taking one turns on one small lasting thing (G.has(kind), ruins.js):
//   the spyglass finds landmarks from twice as far, the watch tells the hour on the dial, the handbell
//   carries your Call farther, the float shows fish boils on the compass, the locket marks where you
//   began, the teacup quenches faster, the horseshoe brings luck in the hunt, the whistle sounds before
//   a gust, the sheep bell gives a stronger morning.
// - Hidden places hold things (K4): a painted wall in each rock shelter, a lost trinket behind the
//   falls, a clay jar at an oasis; pages, chart pieces and
//   far signs in the caves' halls. Unfound ones glint.
// - The naturalist's notebook (K5): torn pages on the lookouts' walks and in the caves, each a
//   technique (a step of growth), a sketch (a rumour of a hidden place near) or a riddle; the last
//   shows the gap in the aurora.
// - The torn chart (K6): four pieces (sea caves, bottles) ink a remote island on the Map.
// - The far signs (K7): seven pieces of glass in colours the world has not got, at the far wonders
//   and deep in the caves; each flickers another sky for a moment. All seven open a dream.
// - The shelf remembers where (K8): tap a found thing (or a hidden place) and the Map opens on it.
import { journal, esc, shelf } from '../journal.js';
import { KEEPSAKES } from './story.js';
import { NOTES } from './drift.js';
import { TREASURES, TRINKETS } from './ruinshapes.js';
import { groundAt, wrapX, ih, toXZ, height, WATER, landmarksNear } from '../world.js';
import { cavesNear } from '../caves.js';
import { wondersNear } from '../wonders.js';
import { builder } from '../shapes.js';

const cap = s => s[0].toUpperCase() + s.slice(1);
const capA = n => cap(n.replace(/^(a|an|the) /i, ''));
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

// the notebook's pages, in the order they are found: [kind, title, text, what it does]
const PAGES = [
  ['skill', 'Thermals', 'Over dark ground in the afternoon sun the air rises. Circle tight inside it, and let it carry you.', 'lift'],
  ['sketch', 'A roof of rock', 'A sketch of a shelter high in a ridge: a slab of stone over a dry floor, its mouth downhill.', 'shelter'],
  ['skill', 'The stoop', 'Fold the wings and fall: a hawk in a stoop goes faster than any bird in level flight.', 'speed'],
  ['riddle', 'A riddle', '“Sing in the hall of a cave, and the hill sings back what it keeps.”', 'cave'],
  ['sketch', 'The owl\'s door', 'A sketch of a slab of rock leaning over a dry floor, an owl drawn in its shadow. “The owls keep things here.”', 'shelter'],
  ['skill', 'Rest well', 'A bird that roosts fed and watered wakes strong. Sleep somewhere high and dry.', 'recovery'],
  ['riddle', 'A riddle', '“The owl in the rock shelter trades for a song: the soft one, sung at dusk.”', 'shelter'],
  ['sketch', 'Behind the water', 'A sketch of a waterfall over a sheer face, and a ledge drawn in behind the curtain.', 'ledge'],
  ['skill', 'Flap less, climb more', 'Short strong beats, then glide. The climb comes from the beat, not the flapping.', 'climb'],
  ['sketch', 'Palms in the sand', 'A sketch of a pool under date palms, far out in the desert. “Fresh water, the only for miles.”', 'oasis'],
  ['skill', 'Higher still', 'The thermals go higher than you think. The strong ones top out where the clouds are made.', 'height'],
  ['gap', 'The last spread', 'Both pages: the pole wall under the northern lights, and a fold drawn brighter than the rest. “On a night of the aurora, fly into its brightest fold. There is another shore.”', 'aurora'],
];
// the painted walls, one in each shelter, in the order you see them
const PAINTS = ['running horses', 'a hand, pressed in ochre', 'a hawk with its wings open', 'deer crossing a river', 'the sun and a row of birds', 'a whale', 'cranes dancing', 'a herd under the stars'];
const SIGNS = ['violet', 'sea-glass gold', 'deep rose', 'ice green', 'night blue', 'ember', 'pearl'];
const SIGN_WONDERS = ['giza', 'picchu', 'angkor', 'moai'];   // the far wonders that each keep a sign (the rest are in deep caves)
const ISLAND = { name: 'Tristan da Cunha', lat: -37.1, lon: -12.3 };   // the chart's island, real and remote

// the sets: each item 'tr:' a treasure, 'tk:' a trinket, 'note:' a bottle note, 'grass:' a keepsake in the grass,
// 'page:', 'paint:', 'chart:', 'sign:'
const SETS = [
  { id: 'keeper', title: 'The keeper\'s things', items: ['tr:lens', 'tr:lampkey', 'tr:float', 'tr:spyglass', 'note:0', 'note:13'], stat: 'stamina', sense: 'Every lighthouse shows on your compass out at sea, lit or dark.' },
  { id: 'village', title: 'The village', items: ['tr:bell', 'tr:locket', 'tr:watch', 'tr:teacup', 'tk:shard', 'tk:thimble'], stat: 'recovery', sense: 'Glints are seen from twice as far.' },
  { id: 'farm', title: 'The hill farm', items: ['tr:horseshoe', 'tr:whistle', 'tr:sheepbell', 'tk:key', 'tk:ribbon', 'tk:button'], stat: 'climb', sense: 'Your feet reach a little farther in the hunt.' },
  { id: 'sea', title: 'The sea notes', items: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12].map(i => 'note:' + i), stat: 'stamina', sense: 'Bottles near you show on the compass.' },
  { id: 'paint', title: 'The painted walls', items: PAINTS.map((_, i) => 'paint:' + i), stat: 'lift', sense: 'Hidden places glint to you from farther off.' },
  { id: 'notebook', title: 'The naturalist\'s notebook', items: PAGES.map((_, i) => 'page:' + i), stat: 'height' },
  { id: 'chart', title: 'The torn chart', items: [0, 1, 2, 3].map(i => 'chart:' + i), stat: 'stamina' },
  { id: 'signs', title: 'The far signs', items: SIGNS.map((_, i) => 'sign:' + i), stat: 'height' },
  { id: 'trinkets', title: 'Trinkets', items: Object.keys(TRINKETS).map(k => 'tk:' + k), stat: 'speed' },
  { id: 'grass', title: 'Things in the grass', items: KEEPSAKES.map((_, i) => 'grass:' + i), stat: 'recovery' },
  { id: 'notes', title: 'Other notes', items: [7, 8, 14, 15].map(i => 'note:' + i) },
];

// a painting on a shelter's back wall, in its frame (x out of the mouth, z across, y up): ochre and charcoal strokes
function paintMesh() {
  const B = builder(), O = [.62, .3, .16], K = [.18, .15, .13], x = -1.85;
  const st = (y0, z0, y1, z1, w, c) => { const dy = y1 - y0, dz = z1 - z0, l = Math.hypot(dy, dz) || 1, ny = -dz / l * w, nz = dy / l * w; B.tri([x, y0 + ny, z0 + nz], [x, y1 + ny, z1 + nz], [x, y1 - ny, z1 - nz], c); B.tri([x, y0 + ny, z0 + nz], [x, y1 - ny, z1 - nz], [x, y0 - ny, z0 - nz], c); };
  // a running animal, two birds, a hand
  st(1.3, -1.6, 1.4, -.6, .12, O); st(1.4, -.6, 1.75, -.35, .07, O); st(1.3, -1.5, .9, -1.8, .04, O); st(1.3, -1.4, .9, -1.2, .04, O); st(1.35, -.8, .95, -.95, .04, O); st(1.35, -.7, .95, -.5, .04, O);
  st(2.0, .3, 2.15, .6, .03, K); st(2.15, .6, 2.0, .9, .03, K); st(1.75, .9, 1.88, 1.15, .025, K); st(1.88, 1.15, 1.75, 1.4, .025, K);
  st(1.0, 1.0, 1.4, 1.0, .1, O); for (let i = 0; i < 4; i++) st(1.4, .85 + i * .1, 1.65, .82 + i * .12, .025, O);
  return B.out();
}

export function findsSystem(G) {
  const b = G.b, H = G.hud, R = G.R;
  const F = { pages: {}, paints: {}, charts: {}, signs: {}, caches: {}, sets: {}, taken: {}, island: false };
  G.finds = { glintK: 1, reachK: 1, signs: () => Object.keys(F.signs).length };

  // ---- what is found, by item key ---------------------------------------------------------------
  const notes = () => G.bottleNotes?.() || [];
  const grass = () => { const c = {}; for (const k of G.story?.keepsakes || []) if (typeof k === 'number') c[k] = (c[k] || 0) + 1; return c; };
  function info(key) {
    const [t, k] = key.split(':'), i = +k, St = G.relics || { treasures: {}, trinkets: [] };
    if (t === 'tr') { const f = St.treasures[k], [n, , story] = TREASURES[k]; return { name: capA(n), star: true, found: !!f, at: f?.at, note: f ? `${story} Found on day ${f.day}${f.place ? `, at ${f.place}` : ''}.` : '', hint: capA(n) }; }
    if (t === 'tk') { const n = St.trinkets.filter(q => q === k).length; return { name: capA(TRINKETS[k]), found: n > 0, n, at: St.at?.[k], hint: capA(TRINKETS[k]) }; }
    if (t === 'note') { const f = notes().find(q => q.note === i), txt = NOTES[i] || ''; return { name: f ? `“${txt.split(' ').slice(0, 4).join(' ').replace(/[.,;:]$/, '')}…”` : 'A note in a bottle', found: !!f, at: f?.at, note: f ? `“${txt}” ${f.where || ''}` : '' }; }
    if (t === 'grass') { const n = grass()[i] || 0; return { name: capA(KEEPSAKES[i]), found: n > 0, n }; }
    if (t === 'page') { const f = F.pages[i], [, title, text] = PAGES[i]; return { name: f ? `Page ${i + 1}: ${title}` : `Page ${i + 1}`, found: !!f, at: f?.at, icon: 'notebook', note: f ? text : '' }; }
    if (t === 'paint') { const f = F.paints[i]; return { name: f ? cap(PAINTS[i]) : 'A painted wall', found: !!f, at: f?.at, icon: 'paint', note: f ? `Painted on the back wall of ${f.place || 'a rock shelter'}.` : '' }; }
    if (t === 'chart') { const f = F.charts[i]; return { name: f ? `Chart piece ${i + 1}` : 'A piece of a chart', found: !!f, at: f?.at, icon: 'chart' }; }
    if (t === 'sign') { const f = F.signs[i]; return { name: f ? `${cap(SIGNS[i])} glass` : 'A far sign', star: true, found: !!f, at: f?.at, icon: 'sign', note: f ? 'Glass in a colour the world does not have. Holding it, the sky changed for a moment.' : '' }; }
    return { name: key, found: false };
  }
  const count = s => s.items.filter(k => info(k).found).length;

  // ---- sets: finishing one -------------------------------------------------------------------------
  const SENSE = {
    village: () => { G.finds.glintK = 2; }, farm: () => { G.finds.reachK = 1.12; },
    paint: () => { G.finds.hiddenK = 2; },
  };
  function checkSets(quiet = false) {
    for (const s of SETS) {
      if (F.sets[s.id] || count(s) < s.items.length) continue;
      F.sets[s.id] = G.day || 1;
      if (quiet) continue;
      G.audio.chord?.() || G.audio.learned?.();
      H.say(`${s.title}: the set is whole.${s.sense ? ' ' + s.sense : ''}`, { kind: 'event', secs: 6, icon: 'keepsake' });
      if (s.stat) G.gift(s.stat, s.title, 'set:' + s.id);
      if (s.id === 'chart') islandQuest();
      if (s.id === 'signs') G.emit('signs');
      G.emit('set', s.id);
    }
    for (const id in F.sets) SENSE[id]?.();
  }
  for (const e of ['keepsake', 'note', 'artefact', 'find']) G.on(e, () => setTimeout(() => checkSets(), 0));

  // ---- the treasures' senses (K3) ----------------------------------------------------------------
  // (the spyglass is journey.js, the watch hud.js, the handbell compass.js, the teacup food.js,
  // the sheep bell growth.js; the rest here)
  (G.marks ||= []).push(() => {
    const out = [], sea = height(b.p[0], b.p[2]) < WATER;
    if (G.has?.('float') && sea) for (const o of G.sea?.boils().values() || []) { const d = Math.hypot(wrapX(o.x - b.p[0]), o.z - b.p[2]); if (d > 40 && d < 1500) out.push(['find', o.x, o.z, 'Fish']); }
    if (G.has?.('locket') && G.home) { const d = Math.hypot(wrapX(G.home[0] - b.p[0]), G.home[1] - b.p[2]); if (d > 300) out.push(['home', G.home[0], G.home[1], 'Where you began']); }
    if (F.sets.sea) for (const o of G.bottles?.() || []) { const d = Math.hypot(wrapX(o.x - b.p[0]), o.z - b.p[2]); if (d < 1000) out.push(['find', o.x, o.z, 'A bottle']); }
    if (F.sets.keeper && sea) for (const l of lights) if (!G.lamps?.lit('k' + l.id)) out.push(['lamp', l.x, l.z, l.name]);
    return out;
  });
  let lights = [], lightsT = 0, gustWas = 0;

  // ---- the things in the caves' halls, by the far wonders -----------------------------------------
  // which find a cave keeps (the next of its kind, so a page is always the next page)
  const nextOf = (o, n) => { for (let i = 0; i < n; i++) if (!o[i]) return i; return -1; };
  function caveThing(cv) {
    const h = ih(hash(cv.id), 5, 871);
    if (cv.kind === 'seacave') return h < .5 && nextOf(F.charts, 4) >= 0 ? 'chart' : h < .8 && nextOf(F.pages, 11) >= 0 ? 'page' : null;
    if ((cv.kind === 'cave' || cv.kind === 'icecave' || cv.kind === 'tube') && h < .14 && nextOf(F.signs, 7) >= 0) return 'sign';
    if (cv.kind !== 'cenote' && cv.kind !== 'tarn' && cv.kind !== 'tunnel' && h < .45 && nextOf(F.pages, 11) >= 0) return 'page';
    return null;
  }
  // a lookout's walk (ruins.js asks): a page, while pages are left
  G.finds.at = (S, p, i) => {
    if (S.kind !== 'watch' || ih(hash(S.id), i, 873) > .6) return null;
    return nextOf(F.pages, 11) >= 0 ? { find: true, kind: 'page', shape: 'page', name: 'a torn notebook page' } : null;
  };
  let things = [], thingsT = 0, painted = false;
  function scan() {
    things = [];
    for (const cv of cavesNear(b.p[0], b.p[2], 500)) {
      const id = 'cv:' + cv.id; if (F.taken[id]) continue;
      const k = caveThing(cv); if (!k) continue;
      const p = cv.pts[cv.pts.length - 1];
      things.push({ id, kind: k, x: p.x, y: p.f + .05, z: p.z, place: G.caves?.NAMES[cv.kind] || 'a cave' });
    }
    for (const W of wondersNear(b.p[0], b.p[2], 700)) {
      if (!SIGN_WONDERS.includes(W.key)) continue;
      const id = 'w:' + W.key; if (F.taken[id] || nextOf(F.signs, 7) < 0) continue;
      const a = ih(hash(W.key), 1, 874) * 6.283, x = W.x + Math.cos(a) * 34, z = W.z + Math.sin(a) * 34;
      things.push({ id, kind: 'sign', x, y: groundAt(x, z) + .02, z, place: W.name });
    }
  }
  // taking one: the next page (or chart piece, or sign) of its kind
  function takeThing(o) {
    F.taken[o.id] = 1; things = things.filter(q => q !== o);
    G.finds.take({ ...o, place: o.place });
  }
  const signFlicker = i => {
    const c = document.querySelector('canvas'); if (!c) return;
    c.style.transition = 'filter 1.2s'; c.style.filter = `hue-rotate(${60 + i * 40}deg) saturate(1.4)`;
    setTimeout(() => { c.style.filter = ''; setTimeout(() => { c.style.transition = ''; }, 1300); }, 2600);
  };
  G.finds.take = a => {
    const at = [Math.round(a.x), Math.round(a.z)], day = G.day || 1, place = a.place || G.placeWhere?.(a.x, a.z) || '';
    if (a.kind === 'page') {
      const i = nextOf(F.pages, PAGES.length); if (i < 0) return;
      F.pages[i] = { day, at, place }; page(i);
    } else if (a.kind === 'chart') {
      const i = nextOf(F.charts, 4); if (i < 0) return;
      F.charts[i] = { day, at, place };
      const n = Object.keys(F.charts).length;
      H.glint(`Chart piece ${i + 1}`, n < 4 ? `A torn piece of an old sea chart: ${n} of 4. The Map shows where they point.` : 'The last piece of the chart. Laid together they show an island, far out in the South Atlantic.', 'chart');
      chartQuest();
    } else if (a.kind === 'sign') {
      const i = nextOf(F.signs, SIGNS.length); if (i < 0) return;
      F.signs[i] = { day, at, place }; signFlicker(i);
      const n = Object.keys(F.signs).length;
      H.glint(`${cap(SIGNS[i])} glass`, `Glass in a colour the world has not got. As you take it the sky turns strange, and back. ${n} of 7.`, 'sign');
      G.quests.set('signs', { group: 'find', icon: 'sign', title: 'The far signs', text: 'Glass from somewhere else: by the far wonders, deep in the caves.', n, of: 7, quiet: true });
      if (n >= 7) G.quests.done('signs', 'All seven. Sleep somewhere that matters to you, and dream.');
    }
    G.audio.learned?.();
    G.emit('find', a);
  };

  // ---- the notebook (K5) --------------------------------------------------------------------------
  function page(i) {
    const [kind, title, text, what] = PAGES[i], n = Object.keys(F.pages).length;
    H.glint(`Page ${i + 1}: ${title}`, `${text} (${n} of ${PAGES.length} pages)`, 'notebook');
    G.quests.set('notebook', { group: 'find', icon: 'notebook', title: 'The naturalist\'s notebook', text: 'Torn pages, on the lookouts\' walks and in the caves.', n, of: PAGES.length, quiet: true });
    if (n >= PAGES.length) G.quests.done('notebook', 'Every page found.');
    if (kind === 'skill') G.gift(what, `Notebook: ${title.toLowerCase()}`, 'page:' + i);
    if (kind === 'sketch') {
      const p = G.hidden?.nearest(what), found = p && G.hidden.found()[p.id];
      if (p && !found && Math.hypot(wrapX(p.x - b.p[0]), p.z - b.p[2]) < 15000) {
        const j = (k, s) => (ih(hash(p.id || 'x'), k, 875) - .5) * s;
        G.quests.set('sketch:' + i, { group: 'rumour', icon: 'notebook', title: `The sketch: ${title.toLowerCase()}`, text: `${text} The land in the sketch is somewhere about here.`, x: p.x + j(1, 500), z: p.z + j(2, 500), r: 450, hidden: p.id });
      }
    }
    if (kind === 'riddle') G.quests.set('riddle:' + i, { group: 'find', icon: 'songs', title: 'A riddle', text: text.replace(/[“”]/g, ''), riddle: what });
    if (kind === 'gap') G.quests.set('aurora', { group: 'way', icon: 'age', title: 'The gap in the aurora', text: 'On a night of the aurora, fly into the pole wall where the lights are brightest.' });
  }
  // a sketch's rumour is done when its place is found; a riddle when its song opens what it keeps (songs.js)
  G.on('hidden', p => { for (const q of G.quests.open()) if (q.hidden === p.id) G.quests.done(q.id, `Found ${p.name}.`); cache(p); });
  G.on('opened', kind => { for (const q of G.quests.open()) if (q.riddle === kind) G.quests.done(q.id, 'Solved.'); });

  // ---- the chart (K6) ---------------------------------------------------------------------------
  // every piece found draws the circle on the Map tighter round the island
  function chartQuest() {
    const n = Object.keys(F.charts).length; if (!n) return;
    const [x, z] = toXZ(ISLAND.lat, ISLAND.lon), r = [9000, 5000, 2500, 0][n - 1], j = k => (ih(n, k, 876) - .5) * r * .6;
    if (n < 4) G.quests.set('chart', { group: 'find', icon: 'chart', title: 'The torn chart', text: 'A piece of an old chart, an island drawn on it. More pieces would show where.', x: x + j(1), z: z + j(2), r, n, of: 4 });
    else islandQuest();
  }
  function islandQuest() {
    if (F.island) return;
    const [x, z] = toXZ(ISLAND.lat, ISLAND.lon);
    G.quests.set('chart', { group: 'find', icon: 'chart', title: `The chart's island: ${ISLAND.name}`, text: 'The four pieces make one chart: an island alone in the South Atlantic, a cross marked by its peak.', x, z, r: undefined, n: 4, of: 4 });
  }
  function reachIsland() {
    F.island = G.day || 1;
    G.quests.done('chart', `Reached ${ISLAND.name} on day ${G.day}.`);
    G.feather?.(`${ISLAND.name}`);
    G.gift('stamina', `Reached ${ISLAND.name}`, 'island', 2);
    H.say(`${ISLAND.name}: under the cross on the chart, a tin box, and a note: “For whoever got here. The island was kind to us.” The far seas are easier for you now.`, { kind: 'event', secs: 7, icon: 'chart' });
    G.emit('island');
  }

  // ---- the hidden places' things (K4) -------------------------------------------------------------
  function cache(p) {
    if (F.caches[p.id]) return;
    const at = [Math.round(p.x ?? b.p[0]), Math.round(p.z ?? b.p[2])], day = G.day || 1;
    if (p.kind === 'shelter') {
      const i = nextOf(F.paints, PAINTS.length); if (i < 0) return;
      F.caches[p.id] = 'paint'; F.paints[i] = { day, at, place: p.name };
      H.glint('A painted wall', `On the shelter's back wall, in ochre and charcoal: ${PAINTS[i]}. ${Object.keys(F.paints).length} of ${PAINTS.length} painted walls.`, 'paint');
    } else if (p.kind === 'ledge' || p.kind === 'oasis') {
      F.caches[p.id] = p.kind;
      const tk = Object.keys(TRINKETS)[Math.floor(ih(hash(p.id), 1, 877) * Object.keys(TRINKETS).length)];
      const St = G.relics; if (St) { St.trinkets.push(tk); (St.at ||= {})[tk] ||= at; }
      if (p.kind === 'oasis') {
        if (nextOf(F.pages, 11) >= 0) { F.caches[p.id] = 'page'; G.finds.take({ kind: 'page', x: at[0], z: at[1], place: p.name }); }
        else H.glint('A clay jar', `Half buried by the pool: a clay jar, and in it ${TRINKETS[tk]}.`, 'keepsake');
      } else H.glint('Behind the water', `At the back of the ledge, where nothing could reach it: ${TRINKETS[tk]}.`, 'keepsake');
    }
    G.emit('find', p);
  }

  // ---- Journal > Things > Keepsakes: one shelf, in sets ------------------------------------------
  const sec = journal(G).section(42, 'Keepsakes');
  G.menu.onOpen(() => {
    let got = 0, all = 0, html = '';
    for (const s of SETS) {
      const items = s.items.map(info), n = items.filter(i => i.found).length;
      got += n; all += items.length;
      if (!n && (s.id === 'signs' || s.id === 'chart' || s.id === 'notes')) continue;   // the strange ones show once one is found
      html += `<div class="set3${F.sets[s.id] ? ' whole' : ''}"><h4>${esc(s.title)} <small>${F.sets[s.id] ? 'whole' : `${n} of ${items.length}`}</small></h4>${shelf(items, 12)}${F.sets[s.id] && s.sense ? `<p class="muted3">${esc(s.sense)}</p>` : ''}</div>`;
    }
    sec.count(`${got} of ${all}`);
    sec.body.innerHTML = html + (got ? '<p class="muted3">Tap a find to see where it was on the Map.</p>' : '<p class="muted3">Rare things glint in the grass, and by the doorsteps and wells of the old farms and villages: land beside one to take it. Bottles with notes drift on every ocean. They fall into sets, each the life of someone who lived here.</p>');
  });
  // the shelf remembers where (K8): any find with a place opens the Map on it
  document.addEventListener('click', e => {
    const a = e.target.closest?.('.glass3 [data-at]'); if (!a) return;
    const [x, z] = a.dataset.at.split(',').map(Number); if (isFinite(x) && isFinite(z)) G.showOnMap?.(x, z);
  });

  // ---- dev ------------------------------------------------------------------------------------------
  G.dev?.add({ id: 'sets', area: 'Menu and map', round: 'Gameplay 10-26 K2 K8', title: 'Keepsakes in sets; tap a find for the Map', how: 'Journal > Things > Keepsakes: each set with its count and its gaps; a whole set gives a step of growth and a sense. Tap a found thing: the Map opens where it was.' });
  G.dev?.add({ id: 'senses', area: 'World', round: 'Gameplay 10-26 K3', title: 'Treasures are senses', how: 'Spyglass: landmarks found from twice as far. Watch: the hour by the date. Handbell: Call reaches farther. Float: fish boils on the compass at sea. Locket: where you began on the compass. Teacup: drink faster. Horseshoe: a longer reach in the hunt. Whistle: a note before a gust. Sheep bell: a stronger morning.' });
  G.dev?.add({ id: 'caches', area: 'World', round: 'Gameplay 10-26 K4 K5 K6 K7', title: 'Things in hidden places: painted walls, notebook pages, chart pieces, far signs', how: 'Find a shelter (a painted wall), a ledge behind the falls, an oasis; caves keep pages, sea caves chart pieces, deep caves far signs; four far wonders keep a sign. Go gives you the next page.',
    go: () => G.finds.take({ kind: 'page', x: b.p[0], z: b.p[2] }) });

  G.on('mock', k => { if (k >= 1) { for (let i = 0; i < PAGES.length; i++) F.pages[i] ||= { day: 1, at: [0, 0] }; } });
  return {
    id: 'finds',
    update(dt) {
      if ((thingsT -= dt) <= 0) { thingsT = .8; scan(); }
      if ((lightsT -= dt) <= 0) { lightsT = 3; lights = F.sets.keeper ? landmarksNear(b.p[0], b.p[2], 6000).filter(l => l.kind === 'lighthouse') : []; }
      for (const o of things) {
        const d = Math.hypot(wrapX(o.x - b.p[0]), o.z - b.p[2]);
        if (d < 3.2 && Math.abs(b.p[1] - o.y) < 3) { takeThing(o); break; }
      }
      // the whistle: a thin note as a gust comes
      if (G.has?.('whistle') && (G.gustWind || 0) > .15 && gustWas <= .15) G.audio.tone?.({ f: G.audio.hz?.(19) || 1900, dur: 1.1, vol: .018, lp: 6000 });
      gustWas = G.gustWind || 0;
      // the chart's island
      if (Object.keys(F.charts).length >= 4 && !F.island) { const [x, z] = toXZ(ISLAND.lat, ISLAND.lon); if (Math.hypot(wrapX(x - b.p[0]), z - b.p[2]) < 900 && b.state !== 'fly') reachIsland(); }
      // unfound hidden places glint, to lead you in (brighter with the painted walls whole)
      const day = G.light?.daylight ?? 1, hk = G.finds.hiddenK || 1;
      if (day > .3 && Math.random() < dt * 2) for (const p of G.hidden?.near?.() || []) {
        if (G.hidden.found()[p.id] || !p.perch) continue;
        const d = Math.hypot(wrapX(p.perch.x - b.p[0]), p.perch.z - b.p[2]); if (d > 160 * hk || d < 15) continue;
        G.part([p.perch.x + (Math.random() - .5) * .6, p.perch.y + .4, p.perch.z + (Math.random() - .5) * .6], [0, .4, 0], .6, [1, .95, .78], .09 * hk);
      }
      for (const o of things) if (Math.random() < dt * 1.2 && Math.hypot(wrapX(o.x - b.p[0]), o.z - b.p[2]) < 90) G.part([o.x, o.y + .25, o.z], [0, .4, 0], .5, o.kind === 'sign' ? [.8, .6, 1] : [1, .95, .8], .1);
    },
    scene(S) {
      for (const o of things) if (Math.abs(wrapX(o.x - S.cam[0])) < 160 && Math.abs(o.z - S.cam[2]) < 160) (S.props['af_' + o.kind] ||= []).push(o.x, o.y + .01, o.z, 1.6, ih(hash(o.id), 2, 2) * 6, .5, 0, 0);
      // the painted walls, in every shelter near
      for (const p of G.hidden?.near?.() || []) if (p.kind === 'shelter' && Math.abs(wrapX(p.x - S.cam[0])) < 300 && Math.abs(p.z - S.cam[2]) < 300) {
        if (!painted) { painted = true; R.shape('fd_paint', paintMesh()); }
        (S.props.fd_paint ||= []).push(p.x, p.y, p.z, 1, p.yaw, .5, 0, 0);
      }
    },
    save: () => F,
    load(o) { Object.assign(F, o || {}); checkSets(true); },
  };
}
