// The long game: the migration south to the wintering marsh and home again, the landmarks found
// along the way, the route flown, the years and the family tree. Writes the top of the Journal:
// where you are and how far along. The Map tab (map.js, made here) shows the country flown over.
// South is +z. The bands of the journey (JOURNEY) and the landmarks come from world.js.
import * as W from '../world.js';
import { SEASON_DAYS } from '../sky.js';
import { journal, esc } from '../journal.js';
import { mapView } from './map.js';
import { clamp } from '../util.js';
import { hourName } from '../dial.js';

const BANDS = W.JOURNEY || { home: 0, marsh: 9000 };
export const HOME_Z = BANDS.home ?? 0, MARSH_Z = BANDS.marsh ?? 9000;
// a name inside a sentence: 'You found the Ridge Pass'
export const inSentence = n => String(n).replace(/^The /, 'the ');
const FIND_R = 150, ROUTE_STEP = 60, ROUTE_MAX = 900;

// a place in words, from the world's own names when it has them
function placeName(x, z) {
  if (W.placeName) return W.placeName(x, z);
  if (W.biomeAt) { const n = W.biomeAt(x, z)?.name; if (n) return { lakeland: 'the lakelands', marsh: 'the wintering marsh', ridge: 'the Great Ridge' }[n] || `the ${n}`; }
  const h = W.height(x, z);
  if (z > MARSH_Z) return 'the wintering marsh';
  if (h < 1.5) return 'the lakes';
  if (h > 90) return 'the mountains';
  return W.forest(x, z) > .2 ? 'the woods' : 'the meadows';
}

export function journeySystem(G) {
  const b = G.b;
  const J = { goal: 'south', journeys: 0, year: 1, family: [], yearChicks: 0, found: {}, route: [], box: [b.p[0], b.p[2], b.p[0], b.p[2]] };
  G.journey = J;
  G.placeName = placeName;
  G.placeNote = (x = b.p[0], z = b.p[2]) => {
    let lm = null, ld = 1500;
    for (const id in J.found) { const l = J.found[id], d = Math.hypot(l.x - x, l.z - z); if (d < ld) { ld = d; lm = l.name; } }
    return `Day ${G.day}, ${G.season.name}, over ${inSentence(placeName(x, z))}${lm ? ` near ${inSentence(lm)}` : ''}.`;
  };
  // how far along: 0 at home, 1 at the marsh
  const along = () => clamp((b.p[2] - HOME_Z) / (MARSH_Z - HOME_Z), 0, 1);
  G.hud.tip('south', () => b.state === 'fly' && G.t > 60 && J.journeys === 0 && along() < .05, 'Autumn calls the hawks south. Follow the sun at midday to the wintering marsh; the Map shows the way.');
  let gather = 0, findT = 0;
  const map = mapView(G, J, { HOME_Z, MARSH_Z });
  G.on('ringLoop', () => { J.loops = (J.loops || 0) + 1; });

  function trace() {
    const r = J.route, last = r[r.length - 1];
    J.box = [Math.min(J.box[0], b.p[0]), Math.min(J.box[1], b.p[2]), Math.max(J.box[2], b.p[0]), Math.max(J.box[3], b.p[2])];
    if (last && Math.hypot(b.p[0] - last[0], b.p[2] - last[1]) < ROUTE_STEP) return;
    const g = Math.max(W.height(b.p[0], b.p[2]), W.WATER);
    const alt = b.state === 'fly' ? Math.max(1, Math.round(b.p[1] - g)) : b.state === 'swim' ? -1 : 0;
    r.push([Math.round(b.p[0]), Math.round(b.p[2]), alt]);
    // a long life of flying: keep every other point of the older half
    if (r.length > ROUTE_MAX) J.route = [...r.slice(0, ROUTE_MAX / 2).filter((_, i) => i % 2 === 0), ...r.slice(ROUTE_MAX / 2)];
  }

  function landmarks() {
    for (const l of W.landmarksNear?.(b.p[0], b.p[2], FIND_R + 400) || []) {
      if (J.found[l.id] || Math.hypot(l.x - b.p[0], l.z - b.p[2]) > FIND_R + (l.r || 0)) continue;
      J.found[l.id] = { name: l.name, x: Math.round(l.x), z: Math.round(l.z), note: `Found on day ${G.day}, in ${G.season.name}, in ${inSentence(placeName(l.x, l.z))}.` };
      G.hud.toast(`You found ${inSentence(l.name)}.`, 3.5); G.audio.learned?.();
      G.emit('landmark', l);
    }
  }

  function arrive() {
    if (J.goal === 'south' && b.p[2] > MARSH_Z) {
      J.goal = 'north'; J.journeys++; gather = 60;
      G.audio.ring?.();
      G.hud.toast('The wintering marsh. Other hawks have gathered here, circling over the reeds.', 6);
      G.hud.toast('Rest as long as you like. When you are ready, home lies back north.', 6);
      if (J.journeys === 1) G.hud.toast('Your first migration done, your tail has moulted red. A grown hawk now.', 6);
      G.emit('marsh');
    }
    if (J.goal === 'north' && b.p[2] < HOME_Z + 250 && J.journeys > 0) {
      J.goal = 'south'; J.journeys++;
      G.audio.ring?.(); G.hud.toast('Home again at the edge of the forest. The journey is complete.', 6);
      // a year ends: it goes in the family tree
      J.family.push({ year: J.year, mate: !!G.story?.mate, chicks: J.yearChicks, landmarks: Object.keys(J.found).length });
      J.year++; J.yearChicks = 0;
      G.emit('newYear', J.year);
      G.hud.toast(`Year ${J.year} begins.`, 5);
    }
    // the flight home: the winter passes while the hawk rests in the marsh, and it flies north into spring
    if (gather > 0 && (gather -= .5) <= 0 && J.goal === 'north' && (G.season.name === 'autumn' || G.season.name === 'winter')) {
      const year = SEASON_DAYS * 4, start = Math.floor((G.day - 1) / year) * year;
      G.day = start + SEASON_DAYS * 3 + 1;
      G.hud.toast('The winter passes in the marsh. Spring now: the land greens all the way home.', 6);
    }
  }

  /* ---------- the journal ---------- */
  const COUNT = ['no chicks', 'one chick', 'two chicks', 'three chicks'];
  const chicks = n => COUNT[n] ?? `${n} chicks`;
  const head = journal(G).section(10), lmSec = journal(G).section(50, 'Landmarks');
  head.body.innerHTML = '<p class="j-trip"></p><p class="j-family"></p><p class="j-rings"></p><p class="j-sky"></p>';
  lmSec.body.innerHTML = '<ul class="list3"></ul>';
  G.menu.onOpen(() => {
    const pct = Math.round(along() * 100);
    const trip = J.goal === 'south' ? `Migrating south to the wintering marsh: ${pct}% of the way.` : `Heading home north to the forest edge: ${100 - pct}% of the way back.`;
    head.body.querySelector('.j-trip').textContent = `${G.placeNote()} ${trip}${J.journeys ? ` Journeys completed: ${J.journeys}.` : ''}`;
    const years = J.family.map(y => `Year ${y.year}: you${y.mate ? ' and your mate' : ''}, ${chicks(y.chicks)} fledged.`);
    head.body.querySelector('.j-family').textContent = years.length || J.yearChicks ? `${years.join(' ')} Now year ${J.year}${J.yearChicks ? `, ${chicks(J.yearChicks)} fledged so far` : ''}.` : '';
    // the rings flown (sys/rings.js keeps G.rings) and the whole courses of them flown
    head.body.querySelector('.j-rings').textContent = G.rings ? `Rings of cloud flown: ${G.rings}${J.loops ? `, and ${J.loops} whole course${J.loops > 1 ? 's' : ''} of them` : ''}.` : '';
    // the weather's notes on what the sky has shown lately (sys/weather.js)
    head.body.querySelector('.j-sky').textContent = (G.skyNotes || []).slice(-3).join(' ');
    const lms = Object.values(J.found).sort((a, c) => a.z - c.z);
    lmSec.body.firstChild.innerHTML = lms.length ? lms.map(l => `<li>${esc(l.name)} <small>${esc(l.note)}</small></li>`).join('') : '<li class="none">None found yet. Rare sights wait along the way south.</li>';
  });
  G.menu.subtitle(() => { const h = hourName(G.tod); return `${h[0].toUpperCase()}${h.slice(1)} on day ${G.day}, ${G.season.name}.`; });

  return {
    id: 'journey',
    update(dt) {
      trace(); map.update(dt);
      if ((findT -= dt) <= 0) { findT = .5; landmarks(); arrive(); }
    },
    save: () => ({ goal: J.goal, journeys: J.journeys, loops: J.loops || 0, year: J.year, family: J.family, yearChicks: J.yearChicks, found: J.found, pins: J.pins || [], route: J.route, box: J.box.map(Math.round), fog: map.save() }),
    load(o) { const { fog, ...rest } = o; Object.assign(J, rest); if (!J.box) J.box = [b.p[0], b.p[2], b.p[0], b.p[2]]; map.load(fog); },
  };
}
