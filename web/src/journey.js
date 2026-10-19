// The long game: the migration south to the wintering marsh and home again, landmarks found
// along the way, the nest and chick, the journal map, and saving all of it on this device.
import { clamp, C } from './util.js';
import * as W from './world.js';
import { SEASONS } from './palette.js';
import { saveStory } from './story.js';
import { saveAtmos } from './atmos.js';

const MAP_A = W.START_X - 1500, MAP_B = W.JOURNEY + 800;

// The world seed comes from the save, else from a shared link (?world=1234), else it is the
// original world. A link that names a different world than the save is kept for "Start a new
// journey" to use, so a shared link never wipes a journey in progress.
const urlSeed = () => { const v = parseInt(new URLSearchParams(location.search).get('world'), 10); return Number.isFinite(v) ? Math.abs(v) % 100000 : null; };
export function loadJourney(G, store) {
  const s = store.get('save', null);
  G.goal = s?.goal ?? 'south';
  G.journeys = s?.journeys ?? 0;
  G.explored = s?.explored ?? [W.START_X, W.START_X];
  G.found = s?.found ?? {};
  G.nest = s?.nest ?? null;
  G.intent = s?.intent ?? null;
  G.route = s?.route ?? [];
  // generations: each journey south and home again is a year; the family tree keeps them
  G.year = s?.year ?? 1; G.family = s?.family ?? []; G.yearChicks = s?.yearChicks ?? 0; G.oldNest = s?.oldNest ?? null;
  G.songLog = store.get('songlog', {});
  const link = urlSeed();
  W.setSeed(s ? s.seed ?? 0 : link ?? store.get('seed', 0));
  G.seed = W.seed.v;
  G.sharedSeed = link !== null && link !== G.seed ? link : null;
  return s;
}
export function saveJourney(G, store) {
  const b = G.bird;
  store.set('save', {
    x: Math.round(b.x), y: Math.round(b.y), clockT: G.clockT, thirst: G.thirst, hunger: G.hunger,
    goal: G.goal, journeys: G.journeys, explored: G.explored.map(Math.round), found: G.found, nest: G.nest,
    seed: G.seed, intent: G.intentions?.save(), route: G.route, year: G.year, family: G.family, yearChicks: G.yearChicks, oldNest: G.oldNest, atmos: saveAtmos(G), ...saveStory(G),
  });
}
// a link to this world, for a friend to fly the same hills
export const worldLink = G => { const u = new URL(location.href); u.search = G.seed ? `?world=${G.seed}` : ''; return u.href; };

export const seasonName = G => SEASONS[Math.floor(G.seasonS + .5) % 4];
const where = x => {
  const bio = W.biomeAt(x).name;
  return bio === 'lakeland' ? 'the lakelands' : bio === 'cliffs' ? 'the cliffs' : `the ${bio}`;
};
export function placeNote(G, x) {
  let lm = null, ld = 2500;
  for (const id in G.found) { const l = G.found[id], d = Math.abs(l.x - x); if (d < ld) { ld = d; lm = l.name; } }
  return `${where(x)}${lm ? ` near ${lm}` : ''}`;
}

// called every frame: exploration, landmarks, arriving at either end of the journey
export function updateJourney(G, dt, { toast, once, audio, spring }) {
  const b = G.bird;
  G.explored[0] = Math.min(G.explored[0], b.x); G.explored[1] = Math.max(G.explored[1], b.x);
  G.goalDir = G.goal === 'south' ? 1 : -1;
  traceRoute(G);
  for (const l of W.landmarksIn(b.x - 220, b.x + 220)) {
    if (G.found[l.id] || Math.abs(l.x - b.x) > 200) continue;
    G.found[l.id] = { name: l.name, x: Math.round(l.x), note: `Found on day ${G.day}, in ${seasonName(G)}, in ${where(l.x)}` };
    toast(`You found ${l.name}.`, 3.5); audio.learned();
  }
  if (G.goal === 'south' && b.x > W.JOURNEY - 700) {
    G.goal = 'north'; G.journeys++; G.gather = { t: 60, x: b.x };
    audio.ring();
    toast('The wintering marsh. Other hawks have gathered here, circling over the reeds.', 6);
    toast('Rest as long as you like. When you are ready, home lies back north, to the left.', 6);
    if (!b.adult) toast('Your first migration done, your tail has moulted red. A grown hawk now.', 6);
  }
  // a hawk's tail turns red after its first full journey south
  b.adult = G.journeys > 0;
  if (G.goal === 'north' && b.x < W.START_X + 250 && G.journeys > 0) {
    G.goal = 'south'; G.journeys++;
    audio.ring(); toast('Home again at the edge of the forest. The journey is complete.', 6);
    // a year ends: it goes in the family tree, and last year's nest tree waits to be built on again
    G.family.push({ year: G.year, mate: !!G.mate, mateNote: G.mate?.note ?? null, chicks: G.yearChicks, landmarks: Object.keys(G.found).length });
    G.year++; G.yearChicks = 0;
    if (G.nest) { G.oldNest = { x: G.nest.x, y: G.nest.y, place: G.nest.place }; G.nest = null; }
    toast(`Year ${G.year} begins.${G.oldNest ? ' Your old nest tree still stands; a few twigs there start this year\'s nest.' : ''}`, 6);
  }
  // the flight home: winter passes while the hawk rests in the marsh, and it flies north into spring
  if (G.gather) { G.gather.t -= dt; if (G.gather.t <= 0) { G.gather = null; if (G.goal === 'north' && !(G.sea.spring > .5)) { spring(); toast('The winter passes in the marsh. Spring now: the land is greening and in bloom all the way home.', 6); } } }
  if (G.goal === 'north' && G.oldNest && b.state === 'perch' && Math.hypot(b.x - G.oldNest.x, b.y - G.oldNest.y) < 30) once('oldnest', 'Last year\'s nest tree. Bring twigs to build here again.');
  once('journey', 'The flocks are heading south, to the right. Follow them to the wintering marsh.');
}

// the route flown, for the journal map: a point every so often along the way, with the height
// above the ground in tens of units (0 when walking or perched on the ground, -1 when swimming)
const ROUTE_STEP = 80, ROUTE_MAX = 900;
function traceRoute(G) {
  const b = G.bird, r = G.route, last = r[r.length - 1];
  if (last && Math.abs(b.x - last[0]) < ROUTE_STEP) return;
  const alt = b.state === 'fly' ? Math.max(1, Math.round((W.groundY(b.x) - b.y) / 10)) : b.state === 'swim' ? -1 : 0;
  r.push([Math.round(b.x), alt]);
  // a long life of flying: keep every other point of the older half
  if (r.length > ROUTE_MAX) G.route = [...r.slice(0, ROUTE_MAX / 2).filter((_, i) => i % 2 === 0), ...r.slice(ROUTE_MAX / 2)];
}

/* ---------- the nest: twigs, an egg, a chick to feed, a fledgling ---------- */
export const NEST_TWIGS = 5, CHICK_MEALS = 5;
export function nestStatus(G, DAY) {
  const n = G.nest;
  if (!n) return 'No nest yet. Twigs lie under some trees: pick one up on the ground, then perch on a branch to start a nest.';
  if (n.fledged) return 'Your chick has fledged and flies with you.';
  if (n.twigs < NEST_TWIGS) return `Building a nest in ${n.place}: ${n.twigs} of ${NEST_TWIGS} twigs.`;
  if (!n.chick) return `An egg in your nest in ${n.place}. It hatches ${G.clockT - n.eggAt > DAY * .6 ? 'very soon' : 'in about a day'}.`;
  return `A chick in your nest in ${n.place}, hungry: ${n.fed} of ${CHICK_MEALS} meals brought. Catch a mouse or a fish and carry it home.`;
}
// on perching: place a carried twig or feed the chick
export function atPerch(G, p, { toast, once, audio, spark }) {
  const n = G.nest;
  const atNest = n && Math.hypot(p.x - n.x, p.y - n.y) < 26;
  if (G.carry === 'twig') {
    if (!p.tree) { once('nestspot', 'A nest needs a tree branch.'); return; }
    if (!n) {
      const old = G.oldNest && Math.hypot(p.x - G.oldNest.x, p.y - G.oldNest.y) < 40;
      if (old) { G.nest = { x: G.oldNest.x, y: G.oldNest.y, twigs: 3, place: G.oldNest.place, fed: 0 }; G.oldNest = null; G.carry = null; audio.rustle(); toast('Last year\'s nest, mended: two more twigs.', 4); return; }
      G.nest = { x: p.x, y: p.y, twigs: 1, place: placeNote(G, p.x), fed: 0 };
      G.carry = null; audio.rustle(); toast('You started a nest. Bring four more twigs.', 4); return;
    }
    if (!atNest) { once('nestfar', 'Twigs go to your nest. You can find it on the journal map.'); return; }
    if (n.twigs < NEST_TWIGS) {
      n.twigs++; G.carry = null; audio.rustle();
      if (n.twigs === NEST_TWIGS) { n.eggAt = G.clockT; audio.learned(); toast('The nest is finished, and there is an egg in it! It will hatch in about a day.', 5); }
      else toast(`Nest: ${n.twigs} of ${NEST_TWIGS} twigs.`, 2.5);
    }
    return;
  }
  if ((G.carry === 'mouse' || G.carry === 'fish') && atNest && n.chick) {
    n.fed++; G.carry = null; audio.eat();
    for (let k = 0; k < 8; k++) spark(n.x + (Math.random() - .5) * 14, n.y - 6);
    if (n.fed >= CHICK_MEALS) { n.chick = false; n.fledged = true; G.yearChicks++; G.spawnYoung = true; audio.learned(); toast('Your chick has fledged! It will fly with you now.', 5); }
    else toast(`Fed your chick: ${n.fed} of ${CHICK_MEALS}.`, 2.5);
  }
}
export function updateNest(G, DAY, toast) {
  const n = G.nest;
  if (n && n.eggAt !== undefined && !n.chick && !n.fledged && G.clockT - n.eggAt > DAY) {
    n.chick = true; n.fed = 0;
    toast('Your egg has hatched! Bring the chick food: catch a mouse or a fish and carry it to the nest.', 6);
  }
}

/* ---------- the journal ---------- */
export function journal(G, DAY) {
  const b = G.bird, span = W.JOURNEY - W.START_X;
  const pct = clamp(Math.round((b.x - W.START_X) / span * 100), 0, 100);
  const head = `Day ${G.day}, ${seasonName(G)}, over ${where(b.x)}.`;
  const trip = G.goal === 'south'
    ? `Migrating south to the wintering marsh: ${pct}% of the way.`
    : `Heading home north to the forest edge: ${100 - pct}% of the way back.`;
  const done = G.journeys ? ` Journeys completed: ${G.journeys}.` : '';
  const landmarks = Object.values(G.found).sort((a, c) => a.x - c.x).map(l => ({ name: l.name, note: l.note }));
  const intent = `${G.intentions?.status() || ''}${G.feathers ? ` Feathers earned: ${G.feathers}.` : ''}`.trim();
  const world = G.seed ? `World ${G.seed}.` : 'The original world.';
  return { journey: `${head} ${trip}${done}`, nest: nestStatus(G, DAY), family: familyNote(G), sky: G.skyNotes?.slice(-3).join(' ') || '', landmarks, intent, world, link: worldLink(G) };
}
// the family tree, a line a year: you, your mate, your chicks
const COUNT = ['no chicks', 'one chick', 'two chicks', 'three chicks'];
export function familyNote(G) {
  const years = G.family.map(y => `Year ${y.year}: you${y.mate ? ' and your mate' : ''}, ${COUNT[y.chicks] ?? `${y.chicks} chicks`} fledged.`);
  if (!years.length && !G.yearChicks) return '';
  return `${years.join(' ')}${years.length ? ' ' : ''}Now year ${G.year}${G.yearChicks ? `, ${COUNT[G.yearChicks] ?? `${G.yearChicks} chicks`} fledged so far` : ''}.`;
}
export function drawMap(G, cv) {
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  const X = x => (x - MAP_A) / (MAP_B - MAP_A) * w, Y = gy => h * .62 + gy * .16;
  ctx.clearRect(0, 0, w, h);
  const [e0, e1] = G.explored;
  const pts = [];
  for (let i = 0; i <= 240; i++) { const x = MAP_A + (MAP_B - MAP_A) * i / 240; let y = 0; for (let k = -2; k <= 2; k++) y += W.groundY(x + k * 30); pts.push([x, y / 5]); }
  // all the land, faint; the part you have flown over, in its biome colours
  ctx.fillStyle = 'rgba(58,36,24,.07)'; ctx.beginPath(); ctx.moveTo(0, h);
  for (const [x, y] of pts) ctx.lineTo(X(x), Y(y)); ctx.lineTo(w, h); ctx.fill();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    if (x2 < e0 - 200 || x > e1 + 200) continue;
    ctx.fillStyle = C(W.biomeAt(x).tint, .55);
    ctx.beginPath(); ctx.moveTo(X(x), h); ctx.lineTo(X(x), Y(y)); ctx.lineTo(X(x2), Y(y2)); ctx.lineTo(X(x2), h); ctx.fill();
  }
  drawRoute(ctx, G.route, X, Y);
  ctx.font = 'italic 22px Spectral, Georgia, serif'; ctx.textAlign = 'center';
  const label = (x, y, text, col = 'rgba(58,36,24,.7)') => { const m = ctx.measureText(text).width / 2 + 8; ctx.fillStyle = col; ctx.fillText(text, clamp(X(x), m, w - m), y); };
  label(W.START_X, 26, 'Forest edge'); label(W.JOURNEY - 200, 26, 'Wintering marsh');
  ctx.strokeStyle = 'rgba(58,36,24,.25)'; ctx.setLineDash([4, 5]); ctx.beginPath();
  ctx.moveTo(X(W.START_X), 30); ctx.lineTo(X(W.START_X), h); ctx.moveTo(X(W.JOURNEY - 700), 30); ctx.lineTo(X(W.JOURNEY - 700), h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = '17px Georgia, serif';
  for (const l of Object.values(G.found)) {
    const gy = Y(W.groundY(l.x));
    ctx.fillStyle = 'rgba(200,120,58,.9)'; ctx.beginPath(); ctx.arc(X(l.x), gy - 4, 4, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(X(l.x), gy - 12); ctx.rotate(-.5); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(58,36,24,.75)'; ctx.fillText(l.name, 0, 0); ctx.restore();
  }
  if (G.nest) { const x = X(G.nest.x), y = Y(G.nest.y) - 4; ctx.strokeStyle = 'rgba(109,74,54,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI); ctx.stroke(); }
  // you
  const bx = X(G.bird.x), by = Math.min(Y(W.groundY(G.bird.x)) - 18, h * .4);
  ctx.strokeStyle = 'rgba(58,36,24,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx - 9, by - 4); ctx.quadraticCurveTo(bx - 4, by - 7, bx, by); ctx.quadraticCurveTo(bx + 4, by - 7, bx + 9, by - 4); ctx.stroke();
  ctx.lineWidth = 1;
}

// the route as a brush stroke in indigo: thick where the hawk soared high, thin near the ground,
// and a dotted trail where it walked. Two passes with a little wobble, as if painted.
function drawRoute(ctx, route, X, Y) {
  if (route.length < 2) return;
  const top = 8, at = ([x, a]) => [X(x), Math.max(top, Y(W.groundY(x)) - 6 - Math.max(0, a) * .9)];
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < route.length; i++) {
      const p = route[i - 1], q = route[i];
      if (Math.abs(q[0] - p[0]) > 600) continue;   // a jump (a new journey, a reload): no line across it
      const [x0, y0] = at(p), [x1, y1] = at(q), j = pass ? .8 : 0;
      if (p[1] <= 0 && q[1] <= 0) {
        if (pass || i % 3) continue;
        ctx.fillStyle = 'rgba(79,111,158,.7)'; ctx.beginPath(); ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, 1.3, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const hi = clamp((p[1] + q[1]) / 2 / 40, 0, 1);
      ctx.strokeStyle = `rgba(79,111,158,${pass ? .3 : .55})`; ctx.lineWidth = (1 + hi * 4.5) * (pass ? .6 : 1);
      ctx.beginPath(); ctx.moveTo(x0 + j, y0 - j); ctx.lineTo(x1 - j, y1 + j); ctx.stroke();
    }
  }
  ctx.restore();
}
