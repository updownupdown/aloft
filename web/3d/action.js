// One action button, bottom middle (placed by sys/songs.css): it shows the one action that fits now
// (Sleep on a roost at night, else Take off), and a swipe up or down on it turns to the other when
// both fit, shown as dots. Each action comes from the system that owns it (G.actions: takeoff in
// main.js, sleep in sys/sleep.js) as { run(), when() }. Settings can turn it off for the separate
// buttons.
const ACTS = {
  sleep: ['Sleep', 'M13.5 4.5a6 6 0 1 0 2 9.5 5 5 0 0 1-2-9.5z'],
  takeoff: ['Take off', 'M10 16V4M5 9l5-5 5 5'],
};
const ORDER = ['sleep', 'takeoff'];   // the first that fits is shown first

export function actionButton(G, ui) {
  ui.insertAdjacentHTML('beforeend', `<button class="act3 gone" aria-label=""><svg viewBox="0 0 20 20" aria-hidden="true"><path d=""/></svg><span></span><i class="dots"></i></button>`);
  const btn = ui.querySelector('.act3'), path = btn.querySelector('path'), label = btn.querySelector('span'), dots = btn.querySelector('.dots');
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
    const [name, d] = ACTS[shown];
    if (label.textContent !== name) { label.textContent = name; path.setAttribute('d', d); btn.setAttribute('aria-label', name); btn.dataset.act = shown; }
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
  setInterval(refresh, 150);
  refresh();
}
