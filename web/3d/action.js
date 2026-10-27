// The action buttons, bottom right: one pill for each action that fits now (Eat with a catch in your
// feet, Drink by fresh water, Sleep on a roost at night, Leave it here with a catch on a branch, ...),
// side by side, Take off always the rightmost (James 10-27: not one button to swipe). Keys: T takes off,
// E runs the first that isn't Take off. Each action comes from the system that owns it (G.actions:
// takeoff in main.js, sleep in sys/sleep.js) as { run(), when() }; one not in ACTS names itself with
// label and icon (a string or a function: sys/quests.js, Make this your ledge).
import { icon } from './icons.js';

const ACTS = {
  eat: ['Eat', 'prey'],
  berries: ['Eat', 'berry'],
  drink: ['Drink', 'thirst'],
  leave: ['Leave it here', 'nest'],
  sleep: ['Sleep', 'sleep'],
  takeoff: ['Take off', 'takeoff'],
};
const ORDER = ['eat', 'berries', 'drink', 'sleep', 'leave'];   // left to right (then the others' own, in the order added, then Take off)

export function actionButton(G, ui) {
  ui.insertAdjacentHTML('beforeend', `<div class="acts3"></div>`);
  ui.classList.add('act3on');   // (the old separate Take off, Eat and Sleep buttons stay hidden)
  const row = ui.querySelector('.acts3');
  let key = '';

  function fits() {
    const own = Object.keys(G.actions || {}).filter(id => !ORDER.includes(id) && id !== 'takeoff');
    return [...ORDER, ...own, 'takeoff'].filter(id => G.actions?.[id]?.when?.());
  }
  const named = id => { const a = G.actions[id], v = f => typeof f === 'function' ? f() : f; return ACTS[id] || [v(a.label) || id, v(a.icon) || 'keepsake']; };
  function refresh() {
    const list = !G.menu?.open ? fits() : [];
    const k = list.map(id => id + named(id).join()).join('|');
    if (k === key) return; key = k;
    row.innerHTML = list.map(id => { const [name, ik] = named(id); return `<button class="act3${id === 'takeoff' ? ' go3' : ''}" data-act="${id}" aria-label="${name}"><i class="ic">${icon(ik)}</i><span>${name}</span></button>`; }).join('');
  }
  row.addEventListener('pointerdown', e => { if (e.target.closest('.act3')) { e.preventDefault(); e.stopPropagation(); G.audio.unlock?.(); } });
  row.addEventListener('pointerup', e => {
    const id = e.target.closest('.act3')?.dataset.act; if (!id || !G.actions?.[id]) return;
    e.stopPropagation(); G.actions[id].run(); key = ''; refresh();
  });
  // keys: T take off, E the first action that isn't Take off
  addEventListener('keydown', e => {
    if (e.repeat || G.menu?.open || G.photo || e.target.closest?.('input, textarea')) return;
    const list = fits(), run = id => { G.actions[id].run(); key = ''; refresh(); };
    if (e.code === 'KeyT' && list.includes('takeoff')) run('takeoff');
    else if (e.code === 'KeyE') { const id = list.find(i => i !== 'takeoff'); if (id) run(id); }
  });
  setInterval(refresh, 150);
  refresh();
}
