// The heads-up layer: meters, a status line, the day dial, toasts, one tip at a time, and the
// thumb pads. Systems add meters with G.hud.meter() and tips with G.hud.tip(); they call
// G.hud.toast(). Meters are washes of pigment along a pencil line (the "Wash" style), each
// painted on its own small canvas and only when its value changes.
import { store } from './util.js';
import { wash, pillP, circP, hexRGB } from './paper.js';
import { createDial } from './dial.js';

const BAR = 64, MH = 13;   // bar length and meter height, in CSS pixels
// a little icon before each meter, washed in its pigment
const ICONS = {
  thirst: (x, cx, cy, col) => wash(x, [[cx, cy - 4.5], [cx + 3, cy + .5], [cx + 2, cy + 3], [cx - 2, cy + 3], [cx - 3, cy + .5]], col, .9, { passes: 2, amp: .3, seed: 1, rim: .4 }),
  hunger: (x, cx, cy, col) => { wash(x, circP(cx - 1.5, cy + 1, 2.2, 8), col, .9, { passes: 2, amp: .3, seed: 2, rim: .4 }); wash(x, circP(cx + 1.8, cy, 2.2, 8), col, .9, { passes: 2, amp: .3, seed: 4, rim: .4 }); },
  wings: (x, cx, cy, col) => wash(x, [[cx - 3.2, cy + 4], [cx - 1.2, cy - .5], [cx + 1.6, cy - 4], [cx + 3.4, cy - 3.2], [cx + 2.2, cy + 1], [cx - 1, cy + 4]], col, .9, { passes: 2, amp: .3, seed: 6, rim: .4 }),
  dot: (x, cx, cy, col) => wash(x, circP(cx, cy, 2.6, 9), col, .9, { passes: 2, amp: .3, seed: 8, rim: .4 }),
};
const TICKS = { thirst: 3, hunger: 6 };

export function createHud(G, ui, input) {
  ui.insertAdjacentHTML('beforeend', `
    <div class="hud3"><span class="meters"></span><span class="alt"></span></div>
    <div class="corner3"><div class="fps3 hidden"></div></div>
    <div class="pad3 L"><i></i></div><div class="pad3 R"><i></i></div>
    <p class="hint3"></p><p class="toast3"></p>`);
  const q = s => ui.querySelector(s);
  const hud = q('.hud3'), meters = q('.meters'), hintEl = q('.hint3'), toastEl = q('.toast3'), padL = q('.pad3.L'), padR = q('.pad3.R');
  const dial = createDial(q('.corner3'));
  q('.corner3').prepend(q('.corner3 .dial'));
  const H = { tips: [], done: store.get('hints3d', {}), status: '', counter: '', quiet: store.get('quietHud3d', false), hidden: false };
  const all = [];   // every meter: { v, low }
  let toastT = 0, tipNow = null, tipT = 0, wake = -9, blink = false;
  const queue = [];

  // a meter: a pencil line with a tick for each meal or sip that would fill it, and a wash of
  // pigment along it as far as it is full, blinking berry-red when low
  H.meter = (id, { label, colour, low = .2, icon, ticks }) => {
    const pig = hexRGB((colour.match(/#[0-9a-f]{6}/gi) || ['#8a7a6a']).pop());
    const cv = document.createElement('canvas'); cv.className = 'm3'; cv.title = label; cv.dataset.m = id;
    meters.append(cv);
    const draw = ICONS[icon || id] || ICONS.dot, nt = ticks ?? TICKS[id] ?? 0, m = { v: 1, low };
    all.push(m);
    let key = '';
    return v => {
      v = Math.max(0, Math.min(1, v)); m.v = v;
      const flash = v < low && blink, dpr = Math.min(devicePixelRatio || 1, 2), k = `${Math.round(v * 64)},${flash},${dpr}`;
      if (k === key) return; key = k;
      const W = BAR + 18, sc = 1.2 * dpr;
      if (cv.width !== Math.ceil(W * sc)) { cv.width = Math.ceil(W * sc); cv.height = Math.ceil(MH * sc); cv.style.width = W * 1.2 + 'px'; cv.style.height = MH * 1.2 + 'px'; }
      const x = cv.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(sc, 0, 0, sc, 0, 0);
      const y = MH / 2;
      draw(x, 5, y, pig);
      x.save(); x.globalCompositeOperation = 'multiply'; x.strokeStyle = 'rgba(58,36,24,.4)'; x.lineWidth = .6; x.beginPath();
      x.moveTo(13, y); x.lineTo(13 + BAR, y);
      for (let i = 1; i < nt; i++) { const tx = 13 + BAR * i / nt; x.moveTo(tx, y - 2.5); x.lineTo(tx, y + 2.5); }
      x.stroke(); x.restore();
      if (v > .01) wash(x, pillP(13, y - 3, BAR * v, 6), flash ? [190, 70, 50] : pig, .72, { passes: 2, amp: .6, seed: id.length * 3, rim: .35, rimW: .8 });
    };
  };
  // one toast at a time; later ones wait their turn so a message is never cut short
  H.toast = (msg, secs = 4) => {
    if (toastT > 0) { if (toastEl.textContent !== msg && !queue.some(m => m[0] === msg)) queue.push([msg, secs]); return; }
    toastEl.textContent = msg; toastEl.classList.add('show'); toastT = secs;
  };
  // a tip shows while `when()` holds, until H.did(id) is called (it is remembered)
  H.tip = (id, when, text) => H.tips.push({ id, when, text });
  H.did = id => {
    if (!H.done[id]) { H.done[id] = 1; store.set('hints3d', H.done); }
    if (tipNow === id) tipT = Math.min(tipT, .3);
  };
  H.resetTips = () => { H.done = {}; store.set('hints3d', {}); };
  H.fps = text => { q('.fps3').textContent = text; };
  H.showFps = on => q('.fps3').classList.toggle('hidden', !on);
  // photo mode hides the whole layer
  H.hide = on => { H.hidden = on; ui.classList.toggle('bare3', on); };
  // a touch on the meters brings quiet meters back for a few seconds
  hud.addEventListener('pointerdown', () => { wake = G.t; });
  hud.style.pointerEvents = 'auto';

  H.update = dt => {
    blink = Math.sin(G.t * 6) > 0;
    toastT -= dt;
    if (toastT <= 0 && toastEl.classList.contains('show')) toastEl.classList.remove('show');
    if (toastT <= -.5 && queue.length) H.toast(...queue.shift());
    tipT -= dt;
    if (tipT <= 0) {
      tipNow = null;
      for (const t of H.tips) if (!H.done[t.id] && t.when()) { tipNow = t.id; hintEl.textContent = t.text; tipT = 9; break; }
    }
    hintEl.classList.toggle('show', !!tipNow && tipT > .3);
    q('.alt').textContent = H.status;
    // quiet meters: fade while every meter is well filled, back as soon as one runs lower
    const lowest = Math.min(...all.map(m => m.v)), quiet = H.quiet && G.t - wake > 4 && lowest > (hud.classList.contains('quiet') ? .5 : .7);
    hud.classList.toggle('quiet', quiet);
    dial.update(G.tod, G.day, false, H.counter);
    for (const [el, P] of [[padL, input.L], [padR, input.R]]) {
      const on = P.id !== null;
      el.classList.toggle('on', on);
      if (on) {
        el.style.left = (P.x0 - 45) + 'px'; el.style.top = (P.y0 - 45) + 'px'; el.style.right = el.style.bottom = 'auto';
        el.firstChild.style.transform = `translate(${P.dx * 30}px, ${P.dy * 30}px)`;
      } else { el.style.left = el.style.top = el.style.right = el.style.bottom = ''; el.firstChild.style.transform = ''; }
    }
  };
  return H;
}
