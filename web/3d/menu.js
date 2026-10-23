// The pause menu: a sheet of frosted glass (letter.js), tidied (James's pick A, 2026-10-23). On the
// left, the mark and "Aloft" with Quit beside them, the sections (Today: how am I, what now; Map:
// where have I been; Journal: what has happened; Guide: who lives here; How to play; Settings), and
// Resume, a dark pill, at the bottom. Then the open section's title with its pages down a column of
// their own (James, 2026-10-23: easier to reach than pills along the top), then the page. Systems add a section with
// G.menu.tab(id, title) (it returns the pane element), pages inside it with G.menu.page(tab, id,
// title, order), and rows with G.menu.toggle() / button() / choice() (radio buttons) / range().
// Settings rows (tab 'play') go to a page by their label (SECTION_OF), else by the group they name:
// Sound, Picture, Controls, Messages, Journey, Advanced. The old Game section's rows went to Today
// (Photo mode, ghost flights) and Settings > Journey (your bird, new journey, new world).
// G.menu.onOpen(fn) refreshes a pane each time the menu opens; G.menu.subtitle(fn) gives the date line
// at the top of Today.
import { letter } from './letter.js';
import { store } from './util.js';
import { icon } from './icons.js';
import { createDev } from './dev.js';
import { createToday } from './today.js';

// where each section sits, whichever system adds it first; others follow in the order added
const ORDER = { today: 0, map: 1, journal: 2, how: 4, play: 5 };
const TITLES = { today: 'Today', map: 'Map', journal: 'Journal', play: 'Settings', how: 'How to play' };
const ICON_OF = { today: 'today', map: 'map', journal: 'journal', play: 'settings', how: 'how' };
// older names: the Game section is Today now, the Guide's pages are in the Journal
const ALIAS = { game: 'today', guide: 'journal' };
// Settings, a page each (title, order)
const PAGES = { audio: ['Sound', 10], graphics: ['Graphics', 20], gameplay: ['Controls', 30], messages: ['Messages', 40], journey: ['Journey', 50], dev: ['Advanced', 60] };
// groups of rows: the page each sits on, its heading (none: the pill names it) and its place on the page;
// 'today' is the row of things to do on Today
const GROUPS = {
  bird: ['journey', 'Your bird', 0], journey: ['journey', '', 1],
  audio: ['audio', '', 0], graphics: ['graphics', '', 0], gameplay: ['gameplay', '', 0], messages: ['messages', '', 0], dev: ['dev', '', 0], looks: ['dev', 'Look tests', 1],
};
// where each Settings row goes: by its label, else by the group it names (OLD names too), else Controls
const SECTION_OF = {
  'Sound effects': 'audio', Music: 'audio', 'Music style': 'audio', 'Music volume': 'audio', 'Wind volume': 'audio', 'Birds and effects': 'audio',
  Graphics: 'graphics', 'Ground detail': 'graphics', Clouds: 'graphics', 'Frame rate': 'graphics', 'Battery use': 'graphics', 'Rest at 30 fps': 'graphics',
  'Photo mode': 'today', 'Share a ghost flight': 'today', 'Start a new journey': 'journey', 'Start a new world': 'journey',
  'Show frame rate': 'dev', 'Feature list': 'dev', Update: 'dev', 'Music lab': 'dev', 'Bird song lab': 'dev',
};
const OLD = { sound: 'audio', app: 'dev', switch: 'gameplay', play: 'journey' };
// rows that keep a set order within their page, whichever system adds them first; the rest follow
const ROW_ORDER = { Graphics: 1, 'Frame rate': 2, 'Rest at 30 fps': 3, 'Ground detail': 4, 'Battery use': 90,
  'Sound effects': 1, 'Wind volume': 2, 'Birds and effects': 3, Music: 4, 'Music style': 5, 'Music volume': 6, Clouds: 6, 'Photo mode': 1, 'Share a ghost flight': 2 };
// rows that sit under a switch, and are greyed out while it is off (by label)
const UNDER = { 'Wind volume': 'Sound effects', 'Birds and effects': 'Sound effects', 'Music volume': 'Music', 'Music style': 'Music' };
// pages that moved: How to play > Hints is Settings > Messages
const MOVED = { 'how/hints': ['play', 'messages'] };

export function createMenu(G, ui) {
  ui.insertAdjacentHTML('beforeend', `
    <button class="menu3" aria-label="Menu">${icon('menu')}</button>
    <div class="veil3 hidden">
      <div class="card3" role="dialog" aria-label="Paused">
        <aside class="rail3">
          <div class="top3"><h1 data-act="title"><span>Aloft</span></h1><button data-act="quit" class="icb3" aria-label="Quit" title="Quit (saves your journey)">${icon('quit')}</button></div>
          <nav class="tabs3" role="tablist" aria-orientation="vertical"></nav>
          <button data-act="resume" class="resume3">${icon('resume')}<span>Resume</span></button>
        </aside>
        <nav class="subs3"><h2></h2></nav>
        <div class="panes3"></div>
      </div>
    </div>`);
  const veil = ui.querySelector('.veil3'), card = veil.querySelector('.card3'), nav = card.querySelector('.tabs3');
  const subs = card.querySelector('.subs3'), panes = card.querySelector('.panes3'), h2 = subs.querySelector('h2');
  const button = ui.querySelector('.menu3');
  // Resume stands as tall as the section buttons above it (they grow with the room the rail has)
  new ResizeObserver(() => { const h = nav.firstElementChild?.offsetHeight; if (h) card.style.setProperty('--tabh', `${h}px`); }).observe(nav);
  const repaint = letter(card);
  const M = { open: false, opens: [], acts: new Map(), sub: null, quit: null };
  let current = null, n = 0, added = 0;
  const switches = {}, deps = [];   // each switch's get() by label; the refreshes of rows under one
  const pages = store.get('pages3d', {}), infos = {};
  const show = id => {
    id = ALIAS[id] || id;
    if (!panes.querySelector(`[data-pane=${id}]`)) id = nav.firstElementChild?.dataset.tab;
    current = id; store.set('tab3d', id);
    for (const b of nav.children) { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of panes.children) p.classList.toggle('hidden', p.dataset.pane !== id);
    panes.scrollTop = 0;
    const pane = panes.querySelector(`[data-pane=${id}]`);
    panes.classList.toggle('flush3', !!pane?.classList.contains('flush3'));
    h2.textContent = pane?.dataset.title || '';
    // the section's pages, if it has any, down their own column under its title
    const bar = barOf(id);
    for (const x of subs.querySelectorAll('.pagetabs3')) x.classList.toggle('hidden', x !== bar);
    card.classList.toggle('nosub3', !bar);
    G.emit('menuTab', id);
    if (bar) showPage(id, pages[id]);
    repaint();
  };
  M.tab = (id, title) => {
    id = ALIAS[id] || id;
    let pane = panes.querySelector(`[data-pane=${id}]`); if (pane) return pane;
    const name = TITLES[id] || title || id, btn = document.createElement('button');
    btn.dataset.tab = id; btn.setAttribute('role', 'tab');
    const rank = ORDER[id] ?? 10 + added++;
    btn.dataset.rank = rank; btn.innerHTML = `${icon(ICON_OF[id] || id)}<span>${name}</span>`;
    nav.insertBefore(btn, [...nav.children].find(b => +b.dataset.rank > rank) || null);
    panes.insertAdjacentHTML('beforeend', `<section class="pane3 hidden" data-pane="${id}" data-title="${name}"></section>`);
    return panes.querySelector(`[data-pane=${id}]`);
  };
  // a page inside a tab, with its own button in the pages column; pages sit in the order given
  const barOf = tab => subs.querySelector(`[data-for=${tab}]`);
  M.page = (tab, id, title, order = 50) => {
    tab = ALIAS[tab] || tab;
    const moved = MOVED[`${tab}/${id}`];
    if (moved) {   // a page that lives inside another now: its own box at the foot of that page
      const host = M.page(moved[0], moved[1], PAGES[moved[1]]?.[0] || title, PAGES[moved[1]]?.[1]);
      let box = host.querySelector(`:scope > [data-moved=${id}]`);
      if (!box) { box = document.createElement('div'); box.dataset.moved = id; host.append(box); }
      return box;
    }
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
    let flush = pane.classList.contains('flush3');
    for (const p of pane.querySelectorAll(':scope > .page3')) { const on = p.dataset.page === id; p.classList.toggle('hidden', !on); if (on && p.classList.contains('flush3')) flush = true; }
    if (tab === current) panes.classList.toggle('flush3', flush);
    panes.scrollTop = 0;
    if (tab === current) bar.querySelector('.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    G.emit('menuPage', tab, id);
  };
  // a short line for a section (the date on Today, today.js shows it)
  M.info = (tab, fn) => { infos[tab] = fn; };
  M.infoOf = tab => infos[tab]?.() || '';
  // a group of rows, by name (GROUPS), made the first time it is asked for: a pale panel on its
  // Settings page, or the row of things to do on Today
  M.group = name => {
    name = OLD[name] || name;
    if (name === 'today') return M.todo;
    const [pg, title, rank] = GROUPS[name] || ['gameplay', name, 9], page = M.page('play', pg, ...PAGES[pg]);
    let g = page.querySelector(`[data-group=${name}]`); if (g) return g;
    let c = page.querySelector(':scope > .stack3');
    if (!c) { c = document.createElement('div'); c.className = 'stack3'; page.prepend(c); }
    g = document.createElement('section'); g.className = 'group3'; g.dataset.group = name; g.dataset.rank = rank;
    if (title) g.innerHTML = `<h3>${title}</h3>`;
    c.insertBefore(g, [...c.children].find(x => +x.dataset.rank > rank) || null);
    return g;
  };
  const seat = (el, label) => {
    el.dataset.row = ROW_ORDER[label] ?? 99;
    el.parentNode.insertBefore(el, [...el.parentNode.children].find(x => x.dataset.row && +x.dataset.row > +el.dataset.row) || null);
  };
  const where = (tab, group, label) => tab !== 'play' && tab !== 'game' ? M.tab(tab) : M.group(SECTION_OF[label] || OLD[group] || group || 'gameplay');
  M.toggle = (tab, { label, sub = '', get, set, group = 'switch' }) => {
    const act = 'a' + n++;
    where(tab, group, label).insertAdjacentHTML('beforeend', `<button data-act="${act}" class="sw" role="switch"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><i></i></button>`);
    const el = card.querySelector(`[data-act=${act}]`), refresh = () => { el.classList.toggle('on', !!get()); el.setAttribute('aria-checked', !!get()); };
    seat(el, label);
    switches[label] = get;
    M.acts.set(act, () => { set(!get()); refresh(); for (const f of deps) f(); });
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
    const live = () => { const off = !!UNDER[label] && switches[UNDER[label]]?.() === false; el.classList.toggle('off3', off); input.disabled = off; };
    const refresh = () => { input.value = Math.round(get() * 100); show(); live(); };
    if (UNDER[label]) { el.classList.add('under3'); deps.push(live); }
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
    tab = ALIAS[tab] || tab;
    if (MOVED[`${tab}/${page}`]) [tab, page] = MOVED[`${tab}/${page}`];
    if (on && tab) current = tab;
    if (on && tab && page) pages[tab] = page;
    if (on === M.open) { if (on && tab) show(tab); return; }
    M.open = G.paused = on; veil.classList.toggle('hidden', !on); ui.classList.toggle('menu-open', on);
    if (on) {
      for (const f of M.opens) f();
      show(current || store.get('tab3d', 'today'));
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
  createToday(G, M);         // the Today section: your bird, how it is, where, and the day's aims (today.js)
  G.dev = createDev(G, M);   // Settings > Advanced > Feature list (dev.js)
  G.dev.add({ id: 'menu-a', area: 'Menu and map', round: 10, title: 'The menu, tidied: Today, Map, Journal, Guide, How to play and Settings down the rail; each section’s pages in a column beside it',
    how: 'Open the menu: Today shows your bird, food, water, wings and health, and the day’s aims; Map shows the globe; Journal has Songs, Nest and family, Landmarks, Biomes, Things found and the Field guide; Settings has Sound, Graphics, Controls, Messages, Journey and Advanced.' });
  return M;
}
