// The heads-up layer: meters, a status line, the day dial, toasts, one tip at a time, and the
// thumb pads. Systems add meters with G.hud.meter() and tips with G.hud.tip(); they call
// G.hud.toast() / G.hud.say(). Meters are short bars stacked in one glass pill with the menu button, beside the
// height and speed; they are touched only when their value changes. A compass runs along the top.
import { store } from './util.js';
import { createDial } from './dial.js';
import { createCompass } from './compass.js';
import { tipBar, tipGroup } from './tips.js';
import { icon } from './icons.js';

// each meter's icon (icons.js)
const ICON_OF = { hunger: 'hunger', thirst: 'thirst', wings: 'stamina' };
// and its colour (slim bars, James's pick D, 2026-10-23)
const COL_OF = { hunger: '#ef8a66', thirst: '#86bde6', wings: '#e8b44a' };
// the message line's kinds: the colour of the icon, and the icon unless the message names one
export const SAY = {
  event: { col: '#ffd36b', icon: 'keepsake' },      // something happened: a new land, an aim done, a gift
  song: { col: '#9fcaff', icon: 'songs' },          // singing: the next note, how a song went
  tutorial: { col: '#9fe39a', icon: 'how' },        // the first season's lessons, tips
  hint: { col: '#ffffff', icon: 'aim' },            // a nudge: what you could do here
  warn: { col: '#ff9e8a', icon: 'hunger' },         // a need running low, danger
};

export function createHud(G, ui, input) {
  ui.insertAdjacentHTML('beforeend', `
    <div class="hud3"><span class="meters"></span><span class="alt"><span class="tape"></span><span class="ptr"></span><span class="nums"><b class="m"></b><b class="v"></b><b class="k"></b></span></span></div>
    <div class="corner3"><div class="fps3 hidden"></div></div>
    <div class="pad3 L"><i></i></div><div class="pad3 R"><i></i></div>
    <p class="toast3"><span class="ic3"></span><span class="tx3"></span><button class="set3" aria-label="Choose which messages show">${icon('settings')}</button></p>`);
  const q = s => ui.querySelector(s);
  const hud = q('.hud3'), meters = q('.meters'), toastEl = q('.toast3'), padL = q('.pad3.L'), padR = q('.pad3.R');
  const dial = createDial(q('.corner3'), { hub: true }), compass = createCompass(G, ui);
  const alt = q('.alt'), tape = q('.alt .tape'), altM = q('.alt .m'), altV = q('.alt .v'), altK = q('.alt .k');
  let vr = 0, lastY = null;   // the rise or sink, m/s, smoothed
  q('.corner3').prepend(q('.corner3 .dial'));
  // off: the groups of tips and kinds of message turned off on How to play > Hints ('tip:food',
  // 'say:hint'); said: the last few lines of each kind, for that page
  const H = { off: store.get('hintsoff3d', {}), said: store.get('said3d', {}), tips: [], done: store.get('hints3d', {}), status: '', flight: null, counter: '', hidden: false };
  const bar = tipBar(G, ui, H);
  const all = [];   // every meter: { v, low }
  let toastT = 0, tipNow = null, tipT = 0, altKey = '';
  const queue = [];

  // a meter: a slim bar beside its icon, the three stacked beside the menu button. It empties as
  // the need grows; when low it warms and breathes slowly (no flashing: that is the whole warning,
  // no message gets in the way)
  H.meter = (id, { label, colour, low = .2 }) => {
    const col = COL_OF[id] || (colour.match(/#[0-9a-f]{6}/gi) || ['#8a7a6a']).pop();
    meters.insertAdjacentHTML('beforeend', `<span class="m3" data-m="${id}" title="${label}" style="--m:${col}">${icon(ICON_OF[id] || id)}<span class="bar"><i></i><b></b></span><span class="nm">${label[0].toUpperCase() + label.slice(1)}</span></span>`);
    const el = meters.lastElementChild, fill = el.querySelector('.bar i'), cap = el.querySelector('.bar b'), m = { v: 1, low };
    all.push(m);
    let key = '';
    // glow: a colour for a soft halo round the bar (say, how clean the last wing beat was), or none;
    // max: how far the bar can fill just now (stamina held down by hunger and thirst), the rest
    // of the bar shaded off behind a small white mark
    return (v, glow = '', max = 1) => {
      max = Math.max(0, Math.min(1, max)); v = Math.max(0, Math.min(max, v)); m.v = v;
      const lo = v < low, k = `${Math.round(v * 100)},${lo},${glow},${Math.round(max * 100)}`;
      if (k === key) return; key = k;
      fill.style.transform = `scaleX(${v.toFixed(3)})`;
      cap.style.width = `${((1 - max) * 100).toFixed(1)}%`; el.classList.toggle('capped', max < .99);
      el.classList.toggle('glow', !!glow); if (glow) el.style.setProperty('--glow', glow);
      el.classList.toggle('low', lo);
    };
  };
  // the message line, top centre over the compass (which fades out under it): white words on a soft dark backing with an icon coloured by
  // kind (SAY). One at a time; the rest wait their turn, except song lines (the next note, how a
  // song went), which show at once
  const toastTx = toastEl.querySelector('.tx3'), toastIc = toastEl.querySelector('.ic3');
  let toastKey = '';
  H.say = (msg, { kind = 'event', secs = 4, icon: ic } = {}) => {
    if (H.off['say:' + kind]) return;
    const seen = H.said[kind] ||= [];
    if (!seen.includes(msg)) { seen.unshift(msg); seen.length = Math.min(seen.length, 8); store.set('said3d', H.said); }
    const k = kind + '|' + msg, song = kind === 'song';
    if (toastT > 0 && !song) {
      if (k !== toastKey && !queue.some(m => m[0] === msg)) queue.push([msg, secs, kind, ic]);
      return;
    }
    // a song line cuts in; what it interrupts goes back to the front of the queue
    if (toastT > 0 && toastEl.dataset.kind !== 'song') queue.unshift([toastTx.textContent, Math.max(2, toastT), toastEl.dataset.kind, toastEl.dataset.icon || undefined]);
    toastKey = k; toastEl.dataset.icon = ic || ''; toastTx.textContent = msg; toastEl.dataset.kind = kind;
    toastIc.innerHTML = icon(ic || SAY[kind]?.icon || 'keepsake'); toastIc.style.color = SAY[kind]?.col || SAY.event.col;
    toastEl.classList.add('show'); toastT = secs;
    ui.style.setProperty('--msgh', toastEl.offsetHeight + 'px');   // a tip steps down below it
  };
  H.toast = (msg, secs = 4, kind = 'event') => H.say(msg, { kind, secs });
  toastEl.querySelector('.set3').addEventListener('click', () => G.menu.set(true, 'how', 'hints'));
  // a tip shows while `when()` holds, until H.did(id) is called or it is swiped away (both are
  // remembered). It shows for eight seconds at a time, then rests a minute, at most three times a
  // session; tips.js gives it its short line and icon
  H.tip = (id, when, text) => H.tips.push({ id, when, text, shown: 0, rest: 0 });
  H.did = id => {
    if (!H.done[id]) { H.done[id] = 1; store.set('hints3d', H.done); }
    if (tipNow === id) tipT = Math.min(tipT, .3);
  };
  H.setOff = (key, off) => { if (off) H.off[key] = 1; else delete H.off[key]; store.set('hintsoff3d', H.off); };
  H.resetTips = () => { H.done = {}; store.set('hints3d', {}); };
  H.fps = n => { q('.fps3').textContent = `${Math.round(n)} FPS`; };
  H.showFps = on => q('.fps3').classList.toggle('hidden', !on);
  // photo mode hides the whole layer
  H.hide = on => { H.hidden = on; ui.classList.toggle('bare3', on); };
  hud.style.pointerEvents = 'auto';

  // until the weather can say what is coming: the weather now, for the next minute or so
  const nowOnly = s => s > 60 ? null : G.storm > .5 ? 'storm' : G.snowing > .3 ? 'snow' : G.rain > .3 ? 'rain' : G.fog > .4 ? 'fog' : G.overcast > .4 ? 'cloud' : 'clear';
  H.update = dt => {
    toastT -= dt;
    if (toastT <= 0 && toastEl.classList.contains('show')) toastEl.classList.remove('show');
    if (toastT <= -.5 && queue.length) { const [m, s, kind, ic] = queue.shift(); H.say(m, { kind, secs: s, icon: ic }); }
    tipT -= dt;
    if (tipT <= 0) {
      tipNow = null;
      for (const t of H.tips) if (!H.done[t.id] && !H.off['tip:' + tipGroup(t.id)] && t.shown < 3 && G.t > t.rest && t.when()) { tipNow = t.id; bar.show(t); tipT = 8; t.shown++; t.rest = G.t + 68; break; }
    }
    if (!tipNow || tipT <= .3 || H.done[tipNow]) bar.hide();
    // the height ladder: a tape of ticks that slides with the height, the height, then the rise or
    // sink and the speed when flying, or what the hawk is doing
    const y = G.b.p[1];
    if (lastY !== null && dt > 0) vr += ((y - lastY) / dt - vr) * Math.min(1, dt * 2.5);
    lastY = y;
    const f = H.flight, h = f ? f.m : H.height ?? '', rate = Math.abs(vr) < .05 ? '0.0' : Math.abs(vr).toFixed(1);
    const ak = f ? `${h}|${f.kmh}|${f.lift}|${f.up}|${rate}|${vr > 0}` : `${h}|${H.status}`;
    if (ak !== altKey) {
      altKey = ak;
      alt.classList.toggle('still', !f);
      tape.style.backgroundPositionY = `${((+h || 0) * 2 % 10).toFixed(1)}px`;
      altM.innerHTML = h !== '' ? `${h}<small>m</small>` : '';
      if (f) {
        altV.innerHTML = `${f.up ? icon('updraft', 'up3 n' + f.up) : vr > .05 ? '↑' : vr < -.05 ? '↓' : ''} ${rate}<small>m/s</small>`;   // in rising air: red chevrons, more for stronger
        altV.className = 'v' + (f.lift || vr > .3 ? ' rise' : vr < -.3 ? ' sink' : '');
        altK.innerHTML = `${f.kmh}<small>km/h</small>`;
      } else { altV.textContent = H.status; altV.className = 'v st'; altK.textContent = ''; }
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
