// The heads-up layer: meters, a status line, the day dial, toasts, one tip at a time, and the
// thumb pads. Systems add meters with G.hud.meter() and tips with G.hud.tip(); they call
// G.hud.toast(). Meters are small rings in one glass pill with the menu button, touched only when
// their value changes.
import { store } from './util.js';
import { createDial } from './dial.js';
import { tipBar } from './tips.js';

const R = 9, LEN = 2 * Math.PI * R;   // each meter is a ring this size, in a 24-unit box

export function createHud(G, ui, input) {
  ui.insertAdjacentHTML('beforeend', `
    <div class="hud3"><span class="meters"></span><span class="alt"></span></div>
    <div class="corner3"><div class="fps3 hidden"></div></div>
    <div class="pad3 L"><i></i></div><div class="pad3 R"><i></i></div>
    <p class="toast3"></p>`);
  const q = s => ui.querySelector(s);
  const hud = q('.hud3'), meters = q('.meters'), toastEl = q('.toast3'), padL = q('.pad3.L'), padR = q('.pad3.R');
  const dial = createDial(q('.corner3'));
  q('.corner3').prepend(q('.corner3 .dial'));
  const H = { tips: [], done: store.get('hints3d', {}), status: '', counter: '', quiet: store.get('quietHud3d', false), hidden: false };
  const bar = tipBar(G, ui, H);
  const all = [];   // every meter: { v, low }
  let toastT = 0, tipNow = null, tipT = 0, wake = -9, blink = false;
  const queue = [];

  // a meter: a ring that empties as the need grows, its name beside it, red and blinking when low
  H.meter = (id, { label, colour, low = .2 }) => {
    const col = (colour.match(/#[0-9a-f]{6}/gi) || ['#8a7a6a']).pop();
    meters.insertAdjacentHTML('beforeend', `<span class="m3" data-m="${id}" title="${label}" style="--m:${col}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="bg" cx="12" cy="12" r="${R}"/><circle class="fg" cx="12" cy="12" r="${R}" stroke-dasharray="${LEN.toFixed(2)}"/></svg><span>${label[0].toUpperCase() + label.slice(1)}</span></span>`);
    const el = meters.lastElementChild, fg = el.querySelector('.fg'), m = { v: 1, low };
    all.push(m);
    let key = '';
    return v => {
      v = Math.max(0, Math.min(1, v)); m.v = v;
      const lo = v < low, k = `${Math.round(v * 60)},${lo},${lo && blink}`;
      if (k === key) return; key = k;
      fg.style.strokeDashoffset = (LEN * (1 - v)).toFixed(2);
      el.classList.toggle('low', lo); el.classList.toggle('blink', lo && blink);
    };
  };
  H.toast = (msg, secs = 4) => {
    if (toastT > 0) { if (toastEl.textContent !== msg && !queue.some(m => m[0] === msg)) queue.push([msg, secs]); return; }
    toastEl.textContent = msg; toastEl.classList.add('show'); toastT = secs;
  };
  // a tip shows while `when()` holds, until H.did(id) is called or it is swiped away (both are
  // remembered). It shows for eight seconds at a time, then rests a minute, at most three times a
  // session; tips.js gives it its short line and icon
  H.tip = (id, when, text) => H.tips.push({ id, when, text, shown: 0, rest: 0 });
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
      for (const t of H.tips) if (!H.done[t.id] && t.shown < 3 && G.t > t.rest && t.when()) { tipNow = t.id; bar.show(t); tipT = 8; t.shown++; t.rest = G.t + 68; break; }
    }
    if (!tipNow || tipT <= .3 || H.done[tipNow]) bar.hide();
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
