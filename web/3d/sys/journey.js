// The long game: the migration south to the wintering marsh and home again, the landmarks found
// along the way, the route flown, the years and the family tree. Writes the top of the Journal:
// where you are and how far along, and a map of the country flown over, painted from the
// terrain itself, with the route as a brush stroke of indigo (broad where the hawk flew high).
// South is +z. The bands of the journey (JOURNEY) and the landmarks come from world.js.
import * as W from '../world.js';
import { SEASON_DAYS } from '../sky.js';
import { journal, esc } from '../journal.js';
import { handmadeTex, C, wash, circP, inkLine } from '../paper.js';
import { clamp } from '../util.js';
import { hourName } from '../dial.js';

const BANDS = W.JOURNEY || { home: 0, marsh: 9000 };
export const HOME_Z = BANDS.home ?? 0, MARSH_Z = BANDS.marsh ?? 9000;
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
    return `Day ${G.day}, ${G.season.name}, over ${placeName(x, z)}${lm ? ` near ${lm}` : ''}.`;
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
      J.found[l.id] = { name: l.name, x: Math.round(l.x), z: Math.round(l.z), note: `Found on day ${G.day}, in ${G.season.name}, in ${placeName(l.x, l.z)}.` };
      G.hud.toast(`You found ${l.name}.`, 3.5); G.audio.learned?.();
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
  head.body.innerHTML = '<p class="j-trip"></p><p class="j-family"></p>';
  mapSec.body.innerHTML = '<canvas class="map3"></canvas>';
  lmSec.body.innerHTML = '<ul class="list3"></ul>';
  const mapCv = mapSec.body.firstChild;
  G.menu.onOpen(() => {
    const pct = Math.round(along() * 100);
    const trip = J.goal === 'south' ? `Migrating south to the wintering marsh: ${pct}% of the way.` : `Heading home north to the forest edge: ${100 - pct}% of the way back.`;
    head.body.querySelector('.j-trip').textContent = `${G.placeNote()} ${trip}${J.journeys ? ` Journeys completed: ${J.journeys}.` : ''}`;
    const years = J.family.map(y => `Year ${y.year}: you${y.mate ? ' and your mate' : ''}, ${chicks(y.chicks)} fledged.`);
    head.body.querySelector('.j-family').textContent = years.length || J.yearChicks ? `${years.join(' ')} Now year ${J.year}${J.yearChicks ? `, ${chicks(J.yearChicks)} fledged so far` : ''}.` : '';
    const lms = Object.values(J.found).sort((a, c) => a.z - c.z);
    lmSec.body.firstChild.innerHTML = lms.length ? lms.map(l => `<li>${esc(l.name)} <small>${esc(l.note)}</small></li>`).join('') : '<li class="none">None found yet. Rare sights wait along the way south.</li>';
  });
  G.menu.subtitle(() => { const h = hourName(G.tod); return `${h[0].toUpperCase()}${h.slice(1)} on day ${G.day}, ${G.season.name}.`; });
  G.on('menuTab', id => { if (id === 'journal') requestAnimationFrame(() => drawMap(mapCv)); });

  // the map: north up, the land washed in its colours from a grid of heights, softened as wet
  // paint softens, on handmade paper
  let landKey = '', land = null, tex = null;
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
    const key = [cssW, Math.round(cx / 50), Math.round(cz / 50), Math.round(sc * 10)].join();
    if (key !== landKey) { landKey = key; land = paintLand(cssW, cssH, cx, cz, sc); tex = handmadeTex(cv.width, cv.height, dpr * .8); }
    x.clearRect(0, 0, cssW, cssH);
    x.fillStyle = '#efe6d2'; x.fillRect(0, 0, cssW, cssH);
    // the land, softened as wet paint softens, then a second sharper pass so the edges pool
    x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.filter = 'blur(2px)'; x.globalAlpha = .9; x.drawImage(land, 0, 0, cssW, cssH);
    x.filter = 'none'; x.globalCompositeOperation = 'multiply'; x.globalAlpha = .25; x.drawImage(land, 0, 0, cssW, cssH); x.restore();
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .7; x.drawImage(tex, 0, 0); x.restore();
    route(x, X, Z);
    x.font = 'italic 14px Spectral, Georgia, serif'; x.textAlign = 'left';
    const label = (px, py, text, col = 'rgba(43,26,16,.8)') => { x.fillStyle = col; x.fillText(text, clamp(px, 6, cssW - x.measureText(text).width - 6), clamp(py, 16, cssH - 6)); };
    // home, the marsh (or which way it lies), landmarks, the nest, and you
    dot(x, X(0), Z(HOME_Z), [111, 138, 74]); label(X(0) + 8, Z(HOME_Z) + 4, 'Home, the forest edge');
    if (Z(MARSH_Z) < cssH - 10) { x.strokeStyle = 'rgba(58,36,24,.35)'; x.setLineDash([4, 5]); x.beginPath(); x.moveTo(0, Z(MARSH_Z)); x.lineTo(cssW, Z(MARSH_Z)); x.stroke(); x.setLineDash([]); label(8, Z(MARSH_Z) + 16, 'The wintering marsh'); }
    else {
      const km = ((MARSH_Z - b.p[2]) / 1000).toFixed(1);
      inkLine(x, [[cssW / 2, cssH - 34], [cssW / 2, cssH - 10], [cssW / 2 - 6, cssH - 17], [cssW / 2, cssH - 10], [cssW / 2 + 6, cssH - 17]], .7, 1.4);
      x.textAlign = 'center'; x.fillStyle = 'rgba(43,26,16,.8)'; x.fillText(`The wintering marsh, ${km} km south`, cssW / 2, cssH - 40); x.textAlign = 'left';
    }
    for (const l of Object.values(J.found)) { dot(x, X(l.x), Z(l.z), [200, 120, 58]); label(X(l.x) + 7, Z(l.z) - 5, l.name); }
    const n = G.nest;
    if (n) { x.strokeStyle = 'rgba(109,74,54,.9)'; x.lineWidth = 2.5; x.beginPath(); x.arc(X(n.x), Z(n.z) - 2, 5, 0, Math.PI); x.stroke(); x.lineWidth = 1; label(X(n.x) + 8, Z(n.z) + 12, 'your nest', 'rgba(109,74,54,.9)'); }
    // you: a little hawk in ink, pointing the way you face
    x.save(); x.translate(X(b.p[0]), Z(b.p[2])); x.rotate(b.yaw);
    x.strokeStyle = 'rgba(43,26,16,.92)'; x.lineWidth = 2.2; x.lineCap = 'round'; x.beginPath();
    x.moveTo(-10, 3); x.quadraticCurveTo(-4, -3, 0, -3); x.quadraticCurveTo(4, -3, 10, 3); x.moveTo(0, -6); x.lineTo(0, 5); x.stroke(); x.restore();
    // a compass mark
    x.fillStyle = 'rgba(43,26,16,.7)'; x.textAlign = 'center'; x.fillText('N', cssW - 16, 18);
    inkLine(x, [[cssW - 16, 34], [cssW - 16, 22]], .7, 1);
  }
  const dot = (x, px, py, col) => wash(x, circP(px, py, 4, 9), col, .9, { passes: 2, amp: .5, seed: px | 0, rim: .5 });

  // the land as a small picture: water, meadow, wood, rock and snow by height, shaded by slope,
  // the parts never flown over left pale
  function paintLand(w, h, cx, cz, sc) {
    const k = 4, gw = Math.ceil(w / k), gh = Math.ceil(h / k), c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    const x = c.getContext('2d'), img = x.createImageData(gw, gh), d = img.data;
    // how near the route each cell is: land far from anywhere flown stays pale
    const pts = J.route.length ? J.route : [[b.p[0], b.p[2]]];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const wx = cx + (i * k - w / 2) * sc, wz = cz + (j * k - h / 2) * sc, y = W.height(wx, wz);
      let col;
      if (y < W.WATER + .3) col = [120, 160, 196];
      else if (y > 150) col = [238, 232, 220];
      else if (y > 85) col = [160, 148, 130];
      else col = W.forest(wx, wz) > .15 ? [104, 136, 84] : y < 3 ? [214, 196, 150] : [160, 180, 112];
      const sl = clamp(.92 + (W.height(wx - sc * k, wz - sc * k) - y) * .02, .75, 1.1);
      let near = 1e9;
      for (let q = 0; q < pts.length; q += 2) { const d = Math.abs(pts[q][0] - wx) + Math.abs(pts[q][1] - wz); if (d < near) near = d; }
      const fade = .35 + .65 * clamp((900 - near) / 500, 0, 1);
      const o = (j * gw + i) * 4;
      for (let q = 0; q < 3; q++) d[o + q] = 239 + (col[q] * sl - 239) * fade;
      d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // the route as a brush stroke in indigo: thick where the hawk soared high, thin near the
  // ground, a dotted trail where it walked
  function route(x, X, Z) {
    const r = J.route; if (r.length < 2) return;
    x.save(); x.globalCompositeOperation = 'multiply'; x.lineCap = 'round'; x.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < r.length; i++) {
      const p = r[i - 1], q = r[i];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 600) continue;   // a jump (a reload, a new journey): no line across it
      const j = pass ? .8 : 0;
      if (p[2] <= 0 && q[2] <= 0) {
        if (pass || i % 3) continue;
        x.fillStyle = 'rgba(79,111,158,.7)'; x.beginPath(); x.arc((X(p[0]) + X(q[0])) / 2, (Z(p[1]) + Z(q[1])) / 2, 1.3, 0, 7); x.fill();
        continue;
      }
      const hi = clamp((p[2] + q[2]) / 2 / 80, 0, 1);
      x.strokeStyle = C([79, 111, 158], pass ? .3 : .55); x.lineWidth = (1 + hi * 4) * (pass ? .6 : 1);
      x.beginPath(); x.moveTo(X(p[0]) + j, Z(p[1]) - j); x.lineTo(X(q[0]) - j, Z(q[1]) + j); x.stroke();
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
