// The menu's Today section: how am I, what now? On the left, your bird and how it is (food, water,
// wings and health as slim bars, like the meters in flight), where it is, and the things to do now
// (Photo mode, Share a ghost flight: G.menu.group('today')). On the right, the day's aim and your
// life goal (journal sections placed before 10 land here: aims.js). Filled each time the menu opens.
import { icon, birdIcon } from './icons.js';
import { BIRD } from './hawk.js';
import { BIRDS } from './birds.js';

// colours to match the meters in flight (hud.js), a shade deeper to read on the glass
const BARS = [
  ['food', 'hunger', 'Food', '#d9734f'],
  ['water', 'thirst', 'Water', '#5f9fcf'],
  ['wings', 'stamina', 'Wings', '#c9921f'],
  ['health', 'health', 'Health', '#5d9e58'],
];
const word = (k, v) => k === 'health'
  ? v > .8 ? 'strong' : v > .55 ? 'well' : v > .35 ? 'thin' : 'weak'
  : k === 'wings'
    ? v > .7 ? 'fresh' : v > .35 ? 'tiring' : 'tired'
    : v > .7 ? 'full' : v > .4 ? 'fine' : v > .2 ? 'low' : 'very low';
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : '';

export function createToday(G, M) {
  const pane = M.tab('today', 'Today');
  pane.innerHTML = `<div class="today3">
    <div class="stack3 tcol3">
      <section class="group3 now3">
        <div class="who3"><span class="bic3"></span><span class="nm3"><b></b><small></small></span><button class="chg3">Change bird</button></div>
        <ul class="bars3">${BARS.map(([k, ic, t, c]) => `<li data-k="${k}" style="--bc:${c}"><span class="bi3">${icon(ic)}</span><span class="bt3">${t}</span><span class="bb3"><i></i><s></s></span><em></em></li>`).join('')}</ul>
      </section>
      <section class="group3 todo3" data-group="today"></section>
    </div>
    <div class="aims3"></div>
  </div>`;
  M.todo = pane.querySelector('.todo3');
  M.aims = pane.querySelector('.aims3');
  M.info('today', () => M.date());
  const who = pane.querySelector('.who3'), rows = Object.fromEntries([...pane.querySelectorAll('.bars3 li')].map(li => [li.dataset.k, li]));
  who.querySelector('.chg3').addEventListener('click', () => M.set(true, 'play', 'journey'));
  M.onOpen(() => {
    const b = G.b;
    who.querySelector('.bic3').innerHTML = birdIcon(BIRD);
    who.querySelector('b').textContent = BIRD === 'hawk' ? 'Red-tailed hawk' : BIRDS[BIRD]?.name || BIRD;
    who.querySelector('small').textContent = cap(G.placeWhere?.() || '');
    const cap1 = b?.maxStamina ?? 1;
    const vals = { food: G.hunger ?? 1, water: G.thirst ?? 1, wings: (b?.stamina ?? 1) / Math.max(.01, cap1), health: G.story?.health ?? 1 };
    for (const k in rows) {
      const v = Math.max(0, Math.min(1, vals[k])), li = rows[k];
      li.querySelector('i').style.width = `${(k === 'wings' ? v * cap1 : v) * 100}%`;
      // wings: the share hunger and thirst take away shows shaded, as in flight
      const s = li.querySelector('s'); s.hidden = k !== 'wings' || cap1 >= .995; s.style.width = `${(1 - cap1) * 100}%`;
      li.querySelector('em').textContent = word(k, v);
      li.classList.toggle('low', k !== 'health' && v < .2);
    }
  });
  return pane;
}
