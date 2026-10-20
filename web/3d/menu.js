// The pause menu: a sheet of ruled paper with tabs. Systems add their own tab with
// G.menu.tab(id, title) (it returns the pane element) and rows with G.menu.toggle() /
// G.menu.button(). G.menu.onOpen(fn) refreshes a pane each time the menu opens.
export function createMenu(G, ui) {
  ui.insertAdjacentHTML('beforeend', `
    <button class="menu3" aria-label="Menu"><i></i><i></i></button>
    <div class="card3 hidden">
      <h1>Aloft</h1>
      <button data-act="resume" class="btn main">Resume</button>
      <nav class="tabs3"></nav>
      <div class="panes3"></div>
    </div>`);
  const card = ui.querySelector('.card3'), nav = card.querySelector('.tabs3'), panes = card.querySelector('.panes3');
  const M = { open: false, opens: [], acts: new Map() };
  let current = null;
  const show = id => {
    current = id;
    for (const b of nav.children) b.classList.toggle('on', b.dataset.tab === id);
    for (const p of panes.children) p.classList.toggle('hidden', p.dataset.pane !== id);
  };
  M.tab = (id, title) => {
    let pane = panes.querySelector(`[data-pane=${id}]`); if (pane) return pane;
    nav.insertAdjacentHTML('beforeend', `<button data-tab="${id}">${title}</button>`);
    panes.insertAdjacentHTML('beforeend', `<section class="pane3 hidden" data-pane="${id}"></section>`);
    pane = panes.querySelector(`[data-pane=${id}]`);
    if (!current) show(id);
    return pane;
  };
  let n = 0;
  M.toggle = (tab, { label, sub = '', get, set }) => {
    const act = 'a' + n++;
    M.tab(tab).insertAdjacentHTML('beforeend', `<button data-act="${act}" class="sw"><span>${label}${sub ? ` <small>${sub}</small>` : ''}</span><i></i></button>`);
    const el = card.querySelector(`[data-act=${act}]`), refresh = () => el.classList.toggle('on', !!get());
    M.acts.set(act, () => { set(!get()); refresh(); });
    M.opens.push(refresh); refresh();
  };
  M.button = (tab, { label, sub = '', onClick, href }) => {
    const act = 'a' + n++;
    M.tab(tab).insertAdjacentHTML('beforeend', href
      ? `<a data-act="${act}" class="btn" href="${href}">${label}${sub ? ` <em>${sub}</em>` : ''}</a>`
      : `<button data-act="${act}" class="btn">${label}${sub ? ` <em>${sub}</em>` : ''}</button>`);
    const el = card.querySelector(`[data-act=${act}]`);
    if (onClick) M.acts.set(act, () => onClick(el));
    return el;
  };
  M.onOpen = fn => M.opens.push(fn);
  M.set = on => {
    M.open = G.paused = on; card.classList.toggle('hidden', !on);
    if (on) { for (const f of M.opens) f(); G.emit('pause'); } else G.emit('resume');
  };
  ui.querySelector('.menu3').addEventListener('click', () => { G.emit('gesture'); M.set(!M.open); });
  card.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) { show(t.dataset.tab); return; }
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'resume') M.set(false); else M.acts.get(a)?.();
  });
  addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') M.set(!M.open); });
  return M;
}
