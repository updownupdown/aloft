// The Journal tab, shared by the systems that write in it, in pages along its top: Log, Songs,
// Landmarks, Field guide and Album. Each system asks for a section by its place (journey 10,
// nest 30, story 40, landmarks 50, field guide 60, album 70; songs have their own page) and fills it
// when the menu opens; the place says which page it is on.
const PAGES = [[0, 'log', 'Log'], [50, 'landmarks', 'Landmarks'], [60, 'guide', 'Field guide'], [70, 'album', 'Album']];
const ORDER = { log: 10, songs: 20, landmarks: 50, guide: 60, album: 70 };

export function journal(G) {
  if (G.journal) return G.journal;
  const pane = G.menu.tab('journal', 'Journal');
  const page = id => G.menu.page('journal', id, (PAGES.find(p => p[1] === id) || [0, id, id[0].toUpperCase() + id.slice(1)])[2], ORDER[id] ?? 80);
  G.journal = {
    pane, page,
    section(order, title = '') {
      const id = [...PAGES].reverse().find(p => order >= p[0])[1], host = page(id);
      const el = document.createElement('section');
      el.dataset.order = order;
      if (title) el.innerHTML = `<h3>${title}</h3>`;
      const body = document.createElement('div'); el.append(body);
      host.insertBefore(el, [...host.children].find(c => +c.dataset.order > order) || null);
      return { el, body, head: el.querySelector('h3') };
    },
  };
  return G.journal;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
