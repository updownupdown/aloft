// A linear compass along the top middle: the quarter of the sky ahead and either side, with
// N, E, S and W, ticks between, and marks for the places that matter (the nest, where you began,
// landmarks found nearby). Moved only when the heading or the marks change. A Call (songs.js, 'call')
// lights up for a while what is round you within about ten seconds' flight: thermals, landmarks not
// yet found and rings of mist (CALLSEE).
import { pinCol } from './sys/map.js';
import { thermalsNear, landmarksNear, ringsNear, isNotable, height, WATER, coastDist } from './world.js';
import { icon } from './icons.js';

const SPAN = Math.PI * .55;          // from the middle to either edge
const POINTS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
// each mark's icon (icons.js)
const MARK = { nest: 'nest', south: 'south', home: 'home', pin: 'pin', place: 'landmarks', therm: 'thermal', ring: 'ring', find: 'landmarks', water: 'thirst' };
// a Call's look round: how far (m, about ten seconds' flight), how long the marks stay (s) and fade
// at the end, and at most how many of each
export const CALLSEE = { r: 320, secs: 10, fade: 3, most: 3 };

export function createCompass(G, ui) {
  ui.insertAdjacentHTML('beforeend', `<div class="compass3" aria-hidden="true"><div class="strip"></div><i class="mid"></i></div>`);
  const el = ui.querySelector('.compass3'), strip = el.querySelector('.strip');
  const b = G.b, ticks = [];
  for (let d = 0; d < 360; d += 15) {
    const p = POINTS.find(q => q[1] === d), t = document.createElement('span');
    t.className = p ? (p[0].length === 1 ? 'pt main' : 'pt') : 'tick';
    if (p) t.textContent = p[0];
    strip.append(t); ticks.push([t, d * Math.PI / 180]);
  }
  let marks = [], key = '', markT = 0, seen = [], seenT = 0;
  // a Call: what is round you, for a while (fixed where it was at the call)
  G.on('call', () => {
    const x = b.p[0], z = b.p[2], R = CALLSEE.r, near = (list, f = () => true) => list.map(o => [o, Math.hypot(o.x - x, o.z - z)])
      .filter(([o, d]) => d < R + (o.r || 0) && d > 25 && f(o)).sort((a, c) => a[1] - c[1]).slice(0, CALLSEE.most).map(([o]) => o);
    seen = [
      ...near(thermalsNear(x, z, R + 80)).map(t => ['therm', t.x, t.z, 'Rising air']),
      ...near(landmarksNear(x, z, R + 100), l => isNotable(l) && !G.journey?.found?.[l.id]).map(l => ['find', l.x, l.z, 'Something to find']),
      ...near(ringsNear(x, z, R), r => G.ringLive?.(r) ?? true).map(r => ['ring', r.x, r.z, 'A ring of mist']),
    ];
    seenT = CALLSEE.secs; markT = 0;
  });
  // the places to show, refreshed every second or so
  function places() {
    const out = [], J = G.journey, x = b.p[0], z = b.p[2];
    if (G.nest) out.push(['nest', G.nest.x, G.nest.z, 'Your nest']);
    if (G.home && Math.hypot(G.home[0] - x, G.home[1] - z) < 5000 && Math.hypot(G.home[0] - x, G.home[1] - z) > 300) out.push(['home', G.home[0], G.home[1], 'Where you began']);
    const found = Object.values(J?.found || {}).map(l => [l, Math.hypot(l.x - x, l.z - z)]).filter(([, d]) => d > 60 && d < 3000).sort((a, c) => a[1] - c[1]).slice(0, 3);
    for (const [l] of found) out.push(['place', l.x, l.z, l.name]);
    // your own pins, the two nearest within 4 km, each in its colour
    const pins = (J?.pins || []).map(p => [p, Math.hypot(p.x - x, p.z - z)]).filter(([, d]) => d > 40 && d < 4000).sort((a, c) => a[1] - c[1]).slice(0, 2);
    for (const [p] of pins) out.push(['pin', p.x, p.z, p.name || 'Your pin', pinCol(p)]);
    if (seenT > 0) out.push(...seen);
    if (wBest && Math.hypot(wBest[0] - x, wBest[1] - z) > 35) out.push(['water', wBest[0], wBest[1], 'Fresh water']);
    return out;
  }
  // Play test A (trials.js): thirsty in flight, the nearest fresh water (a river, a lake, a puddle or a rain
  // pool; the sea is salt) within 2.4 km, searched a ring of samples a frame outward from the bird, again
  // after it has moved on 60 m
  let wk = 1, wBest = null, wFrom = null;
  const fresh = (x, z) => height(x, z) < WATER && coastDist(x, z) > 30;
  function water() {
    if (!G.trial?.water || G.thirst >= .6 || b.state !== 'fly') { wBest = null; wk = 1; wFrom = null; return; }
    const x = b.p[0], z = b.p[2];
    if (wFrom && Math.hypot(wFrom[0] - x, wFrom[1] - z) > 60) { wk = 1; wFrom = null; }
    if (wk > 40) return;
    if (wk === 1) {
      wFrom = [x, z];
      let bd = 400; const was = wBest; wBest = null;
      for (const P of [G.puddles || [], G.pools || []]) for (let i = 0; i < P.length; i += 8) { const d = Math.hypot(P[i] - x, P[i + 2] - z); if (d < bd) { bd = d; wBest = [P[i], P[i + 2]]; } }
      if (wBest) { wk = 99; return; }
      wBest = was;   // kept while the new search runs
    }
    const r = wk * 60, n = Math.max(8, Math.round(r / 9.5));
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (fresh(qx, qz)) { wBest = [qx, qz]; wk = 99; return; } }
    if (++wk > 40) wBest = null;   // nothing within 2.4 km
  }
  function setMarks(list) {
    const k = list.map(m => m[0] + m[3]).join('|');
    if (k === key) { list.forEach((m, i) => { marks[i].x = m[1]; marks[i].z = m[2]; }); return; }
    key = k; for (const m of marks) m.el.remove();
    marks = list.map(([kind, x, z, title, col]) => {
      const e = document.createElement('span'); e.className = 'mk ' + kind; e.title = title; if (col) e.style.color = col;
      e.innerHTML = icon(MARK[kind]); strip.append(e);
      return { el: e, x, z, call: kind === 'therm' || kind === 'ring' || kind === 'find' };
    });
  }
  // its width, kept as it changes (reading clientWidth each frame, after the HUD's writes, forced
  // a layout of the page every frame)
  let last = '', w = el.clientWidth || 240;
  if (window.ResizeObserver) new ResizeObserver(() => { w = el.clientWidth || w; last = ''; }).observe(el);
  return {
    update(dt, hide) {
      el.classList.toggle('hidden', !!hide);
      if (hide) return;
      if (seenT > 0 && (seenT -= dt) <= 0) markT = 0;   // the Call's marks go
      water();
      if ((markT -= dt) <= 0) { markT = 1; setMarks(places()); }
      const fade = Math.min(1, Math.max(0, seenT) / CALLSEE.fade);
      const yaw = b.yaw;
      const k = Math.round(yaw * 200) + ',' + Math.round(b.p[0] / 20) + ',' + Math.round(b.p[2] / 20) + ',' + key + ',' + w + ',' + Math.round(fade * 30);
      if (k === last) return; last = k;
      const at = (e, a, f = 1) => {
        const d = Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw));
        const on = Math.abs(d) < SPAN;
        e.style.opacity = on ? (Math.min(1, (SPAN - Math.abs(d)) / .25) * f).toFixed(2) : 0;
        if (on) e.style.transform = `translateX(${(d / SPAN * w / 2).toFixed(1)}px)`;
      };
      for (const [t, a] of ticks) at(t, a);
      for (const m of marks) at(m.el, Math.atan2(m.x - b.p[0], -(m.z - b.p[2])), m.call ? fade : 1);
    },
  };
}
