// The long game: the migration south to the wintering marsh and home again, the landmarks found
// along the way, the route flown, the years and the family tree. Writes the top of the Journal:
// where you are and how far along, and a map of the country flown over, painted from the
// terrain itself, with the route as a brush stroke of indigo (broad where the hawk flew high).
// South is +z. The bands of the journey (JOURNEY) and the landmarks come from world.js.
import * as W from '../world.js';
import { SEASON_DAYS } from '../sky.js';
import { journal, esc } from '../journal.js';
import { PIG, C, shade, poly, facets } from '../facet.js';
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
  G.hud.tip('south', () => b.state === 'fly' && G.t > 60 && J.journeys === 0 && along() < .05, 'Autumn calls the hawks south. Follow the sun at midday to the wintering marsh; the Journal keeps your map.');
  let gather = 0, findT = 0;

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
  const head = journal(G).section(10), mapSec = journal(G).section(20), lmSec = journal(G).section(50, 'Landmarks');
  head.body.innerHTML = '<p class="j-trip"></p><p class="j-family"></p><p class="j-sky"></p>';
  mapSec.body.innerHTML = '<canvas class="map3"></canvas>';
  lmSec.body.innerHTML = '<ul class="list3"></ul>';
  const mapCv = mapSec.body.firstChild;
  G.menu.onOpen(() => {
    const pct = Math.round(along() * 100);
    const trip = J.goal === 'south' ? `Migrating south to the wintering marsh: ${pct}% of the way.` : `Heading home north to the forest edge: ${100 - pct}% of the way back.`;
    head.body.querySelector('.j-trip').textContent = `${G.placeNote()} ${trip}${J.journeys ? ` Journeys completed: ${J.journeys}.` : ''}`;
    const years = J.family.map(y => `Year ${y.year}: you${y.mate ? ' and your mate' : ''}, ${chicks(y.chicks)} fledged.`);
    head.body.querySelector('.j-family').textContent = years.length || J.yearChicks ? `${years.join(' ')} Now year ${J.year}${J.yearChicks ? `, ${chicks(J.yearChicks)} fledged so far` : ''}.` : '';
    // the weather's notes on what the sky has shown lately (sys/weather.js)
    head.body.querySelector('.j-sky').textContent = (G.skyNotes || []).slice(-3).join(' ');
    const lms = Object.values(J.found).sort((a, c) => a.z - c.z);
    lmSec.body.firstChild.innerHTML = lms.length ? lms.map(l => `<li>${esc(l.name)} <small>${esc(l.note)}</small></li>`).join('') : '<li class="none">None found yet. Rare sights wait along the way south.</li>';
  });
  G.menu.subtitle(() => { const h = hourName(G.tod); return `${h[0].toUpperCase()}${h.slice(1)} on day ${G.day}, ${G.season.name}.`; });
  G.on('menuTab', id => { if (id === 'journal') requestAnimationFrame(() => drawMap(mapCv)); });

  // the map: north up, the land in low poly as the world is, a mesh of triangles over the real
  // heights, each coloured by what grows there and lit by its slope; land far from anywhere
  // flown stays pale
  let landKey = '', land = null;
  function drawMap(cv) {
    const cssW = cv.clientWidth || 600, cssH = Math.round(cssW * .5), dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px';
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the area: everything flown, home, with a margin, kept to the canvas's shape
    let [x0, z0, x1, z1] = J.box;
    x0 = Math.min(x0, -300); x1 = Math.max(x1, 300); z0 = Math.min(z0, HOME_Z - 300); z1 = Math.max(z1, HOME_Z + 300);
    const pad = Math.max(x1 - x0, z1 - z0) * .08 + 120; x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sc = Math.max((x1 - x0) / cssW, (z1 - z0) / cssH);
    const X = wx => (wx - cx) / sc + cssW / 2, Z = wz => (wz - cz) / sc + cssH / 2;
    const key = [cssW, Math.round(cx / 50), Math.round(cz / 50), Math.round(sc * 10), J.route.length >> 4].join();
    if (key !== landKey) { landKey = key; land = paintLand(cssW, cssH, cx, cz, sc, dpr); }
    x.clearRect(0, 0, cssW, cssH);
    x.drawImage(land, 0, 0, cssW, cssH);
    route(x, X, Z);
    x.font = 'italic 14px Spectral, Georgia, serif'; x.textAlign = 'left';
    // labels sit on a cut tab of paper so they read over any ground
    const label = (px, py, text, col = 'rgba(43,26,16,.85)') => {
      const w = x.measureText(text).width, lx = clamp(px, 6, cssW - w - 10), ly = clamp(py, 16, cssH - 6);
      poly(x, [[lx - 4, ly - 13], [lx + w + 6, ly - 13], [lx + w + 2, ly + 4], [lx - 8, ly + 4]], 'rgba(241,236,224,.78)');
      x.fillStyle = col; x.fillText(text, lx, ly);
    };
    // home, the marsh (or which way it lies), landmarks, the nest, and you
    mark(x, X(0), Z(HOME_Z), PIG.wood); label(X(0) + 9, Z(HOME_Z) + 4, 'Home, the forest edge');
    if (Z(MARSH_Z) < cssH - 10) { x.fillStyle = 'rgba(43,26,16,.4)'; for (let i = 0; i < cssW; i += 9) x.fillRect(i, Z(MARSH_Z), 5, 1.4); label(8, Z(MARSH_Z) + 18, 'The wintering marsh'); }
    else {
      const km = ((MARSH_Z - b.p[2]) / 1000).toFixed(1), ax = cssW / 2, ay = cssH - 10;
      poly(x, [[ax - 7, ay - 12], [ax + 7, ay - 12], [ax, ay]], C(PIG.ink, .75));
      x.fillStyle = C(PIG.ink, .75); x.fillRect(ax - 1, ay - 26, 2, 14);
      x.textAlign = 'center'; const t = `The wintering marsh, ${km} km south`; x.textAlign = 'left'; label(ax - x.measureText(t).width / 2, ay - 31, t);
    }
    for (const l of Object.values(J.found)) { mark(x, X(l.x), Z(l.z), PIG.ring); label(X(l.x) + 8, Z(l.z) - 6, l.name); }
    const n = G.nest;
    if (n) { poly(x, [[X(n.x) - 6, Z(n.z) - 3], [X(n.x) + 6, Z(n.z) - 3], [X(n.x) + 3, Z(n.z) + 2], [X(n.x) - 3, Z(n.z) + 2]], C(PIG.bark)); label(X(n.x) + 9, Z(n.z) + 13, 'your nest', C(PIG.bark)); }
    // you: a little faceted hawk, pointing the way you face
    x.save(); x.translate(X(b.p[0]), Z(b.p[2])); x.rotate(b.yaw);
    poly(x, [[0, -7], [11, 1], [3, 0], [2, 6], [-2, 6], [-3, 0], [-11, 1]], C(PIG.ink, .92));
    poly(x, [[0, -7], [-11, 1], [-3, 0]], C(PIG.ink2, .9));
    x.restore();
    // a compass mark
    poly(x, [[cssW - 16, 20], [cssW - 11, 34], [cssW - 16, 31], [cssW - 21, 34]], C(PIG.ink, .7));
    x.fillStyle = C(PIG.ink, .75); x.textAlign = 'center'; x.fillText('N', cssW - 16, 49); x.textAlign = 'left';
  }
  // a place on the map: a little faceted diamond
  const mark = (x, px, py, col) => { const P = [[px, py - 5.5], [px + 4.5, py], [px, py + 5.5], [px - 4.5, py]]; poly(x, P, C(shade(col, .85))); poly(x, [P[0], P[2], P[3]], C(shade(col, 1.15))); };

  function paintLand(w, h, cx, cz, sc, dpr) {
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pts = J.route.length ? J.route : [[b.p[0], b.p[2]]];
    const wx = px => cx + (px - w / 2) * sc, wz = py => cz + (py - h / 2) * sc;
    const ground = (px, py) => {
      const X0 = wx(px), Z0 = wz(py), y = W.height(X0, Z0);
      let col;
      if (y < W.WATER + .3) col = PIG.water;
      else if (y > 150) col = PIG.paper;
      else if (y > 85) col = PIG.rock;
      else col = W.forest(X0, Z0) > .15 ? PIG.wood : y < 3 ? PIG.sand : PIG.meadow;
      let near = 1e9;
      for (let q = 0; q < pts.length; q += 2) { const d = Math.abs(pts[q][0] - X0) + Math.abs(pts[q][1] - Z0); if (d < near) near = d; }
      const fade = .35 + .65 * clamp((900 - near) / 500, 0, 1);
      return col.map((v, i) => PIG.paper[i] + (v - PIG.paper[i]) * fade);
    };
    // the real heights, in pixels, give each triangle its slope (water lies flat)
    facets(x, 0, 0, w, h, 14, (px, py, t) => {
      for (const v of t) v[2] = Math.max(W.height(wx(v[0]), wz(v[1])), 0) / sc;
      return ground(px, py);
    }, { seed: 5, relief: 1.6 });
    return c;
  }

  // the route as a crisp ribbon in indigo: broad where the hawk soared high, thin near the
  // ground, a dotted trail where it walked
  function route(x, X, Z) {
    const r = J.route; if (r.length < 2) return;
    x.save(); x.lineCap = 'butt'; x.lineJoin = 'miter';
    for (let i = 1; i < r.length; i++) {
      const p = r[i - 1], q = r[i];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 600) continue;   // a jump (a reload, a new journey): no line across it
      if (p[2] <= 0 && q[2] <= 0) {
        if (i % 3) continue;
        const mx = (X(p[0]) + X(q[0])) / 2, my = (Z(p[1]) + Z(q[1])) / 2;
        poly(x, [[mx, my - 1.6], [mx + 1.6, my], [mx, my + 1.6], [mx - 1.6, my]], C(PIG.water, .85));
        continue;
      }
      const hi = clamp((p[2] + q[2]) / 2 / 80, 0, 1);
      x.strokeStyle = C([79, 111, 158], .75); x.lineWidth = 1.2 + hi * 3.5;
      x.beginPath(); x.moveTo(X(p[0]), Z(p[1])); x.lineTo(X(q[0]), Z(q[1])); x.stroke();
    }
    x.restore();
  }

  return {
    id: 'journey',
    update(dt) {
      trace();
      if ((findT -= dt) <= 0) { findT = .5; landmarks(); arrive(); }
    },
    save: () => ({ goal: J.goal, journeys: J.journeys, year: J.year, family: J.family, yearChicks: J.yearChicks, found: J.found, route: J.route, box: J.box.map(Math.round) }),
    load(o) { Object.assign(J, o); if (!J.box) J.box = [b.p[0], b.p[2], b.p[0], b.p[2]]; },
  };
}
