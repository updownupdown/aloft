// The pause menu: a sheet of frosted glass (letter.js) in columns. A slim rail on the left keeps
// the mark, "Aloft" on its side, Resume (the biggest thing there) and Quit; then the sections with
// their icons; then the open section's pages (sub-tabs) stacked down a column of their own, when it
// has any; then the open page. Systems add their own section with G.menu.tab(id, title) (it returns
// the pane element), pages inside it with G.menu.page(tab, id, title), and rows with
// G.menu.toggle() / G.menu.button(). Settings (tab 'play') is one column of sections with icons
// (audio, graphics, gameplay, dev tools; each row goes by its label, SECTION_OF); the groups 'bird'
// and 'play' sit in the Game section instead (G.menu.group). G.menu.onOpen(fn) refreshes a pane each time the menu opens; G.menu.subtitle(fn)
// gives the date line that the Map shows.
import { letter } from './letter.js';
import { store } from './util.js';

// where each section sits, whichever system adds it first; others follow in the order added
const ORDER = { map: -1, journal: 1, game: 1.5, play: 2, how: 3 };
const TITLES = { map: 'Map', game: 'Game', play: 'Settings', journal: 'Journal', how: 'How to play' };
// 20-unit line icons for the sections
const ICONS = {
  map: 'M3 5l4.5-2 5 2L17 3v12l-4.5 2-5-2L3 17zM7.5 3v12M12.5 5v12',
  journal: 'M4 3.5h9a2 2 0 0 1 2 2V17H6a2 2 0 0 1-2-2zM4 15a2 2 0 0 1 2-2h9M8 7h4',
  // a feather
  game: 'M16.5 3.5C10 3.5 5.5 8 5 14.5M16.5 3.5c.5 6-3.5 10.5-9.5 11M4 17l3-2.5M9 10.5l3.5-.5M8 13l3 .2',
  // sliders
  play: 'M3 6h3.5M10.5 6H17M3 14h7.5M14.5 14H17M8.5 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12.5 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  how: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7.6 7.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M10 14.5h.01',
};
// groups of rows, in one column, in this order: the section each sits in, its heading and an icon.
// Game: your bird, then play; Settings: audio, graphics, gameplay, dev tools
const GROUPS = {
  bird: ['game', 'Your bird'],
  play: ['game', 'Play'],
  audio: ['play', 'Audio', 'M3 8h3l4-3.5v11L6 12H3zM13 7.5a3.5 3.5 0 0 1 0 5M15.2 5.2a6.6 6.6 0 0 1 0 9.6'],
  graphics: ['play', 'Graphics', 'M2.5 15.5l5-7 3.5 4.5 2.5-3 4 5.5zM13.5 4.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z'],
  gameplay: ['play', 'Gameplay', 'M6 6.5h8a4 4 0 0 1 0 8c-1.4 0-2-1-4-1s-2.6 1-4 1a4 4 0 0 1 0-8zM6 9v3M4.5 10.5h3M13.5 10h.01M15 11.5h.01'],
  dev: ['play', 'Dev tools', 'M7 6l-4 4 4 4M13 6l4 4-4 4M11 4.5l-2 11'],
};
// where each Settings row goes: by its label, else by the group it names (older names: sound, app),
// else gameplay
const SECTION_OF = {
  Sound: 'audio', Music: 'audio', 'Music style': 'audio',
  Graphics: 'graphics', 'Ground detail': 'graphics', 'Full refresh rate': 'graphics',
  'Show frame rate': 'dev', Update: 'dev', 'Music lab': 'dev', 'Bird song lab': 'dev',
};
const OLD = { sound: 'audio', app: 'dev', switch: 'gameplay' };

export function createMenu(G, ui) {
  ui.insertAdjacentHTML('beforeend', `
    <button class="menu3" aria-label="Menu"><i></i><i></i><i></i></button>
    <div class="veil3 hidden">
      <div class="card3" role="dialog" aria-label="Paused">
        <aside class="rail3">
          <h1 data-act="title"><span>Aloft</span></h1>
          <button data-act="resume" class="resume3"><span>Resume</span></button>
          <button data-act="quit" class="quit3" aria-label="Quit" title="Quit (saves your journey)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4.5v12H8M12 6.5L15.5 10 12 13.5M15.5 10H8"/></svg><span>Quit</span></button>
        </aside>
        <nav class="tabs3" role="tablist" aria-orientation="vertical"></nav>
        <nav class="subs3"></nav>
        <div class="panes3"></div>
      </div>
    </div>`);
  const veil = ui.querySelector('.veil3'), card = veil.querySelector('.card3'), nav = card.querySelector('.tabs3'), subs = card.querySelector('.subs3'), panes = card.querySelector('.panes3');
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
    // the section's pages, if it has any, down the third column
    const bar = barOf(id);
    for (const x of subs.children) x.classList.toggle('hidden', x !== bar);
    card.classList.toggle('nosub3', !bar);
    G.emit('menuTab', id);
    if (bar) showPage(id, pages[id]);
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
    if (id === 'play' || id === 'game') pane.innerHTML = `<div class="stack3 ${id}3"></div>`;
    return pane;
  };
  // a page inside a tab, with its own button in the pages column; pages sit in the order given
  const barOf = tab => subs.querySelector(`[data-for=${tab}]`);
  M.page = (tab, id, title, order = 50) => {
    const pane = M.tab(tab);
    let bar = barOf(tab);
    if (!bar) { subs.insertAdjacentHTML('beforeend', `<div class="pagetabs3 hidden" role="tablist" aria-orientation="vertical" data-for="${tab}"></div>`); bar = barOf(tab); }
    let page = pane.querySelector(`:scope > [data-page=${id}]`); if (page) return page;
    const btn = document.createElement('button');
    btn.dataset.page = id; btn.dataset.order = order; btn.setAttribute('role', 'tab'); btn.textContent = title;
    bar.insertBefore(btn, [...bar.children].find(b => +b.dataset.order > order) || null);
    page = document.createElement('div'); page.className = 'page3 hidden'; page.dataset.page = id; pane.append(page);
    if (!bar.querySelector('.on')) showPage(tab, id);
    return page;
  };
  const showPage = (tab, id) => {
    const pane = panes.querySelector(`[data-pane=${tab}]`), bar = barOf(tab); if (!pane || !bar) return;
    if (!bar.querySelector(`[data-page=${id}]`)) id = bar.firstElementChild?.dataset.page;
    pages[tab] = id; store.set('pages3d', pages);
    for (const b of bar.children) { const on = b.dataset.page === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of pane.querySelectorAll(':scope > .page3')) p.classList.toggle('hidden', p.dataset.page !== id);
    panes.scrollTop = 0;
    G.emit('menuPage', tab, id);
  };
  // a group of rows in Game or Settings, by name (GROUPS), made the first time it is asked for
  M.group = name => {
    name = OLD[name] || name;
    const [tab, title, icon] = GROUPS[name] || ['play', name], pane = M.tab(tab);
    let g = pane.querySelector(`[data-group=${name}]`); if (g) return g;
    const c = pane.querySelector('.stack3');
    g = document.createElement('section'); g.className = 'group3'; g.dataset.group = name; g.dataset.rank = Object.keys(GROUPS).indexOf(name);
    g.innerHTML = `<h3>${icon ? `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${icon}"/></svg>` : ''}${title}</h3>`;
    c.insertBefore(g, [...c.children].find(x => +x.dataset.rank > +g.dataset.rank) || null);
    return g;
  };
  const where = (tab, group, label) => tab !== 'play' ? M.tab(tab) : M.group(group === 'bird' || group === 'play' ? group : SECTION_OF[label] || OLD[group] || group || 'gameplay');
  M.toggle = (tab, { label, sub = '', get, set, group = 'switch' }) => {
    const act = 'a' + n++;
    where(tab, group, label).insertAdjacentHTML('beforeend', `<button data-act="${act}" class="sw" role="switch"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><i></i></button>`);
    const el = card.querySelector(`[data-act=${act}]`), refresh = () => { el.classList.toggle('on', !!get()); el.setAttribute('aria-checked', !!get()); };
    M.acts.set(act, () => { set(!get()); refresh(); });
    M.opens.push(refresh); refresh();
    return el;
  };
  // a button row; main: a dark pill (one per group at most); group: where it sits in Settings
  M.button = (tab, { label, sub = '', onClick, href, quiet = false, main = false, group }) => {
    const act = 'a' + n++, cls = main ? 'main3' : quiet ? 'quiet3' : 'btn';
    where(tab, group, label).insertAdjacentHTML('beforeend', href
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
    const pg = e.target.closest('[data-page]'); if (pg?.tagName === 'BUTTON') { showPage(pg.closest('[data-for]').dataset.for, pg.dataset.page); return; }
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'resume') M.set(false); else if (a === 'quit') M.quit?.(); else M.acts.get(a)?.();
  });
  addEventListener('keydown', e => { if ((e.code === 'Escape' || e.code === 'KeyP') && !G.photo) M.set(!M.open); });
  return M;
}
