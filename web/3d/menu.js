// The pause menu: a low-poly letter, its sections down the left margin (letter.js
// paints it). Systems add their own tab with G.menu.tab(id, title) (it returns the pane element)
// and rows with G.menu.toggle() / G.menu.button(). G.menu.onOpen(fn) refreshes a pane each time
// the menu opens; G.menu.subtitle(fn) writes the line opposite the title.
import { letter } from './letter.js';
import { store } from './util.js';

// where each section sits, whichever system adds it first; others follow in the order added
const ORDER = { play: 0, journal: 1, songs: 2, how: 3 };
const TITLES = { play: 'Settings', journal: 'Journal', songs: 'Songs', how: 'How to play' };

export function createMenu(G, ui) {
  ui.insertAdjacentHTML('beforeend', `
    <button class="menu3" aria-label="Menu"><i></i><i></i><i></i></button>
    <div class="veil3 hidden">
      <div class="card3" role="dialog" aria-label="Paused">
        <h1 data-act="title">Aloft</h1><p class="sub3"></p>
        <nav class="tabs3" role="tablist"></nav>
        <div class="panes3"></div>
        <footer class="foot3"><button data-act="resume" class="resume3">Resume</button></footer>
      </div>
    </div>`);
  const veil = ui.querySelector('.veil3'), card = veil.querySelector('.card3'), nav = card.querySelector('.tabs3'), panes = card.querySelector('.panes3');
  const button = ui.querySelector('.menu3');
  const repaint = letter(card);
  const M = { open: false, opens: [], acts: new Map(), sub: null };
  let current = null, n = 0, added = 0;
  const show = id => {
    if (!nav.querySelector(`[data-tab=${id}]`)) id = nav.firstElementChild?.dataset.tab;
    current = id; store.set('tab3d', id);
    for (const b of nav.children) { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of panes.children) p.classList.toggle('hidden', p.dataset.pane !== id);
    panes.scrollTop = 0;
    G.emit('menuTab', id);
    repaint();
  };
  M.tab = (id, title) => {
    let pane = panes.querySelector(`[data-pane=${id}]`); if (pane) return pane;
    const rank = ORDER[id] ?? 10 + added++;
    const btn = document.createElement('button');
    btn.dataset.tab = id; btn.dataset.rank = rank; btn.setAttribute('role', 'tab'); btn.textContent = TITLES[id] || title || id;
    nav.insertBefore(btn, [...nav.children].find(b => +b.dataset.rank > rank) || null);
    panes.insertAdjacentHTML('beforeend', `<section class="pane3 hidden" data-pane="${id}"></section>`);
    return panes.querySelector(`[data-pane=${id}]`);
  };
  M.toggle = (tab, { label, sub = '', get, set }) => {
    const act = 'a' + n++;
    M.tab(tab).insertAdjacentHTML('beforeend', `<button data-act="${act}" class="sw" role="switch"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><i></i></button>`);
    const el = card.querySelector(`[data-act=${act}]`), refresh = () => { el.classList.toggle('on', !!get()); el.setAttribute('aria-checked', !!get()); };
    M.acts.set(act, () => { set(!get()); refresh(); });
    M.opens.push(refresh); refresh();
    return el;
  };
  M.button = (tab, { label, sub = '', onClick, href, quiet = false }) => {
    const act = 'a' + n++, cls = quiet ? 'quiet3' : 'btn';
    M.tab(tab).insertAdjacentHTML('beforeend', href
      ? `<a data-act="${act}" class="${cls}" href="${href}">${label}${sub ? ` <em>${sub}</em>` : ''}</a>`
      : `<button data-act="${act}" class="${cls}">${label}${sub ? ` <em>${sub}</em>` : ''}</button>`);
    const el = card.querySelector(`[data-act=${act}]`);
    if (onClick) M.acts.set(act, () => onClick(el));
    return el;
  };
  M.onOpen = fn => M.opens.push(fn);
  M.subtitle = fn => { M.sub = fn; };
  M.repaint = repaint;
  M.hideButton = h => button.classList.toggle('hidden', h);
  M.set = on => {
    if (on === M.open) return;
    M.open = G.paused = on; veil.classList.toggle('hidden', !on); ui.classList.toggle('menu-open', on);
    if (on) {
      card.querySelector('.sub3').textContent = M.sub ? M.sub() : 'Paused';
      for (const f of M.opens) f();
      show(current || store.get('tab3d', 'play'));
      G.emit('pause');
    } else G.emit('resume');
  };
  button.addEventListener('click', () => { G.emit('gesture'); M.set(!M.open); });
  veil.addEventListener('click', e => {
    if (e.target === veil) { M.set(false); return; }
    const t = e.target.closest('[data-tab]'); if (t) { show(t.dataset.tab); return; }
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'resume') M.set(false); else M.acts.get(a)?.();
  });
  addEventListener('keydown', e => { if ((e.code === 'Escape' || e.code === 'KeyP') && !G.photo) M.set(!M.open); });
  return M;
}
