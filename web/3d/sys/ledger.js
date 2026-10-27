// Journal > Everything (I and J of the review): one ledger of every count in the game, for those who
// like to find it all, and the gates told up front (what opens the doors, the Other Shore, the island,
// the far dream). The world's finds are shared by your birds; the bird's own column is the bird flying
// now (each grows on its own). It only reads what the other systems keep, when the page opens.
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';
import { BIRD } from '../hawk.js';
import { BIRDS } from '../birds.js';
import { SPECIES } from '../../src/songs.js';
import { AGES } from '../ages.js';
import { FEATHER } from './growth.js';

const SONGS = SPECIES.filter(s => !s.mimic).length;
const NEED = { ice: 1, drowned: 3, red: 5 };   // far signs for each door (sys/ages.js DOOR.need)
const BIRD_IDS = ['hawk', 'osprey', 'owl', 'raven', 'albatross'];
const nameOf = id => id === 'hawk' ? 'Red-tailed hawk' : BIRDS[id]?.name || id;

export function ledgerSystem(G) {
  const page = journal(G).page('everything');
  // a row: an icon, what, how many of how many (or a count alone), a thin bar, a line of what helps
  const row = (ic, what, n, of, help = '') => `<li class="${of && n >= of ? 'full' : ''}">${icon(ic)}<span><b>${esc(what)}</b>${help ? `<small>${esc(help)}</small>` : ''}</span>
    <em>${n}${of ? `<s>/${of}</s>` : ''}</em><i><u style="width:${of ? Math.min(100, n / of * 100).toFixed(1) : 0}%"></u></i></li>`;   // (a bar on every row, empty at 0 or with no total: James 10-27)
  const section = (title, rows, note = '') => `<section class="led3"><h3><span>${title}</span></h3>${note ? `<p class="muted3">${note}</p>` : ''}<ul>${rows.join('')}</ul></section>`;

  function draw() {
    const J = G.journey || {}, f = G.finds?.ledger?.() || {}, e = G.errands, a = G.ages?.ledger?.() || { sights: [] }, L = G.collection?.(), gd = G.guide?.count?.();
    const lm = G.store.get('lmTotal', null)?.n || 0, hid = Object.keys(G.hidden?.found?.() || {}).length, signs = f.signs || 0;
    // the share of everything with a known end, for the heading
    const ends = [[G.learned?.size || 0, SONGS], [Object.values(J.found || {}).filter(f => f.real).length, lm], [L?.lands || 0, L?.of || 0], [gd?.n || 0, gd?.of || 0],
      [f.sets || 0, f.setsOf || 0], [f.pages || 0, f.pagesOf || 0], [f.paints || 0, f.paintsOf || 0], [signs, 7], [f.charts || 0, 4], [e?.homes() || 0, e?.homesOf || 0], [a.been || 0, a.of || 0]].filter(([, o]) => o);
    const all = ends.reduce((s, [n, o]) => s + Math.min(1, n / o), 0) / Math.max(1, ends.length);
    const world = [
      row('songs', 'Songs learned', G.learned?.size || 0, SONGS, 'Copy a songbird’s song.'),
      row('landmarks', 'Landmarks', Object.values(J.found || {}).filter(f => f.real).length, lm, 'Fly close to the wonders, volcanoes and great natural sights.'),
      row('lands', 'Lands seen', L?.lands || 0, L?.of || 0, 'Fly over every kind of land.'),
      row('guide', 'Field guide pages', gd?.n || 0, gd?.of || 0, 'Look at creatures and birds up close.'),
      row('door', 'Hidden places and caves', hid, 0, 'Ledges behind falls, rock shelters, oases, caves.'),
      row('keepsake', 'Keepsake sets whole', f.sets || 0, f.setsOf || 0, 'Journal > Things > Keepsakes.'),
      row('notebook', 'Notebook pages', f.pages || 0, f.pagesOf || 0, 'On the lookouts’ walks and in caves.'),
      row('paint', 'Painted walls', f.paints || 0, f.paintsOf || 0, 'In the rock shelters.'),
      row('sign', 'Far signs', signs, 7, 'By four far wonders and deep in caves.'),
      row('chart', 'Chart pieces', f.charts || 0, 4, f.island ? 'The island reached.' : 'In sea caves and bottles.'),
      row('lamp', 'Lamps lit again', e?.lit() || 0, 0, 'Carry a lens or a key to a dark lighthouse.'),
      row('carry', 'Treasures home', e?.homes() || 0, e?.homesOf || 0, 'Each to a home of its kind.'),
      row('seed', 'Trees planted', e?.planted() || 0, 0, e?.tin() ? 'From the seed tin.' : 'Find the seed tin first.'),
      row('ring', 'Oceans crossed', G.ocean?.crossed?.() || 0, 0, 'Follow a sea road to landfall.'),
      row('ring', 'Sea ring courses', G.ocean?.courses?.() || 0, 0, 'Along the sea roads.'),
      row('songs', 'Choruses', G.lore?.choruses?.() || 0, G.lore?.chorusOf || 0, 'Every songbird of one land.'),
      row('songs', 'Sea songs', G.lore?.seaSongs?.() || 0, 2, 'Ride a whale; rest by a gannet colony.'),
    ];
    const ages = [
      row('age', 'Ages reached', a.been || 0, a.of || 0, 'Through the doors and the gap in the aurora.'),
      row('door', 'Doors of light found', a.doors || 0, 0, 'At the back of deep caves.'),
      ...a.sights.map(([id, n, of]) => row('age', `Sights of ${AGES[id].name}`, n, of, '')),
      row('sleep', 'Dreams', a.dreams || 0, 0, 'Sleep where it matters: your ledge, a hidden place, under the lights.'),
    ];
    const gr = G.growth, me = gr?.of(BIRD);
    const bird = [
      row('strength', 'Grown', Math.round((gr?.grown(BIRD) || 0) * 100), 100, gr?.prime(BIRD) ? 'In its prime.' : 'Today > Strength shows the ways still open.'),
      row('feather', 'Feathers', Math.min(FEATHER.most, me?.feathers || 0), FEATHER.most, 'The day’s aim, the season’s, lessons, crossings, dreams.'),
      row('songs', 'Songs mastered', G.lore?.mastered?.() || 0, SONGS, 'Sing one cleanly three times.'),
      ...(G.life ? [row('check', `Life goal: ${G.life.title}`, G.life.steps.filter(s => s.done).length, G.life.steps.length, '')] : []),
    ];
    const others = BIRD_IDS.filter(id => id !== BIRD && gr?.of(id)).map(id => row('strength', nameOf(id), Math.round(gr.grown(id) * 100), 100, gr.prime(id) ? 'In its prime.' : ''));
    const gates = [
      ...Object.entries(NEED).map(([id, n]) => row('door', `The door to ${AGES[id].name}`, Math.min(signs, n), n, `Opens with ${n} far ${n === 1 ? 'sign' : 'signs'}; the doors are at the back of deep caves in the hills or the ice.`)),
      row('age', 'The Other Shore', G.quests?.get('aurora') ? 1 : 0, 1, 'The notebook’s last page or the far dream tells of it; then the pole wall on a night of the lights.'),
      row('sleep', 'The far dream', signs, 7, 'All seven far signs, then sleep somewhere that matters.'),
      row('chart', 'The chart’s island', f.charts || 0, 4, 'Four chart pieces show where; land there.'),
      row('feather', 'The owl’s feather', 0, 0, 'Sing at a rock shelter you found, at dusk.'),
    ];
    page.innerHTML = `<p class="ledhead3">${icon('journal')}<span><b>${Math.round(all * 100)}% of everything found</b><small>For those who like to find it all; nothing here is needed to fly. The world’s finds are shared by your birds; each bird grows on its own.</small></span></p>`
      + section('The world', world) + section('The ages', ages)
      + section(`${esc(nameOf(BIRD))}, the bird you fly`, bird) + (others.length ? section('Your other birds', others) : '')
      + section('What opens what', gates, 'Told here before you meet them, so nothing is a surprise you have to guess.');
  }
  G.menu.onOpen(draw);
  G.on('menuTab', () => draw());
  G.dev?.add({ id: 'ledger', area: 'Menu and map', round: 'Gameplay review I J', title: 'Journal > Everything: every count, the bird\'s own, and what opens what', how: 'Open Journal > Everything.' });
  return { id: 'ledger' };
}
