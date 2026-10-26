// The long game: the whole Earth to wander (earth.js), the lands (regions) and the landmarks found
// on the way, the route flown, the years and the family tree. Writes Journal > Places > Landmarks:
// every landmark found, newest first, the wonders starred (sys/ruins.js finds them, wonders.js
// names them). The Map tab (map.js, made here) shows the land flown over. A year turns with your own spring (the seasons follow the latitude, so a bird that
// crosses the equator meets spring early or late); the tropics, with no spring, count 32 days.
import * as W from '../world.js';
import { YEAR_DAYS, REGIONS, EARTH } from '../earth.js';
import { WONDERS } from '../wonders.js';
import { journal, esc } from '../journal.js';
import { mapView } from './map.js';
import { hourName } from '../dial.js';

// a name inside a sentence: 'You found the Ridge Pass'
export const inSentence = n => String(n).replace(/^The /, 'the ');
const FIND_R = 150, ROUTE_STEP = 60, ROUTE_MAX = 900;
const placeName = (x, z) => W.placeName(x, z);

export function journeySystem(G) {
  const b = G.b;
  const J = { year: 1, yearDay: 1, family: [], yearChicks: 0, found: {}, regions: {}, route: [], box: [b.p[0], b.p[2], b.p[0], b.p[2]] };
  G.journey = J;
  G.placeName = placeName;
  // 'over the meadows, the Loire lowlands near the Old Oak'
  G.placeWhere = (x = b.p[0], z = b.p[2]) => {
    let lm = null, ld = 1500;
    for (const id in J.found) { const l = J.found[id], d = Math.hypot(l.x - x, l.z - z); if (d < ld) { ld = d; lm = l.name; } }
    return `over ${inSentence(placeName(x, z))}${lm ? ` near ${inSentence(lm)}` : ''}`;
  };
  G.placeNote = (x = b.p[0], z = b.p[2]) => `${G.date?.text || `Day ${G.day}`}, ${G.season.name}, ${G.placeWhere(x, z)}.`;
  G.hud.tip('wander', () => b.state === 'fly' && G.t > 90 && Object.keys(J.regions).length < 2, 'The whole Earth is yours to wander: each land has its own birds and sights, and the Map shows where you have been. The world wraps round: fly on past the far sea and you come back to where you began.');
  let findT = 0, regionAt = '', regionT = 0;
  const map = mapView(G, J);
  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  // (landmarks and lands, nearest first: the whole Earth's list takes a few seconds)
  G.on('mock', k => {
    const all = W.landmarksNear(0, EARTH.Z0 + EARTH.H / 2, 5e4).filter(W.isNotable).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]));
    J.found = Object.fromEntries(all.slice(0, Math.round(k * all.length)).map(l => [l.id, { name: l.name, x: Math.round(l.x), z: Math.round(l.z), note: 'Found in a dev mock.' }]));
    J.regions = Object.fromEntries(REGIONS.slice(0, Math.round(k * REGIONS.length)).map(r => [r[0], { name: r[1], day: G.day, date: '' }]));
    J.year = 1 + Math.round(k * 3);
  });
  G.on('ringLoop', () => { J.loops = (J.loops || 0) + 1; });
  G.on('wrap', () => { J.box = [b.p[0], b.p[2], b.p[0], b.p[2]]; });

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

  // the landmarks worth finding (world.js isNotable); the others, scenery, still count once as their
  // land's sight for the biomes collection (aims.js, 'sight' events)
  const passed = new Set();
  function landmarks() {
    for (const l of W.landmarksNear?.(b.p[0], b.p[2], FIND_R + 400) || []) {
      if (J.found[l.id] || passed.has(l.id) || Math.hypot(l.x - b.p[0], l.z - b.p[2]) > FIND_R + (l.r || 0)) continue;
      if (!W.isNotable(l)) { passed.add(l.id); G.emit('sight', l); continue; }
      J.found[l.id] = { name: l.name, x: Math.round(l.x), z: Math.round(l.z), note: `Found on ${G.date?.text || `day ${G.day}`}, in ${G.season.name}, in ${inSentence(placeName(l.x, l.z))}.` };
      G.hud.name(l.name, 'landmarks'); G.audio.learned?.();
      G.emit('landmark', l);
    }
  }
  // a land (earth.js REGIONS) the first time the bird flies over it, once it has held a few seconds
  function regions(dt) {
    const r = W.regionAt(b.p[0], b.p[2]), k = r?.key || '';
    if (k !== regionAt) { regionAt = k; regionT = 0; return; }
    if (!k || J.regions[k] || (regionT += dt) < 4) return;
    J.regions[k] = { name: r.name, day: G.day, date: G.date?.text || '' };
    G.hud.name(r.name[0].toUpperCase() + r.name.slice(1), 'map');
    G.emit('region', r);
  }
  // a year ends with the start of your own spring, or 32 days on where there is none
  function year() {
    J.family.push({ year: J.year, mate: !!G.story?.mate, chicks: J.yearChicks, landmarks: Object.keys(J.found).length });
    J.year++; J.yearChicks = 0; J.yearDay = G.day;
    G.emit('newYear', J.year);
    G.hud.name(`Year ${J.year}`, 'nest');
  }
  G.on('season', s => { if (s.name === 'spring' && G.day - J.yearDay >= YEAR_DAYS / 2) year(); });
  G.on('newDay', () => { if (G.season.tropic && G.day - J.yearDay >= YEAR_DAYS) year(); });

  /* ---------- the journal: Places > Landmarks ---------- */
  // every landmark found, newest first: the wonders starred with their story, the named landmarks,
  // the island sights and the ice edges (James, 2026-10-24: one list; the lands flown over are the
  // Map's to name, not a collection)
  const lmSec = journal(G).section(43, 'Landmarks');
  const wonderOf = name => Object.keys(WONDERS).find(k => WONDERS[k][0] === name);
  G.menu.onOpen(() => {
    const lms = Object.values(J.found).reverse(), W = Object.keys(WONDERS), nw = W.filter(k => G.relics?.wonders?.[k]).length;
    lmSec.count(`${lms.length} found`);
    const row = l => { const w = wonderOf(l.name); return `<li${w ? ' class="star"' : ''}>${w ? '<i class="star3" title="A wonder">★</i>' : ''}${esc(l.name)} <small>${w ? esc(WONDERS[w][5]) + ' ' : ''}${esc(l.note)}</small></li>`; };
    lmSec.body.innerHTML = `<p class="muted3">${nw} of ${W.length} wonders found: people built them, long ago, where the old maps put them. ★ marks one.</p>`
      + (lms.length ? `<ul class="list3">${lms.map(row).join('')}</ul>` : '<p class="muted3">None found yet. Rare sights wait in every land: an old oak, a waterfall, a tower, a light.</p>');
  });
  G.menu.subtitle(() => { const h = hourName(G.tod); return `${h[0].toUpperCase()}${h.slice(1)} on ${G.date?.text || `day ${G.day}`}, ${G.season.name}.`; });

  return {
    id: 'journey',
    update(dt) {
      trace(); map.update(dt);
      if ((findT -= dt) <= 0) { findT = .5; landmarks(); regions(.5); }
    },
    save: () => ({ loops: J.loops || 0, year: J.year, yearDay: J.yearDay, family: J.family, yearChicks: J.yearChicks, found: J.found, regions: J.regions, pins: J.pins || [], route: J.route, box: J.box.map(Math.round), fog: map.save() }),
    load(o) { const { fog, ...rest } = o; Object.assign(J, rest); if (!J.box) J.box = [b.p[0], b.p[2], b.p[0], b.p[2]]; map.load(fog); },
  };
}
