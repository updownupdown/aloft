// Journal > Messages (asked for as How to play > Hints, then Settings > Messages; menu.js MOVED): every tip, grouped, with its short line and its whole text, and every kind
// of message on the message line with the last few it said. Each group and kind has a switch;
// the gear on a tip or a message opens this page. Show the tips again lives here too.
import { icon } from './icons.js';
import { SAY } from './hud.js';
import { SHORT, ICON, TIP_GROUPS, tipGroup } from './tips.js';

const KINDS = [
  ['event', 'Things that happen', 'A landmark, a song learned: one line every half minute at most'],
  ['warn', 'Warnings', 'Danger, or something you tried that didn’t work'],
  ['tutorial', 'Lessons', 'The end of the first flight, and the lessons when they end'],
  ['hint', 'Nudges', 'What you could do here'],
  ['song', 'Singing', 'Who answers your song, under the song card'],
  ['name', 'Names', 'A land, a landmark, a rainbow: a title under the compass'],
  ['next', 'The next step', 'The open lesson, or the day’s aim: a thin line under the compass'],
  ['glint', 'Things to learn', 'Something new waits by the compass: tap it to read'],
  ['tally', 'Counts', 'Keepsakes, a catch: a few words beside the compass'],
];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sw = (key, on, title, sub, ic, col = '') =>
  `<button class="sw hsw3${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-key="${key}"><span class="hic3"${col ? ` style="color:${col}"` : ''}>${icon(ic)}</span><span>${title} <small>${sub}</small></span><i></i></button>`;

export function hintsPage(G) {
  const H = G.hud, page = G.menu.page('how', 'hints', 'Hints', 50);
  const draw = () => {
    const tips = TIP_GROUPS.map(([id, title, ic, ids]) => {
      const at = t => { const i = ids.indexOf(t.id); return i < 0 ? 99 : i; };
      const list = H.tips.filter(t => tipGroup(t.id) === id).sort((a, b) => at(a) - at(b));
      if (!list.length) return '';
      const seen = list.filter(t => H.done[t.id]).length;
      return `<section class="hgrp3">${sw('tip:' + id, !H.off['tip:' + id], title, `${list.length} tip${list.length > 1 ? 's' : ''}, ${seen} seen`, ic)}
        <ul>${list.map(t => { const [i, short] = SHORT[t.id] || ['dot', t.text];
          return `<li class="${H.done[t.id] ? 'seen3' : ''}"><span class="hic3">${icon(ICON[i] || 'how')}</span><span><b>${esc(short)}</b><span>${esc(t.text)}</span></span><em>${H.done[t.id] ? 'seen' : ''}</em></li>`; }).join('')}</ul></section>`;
    }).join('');
    const says = KINDS.map(([k, title, sub]) => {
      const said = H.said[k] || [];
      return `<section class="hgrp3">${sw('say:' + k, !H.off['say:' + k], title, sub, SAY[k].icon, SAY[k].col)}
        ${k === 'next' ? '' : said.length ? `<ul class="said3">${said.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="none3">Nothing yet.</p>'}</section>`;
    }).join('');
    page.innerHTML = `<p>Turn off the hints you don’t need. Tips teach a move once; messages say what is happening.</p>
      <button class="btn hreset3">Show the tips again <em>${Object.keys(H.done).length} seen</em></button>
      <h3>Tips</h3>${tips}<h3>Messages</h3>${says}`;
  };
  page.addEventListener('click', e => {
    const s = e.target.closest('.hsw3');
    if (s) { const key = s.dataset.key; H.setOff(key, !H.off[key]); draw(); return; }
    if (e.target.closest('.hreset3')) { H.resetTips(); draw(); }
  });
  G.on('menuPage', (tab, id) => { if (tab === 'journal' && id === 'messages') draw(); });
  G.menu.onOpen(draw);
  draw();
}
