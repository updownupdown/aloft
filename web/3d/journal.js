// The pages that systems write in, shared: each system asks for a section by its place and fills it
// when the menu opens; the place says which section and page it is on (James, 2026-10-23):
//   before 10   Today: on the right, Focus (lessons 3, the quest you follow 4, the day's aim 5, the season's 6,
//               the ring course 6.5, your life 8: one picked, the rest suggested) and the quests 9; on the left, strength 7
//   10-29       not shown (the old Log: daily records were too much)
//   30-41       not shown (was Journal > Nest, removed 2026-10-26)
//   42          Journal > Things: Keepsakes (the story's glinting things, the ruins' trinkets and
//               treasures, the bottles' notes, one shelf: ruins.js)
//   43-59       Journal > Places (landmarks 43, with the wonders starred: journey.js; lands 45: aims.js)
//   60 on       Journal > Things too (creatures: the field guide's animals and water life)
// Songs have their own page, Journal > Songs (page('songs')), with the field guide's other birds.
// The Journal is Songs, Places, Things (James, 2026-10-24; Nest removed 10-26); six kinds of thing to find
// (songs, landmarks, lands, keepsakes, creatures, feathers), each a shelf (shelf()) but the songs
// and the feathers, each with its count at the right of its heading (section().count()).
// The Map has no pages: the globe fills it.
import { icon } from './icons.js';

const PAGES = {
  songs: ['journal', 'Songs', 5], places: ['journal', 'Places', 10], things: ['journal', 'Things', 20], everything: ['journal', 'Everything', 30],
};
const pageOf = o => o < 10 ? 'today' : o < 42 ? null : o < 43 ? 'things' : o < 60 ? 'places' : 'things';
// a section's heading where the page already says it
const RETITLE = { Today: '', Lessons: '' };

export function journal(G) {
  if (G.journal) return G.journal;
  const pane = G.menu.tab('journal', 'Journal');
  const page = id => { const [tab, title, order] = PAGES[id] || ['journal', id[0].toUpperCase() + id.slice(1), 80]; return G.menu.page(tab, id, title, order); };
  G.journal = {
    pane, page,
    section(order, title = '') {
      const id = pageOf(order), host = id === 'today' ? (order >= 7 && order < 8 ? G.menu.later || G.menu.aims : G.menu.aims) : id ? page(id) : document.createElement('div');
      const el = document.createElement('section');
      el.dataset.order = order;
      const t = RETITLE[title] ?? title; if (t) el.innerHTML = `<h3><span>${t}</span></h3>`;
      const body = document.createElement('div'); el.append(body);
      host.insertBefore(el, [...host.children].find(c => +c.dataset.order > order) || null);
      const head = el.querySelector('h3');
      // a small count at the right of the heading, on the same row ('4 of 26', '12 found')
      const count = text => {
        if (!head) return;
        let c = head.querySelector('.count3');
        if (!text) { c?.remove(); return; }
        if (!c) { c = document.createElement('small'); c.className = 'count3'; head.append(c); }
        c.textContent = text;
      };
      return { el, body, head, count };
    },
  };
  return G.journal;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// A shelf (James, 2026-10-24; a row each, 10-27): the things found, each with its picture or icon, its name
// (and a count when you hold several) and its whole note, the rest grey with a question mark, at most
// `peek` of them and then "and N more". An item:
// { name, found, pic (a data URL) or icon (icons.js), note, star (one of a kind), hint (for a slot not yet found), n }
export function shelf(items, peek = 8) {
  const got = items.filter(i => i.found), todo = items.filter(i => !i.found), few = todo.slice(0, peek);
  const star = i => i.star ? '<i class="star3" title="One of a kind">★</i>' : '';
  const slot = i => i.found
    ? `<li class="found${i.star ? ' star' : ''}"><span class="pic">${i.pic ? `<img alt="" src="${i.pic}">` : icon(i.icon || 'keepsake')}</span><b>${star(i)}${esc(i.name)}${i.n > 1 ? ` <small>×${i.n}</small>` : ''}</b>${i.note || i.at ? `<span class="note">${esc(i.note || '')}${i.at ? ` <button class="at3" data-at="${i.at}">${icon('map')}Where</button>` : ''}</span>` : ''}</li>`
    : `<li class="empty${i.star ? ' star' : ''}"><span class="pic">?</span>${i.hint ? `<small>${esc(i.hint)}</small>` : ''}</li>`;
  return `<ul class="shelf3">${got.map(slot).join('')}${few.map(slot).join('')}</ul>${todo.length > few.length ? `<p class="shelfmore3">and ${todo.length - few.length} more to find.</p>` : ''}`;
}
