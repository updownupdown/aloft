// The pages that systems write in, shared: each system asks for a section by its place and fills it
// when the menu opens; the place says which section and page it is on (James, 2026-10-23):
//   before 10   Today (aims 5 the day's aim, 7 your life)
//   15          How to play > Things learned (quiet.js notes)
//   10-29 else  not shown (the old Log: daily records were too much)
//   30-41       Journal > Nest and family (nest 30, story 40)
//   42          Journal > Things found (things people left, bottles)
//   43-59       Journal > Landmarks (wonders 43, landmarks 50), but 45 is Journal > Lands (the collection)
//   60 on       Guide > Field guide
// Songs have their own page, Guide > Songs (page('songs')). The Map has no pages: the globe fills it.
const PAGES = {
  landmarks: ['journal', 'Landmarks', 10], lands: ['journal', 'Lands', 20], family: ['journal', 'Nest and family', 30], finds: ['journal', 'Things found', 40],
  notes: ['how', 'Things learned', 45], songs: ['guide', 'Songs', 10], guide: ['guide', 'Field guide', 20],
};
const pageOf = o => o < 10 ? 'today' : o === 15 ? 'notes' : o < 30 ? null : o < 42 ? 'family' : o < 43 ? 'finds' : o === 45 ? 'lands' : o < 60 ? 'landmarks' : 'guide';
// a section's heading where the page already says it
const RETITLE = { Today: 'Today’s aim', Landmarks: 'Places found', Notes: '' };

export function journal(G) {
  if (G.journal) return G.journal;
  const pane = G.menu.tab('journal', 'Journal');
  const page = id => { const [tab, title, order] = PAGES[id] || ['journal', id[0].toUpperCase() + id.slice(1), 80]; return G.menu.page(tab, id, title, order); };
  G.journal = {
    pane, page,
    section(order, title = '') {
      const id = pageOf(order), host = id === 'today' ? G.menu.aims : id ? page(id) : document.createElement('div');
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
