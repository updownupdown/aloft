// Soft aims: an intention for each day, the bird's life goal on the Log (sys/life.js), the lands
// collection and racing your own best round a ring course. Each dawn the Journal offers one optional aim (fly a ring
// course, sing with a songbird, see a land you haven't, ...); doing it earns a feather. The lands
// collection is a shelf of small faceted tiles, one for each land of the world, that fill in as you
// fly over them (Journal > Places > Lands). A course flown faster than ever, ring for ring, brings a mouse.
import * as W from '../world.js';
import { BIOMES, blend } from '../biomes.js';
import { facets } from '../facet.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';
import { FOOD } from './food.js';

// the aims: a line for the Journal and the toast, and what does it (an event and a test)
const AIMS = {
  course: { text: 'Fly a whole ring course in one go.', on: 'ringLoop' },
  rings: { text: 'Fly through five rings of cloud.', on: 'ring', n: 5 },
  sing: { text: 'Sing with a songbird until it answers.', on: 'song' },
  mouse: { text: 'Catch a mouse.', on: 'catch', ok: e => e.kind === 'mouse' },
  fish: { text: 'Take a fish from the water.', on: 'catch', ok: e => e.kind === 'fish' },
  land: { text: 'Fly over a land you have not seen yet.', on: 'newLand' },
  sight: { text: 'Find a landmark.', on: 'landmark' },
  guide: { text: 'Add a page to your field guide.', on: 'sighted' },
  high: { text: 'Ride a thermal 250 m above the ground.', on: 'high' },
  pin: { text: 'Mark a good place on your map with a pin.', on: 'pin' },
  // what the lessons teach (sys/lessons.js): never offered as aims
  perch: { text: 'Land on a branch.', on: 'land', ok: k => k === 'perch', lesson: 1 },
  drink: { text: 'Land by water and drink.', on: 'drink', lesson: 1 },
  sleep: { text: 'Roost on a branch and sleep through a night.', on: 'sleep', lesson: 1 },
  far: { text: 'Fly two kilometres from where you were at dawn.', on: 'far', lesson: 1 },
};
const HIGH = 250;
// a season's aim (L3 of the gameplay study): one longer aim for each season of your bird's year,
// beside the day's; done, it earns two feathers
const SEASON_AIMS = {
  lands: { text: 'Fly over four lands you have not seen yet.', on: 'newLand', n: 4 },
  songs: { text: 'Learn three songs.', on: 'learn', n: 3 },
  cross: { text: 'Cross a sea and make landfall.', on: 'landfall' },
  lamp: { text: 'Light a dark lighthouse.', on: 'lamp' },
  hidden: { text: 'Find three hidden places.', on: 'hidden', n: 3 },
  home: { text: 'Carry a treasure home.', on: 'home' },
  courses: { text: 'Fly three whole ring courses.', on: 'ringLoop', n: 3 },
  landmarks: { text: 'Find four landmarks.', on: 'landmark', n: 4 },
  pages: { text: 'Find two pages of the naturalist\'s notebook.', on: 'find', ok: e => e?.kind === 'page', n: 2 },
  master: { text: 'Master a song: sing it cleanly three times.', on: 'mastered' },
};

export function aimsSystem(G) {
  const b = G.b;
  const A = { day: 0, aim: null, done: false, count: 0, feathers: 0, seen: {}, sights: {}, last: [] };

  // ---- the day's offers (P of the review): at most three a day of the day's aim, Today's ring course,
  // a gleam to fly to (visitors.js) and the season's aim, picked from what you have not done lately --------------
  const OFFERS = ['aim', 'course', 'ask', 'season'], MOST = 3;
  A.lastDone ||= {};
  function planDay() {
    const can = OFFERS.filter(k => k !== 'season' || !A.season?.done);
    A.offers = { day: G.day, list: can.map(k => [k, (A.lastDone[k] ?? -99) + Math.random() * 1.5]).sort((p, q) => p[1] - q[1]).slice(0, MOST).map(([k]) => k) };
  }
  G.offered = k => { if (A.offers?.day !== G.day) planDay(); return A.offers.list.includes(k); };
  G.offerDone = k => { A.lastDone[k] = G.day || 0; };

  // ---- the day's aim ------------------------------------------------------------------------
  function pick() {
    const pool = Object.keys(AIMS).filter(k => !AIMS[k].lesson && !A.last.includes(k) && !(k === 'land' && seenAll()));
    A.aim = pool[Math.floor(Math.random() * pool.length)] || 'rings'; A.day = G.day; A.done = false; A.count = 0;
    A.off = !G.offered('aim');   // (a day without one: P)
    A.last = [...A.last, A.aim].slice(-4);
  }
  const offer = () => !A.off && G.hud.glint('Today’s aim', `If you like: ${AIMS[A.aim].text[0].toLowerCase()}${AIMS[A.aim].text.slice(1)}`, 'keepsake');
  // the aim as the next step, a thin line under the compass, once the lessons are done (quiet.js)
  // (the ladder, D of the review: the open lesson, the quest you follow, the day's aim, the season's, Today's course)
  const line = () => {
    const a = AIMS[A.aim], s = A.season, sa = s && SEASON_AIMS[s.aim], quiet = !!G.lessons?.learning;
    G.hud.next?.('aim', a && !A.off && !A.done && !quiet ? a.text : null, 'today’s aim, for a feather');
    G.hud.next?.('season', sa && !s.done && !quiet && G.offered('season') ? sa.text : null, sa?.n ? `this season’s aim: ${Math.min(s.count, sa.n)} of ${sa.n}` : 'this season’s aim, for two feathers');
  };
  G.on('newDay', () => { pick(); if (!G.lessons?.learning) offer(); });   // while the lessons run (sys/lessons.js) they are the day's things to do
  for (const ev of new Set(Object.values(AIMS).map(a => a.on))) G.on(ev, e => {
    const a = AIMS[A.aim]; if (!a || A.off || A.done || a.on !== ev || (a.ok && !a.ok(e))) return;
    if (++A.count < (a.n || 1)) return;
    A.done = true; G.offerDone('aim'); G.feather('Aim done'); G.hud.nextDone?.('aim');
  });
  // feathers (one for each day's aim kept, one for each chapter of the lessons) are your bird's own:
  // sys/growth.js G.feather
  // a thermal ride high above the ground: held for a moment and a half; and a few things other
  // systems don't announce (a drink, a night's sleep, two kilometres since dawn)
  let highT = 0, high = false, drank = 0, asleep = false, farFrom = null;

  // ---- the season's aim ----------------------------------------------------------------------
  const seasonKey = () => `${G.journey?.year ?? 0}:${G.season?.name || ''}`;
  function pickSeason() {
    const pool = Object.keys(SEASON_AIMS).filter(k => k !== A.season?.aim);
    A.season = { key: seasonKey(), aim: pool[Math.floor(Math.random() * pool.length)], count: 0, done: false };
    const a = SEASON_AIMS[A.season.aim];
    G.quests?.set('season', { group: 'errand', icon: 'keepsake', title: 'This season', text: `${a.text} Before the season turns, for two feathers.`, n: 0, of: a.n || 1, quiet: true, done: false });
  }
  for (const ev of new Set(Object.values(SEASON_AIMS).map(a => a.on))) G.on(ev, e => {
    const s = A.season, a = s && SEASON_AIMS[s.aim]; if (!a || s.done || a.on !== ev || (a.ok && !a.ok(e))) return;
    s.count++; G.quests?.set('season', { n: Math.min(s.count, a.n || 1) });
    if (s.count < (a.n || 1)) return;
    s.done = true; G.offerDone('season'); G.hud.nextDone?.('season'); G.feather('The season\'s aim'); G.feather('The season\'s aim');
    G.quests?.done('season', `Done in ${G.season?.name || 'the season'}: two feathers.`);
  });

  // ---- racing your own best (in place of the companion's races, gone 10-27) ------------------
  // a whole course flown faster, ring for ring, than ever before brings a mouse
  G.on('ringLoop', e => {
    if (!e.secs || !e.n) return;
    const per = e.secs / e.n, best = A.bestRing;
    A.bestRing = Math.min(best ?? 1e9, per);
    if (best && per < best) { G.hunger = Math.min(1, G.hunger + FOOD.mouse); G.hud.tally(`Your fastest course yet, ${Math.round(e.secs)} s: a mouse for you`, 'ring'); G.emit('raceWon'); }
  });

  // ---- the lands ----------------------------------------------------------------------------
  const KEYS = Object.keys(BIOMES);
  const landOf = (x, z) => { let best = null; for (const e of blend(x, z)) if (!best || e.w > best.w) best = e; return best?.name; };
  const seenAll = () => KEYS.every(k => A.seen[k]);
  // for the Map: the lands seen, of how many, and the feathers for aims kept
  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  G.on('mock', k => {
    const n = Math.round(k * KEYS.length), keep = KEYS.slice(0, n);
    A.seen = Object.fromEntries(keep.map(q => [q, 1])); A.sights = Object.fromEntries(keep.filter((q, i) => i % 2 === 0 || k >= 1).map(q => [q, 1]));
  });
  G.collection = () => ({ lands: KEYS.filter(k => A.seen[k]).length, of: KEYS.length, sights: Object.keys(A.sights).length, feathers: G.feathers?.() || 0 });
  let landT = 0;
  // a found landmark counts as its land's sight when it is the kind that land is known for
  const sightOf = l => {
    const land = landOf(l.x, l.z), want = (W.LANDS || []).find(e => e.key === land)?.sight;
    if (land && want && (l.kind === want || (want === 'summit' && l.summit)) && !A.sights[land]) A.sights[land] = 1;   // (kept, no longer shown: James, 2026-10-24)
  };
  G.on('landmark', sightOf); G.on('sight', sightOf);   // (a landmark found, or one passed that is only scenery)

  // ---- the Journal: the day's aim in Today's Next card, the lands under Places ----------------
  const today = journal(G).section(5, 'Today');
  const seasonSec = journal(G).section(6, 'This season');
  const lands = journal(G).section(45, 'Lands');
  // the chosen bird's life goal (sys/life.js G.life), as a checklist with counts
  const life = journal(G).section(8, 'Your life');
  const tile = {};
  G.menu.onOpen(() => {
    const a = AIMS[A.aim];
    today.el.classList.toggle('hidden', !!G.lessons?.learning || !a || !!A.off);
    const s = A.season, sa = s && SEASON_AIMS[s.aim];
    seasonSec.el.classList.toggle('hidden', !!G.lessons?.learning || !sa || !G.offered('season'));
    today.body.innerHTML = (a ? `<p class="nch3">${icon('keepsake')}<span>Today’s aim</span>${a.n && !A.done ? `<small>${A.count} of ${a.n}</small>` : ''}</p>
      <p class="ntask3${A.done ? ' done' : ''}">${esc(a.text)}</p><p class="nsay3">${A.done ? 'Done: a feather earned.' : 'If you like: it earns a feather. Tomorrow brings another.'}</p>` : '');
    seasonSec.body.innerHTML = (sa ? `<p class="nch3">${icon('keepsake')}<span>This season</span>${sa.n && !s.done ? `<small>${Math.min(s.count, sa.n)} of ${sa.n}</small>` : ''}</p><p class="ntask3${s.done ? ' done' : ''}">${esc(sa.text)}</p><p class="nsay3">${s.done ? 'Done: two feathers earned.' : 'A longer aim, for two feathers, before the season turns.'}</p>` : '');
    const L = G.life;
    life.el.classList.toggle('hidden', !L);
    if (L) life.body.innerHTML = `<p class="life3t">${esc(L.title)}${L.done ? ' <small>Done.</small>' : ''}</p><ul class="life3">${L.steps.map(s => `<li class="${s.done ? 'done' : ''}"><i></i><span>${esc(s.text)}</span>${s.need > 1 ? ` <small>${Math.min(s.n, s.need)} of ${s.need}</small>` : ''}</li>`).join('')}</ul>`;
    const n = KEYS.filter(k => A.seen[k]).length;
    lands.count(`${n} of ${KEYS.length}`);
    lands.body.innerHTML = `<div class="lands3">${KEYS.map(k => `<figure class="${A.seen[k] ? 'seen' : ''}"><img alt="" src="${pic(k)}"><figcaption>${A.seen[k] ? esc(cap(BIOMES[k].label)) : '?'}</figcaption></figure>`).join('')}</div>`
      + (n ? '' : '<p class="muted3">Each land you fly over fills in here: forest, steppe, tundra, desert, rainforest.</p>');
  });
  const cap = t => t.replace(/^the /, '').replace(/^./, c => c.toUpperCase());
  // a small faceted tile in the land's own ground colours (cached)
  function pic(k) {
    if (tile[k]) return tile[k];
    const c = document.createElement('canvas'); c.width = 96; c.height = 64;
    const x = c.getContext('2d'), B = BIOMES[k];
    facets(x, 0, 0, 96, 64, 14, (px, py) => {
      const col = B.c(400 + px * 7, 20 + (64 - py) * 1.2, 300 + py * 9);
      return [col[0] * 255, col[1] * 255, col[2] * 255];
    }, { seed: k.length * 13 + k.charCodeAt(0), relief: .8 });
    return (tile[k] = c.toDataURL('image/png'));
  }

  return {
    id: 'aims',
    update(dt) {
      if (!A.aim || A.day !== G.day) { pick(); if (G.t > 3 && !G.lessons?.learning) offer(); }
      if (G.season && A.season?.key !== seasonKey() && !G.lessons?.learning) pickSeason();
      if ((landT -= dt) <= 0) {
        landT = 2; line();
        const k = landOf(b.p[0], b.p[2]);
        if (k && !A.seen[k]) { A.seen[k] = 1; if (Object.keys(A.seen).length > 1) { G.hud.tally(`New land: ${BIOMES[k]?.label || k}`, 'lands'); G.emit('newLand', k); } }
      }
      if (G.thirst < drank || b.eating > 0) drank = G.thirst; else if (G.thirst - drank > .05 && b.state !== 'fly') { G.emit('drink'); drank = G.thirst; }
      if (b.asleep && !asleep) G.emit('sleep'); asleep = !!b.asleep;
      if (farFrom?.day !== G.day) farFrom = { day: G.day, x: b.p[0], z: b.p[2], done: false };
      if (!farFrom.done && Math.hypot(W.wrapX(b.p[0] - farFrom.x), b.p[2] - farFrom.z) > 2000) { farFrom.done = true; G.emit('far'); }
      const up = b.state === 'fly' && b.lift > .8 && b.p[1] - Math.max(W.height(b.p[0], b.p[2]), W.WATER) > HIGH;
      if (!up) { high = false; highT = 0; } else if (!high && (highT += dt) > 1.5) { high = true; G.emit('high'); }
    },
    save: () => A,
    load(o) { Object.assign(A, o); if (A.feathers) { G.oldFeathers = A.feathers; delete A.feathers; } },
  };
}
