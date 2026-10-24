// One action button, bottom middle (placed by sys/songs.css): it shows the one action that fits now
// (Eat with a catch in your feet, Drink by fresh water, Sleep on a roost at night, else Take off; Leave
// it here with a catch on a branch), and a swipe up or down on it turns to the other when
// both fit, shown as dots. Keys: T takes off, E runs the action shown (or the first that isn't Take
// off), Up/Down turn to the other. Each action comes from the system that owns it (G.actions: takeoff in
// main.js, sleep in sys/sleep.js) as { run(), when() }. Settings can turn it off for the separate
// buttons.
import { icon } from './icons.js';

const ACTS = {
  eat: ['Eat', 'prey'],
  berries: ['Eat', 'berry'],
  drink: ['Drink', 'thirst'],
  leave: ['Leave it here', 'nest'],
  sleep: ['Sleep', 'sleep'],
  takeoff: ['Take off', 'takeoff'],
};
const ORDER = ['eat', 'berries', 'drink', 'sleep', 'takeoff', 'leave'];   // the first that fits is shown first

export function actionButton(G, ui) {
  ui.insertAdjacentHTML('beforeend', `<button class="act3 gone" aria-label=""><i class="ic"></i><span></span><i class="dots"></i></button>`);
  const btn = ui.querySelector('.act3'), ic = btn.querySelector('.ic'), label = btn.querySelector('span'), dots = btn.querySelector('.dots');
  G.settings.oneAction = G.store.get('oneAction3d', true);
  G.menu.toggle('play', { label: 'One action button', sub: 'Take off and Sleep in one; swipe it for the other', get: () => G.settings.oneAction, set: v => { G.settings.oneAction = v; G.store.set('oneAction3d', v); refresh(); } });
  let shown = null, pick = 0, key = '', y0 = null, swiped = false;

  function fits() { return ORDER.filter(id => G.actions?.[id]?.when?.()); }
  function refresh() {
    const on = G.settings.oneAction;
    ui.classList.toggle('act3on', on);
    const list = on && !G.menu?.open ? fits() : [];
    const k = list.join(',');
    if (k !== key) { key = k; pick = 0; }   // what fits changed: back to the first
    shown = list[pick % Math.max(1, list.length)] || null;
    btn.classList.toggle('gone', !shown);
    if (!shown) return;
    const [name, ik] = ACTS[shown];
    if (label.textContent !== name) { label.textContent = name; ic.innerHTML = icon(ik); btn.setAttribute('aria-label', name); btn.dataset.act = shown; }
    dots.innerHTML = list.length > 1 ? list.map((id, i) => `<b class="${i === pick % list.length ? 'on' : ''}"></b>`).join('') : '';
  }
  // a tap runs it; a swipe up or down turns to the next that fits
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btn.setPointerCapture(e.pointerId); y0 = e.clientY; swiped = false; G.audio.unlock?.(); });
  btn.addEventListener('pointermove', e => {
    if (y0 === null || swiped || Math.abs(e.clientY - y0) < 22) return;
    swiped = true; const n = fits().length; if (n > 1) { pick = (pick + (e.clientY < y0 ? 1 : n - 1)) % n; refresh(); btn.classList.add('turn'); setTimeout(() => btn.classList.remove('turn'), 200); }
  });
  btn.addEventListener('pointerup', e => {
    if (y0 === null) return; y0 = null;
    if (!swiped && shown) { e.stopPropagation(); G.actions[shown].run(); key = ''; refresh(); }
  });
  btn.addEventListener('pointercancel', () => { y0 = null; });
  // keys: T take off, E the action shown (never Take off: that is T), Up/Down turn to the next
  addEventListener('keydown', e => {
    if (e.repeat || G.menu?.open || G.photo || e.target.closest?.('input, textarea')) return;
    const list = fits(), run = id => { G.actions[id].run(); key = ''; refresh(); };
    if (e.code === 'KeyT' && list.includes('takeoff')) run('takeoff');
    else if (e.code === 'KeyE') {
      const cur = list[pick % Math.max(1, list.length)], id = cur && cur !== 'takeoff' ? cur : list.find(i => i !== 'takeoff');
      if (id) run(id);
    } else if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && G.b.state !== 'fly' && list.length > 1) {
      if (list.join(',') !== key) refresh();
      pick = (pick + (e.code === 'ArrowUp' ? 1 : list.length - 1)) % list.length; refresh();
    }
  });
  setInterval(refresh, 150);
  refresh();
}
