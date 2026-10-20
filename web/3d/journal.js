// The Journal tab, shared by the systems that write in it: each asks for a section by its place
// on the page (journey 10, map 20, nest 30, story 40, landmarks 50, field guide 60, album 70) and
// fills it when the menu opens.
export function journal(G) {
  if (G.journal) return G.journal;
  const pane = G.menu.tab('journal', 'Journal');
  G.journal = {
    pane,
    section(order, title = '') {
      const el = document.createElement('section');
      el.dataset.order = order;
      if (title) el.innerHTML = `<h3>${title}</h3>`;
      const body = document.createElement('div'); el.append(body);
      pane.insertBefore(el, [...pane.children].find(c => +c.dataset.order > order) || null);
      return { el, body, head: el.querySelector('h3') };
    },
  };
  return G.journal;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
