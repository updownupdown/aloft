// The pause menu: a sheet of frosted glass (letter.js), the sections as tabs with icons in a column
// on the left (Quit at its top, Resume always at its foot) and the open section on the right.
// Systems add their own tab with G.menu.tab(id, title) (it returns the pane element), pages inside
// a tab with G.menu.page(tab, id, title) (sub-tabs), and rows with G.menu.toggle() /
// G.menu.button(). Settings has two columns: switches gather under their own heading, buttons in
// the group they name (G.menu.group). G.menu.onOpen(fn) refreshes a pane each time the menu opens;
// G.menu.subtitle(fn) gives the date line that the Map shows.
import { letter } from './letter.js';
import { store } from './util.js';

// where each section sits, whichever system adds it first; others follow in the order added
const ORDER = { map: -1, journal: 1, play: 2, how: 3 };
const TITLES = { map: 'Map', play: 'Settings', journal: 'Journal', how: 'How to play' };
// 20-unit line icons for the tabs
const ICONS = {
  map: 'M3 5l4.5-2 5 2L17 3v12l-4.5 2-5-2L3 17zM7.5 3v12M12.5 5v12',
  journal: 'M4 3.5h9a2 2 0 0 1 2 2V17H6a2 2 0 0 1-2-2zM4 15a2 2 0 0 1 2-2h9M8 7h4',
  play: 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8',
  how: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7.6 7.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M10 14.5h.01',
};
// Settings' columns: the switches, then the named groups in this order
const GROUPS = { bird: [1, 'Your bird'], play: [1, 'Play'], sound: [2, 'Sound and music'], app: [2, 'The app'] };

export function createMenu(G, ui) {
  ui.insertAdjacentHTML('beforeend', `
    <button class="menu3" aria-label="Menu"><i></i><i></i><i></i></button>
    <div class="veil3 hidden">
      <div class="card3" role="dialog" aria-label="Paused">
        <aside class="side3">
          <div class="head3"><h1 data-act="title">Aloft</h1><button data-act="quit" class="quit3" aria-label="Quit" title="Quit (saves your journey)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4.5v12H8M12 6.5L15.5 10 12 13.5M15.5 10H8"/></svg></button></div>
          <nav class="tabs3" role="tablist" aria-orientation="vertical"></nav>
          <button data-act="resume" class="resume3">Resume</button>
        </aside>
        <div class="panes3"></div>
      </div>
    </div>`);
  const veil = ui.querySelector('.veil3'), card = veil.querySelector('.card3'), nav = card.querySelector('.tabs3'), panes = card.querySelector('.panes3');
  const button = ui.querySelector('.menu3');
  const repaint = letter(card);
  const M = { open: false, opens: [], acts: new Map(), sub: null, quit: null };
  let current = null, n = 0, added = 0;
  const pages = store.get('pages3d', {});
  const show = id => {
    if (!nav.querySelector(`[data-tab=${id}]`)) id = nav.firstElementChild?.dataset.tab;
    current = id; store.set('tab3d', id);
    for (const b of nav.children) { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of panes.children) p.classList.toggle('hidden', p.dataset.pane !== id);
    panes.scrollTop = 0;
    const pane = panes.querySelector(`[data-pane=${id}]`);
    panes.classList.toggle('flush3', !!pane?.classList.contains('flush3'));
    G.emit('menuTab', id);
    if (pane?.querySelector(':scope > .pagetabs3')) showPage(id, pages[id]);
    repaint();
  };
  M.tab = (id, title) => {
    let pane = panes.querySelector(`[data-pane=${id}]`); if (pane) return pane;
    const rank = ORDER[id] ?? 10 + added++;
    const btn = document.createElement('button');
    btn.dataset.tab = id; btn.dataset.rank = rank; btn.setAttribute('role', 'tab');
    btn.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${ICONS[id] || 'M10 10h.01'}"/></svg><span>${TITLES[id] || title || id}</span>`;
    nav.insertBefore(btn, [...nav.children].find(b => +b.dataset.rank > rank) || null);
    panes.insertAdjacentHTML('beforeend', `<section class="pane3 hidden" data-pane="${id}"></section>`);
    pane = panes.querySelector(`[data-pane=${id}]`);
    if (id === 'play') pane.innerHTML = '<div class="settings3"><div class="col3" data-col="1"></div><div class="col3" data-col="2"><div class="sw3"><h3>Switches</h3></div></div></div>';
    return pane;
  };
  // a page inside a tab, with its own small tab; pages sit in the order given
  M.page = (tab, id, title, order = 50) => {
    const pane = M.tab(tab);
    let bar = pane.querySelector(':scope > .pagetabs3');
    if (!bar) { pane.insertAdjacentHTML('afterbegin', '<nav class="pagetabs3" role="tablist"></nav>'); bar = pane.firstElementChild; }
    let page = pane.querySelector(`:scope > [data-page=${id}]`); if (page) return page;
    const btn = document.createElement('button');
    btn.dataset.page = id; btn.dataset.order = order; btn.setAttribute('role', 'tab'); btn.textContent = title;
    bar.insertBefore(btn, [...bar.children].find(b => +b.dataset.order > order) || null);
    page = document.createElement('div'); page.className = 'page3 hidden'; page.dataset.page = id; pane.append(page);
    if (!bar.querySelector('.on')) showPage(tab, id);
    return page;
  };
  const showPage = (tab, id) => {
    const pane = panes.querySelector(`[data-pane=${tab}]`), bar = pane?.querySelector(':scope > .pagetabs3'); if (!bar) return;
    if (!bar.querySelector(`[data-page=${id}]`)) id = bar.firstElementChild?.dataset.page;
    pages[tab] = id; store.set('pages3d', pages);
    for (const b of bar.children) { const on = b.dataset.page === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of pane.querySelectorAll(':scope > .page3')) p.classList.toggle('hidden', p.dataset.page !== id);
    panes.scrollTop = 0;
    G.emit('menuPage', tab, id);
  };
  // a group of Settings buttons, by name (GROUPS), made the first time it is asked for
  M.group = name => {
    const pane = M.tab('play'), [col, title] = GROUPS[name] || [2, name];
    let g = pane.querySelector(`[data-group=${name}]`); if (g) return g;
    const c = pane.querySelector(`[data-col="${col}"]`);
    g = document.createElement('div'); g.className = 'group3'; g.dataset.group = name; g.dataset.rank = Object.keys(GROUPS).indexOf(name);
    g.innerHTML = `<h3>${title}</h3>`;
    c.insertBefore(g, [...c.children].find(x => +x.dataset.rank > +g.dataset.rank) || null);
    return g;
  };
  const where = (tab, group) => tab !== 'play' ? M.tab(tab) : group === 'switch' ? M.tab('play').querySelector('.sw3') : M.group(group || 'app');
  M.toggle = (tab, { label, sub = '', get, set, group = 'switch' }) => {
    const act = 'a' + n++;
    where(tab, group).insertAdjacentHTML('beforeend', `<button data-act="${act}" class="sw" role="switch"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><i></i></button>`);
    const el = card.querySelector(`[data-act=${act}]`), refresh = () => { el.classList.toggle('on', !!get()); el.setAttribute('aria-checked', !!get()); };
    M.acts.set(act, () => { set(!get()); refresh(); });
    M.opens.push(refresh); refresh();
    return el;
  };
  // a button row; main: a dark pill (one per group at most); group: where it sits in Settings
  M.button = (tab, { label, sub = '', onClick, href, quiet = false, main = false, group }) => {
    const act = 'a' + n++, cls = main ? 'main3' : quiet ? 'quiet3' : 'btn';
    where(tab, group).insertAdjacentHTML('beforeend', href
      ? `<a data-act="${act}" class="${cls}" href="${href}">${label}${sub ? ` <em>${sub}</em>` : ''}</a>`
      : `<button data-act="${act}" class="${cls}">${label}${sub ? ` <em>${sub}</em>` : ''}</button>`);
    const el = card.querySelector(`[data-act=${act}]`);
    if (onClick) M.acts.set(act, () => onClick(el));
    return el;
  };
  M.onOpen = fn => M.opens.push(fn);
  M.subtitle = fn => { M.sub = fn; };
  M.date = () => M.sub ? M.sub() : '';
  M.repaint = repaint;
  M.hideButton = h => button.classList.toggle('hidden', h);
  // open (on a given tab, and page, if named) or close
  M.set = (on, tab, page) => {
    if (on && tab) current = tab;
    if (on && tab && page) pages[tab] = page;
    if (on === M.open) { if (on && tab) show(tab); return; }
    M.open = G.paused = on; veil.classList.toggle('hidden', !on); ui.classList.toggle('menu-open', on);
    if (on) {
      for (const f of M.opens) f();
      show(current || store.get('tab3d', 'play'));
      G.emit('pause');
    } else G.emit('resume');
  };
  button.addEventListener('click', () => { G.emit('gesture'); M.set(!M.open); });
  veil.addEventListener('click', e => {
    if (e.target === veil) { M.set(false); return; }
    const t = e.target.closest('[data-tab]'); if (t) { show(t.dataset.tab); return; }
    const pg = e.target.closest('[data-page]'); if (pg?.tagName === 'BUTTON') { showPage(pg.closest('.pane3').dataset.pane, pg.dataset.page); return; }
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'resume') M.set(false); else if (a === 'quit') M.quit?.(); else M.acts.get(a)?.();
  });
  addEventListener('keydown', e => { if ((e.code === 'Escape' || e.code === 'KeyP') && !G.photo) M.set(!M.open); });
  return M;
}
