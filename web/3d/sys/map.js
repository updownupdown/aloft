// The Map tab: the country as the hawk has seen it, north up. Everywhere starts under fog; flying
// clears it around the hawk (wider the higher it flies), and the cleared ground is painted from the
// terrain itself as the world is, in lit triangles coloured by what grows there. Drag to pan, pinch
// or the wheel to zoom, tap a place for its note. Painted only while the menu shows the map: the
// land goes to a cache a screen wider than the view on every side, so a drag only slides it.
// Created by journey.js, which keeps the route and the landmarks; the fog saves with the journey.
import * as W from '../world.js';
import { PIG, C, shade, poly, facets } from '../facet.js';
import { clamp } from '../util.js';
import { esc } from '../journal.js';
import { hourName } from '../dial.js';

const CELL = 100;                        // fog cells, metres
const SEE = [160, 2.2, 520];             // clearing radius: base, per metre of height, most
const ZOOM = [1.2, 24], ZOOM0 = 5;       // metres per CSS pixel: closest, farthest, at first
const FOG = [228, 235, 239];
const key = (i, j) => i + ',' + j;

export function mapView(G, J, { HOME_Z, MARSH_Z }) {
  const b = G.b, seen = new Set();
  // clear the fog round the hawk
  function reveal(x = b.p[0], z = b.p[2]) {
    const alt = b.state === 'fly' ? b.p[1] - Math.max(W.height(x, z), W.WATER) : 0;
    const r = clamp(SEE[0] + alt * SEE[1], SEE[0], SEE[2]), n = Math.ceil(r / CELL);
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const dx = (ci + i + .5) * CELL - x, dz = (cj + j + .5) * CELL - z;
      if (dx * dx + dz * dz <= r * r) seen.add(key(ci + i, cj + j));
    }
  }
  const isSeen = (x, z) => seen.has(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  const nearSeen = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (seen.has(key(i + u, j + v))) return true; return false; };
  // how much of the way south has been seen: the cells of a band 3 km wide from home to the marsh
  function explored() {
    const i0 = -15, i1 = 15, j0 = Math.floor((HOME_Z - 500) / CELL), j1 = Math.floor((MARSH_Z + 500) / CELL);
    let n = 0;
    for (const k of seen) { const [i, j] = k.split(',').map(Number); if (i >= i0 && i < i1 && j >= j0 && j < j1) n++; }
    return n / ((i1 - i0) * (j1 - j0));
  }

  // ---- the tab ----------------------------------------------------------------------------
  const pane = G.menu.tab('map', 'Map');
  pane.classList.add('mappane3', 'flush3');
  pane.innerHTML = `<div class="mapbox3"><canvas></canvas><div class="mapsum3"><b></b><span></span></div>
      <div class="mapbtn3"><button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">−</button><button data-z="me" aria-label="Centre on the hawk">◎</button></div>
      <div class="mapnote3 hidden"></div></div>`;
  const sum = pane.querySelector('.mapsum3'), box = pane.querySelector('.mapbox3'), cv = box.querySelector('canvas'), note = box.querySelector('.mapnote3');
  const V = { x: 0, z: 0, sc: ZOOM0, w: 0, h: 0, dpr: 1 };
  let cache = null, open = false, raf = 0;
  const centre = () => { V.x = b.p[0]; V.z = b.p[2]; };
  const fit = () => {
    const r = box.getBoundingClientRect();
    V.w = Math.max(200, Math.round(r.width)); V.h = Math.max(140, Math.round(r.height)); V.dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(V.w * V.dpr); cv.height = Math.round(V.h * V.dpr);
  };
  G.on('menuTab', id => {
    open = id === 'map';
    pane.closest('.card3')?.classList.toggle('wide3', open);
    if (!open) return;
    centre(); note.classList.add('hidden');
    const pct = Math.round(explored() * 100);
    // the overlay: when it is, then where the hawk is and how much of the way is known
    const h = hourName(G.tod), where = G.placeNote().replace(/^Day \d+, \w+, /, '');
    sum.firstChild.textContent = `${h[0].toUpperCase()}${h.slice(1)} · Day ${G.day} · ${G.season.name[0].toUpperCase()}${G.season.name.slice(1)}`;
    sum.lastChild.textContent = `${where[0].toUpperCase()}${where.slice(1)} ${pct}% of the way south explored.`;
    requestAnimationFrame(() => { fit(); cache = null; draw(); });
  });
  addEventListener('resize', () => { if (open) { fit(); cache = null; soon(); } });
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

  // screen <-> world
  const sx = wx => (wx - V.x) / V.sc + V.w / 2, sz = wz => (wz - V.z) / V.sc + V.h / 2;
  const wx = px => V.x + (px - V.w / 2) * V.sc, wz = py => V.z + (py - V.h / 2) * V.sc;

  // the land under the fog, for a rectangle one view wider on every side
  function paintCache() {
    const W3 = V.w * 3, H3 = V.h * 3, c = document.createElement('canvas');
    c.width = Math.round(W3 * V.dpr); c.height = Math.round(H3 * V.dpr);
    const x = c.getContext('2d'); x.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    const ox = V.x - V.w * 1.5 * V.sc, oz = V.z - V.h * 1.5 * V.sc, sc = V.sc;
    const X = px => ox + px * sc, Z = py => oz + py * sc;
    const ground = (px, py) => {
      const x0 = X(px), z0 = Z(py), y = W.height(x0, z0);
      if (y < W.WATER + .3) return PIG.water;
      if (y > 150) return PIG.paper;
      if (y > 85) return PIG.rock;
      return W.forest(x0, z0) > .15 ? PIG.wood : y < 3 ? PIG.sand : PIG.meadow;
    };
    const cell = clamp(14 * Math.sqrt(ZOOM0 / sc), 9, 22);
    facets(x, 0, 0, W3, H3, cell, (px, py, t) => {
      if (!nearSeen(X(px), Z(py))) return null;
      for (const v of t) v[2] = Math.max(W.height(X(v[0]), Z(v[1])), 0) / sc;
      return ground(px, py);
    }, { seed: 5, relief: 1.6 });
    // the fog: a sheet of paper with soft holes where the hawk has been
    const f = document.createElement('canvas'); f.width = c.width; f.height = c.height;
    const fx = f.getContext('2d'); fx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    fx.fillStyle = C(FOG); fx.fillRect(0, 0, W3, H3);
    fx.strokeStyle = C(shade(FOG, .94)); fx.lineWidth = 1;
    for (let y = 6; y < H3; y += 9) { fx.beginPath(); fx.moveTo(0, y); fx.lineTo(W3, y); fx.stroke(); }
    fx.globalCompositeOperation = 'destination-out';
    const rr = CELL * 1.05 / sc, i0 = Math.floor(ox / CELL) - 1, i1 = Math.ceil(X(W3) / CELL) + 1, j0 = Math.floor(oz / CELL) - 1, j1 = Math.ceil(Z(H3) / CELL) + 1;
    for (const k of seen) {
      const [i, j] = k.split(',').map(Number); if (i < i0 || i > i1 || j < j0 || j > j1) continue;
      const px = ((i + .5) * CELL - ox) / sc, py = ((j + .5) * CELL - oz) / sc;
      const g = fx.createRadialGradient(px, py, rr * .35, px, py, rr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = g; fx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    x.drawImage(f, 0, 0, W3, H3);
    cache = { c, ox, oz, sc, w: W3, h: H3 };
  }

  // what can be tapped: home, the nest, the landmarks found
  function places() {
    const out = [{ x: 0, z: HOME_Z, name: 'Home, the forest edge', note: 'Where the journey starts and ends.', col: PIG.wood }];
    if (G.nest) out.push({ x: G.nest.x, z: G.nest.z, name: 'Your nest', note: G.nest.egg || G.nest.chick ? 'Someone is waiting for you here.' : 'A nest of twigs, in a tree.', col: PIG.bark });
    for (const l of Object.values(J.found)) out.push({ x: l.x, z: l.z, name: l.name, note: l.note, col: PIG.ring });
    return out;
  }

  function draw() {
    if (!open || !V.w) return;
    const x = cv.getContext('2d'); x.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    const vx0 = wx(0), vz0 = wz(0), vx1 = wx(V.w), vz1 = wz(V.h);
    if (!cache || cache.sc !== V.sc || vx0 < cache.ox || vz0 < cache.oz || vx1 > cache.ox + cache.w * cache.sc || vz1 > cache.oz + cache.h * cache.sc) paintCache();
    x.fillStyle = C(FOG); x.fillRect(0, 0, V.w, V.h);
    x.drawImage(cache.c, (cache.ox - vx0) / V.sc, (cache.oz - vz0) / V.sc, cache.w, cache.h);
    route(x);
    // the marsh: a dashed line across the map where it lies, or which way it is
    x.font = '600 12px Manrope, system-ui, sans-serif';
    const label = (px, py, text) => {
      const w = x.measureText(text).width, lx = clamp(px, 6, V.w - w - 10), ly = clamp(py, 16, V.h - 6);
      x.fillStyle = 'rgba(255,255,255,.82)'; x.beginPath(); x.roundRect(lx - 6, ly - 13, w + 12, 18, 9); x.fill();
      x.fillStyle = '#1d2b36'; x.fillText(text, lx, ly);
    };
    const mz = sz(MARSH_Z);
    if (mz > 0 && mz < V.h) { x.fillStyle = C(PIG.ink, .45); for (let i = 0; i < V.w; i += 10) x.fillRect(i, mz, 6, 1.5); label(10, mz + 18, 'The wintering marsh'); }
    else if (mz >= V.h) { const km = ((MARSH_Z - V.z) / 1000).toFixed(1), t = `The wintering marsh, ${km} km south`; label(V.w / 2 - x.measureText(t).width / 2, V.h - 22, t); poly(x, [[V.w / 2 - 6, V.h - 13], [V.w / 2 + 6, V.h - 13], [V.w / 2, V.h - 4]], C(PIG.ink, .7)); }
    for (const p of places()) {
      const px = sx(p.x), py = sz(p.z); if (px < -20 || py < -20 || px > V.w + 20 || py > V.h + 20) continue;
      mark(x, px, py, p.col); label(px + 9, py - 6, p.name);
    }
    // you: a little hawk, pointing the way you face
    x.save(); x.translate(sx(b.p[0]), sz(b.p[2])); x.rotate(b.yaw);
    poly(x, [[0, -8], [12, 1], [3, 0], [2, 7], [-2, 7], [-3, 0], [-12, 1]], C(PIG.ink, .92));
    x.restore();
    // north
    poly(x, [[V.w - 18, 12], [V.w - 13, 26], [V.w - 18, 23], [V.w - 23, 26]], C(PIG.ink, .7));
    x.fillStyle = C(PIG.ink, .75); x.textAlign = 'center'; x.fillText('N', V.w - 18, 40); x.textAlign = 'left';
  }
  const mark = (x, px, py, col) => { const P = [[px, py - 6], [px + 5, py], [px, py + 6], [px - 5, py]]; poly(x, P, C(shade(col, .85))); poly(x, [P[0], P[2], P[3]], C(shade(col, 1.15))); x.strokeStyle = C(PIG.ink, .6); x.lineWidth = 1; x.stroke(); };
  // the route: broad where the hawk soared high, thin near the ground, dotted where it walked
  function route(x) {
    const r = J.route; if (r.length < 2) return;
    x.save(); x.lineCap = 'round';
    for (let i = 1; i < r.length; i++) {
      const p = r[i - 1], q = r[i];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 600) continue;
      if (p[2] <= 0 && q[2] <= 0) { if (i % 3 === 0) { x.fillStyle = C(PIG.water, .85); x.fillRect(sx((p[0] + q[0]) / 2) - 1.2, sz((p[1] + q[1]) / 2) - 1.2, 2.4, 2.4); } continue; }
      x.strokeStyle = C([79, 111, 158], .75); x.lineWidth = 1.2 + clamp((p[2] + q[2]) / 160, 0, 1) * 3;
      x.beginPath(); x.moveTo(sx(p[0]), sz(p[1])); x.lineTo(sx(q[0]), sz(q[1])); x.stroke();
    }
    x.restore();
  }

  // ---- touch: drag to pan, pinch to zoom, tap a place ----------------------------------------
  const pts = new Map();
  let pinch = 0, moved = 0;
  const zoomAt = (k, px = V.w / 2, py = V.h / 2) => {
    const sc = clamp(V.sc * k, ZOOM[0], ZOOM[1]); if (sc === V.sc) return;
    const ax = wx(px), az = wz(py); V.sc = sc; V.x = ax - (px - V.w / 2) * sc; V.z = az - (py - V.h / 2) * sc; soon();
  };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); moved = 0; pinch = 0; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const q = local(e);
    if (pts.size === 1) { V.x -= (q[0] - p[0]) * V.sc; V.z -= (q[1] - p[1]) * V.sc; moved += Math.hypot(q[0] - p[0], q[1] - p[1]); soon(); }
    pts.set(e.pointerId, q);
    if (pts.size === 2) {
      const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
      if (pinch) zoomAt(pinch / d, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
      pinch = d; moved = 99;
    }
  });
  const up = e => {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId); pinch = 0;
    if (!p || moved > 6 || pts.size) return;
    let best = null, bd = 22;
    for (const pl of places()) { const d = Math.hypot(sx(pl.x) - p[0], sz(pl.z) - p[1]); if (d < bd) { bd = d; best = pl; } }
    note.classList.toggle('hidden', !best);
    if (best) note.innerHTML = `<b>${esc(best.name)}</b><small>${esc(best.note || '')}</small>`;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = local(e); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, px, py); }, { passive: false });
  box.querySelector('.mapbtn3').addEventListener('click', e => {
    const z = e.target.closest('[data-z]')?.dataset.z;
    if (z === 'in') zoomAt(1 / 1.5); if (z === 'out') zoomAt(1.5); if (z === 'me') { centre(); soon(); }
  });

  let t = 0;
  return {
    update(dt) { if ((t -= dt) <= 0) { t = .5; reveal(); } },
    save: () => [...seen].join(';'),
    load(s) {
      seen.clear();
      if (s) for (const k of String(s).split(';')) if (k) seen.add(k);
      // a journey saved before the fog: clear it along the route already flown
      else for (const p of J.route) reveal(p[0], p[1]);
    },
    isSeen,
  };
}
