// A linear compass along the top middle: the quarter of the sky ahead and either side, with
// N, E, S and W, ticks between, and marks for the places that matter (the nest, the way south or
// home, landmarks found nearby). Moved only when the heading or the marks change.
import { HOME_Z, MARSH_Z } from './sys/journey.js';
import { pinCol } from './sys/map.js';
import { icon } from './icons.js';

const SPAN = Math.PI * .55;          // from the middle to either edge
const POINTS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
// each mark's icon (icons.js)
const MARK = { nest: 'nest', south: 'south', home: 'home', ghost: 'ghost', pin: 'pin', place: 'landmarks' };

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
  let marks = [], key = '', markT = 0;
  // the places to show, refreshed every second or so
  function places() {
    const out = [], J = G.journey, x = b.p[0], z = b.p[2];
    if (G.nest) out.push(['nest', G.nest.x, G.nest.z, 'Your nest']);
    if (J?.goal === 'south' && z < MARSH_Z - 200) out.push(['south', x, MARSH_Z, 'The wintering marsh']);
    if (J?.goal === 'north' && z > HOME_Z + 200) out.push(['home', x, HOME_Z, 'Home']);
    const found = Object.values(J?.found || {}).map(l => [l, Math.hypot(l.x - x, l.z - z)]).filter(([, d]) => d > 60 && d < 3000).sort((a, c) => a[1] - c[1]).slice(0, 3);
    for (const [l] of found) out.push(['place', l.x, l.z, l.name]);
    if (G.ghost) out.push(['ghost', G.ghost.x, G.ghost.z, 'The ghost flight']);
    // your own pins, the two nearest within 4 km, each in its colour
    const pins = (J?.pins || []).map(p => [p, Math.hypot(p.x - x, p.z - z)]).filter(([, d]) => d > 40 && d < 4000).sort((a, c) => a[1] - c[1]).slice(0, 2);
    for (const [p] of pins) out.push(['pin', p.x, p.z, 'Your pin', pinCol(p)]);
    return out;
  }
  function setMarks(list) {
    const k = list.map(m => m[0] + m[3]).join('|');
    if (k === key) { list.forEach((m, i) => { marks[i].x = m[1]; marks[i].z = m[2]; }); return; }
    key = k; for (const m of marks) m.el.remove();
    marks = list.map(([kind, x, z, title, col]) => {
      const e = document.createElement('span'); e.className = 'mk ' + kind; e.title = title; if (col) e.style.color = col;
      e.innerHTML = icon(MARK[kind]); strip.append(e);
      return { el: e, x, z };
    });
  }
  let last = '';
  return {
    update(dt, hide) {
      el.classList.toggle('hidden', !!hide);
      if (hide) return;
      if ((markT -= dt) <= 0) { markT = 1; setMarks(places()); }
      const yaw = b.yaw, w = el.clientWidth || 240;
      const k = Math.round(yaw * 200) + ',' + Math.round(b.p[0] / 20) + ',' + Math.round(b.p[2] / 20) + ',' + key + ',' + w;
      if (k === last) return; last = k;
      const at = (e, a) => {
        const d = Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw));
        const on = Math.abs(d) < SPAN;
        e.style.opacity = on ? Math.min(1, (SPAN - Math.abs(d)) / .25).toFixed(2) : 0;
        if (on) e.style.transform = `translateX(${(d / SPAN * w / 2).toFixed(1)}px)`;
      };
      for (const [t, a] of ticks) at(t, a);
      for (const m of marks) at(m.el, Math.atan2(m.x - b.p[0], -(m.z - b.p[2])));
    },
  };
}
