// A linear compass along the top middle: the quarter of the sky ahead and either side, with
// N, E, S and W, ticks between, and marks for the places that matter (the nest, the way south or
// home, landmarks found nearby). Moved only when the heading or the marks change.
import { HOME_Z, MARSH_Z } from './sys/journey.js';

const SPAN = Math.PI * .55;          // from the middle to either edge
const POINTS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const MARK = {
  nest: '<path d="M3 9c1 3 9 3 10 0M2 9h12M5 9c0-2 1.5-3 3-3s3 1 3 3"/>',
  south: '<path d="M8 3v10M4 9l4 4 4-4"/>',
  home: '<path d="M3 8l5-4 5 4v5H3zM7 13v-3h2v3"/>',
  place: '<path d="M8 2l1.8 4 4.2.4-3.2 2.8 1 4.3L8 11.3 4.2 13.5l1-4.3L2 6.4l4.2-.4z"/>',
};

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
    return out;
  }
  function setMarks(list) {
    const k = list.map(m => m[0] + m[3]).join('|');
    if (k === key) { list.forEach((m, i) => { marks[i].x = m[1]; marks[i].z = m[2]; }); return; }
    key = k; for (const m of marks) m.el.remove();
    marks = list.map(([kind, x, z, title]) => {
      const e = document.createElement('span'); e.className = 'mk ' + kind; e.title = title;
      e.innerHTML = `<svg viewBox="0 0 16 16">${MARK[kind]}</svg>`; strip.append(e);
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
