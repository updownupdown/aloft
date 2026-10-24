// The pages that systems write in, shared: each system asks for a section by its place and fills it
// when the menu opens; the place says which section and page it is on (James, 2026-10-23):
//   before 10   Today (before 7 in its Tutorial box: lessons 3, aims 5 the day's aim; then 7 your life)
//   10-29       not shown (the old Log: daily records were too much)
//   30-41       Journal > Nest (nest 30, story 40)
//   42          Journal > Things (things people left, bottles)
//   43-59       Journal > Places (wonders 43, biomes 45, landmarks 50)
//   60 on       Journal > Things too (the field guide's animals and water life)
// Songs have their own page, Journal > Songs (page('songs')), with the field guide's other birds.
// The Journal is Songs, Places, Things, Nest (James, 2026-10-24). The Map has no pages: the globe fills it.
const PAGES = {
  songs: ['journal', 'Songs', 5], places: ['journal', 'Places', 10], things: ['journal', 'Things', 20], family: ['journal', 'Nest', 30],
};
const pageOf = o => o < 10 ? 'today' : o < 30 ? null : o < 42 ? 'family' : o < 43 ? 'things' : o < 60 ? 'places' : 'things';
// a section's heading where the page already says it
const RETITLE = { Today: 'Today’s aim', Lessons: '' };

export function journal(G) {
  if (G.journal) return G.journal;
  const pane = G.menu.tab('journal', 'Journal');
  const page = id => { const [tab, title, order] = PAGES[id] || ['journal', id[0].toUpperCase() + id.slice(1), 80]; return G.menu.page(tab, id, title, order); };
  G.journal = {
    pane, page,
    section(order, title = '') {
      const id = pageOf(order), host = id === 'today' ? (order < 7 ? G.menu.aims : G.menu.later || G.menu.aims) : id ? page(id) : document.createElement('div');
      const el = document.createElement('section');
      el.dataset.order = order;
      const t = RETITLE[title] ?? title; if (t) el.innerHTML = `<h3>${t}</h3>`;
      const body = document.createElement('div'); el.append(body);
      host.insertBefore(el, [...host.children].find(c => +c.dataset.order > order) || null);
      return { el, body, head: el.querySelector('h3') };
    },
  };
  return G.journal;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
