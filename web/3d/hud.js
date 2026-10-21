// The heads-up layer: meters, a status line, the day dial, toasts, one tip at a time, and the
// thumb pads. Systems add meters with G.hud.meter() and tips with G.hud.tip(); they call
// G.hud.toast(). Meters are short bars stacked in one glass pill with the menu button, beside the
// height and speed; they are touched only when their value changes. A compass runs along the top.
import { store } from './util.js';
import { createDial } from './dial.js';
import { createCompass } from './compass.js';
import { tipBar } from './tips.js';

// each meter's icon, a 16-unit line drawing
const ICONS = {
  hunger: 'M3 12c0-3.5 2.5-6 6-6 2.5 0 4 1.5 4 3.5 0 1.5-1 2.5-3 2.5zM13 9.5l2 .5M3 12c-1 1-1.5 2-2 2.5M10 8.5h.01',
  thirst: 'M8 2.5C6 6 4 8 4 10.5a4 4 0 0 0 8 0C12 8 10 6 8 2.5z',
  wings: 'M1 9c3-1 5-3 7-3s4 2 7 3c-3 0-5 1-7 3-2-2-4-3-7-3z',
};

export function createHud(G, ui, input) {
  ui.insertAdjacentHTML('beforeend', `
    <div class="hud3"><span class="meters"></span><span class="alt"><b class="m"></b><b class="k"></b></span></div>
    <div class="corner3"><div class="fps3 hidden"></div></div>
    <div class="pad3 L"><i></i></div><div class="pad3 R"><i></i></div>
    <p class="toast3"></p>`);
  const q = s => ui.querySelector(s);
  const hud = q('.hud3'), meters = q('.meters'), toastEl = q('.toast3'), padL = q('.pad3.L'), padR = q('.pad3.R');
  const dial = createDial(q('.corner3')), compass = createCompass(G, ui);
  const altM = q('.alt .m'), altK = q('.alt .k');
  q('.corner3').prepend(q('.corner3 .dial'));
  const H = { tips: [], done: store.get('hints3d', {}), status: '', flight: null, counter: '', hidden: false };
  const bar = tipBar(G, ui, H);
  const all = [];   // every meter: { v, low }
  let toastT = 0, tipNow = null, tipT = 0, altKey = '';
  const queue = [];

  // a meter: an icon and a bar that empties as the need grows; it flashes when low, faster when
  // nearly empty (that is the whole warning: no message gets in the way)
  H.meter = (id, { label, colour, low = .2 }) => {
    const col = (colour.match(/#[0-9a-f]{6}/gi) || ['#8a7a6a']).pop();
    meters.insertAdjacentHTML('beforeend', `<span class="m3" data-m="${id}" title="${label}" style="--m:${col}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${ICONS[id] || 'M8 8h.01'}"/></svg><span class="bar"><i></i><b></b></span><span class="nm">${label[0].toUpperCase() + label.slice(1)}</span></span>`);
    const el = meters.lastElementChild, fill = el.querySelector('.bar i'), cap = el.querySelector('.bar b'), m = { v: 1, low };
    all.push(m);
    let key = '';
    // glow: a colour for a soft halo round the bar (say, how clean the last wing beat was), or none;
    // max: how far the bar can fill just now (stamina held down by hunger and thirst), the rest
    // of the bar hatched off behind a small white mark
    return (v, glow = '', max = 1) => {
      max = Math.max(0, Math.min(1, max)); v = Math.max(0, Math.min(max, v)); m.v = v;
      const lo = v < low, k = `${Math.round(v * 100)},${lo},${v < low * .6},${glow},${Math.round(max * 100)}`;
      if (k === key) return; key = k;
      fill.style.transform = `scaleX(${v.toFixed(3)})`;
      cap.style.left = `${(max * 100).toFixed(1)}%`; el.classList.toggle('capped', max < .99);
      el.classList.toggle('glow', !!glow); if (glow) el.style.setProperty('--glow', glow);
      el.classList.toggle('low', lo); el.classList.toggle('urgent', v < low * .6);
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
  H.fps = n => { q('.fps3').textContent = Math.round(n); };
  H.showFps = on => q('.fps3').classList.toggle('hidden', !on);
  // photo mode hides the whole layer
  H.hide = on => { H.hidden = on; ui.classList.toggle('bare3', on); };
  hud.style.pointerEvents = 'auto';

  // until the weather can say what is coming: the weather now, for the next minute or so
  const nowOnly = s => s > 60 ? null : G.storm > .5 ? 'storm' : G.snowing > .3 ? 'snow' : G.rain > .3 ? 'rain' : G.fog > .4 ? 'fog' : G.overcast > .4 ? 'cloud' : 'clear';
  H.update = dt => {
    toastT -= dt;
    if (toastT <= 0 && toastEl.classList.contains('show')) toastEl.classList.remove('show');
    if (toastT <= -.5 && queue.length) H.toast(...queue.shift());
    tipT -= dt;
    if (tipT <= 0) {
      tipNow = null;
      for (const t of H.tips) if (!H.done[t.id] && t.shown < 3 && G.t > t.rest && t.when()) { tipNow = t.id; bar.show(t); tipT = 8; t.shown++; t.rest = G.t + 68; break; }
    }
    if (!tipNow || tipT <= .3 || H.done[tipNow]) bar.hide();
    // height over speed when flying, else what the hawk is doing
    const f = H.flight, ak = f ? `${f.m}|${f.kmh}|${f.lift}` : H.status;
    if (ak !== altKey) {
      altKey = ak;
      if (f) { altM.innerHTML = `${f.m}<small>m</small>`; altK.innerHTML = `${f.kmh}<small>km/h</small>`; } else { altM.textContent = H.status; altK.textContent = ''; }
      altM.className = 'm' + (f?.lift ? ' ' + f.lift : '');
    }
    compass.update(dt, G.menu?.open);
    dial.update(G.tod, G.day, false, G.season, G.forecast || nowOnly);
    for (const [el, P] of [[padL, input.L], [padR, input.R]]) {
      // perched or standing, a drag turns the bird: no sticks then
      const fly = G.b.state === 'fly', on = P.id !== null && fly;
      el.style.display = fly ? '' : 'none';
      el.classList.toggle('on', on);
      if (on) {
        el.style.left = (P.x0 - 45) + 'px'; el.style.top = (P.y0 - 45) + 'px'; el.style.right = el.style.bottom = 'auto';
        el.firstChild.style.transform = `translate(${P.dx * 30}px, ${P.dy * 30}px)`;
      } else { el.style.left = el.style.top = el.style.right = el.style.bottom = ''; el.firstChild.style.transform = ''; }
    }
  };
  return H;
}
