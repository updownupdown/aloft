// The pause menu: a sheet of frosted glass (letter.js) in columns. A slim rail on the left keeps
// the mark, "Aloft" on its side, Resume (the biggest thing there) and Quit; then the sections with
// their icons; then the open section's pages (sub-tabs) stacked down a column of their own, when it
// has any; then the open page. Systems add their own section with G.menu.tab(id, title) (it returns
// the pane element), pages inside it with G.menu.page(tab, id, title), and rows with
// G.menu.toggle() / G.menu.button() / G.menu.choice() (radio buttons). Settings (tab 'play') is one column of sections with icons
// (audio, graphics, gameplay, dev tools; each row goes by its label, SECTION_OF); the groups 'bird'
// and 'play' sit in the Game section instead (G.menu.group). G.menu.onOpen(fn) refreshes a pane each time the menu opens; G.menu.subtitle(fn)
// gives the date line that the Map shows.
import { letter } from './letter.js';
import { store } from './util.js';
import { icon } from './icons.js';
import { createDev } from './dev.js';

// where each section sits, whichever system adds it first; others follow in the order added
const ORDER = { map: -1, journal: 1, game: 1.5, play: 2, how: 3 };
const TITLES = { map: 'Map', game: 'Game', play: 'Settings', journal: 'Journal', how: 'How to play' };
// the sections' icons (icons.js), by section id
const ICON_OF = { map: 'map', journal: 'journal', game: 'game', play: 'settings', how: 'how' };
// the pages' icons, by page id (pages without one have none)
const PAGE_ICON = { log: 'log', songs: 'songs', lands: 'lands', landmarks: 'landmarks', guide: 'guide', album: 'album' };
// groups of rows, in one column, in this order: the section each sits in, its heading and its icon.
// Game: your bird, then play; Settings: audio, graphics, gameplay, dev tools
const GROUPS = {
  bird: ['game', 'Your bird'],
  play: ['game', 'Play'],
  audio: ['play', 'Audio', 'audio'],
  graphics: ['play', 'Graphics', 'graphics'],
  gameplay: ['play', 'Gameplay', 'gameplay'],
  dev: ['play', 'Dev tools', 'dev'],
};
// where each Settings row goes: by its label, else by the group it names (older names: sound, app),
// else gameplay
const SECTION_OF = {
  Sound: 'audio', Music: 'audio', 'Music style': 'audio', 'Music volume': 'audio', 'Wind volume': 'audio', 'Birds and effects': 'audio',
  Graphics: 'graphics', 'Ground detail': 'graphics', 'Frame rate': 'graphics', 'Battery use': 'graphics',
  'Show frame rate': 'dev', 'Feature list': 'dev', Update: 'dev', 'Music lab': 'dev', 'Bird song lab': 'dev',
};
const OLD = { sound: 'audio', app: 'dev', switch: 'gameplay' };
// rows that keep a set order within their section, whichever system adds them first; the rest follow
const ROW_ORDER = { Graphics: 1, 'Frame rate': 2, 'Ground detail': 3, 'Battery use': 4 };

export function createMenu(G, ui) {
  ui.insertAdjacentHTML('beforeend', `
    <button class="menu3" aria-label="Menu">${icon('menu')}</button>
    <div class="veil3 hidden">
      <div class="card3" role="dialog" aria-label="Paused">
        <aside class="rail3">
          <h1 data-act="title"><span>Aloft</span></h1>
          <button data-act="resume" class="resume3">${icon('resume')}<span>Resume</span></button>
          <button data-act="quit" class="quit3" aria-label="Quit" title="Quit (saves your journey)">${icon('quit')}<span>Quit</span></button>
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
    btn.innerHTML = `${icon(ICON_OF[id] || id)}<span>${TITLES[id] || title || id}</span>`;
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
    btn.dataset.page = id; btn.dataset.order = order; btn.setAttribute('role', 'tab'); btn.innerHTML = `${PAGE_ICON[id] ? icon(PAGE_ICON[id]) : ''}<span>${title}</span>`;
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
    const [tab, title, ic] = GROUPS[name] || ['play', name], pane = M.tab(tab);
    let g = pane.querySelector(`[data-group=${name}]`); if (g) return g;
    const c = pane.querySelector('.stack3');
    g = document.createElement('section'); g.className = 'group3'; g.dataset.group = name; g.dataset.rank = Object.keys(GROUPS).indexOf(name);
    g.innerHTML = `<h3>${ic ? icon(ic) : ''}${title}</h3>`;
    c.insertBefore(g, [...c.children].find(x => +x.dataset.rank > +g.dataset.rank) || null);
    return g;
  };
  const seat = (el, label) => {
    el.dataset.row = ROW_ORDER[label] ?? 99;
    el.parentNode.insertBefore(el, [...el.parentNode.children].find(x => x.dataset.row && +x.dataset.row > +el.dataset.row) || null);
  };
  const where = (tab, group, label) => tab !== 'play' ? M.tab(tab) : M.group(group === 'bird' || group === 'play' ? group : SECTION_OF[label] || OLD[group] || group || 'gameplay');
  M.toggle = (tab, { label, sub = '', get, set, group = 'switch' }) => {
    const act = 'a' + n++;
    where(tab, group, label).insertAdjacentHTML('beforeend', `<button data-act="${act}" class="sw" role="switch"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><i></i></button>`);
    const el = card.querySelector(`[data-act=${act}]`), refresh = () => { el.classList.toggle('on', !!get()); el.setAttribute('aria-checked', !!get()); };
    seat(el, label);
    M.acts.set(act, () => { set(!get()); refresh(); });
    M.opens.push(refresh); refresh();
    return el;
  };
  // a row of choices with one picked (radio buttons): options [[value, label]...]; sub(value) says
  // what the pick means
  M.choice = (tab, { label, sub = () => '', options, get, set, group }) => {
    const act = 'a' + n++;
    where(tab, group, label).insertAdjacentHTML('beforeend', `<div class="choice3" role="radiogroup" aria-label="${label}"><span>${label}<small></small></span>` +
      `<div>${options.map(([, t], i) => `<button data-act="${act}" data-i="${i}" role="radio">${t}</button>`).join('')}</div></div>`);
    const btns = [...card.querySelectorAll(`[data-act=${act}]`)], el = btns[0].closest('.choice3');
    seat(el, label);
    const refresh = () => {
      const v = get(); el.querySelector('small').textContent = sub(v);
      btns.forEach((b, i) => { const on = options[i][0] === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    };
    M.acts.set(act, b => { set(options[+b.dataset.i][0]); refresh(); });
    M.opens.push(refresh); refresh();
    return { el, refresh };
  };
  // a slider from 0 to 100%: get() and set(v) take 0..1
  M.range = (tab, { label, sub = '', get, set, group }) => {
    const act = 'a' + n++;
    where(tab, group, label).insertAdjacentHTML('beforeend', `<label class="range3" data-range="${act}"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><input type="range" min="0" max="100" step="5" aria-label="${label}"><b></b></label>`);
    const el = card.querySelector(`[data-range=${act}]`), input = el.querySelector('input'), out = el.querySelector('b');
    seat(el, label);
    const show = () => { out.textContent = input.value + '%'; input.style.setProperty('--v', input.value + '%'); };
    const refresh = () => { input.value = Math.round(get() * 100); show(); };
    input.addEventListener('input', () => { set(input.value / 100); show(); });
    M.opens.push(refresh); refresh();
    return { el, refresh };
  };
  // a button row; main: a dark pill (one per group at most); group: where it sits in Settings
  M.button = (tab, { label, sub = '', onClick, href, quiet = false, main = false, group }) => {
    const act = 'a' + n++, cls = main ? 'main3' : quiet ? 'quiet3' : 'btn';
    where(tab, group, label).insertAdjacentHTML('beforeend', href
      ? `<a data-act="${act}" class="${cls}" href="${href}">${label}${sub ? ` <em>${sub}</em>` : ''}</a>`
      : `<button data-act="${act}" class="${cls}">${label}${sub ? ` <em>${sub}</em>` : ''}</button>`);
    const el = card.querySelector(`[data-act=${act}]`);
    seat(el, label);
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
    if (a === 'resume') M.set(false); else if (a === 'quit') M.quit?.(); else M.acts.get(a)?.(e.target.closest('[data-act]'));
  });
  addEventListener('keydown', e => { if ((e.code === 'Escape' || e.code === 'KeyP') && !G.photo) M.set(!M.open); });
  G.dev = createDev(G, M);   // Settings > Dev tools > Feature list (dev.js)
  return M;
}
