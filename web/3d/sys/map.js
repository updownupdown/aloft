// The Map tab: the Earth as a globe (globe.js), spun with a finger. Everywhere starts under fog;
// flying clears it around the hawk (wider the higher it flies). Drag to spin (flick and it coasts),
// pinch, the wheel or the buttons to zoom, tap a place for its note, hold to drop a pin. Only places
// that are one of a kind get a mark; a name many places share is a quiet word, once, when close.
// Created by journey.js, which keeps the route and the landmarks; the fog saves with the journey,
// a bit per 100 m cell over the whole Earth (earth.js), wrapping east to west like the world.
import * as W from '../world.js';
import { PIG, C, shade, poly } from '../facet.js';
import { clamp } from '../util.js';
import { esc } from '../journal.js';
import { createDial } from '../dial.js';
import { icon } from '../icons.js';
import { SEASON_DAYS, SEASONS } from '../sky.js';
import { EARTH, wrapX, latLon, toXZ } from '../earth.js';
import { createGlobe, prebake } from '../globe.js';

const CELL = 100;                        // fog cells, metres
const SEE = [160, 2.2, 520];             // clearing radius: base, per metre of height, most
const D = Math.PI / 180;
// the fog: one bit per cell, columns wrapping round the world
const FI = Math.round(EARTH.W / CELL), FJ = Math.ceil(EARTH.H / CELL), FJ0 = Math.floor(EARTH.Z0 / CELL);
const bit = (i, j) => { const jj = j - FJ0; return jj < 0 || jj >= FJ ? -1 : jj * FI + (((i + FI / 2) % FI) + FI) % FI; };
// your own pins: a long press drops one in the colour you pick (they mean what you like); they
// show on the compass. Pins dropped before had a kind, and keep that kind's colour
export const PINS = ['#e8a33a', '#c0533f', '#d977a8', '#8a6fc0', '#3f8fd0', '#5f9a4a', '#f4f1e8'];
const OLD = { thermal: '#e8a33a', water: '#3f8fd0', perch: '#5f9a4a', food: '#c0533f', mark: '#8a6fc0' };
export const pinCol = p => p.col || OLD[p.kind] || PINS[3];

export function mapView(G, J) {
  const b = G.b, seen = new Uint8Array(Math.ceil(FI * FJ / 8));
  let count = 0;
  const see = k => { if (k < 0 || seen[k >> 3] & (1 << (k & 7))) return; seen[k >> 3] |= 1 << (k & 7); count++; };
  const has = (i, j) => { const k = bit(i, j); return k >= 0 && !!(seen[k >> 3] & (1 << (k & 7))); };
  // clear the fog round the hawk
  function reveal(x = b.p[0], z = b.p[2]) {
    const alt = b.state === 'fly' ? b.p[1] - Math.max(W.height(x, z), W.WATER) : 0;
    const r = clamp(SEE[0] + alt * SEE[1], SEE[0], SEE[2]), n = Math.ceil(r / CELL);
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const dx = (ci + i + .5) * CELL - x, dz = (cj + j + .5) * CELL - z;
      if (dx * dx + dz * dz <= r * r) see(bit(ci + i, cj + j));
    }
  }
  const isSeen = (x, z) => has(Math.floor(x / CELL), Math.floor(z / CELL));
  // how much of the world has been seen, 0..1
  const explored = () => count / (FI * FJ);

  // ---- the tab ----------------------------------------------------------------------------
  const pane = G.menu.tab('map', 'Map');
  pane.classList.add('mappane3', 'flush3');
  pane.innerHTML = `<div class="mapbox3"><canvas></canvas><div class="mapsum3"></div><div class="mapday3"><div class="mapseason3"></div></div>
      <div class="mapbtn3"><button data-z="in" aria-label="Zoom in">${icon('zoomin')}</button><button data-z="out" aria-label="Zoom out">${icon('zoomout')}</button><button data-z="me" aria-label="Centre on the hawk">${icon('me')}</button></div>
      <p class="maptip3">Hold the map to drop a pin.</p><div class="mapnote3 hidden"></div></div>`;
  const sum = pane.querySelector('.mapsum3'), box = pane.querySelector('.mapbox3'), cv = box.querySelector('canvas'), note = box.querySelector('.mapnote3');
  // top right, the same day dial as in flight, and the season in more detail beneath it
  const day = box.querySelector('.mapday3'), seasonEl = day.querySelector('.mapseason3'), dial = createDial(day);
  day.prepend(dial.el || day.querySelector('.dial'));
  const over = document.createElement('canvas'); over.className = 'mapover3'; cv.after(over);
  const globe = createGlobe(cv);
  G.menu.onOpen(() => setTimeout(prebake, 30));   // the globe's land, while the menu slides in
  // the view: the point in the middle and the ball's radius in CSS pixels; T is where it is easing to
  const V = { lat: 0, lon: 0, R: 300, w: 0, h: 0, dpr: 1 }, T = { lat: 0, lon: 0, R: 300 };
  let open = false, raf = 0, spin = [0, 0], held = false;
  const rMin = () => Math.min(V.w, V.h) * .42, rMax = () => Math.min(V.w, V.h) * 5;
  const hawkLL = () => latLon(b.p[0], b.p[2]);
  const centre = (R = T.R) => { const [la, lo] = hawkLL(); T.lat = la; T.lon = lo; T.R = clamp(R, rMin(), rMax()); spin = [0, 0]; soon(); };
  const fit = () => {
    const r = box.getBoundingClientRect();
    V.w = Math.max(200, Math.round(r.width)); V.h = Math.max(140, Math.round(r.height)); V.dpr = Math.min(devicePixelRatio || 1, 2);
    for (const c of [cv, over]) { c.width = Math.round(V.w * V.dpr); c.height = Math.round(V.h * V.dpr); }
  };
  // the fog, splatted from the seen cells (a few ms; on every opening)
  const fogNow = () => globe?.fog(fn => {
    for (let n = 0; n < seen.length; n++) {
      const by = seen[n]; if (!by) continue;
      for (let q = 0; q < 8; q++) if (by & (1 << q)) {
        const k = n * 8 + q, jj = Math.floor(k / FI), ii = k - jj * FI;
        fn((ii - FI / 2 + .5) * CELL, (jj + FJ0 + .5) * CELL);
      }
    }
  });
  G.on('menuTab', id => {
    open = id === 'map';
    pane.closest('.card3')?.classList.toggle('wide3', open);
    if (!open) return;
    note.classList.add('hidden');
    const pct = Math.round(explored() * 100);
    dial.update(G.tod, G.day, false, null, G.forecast || null);
    const cap = t => t[0].toUpperCase() + t.slice(1), into = (G.season.d ?? 0) + 1, left = SEASON_DAYS - into;
    const next = SEASONS[(SEASONS.indexOf(G.season.name) + 1) % SEASONS.length];
    const pips = Array.from({ length: SEASON_DAYS }, (_, i) => `<i class="${i < into - 1 ? 'on' : i === into - 1 ? 'on now' : ''}"></i>`).join('');
    seasonEl.className = `mapseason3 ${G.season.name}`;
    seasonEl.innerHTML = `<b>${G.date?.text ? `${G.date.text}, ` : ''}${cap(G.season.tropic ? 'tropical summer' : G.season.name)}</b><span class="pips3s">${pips}</span>
      <small>${G.season.tropic ? 'near the equator: summer all year' : left ? `${left} day${left > 1 ? 's' : ''} to ${next} here` : `${cap(next)} comes tomorrow`}</small>`;
    // top left: where the hawk is, and how far the journey has come
    const where = G.placeWhere(), L = G.collection?.(), found = Object.keys(J.found || {}).length;
    sum.innerHTML = `<p class="here3">${esc(cap(where))}</p>
      <div class="far3"><span><i style="width:${Math.max(2, pct)}%"></i></span><small>${pct < 1 ? (explored() * 100).toFixed(2) : pct}% of the world known</small></div>
      <ul class="tally3"><li><b>${J.year || 1}</b>${J.year > 1 ? 'years' : 'year'}</li><li><b>${found}</b>${found === 1 ? 'landmark' : 'landmarks'}</li>${L ? `<li><b>${L.lands}<span>/${L.of}</span></b>lands</li><li><b>${L.feathers}</b>${L.feathers === 1 ? 'feather' : 'feathers'}</li>` : ''}${J.pins?.length ? `<li><b>${J.pins.length}</b>${J.pins.length === 1 ? 'pin' : 'pins'}</li>` : ''}</ul>`;
    requestAnimationFrame(() => {
      fit(); fogNow();
      // open on the hawk, close enough to see the country round it; then spin out to the whole Earth
      const [la, lo] = hawkLL(); Object.assign(V, { lat: la, lon: lo, R: rMax() * .5 }); Object.assign(T, { lat: la, lon: lo, R: V.R });
      draw();
    });
  });
  addEventListener('resize', () => { if (open) { fit(); soon(); } });
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  // ease toward T, coast on a flick, keep going till still
  function frame() {
    if (!open) return;
    if (!held && (spin[0] || spin[1])) { T.lon += spin[0]; T.lat = clamp(T.lat + spin[1], -85, 85); spin = spin.map(s => Math.abs(s) < .002 ? 0 : s * .92); }
    const dl = ((T.lon - V.lon + 540) % 360) - 180;
    V.lat += (T.lat - V.lat) * .3; V.lon += dl * .3; V.R *= (T.R / V.R) ** .3;
    draw();
    if (Math.abs(T.lat - V.lat) > .001 || Math.abs(dl) > .001 || Math.abs(T.R / V.R - 1) > .001 || spin[0] || spin[1]) raf = requestAnimationFrame(frame);
  }
  const at = (x, z) => { const [la, lo] = latLon(x, z); return globe.project(V, V.w, V.h, la, lo); };

  // what can be tapped: home, the nest, the landmarks found. A landmark is "unique" (a mark and
  // its name always) unless several share its name or it is a whole land's sight (the dunes, the
  // salt pan): those are only named when close, and only once in a stretch of map
  const SIGHTS = new Set(['The Singing Dunes', 'The Golden Sea', 'The Stone Forest', 'The Hundred Towers', 'The White Pan', 'The Salt Mirror', 'The Painted Hills', 'The Striped Hills']);
  function places() {
    const out = G.home ? [{ x: G.home[0], z: G.home[1], name: 'Where you began', note: 'Your first flight started here.', col: PIG.wood, rank: 1 }] : [];
    if (G.nest) out.push({ x: G.nest.x, z: G.nest.z, name: 'Your nest', note: G.nest.egg || G.nest.chick ? 'Someone is waiting for you here.' : 'A nest of twigs, in a tree.', col: PIG.bark, rank: 0 });
    const names = {};
    for (const l of Object.values(J.found)) names[l.name] = (names[l.name] || 0) + 1;
    for (const l of Object.values(J.found)) out.push({ x: l.x, z: l.z, name: l.name, note: l.note, col: PIG.ring, rank: SIGHTS.has(l.name) ? 4 : names[l.name] > 1 ? 3 : 2, plain: SIGHTS.has(l.name) || names[l.name] > 1 });
    // food left on a branch (flight thread's G.caches), till it spoils
    for (const c of G.caches || []) out.push({ x: c.x, z: c.z, name: `A ${c.kind || 'catch'} left on a branch`, note: `Left on day ${Math.floor(c.day)}. It keeps two days.`, cache: c, rank: 1 });
    for (const p of J.pins || []) out.push({ x: p.x, z: p.z, name: 'Your pin', note: '', pin: p, rank: 0 });
    for (const p of G.mapPlaces?.() || []) out.push({ rank: 2, ...p });   // places other systems add (the neighbours' valley)
    return out;
  }
  let shown = [];   // the markers drawn, for taps

  function draw() {
    if (!open || !V.w || !globe) return;
    globe.draw(V, V.w, V.h, V.dpr);
    const x = over.getContext('2d'); x.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); x.clearRect(0, 0, V.w, V.h);
    x.font = '600 12px Outfit, system-ui, sans-serif';
    // labels keep clear of the panels over the map
    const br = box.getBoundingClientRect(), boxes = [sum, day].map(el => { const r = el.getBoundingClientRect(); return [r.left - br.left, r.bottom - br.top, r.width, r.height]; }), named = [];
    const free = (lx, ly, w) => !boxes.some(q => lx < q[0] + q[2] && lx + w > q[0] && ly - 14 < q[1] && ly + 4 > q[1] - (q[3] ?? 18));
    const label = (px, py, text, plain) => {
      const w = x.measureText(text).width + 12, lx = px + 9, ly = py - 5;
      if (lx + w > V.w - 4 || ly > V.h - 4 || !free(lx - 6, ly, w)) return false;
      boxes.push([lx - 6, ly + 5, w, 19]); named.push([text, px, py]);
      if (plain) { x.fillStyle = 'rgba(255,255,255,.92)'; x.font = 'italic 500 12px Outfit, system-ui, sans-serif'; x.fillText(text, lx, ly); x.font = '600 12px Outfit, system-ui, sans-serif'; return true; }
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.roundRect(lx - 6, ly - 13, w, 18, 9); x.fill();
      x.fillStyle = '#1d2b36'; x.fillText(text, lx, ly);
      return true;
    };
    shown = []; const dots = [];
    const close = V.R > rMax() * .3;
    for (const p of places().sort((a, c) => a.rank - c.rank)) {
      const [px, py, front] = at(p.x, p.z); if (!front || px < -20 || py < -20 || px > V.w + 20 || py > V.h + 20) continue;
      if (p.pin) { pin(x, px, py, pinCol(p.pin)); shown.push([p, px, py]); continue; }
      if (p.cache) { pin(x, px, py, '#7a4a2a'); shown.push([p, px, py]); continue; }
      if (p.plain) {
        // a repeated name or a land's sight: no mark, a quiet name when close, once per stretch
        if (!close || named.some(([t, qx, qy]) => t === p.name && Math.hypot(qx - px, qy - py) < 220)) continue;
        if (label(px - 9, py + 5, p.name, true)) shown.push([p, px, py]);
        continue;
      }
      // one mark to a spot, and none under the panels
      if (dots.some(([qx, qy]) => Math.hypot(qx - px, qy - py) < 12) || !free(px - 6, py + 6, 12)) continue;
      dots.push([px, py]); mark(x, px, py, p.col); label(px, py, p.name); shown.push([p, px, py]);
    }
    // you: a little hawk, pointing the way you face
    const [hx, hy, hf] = at(b.p[0], b.p[2]);
    if (hf) {
      const [ax, ay] = at(b.p[0] + Math.sin(b.yaw) * 400, b.p[2] - Math.cos(b.yaw) * 400);
      x.save(); x.translate(hx, hy); x.rotate(Math.atan2(ax - hx, hy - ay));
      x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 4;
      poly(x, [[0, -9], [13, 1], [3, 0], [2, 8], [-2, 8], [-3, 0], [-13, 1]], C(PIG.paper, .98));
      x.restore();
    }
  }
  // a pin: a round head on a short stem, its point on the place
  const pin = (x, px, py, col) => {
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 10); x.stroke();
    x.fillStyle = col; x.beginPath(); x.arc(px, py - 14, 6, 0, 6.283); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(px - 2, py - 16, 1.8, 0, 6.283); x.fill();
  };
  const mark = (x, px, py, col) => { const P = [[px, py - 6], [px + 5, py], [px, py + 6], [px - 5, py]]; poly(x, P, C(shade(col, .85))); poly(x, [P[0], P[2], P[3]], C(shade(col, 1.15))); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1; x.stroke(); };
  // ---- touch: drag to spin, flick to coast, pinch to zoom, tap a place, double tap to fly there (play testing) ---
  const pts = new Map();
  let pinch = 0, moved = 0, lastTap = null, lastMove = 0;
  // main.js G.travelTo: shut the menu, fade to black, set down on the nearest perch (or the
  // ground or water) there, fade back in
  function teleport(x, z) {
    x = wrapX(x); z = Math.max(EARTH.Z0 + 200, Math.min(EARTH.Z0 + EARTH.H - 200, z));
    G.travelTo(x, z, () => { reveal(); G.hud.reply(`Flown to ${G.placeName?.(x, z) || 'there'}.`, 3); });
  }
  const toWorld = (px, py) => { const ll = globe.unproject(V, V.w, V.h, px, py); return ll && toXZ(ll[0], ll[1]); };
  // zoom keeping the point under (px, py) still (near enough: it nudges the centre toward it)
  const zoomAt = (k, px = V.w / 2, py = V.h / 2) => {
    const R = clamp(T.R * k, rMin(), rMax()); if (R === T.R) return;
    const ll = globe.unproject(V, V.w, V.h, px, py);
    if (ll && k > 1) { const f = 1 - T.R / R, dl = ((ll[1] - T.lon + 540) % 360) - 180; T.lat = clamp(T.lat + (ll[0] - T.lat) * f, -85, 85); T.lon += dl * f; }
    T.R = R; soon();
  };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // a long press (still for half a second) offers a pin there
  let pressT = 0;
  const offerPin = p => {
    const w = toWorld(p[0], p[1]); if (!w) return;
    lastTap = null; moved = 99;
    note.classList.remove('hidden');
    note.innerHTML = `<b>Drop a pin here</b><small>Pick its colour.</small><span class="pins3">${PINS.map(c => `<button data-pin="${c}" style="--pc:${c}" aria-label="Pin colour"></button>`).join('')}</span>`;
    note.onclick = e => {
      const k = e.target.closest('[data-pin]')?.dataset.pin; if (!k) return;
      (J.pins ||= []).push({ id: Date.now().toString(36), col: k, x: Math.round(w[0]), z: Math.round(w[1]) });
      if (J.pins.length > 40) J.pins.shift();
      note.classList.add('hidden'); note.onclick = null; soon(); G.hud.did('pin'); G.emit('pin');
    };
  };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); moved = 0; pinch = 0; held = true; spin = [0, 0];
    clearTimeout(pressT); if (pts.size === 1) { const p0 = local(e); pressT = setTimeout(() => { if (moved < 6 && pts.size === 1) offerPin(p0); }, 550); }
  });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const q = local(e);
    if (pts.size === 1) {
      // a drag turns the ball under the finger: degrees per pixel from its size
      const k = 180 / Math.PI / T.R, dlon = -(q[0] - p[0]) * k / Math.max(.2, Math.cos(T.lat * D)), dlat = (q[1] - p[1]) * k;
      T.lon += dlon; T.lat = clamp(T.lat + dlat, -85, 85); Object.assign(V, { lat: T.lat, lon: T.lon });
      spin = [dlon, dlat]; lastMove = performance.now();
      moved += Math.hypot(q[0] - p[0], q[1] - p[1]); soon();
    }
    pts.set(e.pointerId, q);
    if (pts.size === 2) {
      const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
      if (pinch) { zoomAt(d / pinch, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2); V.R = T.R; }
      pinch = d; moved = 99;
    }
  });
  const up = e => {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId); pinch = 0; clearTimeout(pressT);
    if (!pts.size) { held = false; if (performance.now() - lastMove > 80) spin = [0, 0]; soon(); }
    if (!p || moved > 6 || pts.size) return;
    const now = performance.now();
    if (lastTap && now - lastTap.t < 350 && Math.hypot(p[0] - lastTap.p[0], p[1] - lastTap.p[1]) < 24) { lastTap = null; const w = toWorld(p[0], p[1]); if (w) teleport(w[0], w[1]); return; }
    lastTap = { t: now, p };
    let best = null, bd = 22;
    for (const [pl, px, py] of shown) { const d = Math.hypot(px - p[0], py - p[1]); if (d < bd) { bd = d; best = pl; } }
    note.classList.toggle('hidden', !best); note.onclick = null;
    if (best?.pin) {
      note.innerHTML = `<b>${esc(best.name)}</b><small>Your pin. It shows on the compass when you are near.</small><span class="pins3"><button data-un="1">Remove pin</button></span>`;
      note.onclick = e => { if (!e.target.closest('[data-un]')) return; J.pins = J.pins.filter(q => q !== best.pin); note.classList.add('hidden'); soon(); };
    } else if (best) note.innerHTML = `<b>${esc(best.name)}</b><small>${esc(best.note || '')}</small>`;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = local(e); zoomAt(e.deltaY > 0 ? 1 / 1.2 : 1.2, px, py); }, { passive: false });
  box.querySelector('.mapbtn3').addEventListener('click', e => {
    const z = e.target.closest('[data-z]')?.dataset.z;
    if (z === 'in') zoomAt(1.8); if (z === 'out') zoomAt(1 / 1.8); if (z === 'me') centre(Math.max(T.R, rMax() * .5));
  });

  let t = 0;
  return {
    update(dt) { if ((t -= dt) <= 0) { t = .5; reveal(); } },
    // runs of seen and unseen cells, alternating from unseen, in base 36
    save() {
      const out = []; let run = 0, cur = 0;
      for (let k = 0; k < FI * FJ; k++) { const v = (seen[k >> 3] >> (k & 7)) & 1; if (v !== cur) { out.push(run.toString(36)); run = 0; cur = v; } run++; }
      out.push(run.toString(36));
      return 'r' + out.join('.');
    },
    load(s) {
      seen.fill(0); count = 0;
      if (typeof s === 'string' && s[0] === 'r') { let k = 0, cur = 0; for (const t of s.slice(1).split('.')) { const n = parseInt(t, 36) || 0; if (cur) for (let q = k; q < k + n; q++) see(q); k += n; cur ^= 1; } }
    },
    isSeen, explored,
  };
}
