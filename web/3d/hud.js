// The heads-up layer: meters, a status line, toasts, one tip at a time, and the thumb pads.
// Systems add meters with G.hud.meter() and tips with G.hud.tip(); they call G.hud.toast().
import { store } from './util.js';

export function createHud(G, ui, input) {
  ui.insertAdjacentHTML('beforeend', `
    <div class="hud3"><span class="meters"></span><span class="ringc"></span><span class="alt"></span></div>
    <div class="fps3 hidden"></div>
    <div class="pad3 L"><i></i></div><div class="pad3 R"><i></i></div>
    <p class="hint3"></p><p class="toast3"></p>`);
  const q = s => ui.querySelector(s);
  const meters = q('.meters'), hintEl = q('.hint3'), toastEl = q('.toast3'), padL = q('.pad3.L'), padR = q('.pad3.R');
  const H = { tips: [], done: store.get('hints3d', {}), status: '', counter: '' };
  let toastT = 0, tipNow = null, tipT = 0;

  // a meter: a short bar in a pigment, filled 0..1, flashing when low
  H.meter = (id, { label, colour, low = .2 }) => {
    meters.insertAdjacentHTML('beforeend', `<span class="m3" data-m="${id}"><em>${label}</em><span><b style="background:${colour}"></b></span></span>`);
    const el = meters.querySelector(`[data-m=${id}]`), bar = el.querySelector('b');
    return v => { bar.style.width = (Math.max(0, Math.min(1, v)) * 100).toFixed(0) + '%'; el.classList.toggle('low', v < low); };
  };
  H.toast = (msg, secs = 4) => { toastEl.textContent = msg; toastEl.classList.add('show'); toastT = secs; };
  // a tip shows while `when()` holds, until H.did(id) is called (it is remembered)
  H.tip = (id, when, text) => H.tips.push({ id, when, text });
  H.did = id => {
    if (!H.done[id]) { H.done[id] = 1; store.set('hints3d', H.done); }
    if (tipNow === id) tipT = Math.min(tipT, .3);
  };
  H.resetTips = () => { H.done = {}; store.set('hints3d', {}); };
  H.fps = text => { q('.fps3').textContent = text; };
  H.showFps = on => q('.fps3').classList.toggle('hidden', !on);

  H.update = dt => {
    toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show');
    tipT -= dt;
    if (tipT <= 0) {
      tipNow = null;
      for (const t of H.tips) if (!H.done[t.id] && t.when()) { tipNow = t.id; hintEl.textContent = t.text; tipT = 9; break; }
    }
    hintEl.classList.toggle('show', !!tipNow && tipT > .3);
    q('.ringc').textContent = H.counter;
    q('.alt').textContent = H.status;
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
