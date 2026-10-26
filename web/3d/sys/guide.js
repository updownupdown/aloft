// The field guide: each kind of animal the hawk has seen, kept across journeys. The first time one
// is in view near enough to make out, its portrait is cut from that very frame and faded onto a
// little round of paper.
// Systems that draw an animal call G.sight(key, x, y, z, r) every frame (r: about its radius,
// in metres; cheap when already seen) and may add or rename its page with G.guide.page().
import { SPECIES } from '../../src/songs.js';
import { project, afterDraw, portrait } from '../shot.js';
import { journal, esc, shelf } from '../journal.js';

const NOTES = {
  mouse: ['Meadow vole', 'A red-tail’s favourite meal: it runs in hidden tunnels through the grass.'],
  heron: ['Great blue heron', 'Stands still in the shallows for minutes at a time, then spears a fish in one strike.'],
  squirrel: ['Eastern gray squirrel', 'Buries nuts all autumn; the ones it never digs up grow into oaks.'],
  fish: ['Pumpkinseed sunfish', 'Rises to snap insects off the surface on calm evenings.'],
  starling: ['European starling', 'At dusk thousands wheel together in one cloud, a murmuration, before they roost.'],
  kettlehawk: ['Broad-winged hawk', 'Migrates in great kettles of hundreds, riding one thermal after another all the way to South America.'],
  redtail: ['Red-tailed hawk', 'Your own kind: the brick-red tail comes with the first full year.'],
  osprey: ['Osprey', 'Your own kind: pairs return to the same nest each spring and add to it, year on year.'],
  barnowl: ['Barn owl', 'Your own kind: a pair keeps one roost for life, hunting the same fields by night.'],
  albatross: ['Royal albatross', 'Your own kind: a pair meets again at the colony every other year, with a long dance of bows and calls.'],
};
const SONG = { Chickadee: 'Says its own name, chick-a-dee-dee-dee, and stays all winter.', Robin: 'One of the first to sing at dawn, a cheery up-and-down carol.',
  Warbler: 'A bright scrap of yellow that sings a rising run of notes.', Wren: 'Tiny, loud, and always with its tail cocked high.',
  Thrush: 'Its flute-like song echoes through the trees at dawn and dusk.', Finch: 'Bounces through the air on looping flights, calling as it goes.',
  Owl: 'Hunts by sound in the dark, on wings that make no noise.', Lark: 'Sings while hanging high in the air over open fields.',
  Cardinal: 'Male and female both sing; red all year round.', Meadowlark: 'Sings its flute-like phrases from a fence post or a tall weed.',
  'Red-winged blackbird': 'Flashes red shoulders and calls conk-la-ree from the reeds.', 'Mourning dove': 'Its low, sad cooing carries far on still mornings.',
  'Blue jay': 'A clever mimic that can copy the scream of a red-shouldered hawk.', 'Song sparrow': 'Each male knows up to a dozen songs and takes turns with them.',
  'White-throated sparrow': 'Whistles Old Sam Peabody, Peabody, Peabody.', Veery: 'Its spiralling, downward song sounds like a voice in a drainpipe.' };

export function guideSystem(G) {
  const pages = new Map(), want = new Map(), seen = G.store.get('guide3d', {});
  let lastS = null;
  const page = (key, name, note = '', hint = '') => { const p = pages.get(key); pages.set(key, { key, name: name || p?.name || key, note: note || p?.note || '', hint: hint || p?.hint || '' }); };
  for (const sp of SPECIES) page('sp' + sp.id, sp.name, SONG[sp.name] || '', `A songbird. ${sp.hint}.`);
  for (const [k, [n, t]] of Object.entries(NOTES)) page(k, n, t);
  G.guide = { page, seen: key => !!seen[key], name: key => pages.get(key)?.name || key, note: key => pages.get(key)?.note || '' };

  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  // (no portraits: the cards show their name and note)
  G.on('mock', k => {
    const keys = [...pages.keys()], n = Math.round(k * keys.length);
    for (const q of Object.keys(seen)) delete seen[q];
    for (const q of keys.slice(0, n)) seen[q] = { src: '' };
    G.store.set('guide3d', seen);
  });
  G.sight = (key, x, y, z, r = .5) => {
    if (seen[key] || want.has(key) || G.paused || !lastS) return;
    const c = document.getElementById('game3'), W = c.width, H = c.height;
    const s = project(lastS, [x, y, z], W, H); if (!s || s.z > 80) return;
    const rad = r * s.px;
    if (rad < 10 * Math.min(devicePixelRatio || 1, 2) || s.x < rad || s.y < rad || s.x > W - rad || s.y > H - rad) return;   // too small, or not wholly in frame
    want.set(key, { x: s.x, y: s.y, side: rad * 2.6 });
  };

  function capture(canvas) {
    const got = [];
    for (const [key, w] of want) {
      try { seen[key] = { src: portrait(canvas, w.x, w.y, w.side) }; got.push(key); } catch { /* try another time */ }
    }
    want.clear();
    if (!got.length) return;
    G.store.set('guide3d', seen);
    for (const k of got) { G.hud.tally(`Seen: ${G.guide.name(k)}`, 'guide'); G.emit('sighted', k); }
  }

  // the field guide has no page of its own now (James, 10-24): its other birds sit at the foot of
  // Journal > Songs (songs.js asks G.guide.cards('bird')), its animals and water life on one shelf,
  // Creatures, under Journal > Things.
  // Each is found or not; when doesn't matter. Found: a card with its portrait; not yet: a ? and a hint.
  const BIRDY = /eagle|hawk|owl|gull|kestrel|heron|egret|crow|raven|starling|buzzard|falcon|kite|vulture|tern|puffin|albatross|gannet|pelican|booby|frigate|swan|duck|goose|stork|crane|ibis|flamingo|penguin|parrot|cormorant/i;
  const WET = /whale|turtle|fish|seal|dolphin|shark|orca|walrus|crab|ray\b|sunfish/i;
  const kindOf = p => p.key.startsWith('sp') ? 'song' : BIRDY.test(p.name) ? 'bird' : WET.test(p.name) ? 'water' : 'land';
  const of = k => [...pages.values()].filter(p => kindOf(p) === k).map(p => ({ ...p, s: seen[p.key] }));
  const more = {};
  G.guide.cards = (k, title = '') => {
    const all = of(k), got = all.filter(p => p.s), todo = all.filter(p => !p.s), few = more[k] ? todo : todo.slice(0, 6);
    return `<div class="gsec3" data-kind="${k}">${title ? `<h3>${title} <small>${got.length} of ${all.length}</small></h3>` : ''}`
      + (got.length ? `<ul class="guide3">${got.map(p => `<li class="seen"><div class="pic"><img alt="" src="${p.s.src}"></div><div><b>${esc(p.name)}</b><small>${esc(p.note)}</small></div></li>`).join('')}</ul>` : '')
      // with hints, a ? and its hint each; without, only how many are left
      + (todo.length && todo.some(p => p.hint) ? `<ul class="gnot3">${few.map(p => `<li><span>?</span><small>${esc(p.hint || 'Keep your eyes open.')}</small></li>`).join('')}`
        + (todo.length > few.length ? `<li class="more3g"><button data-more="${k}">Show all ${todo.length}</button></li>` : '') + '</ul>'
        : todo.length ? `<p class="gleft3">${got.length ? `${todo.length} more to find.` : 'None seen yet.'} Fly close and hold one in view a moment to note it.</p>` : '')
      + '</div>';
  };
  // a Show all anywhere in the menu opens that kind's whole list
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-more]'); if (!m || !G.menu.open) return;
    more[m.dataset.more] = true; const box = m.closest('.gsec3'), t = box.querySelector('h3')?.firstChild?.textContent.trim() || '';
    box.outerHTML = G.guide.cards(m.dataset.more, t);
  });
  const sec = journal(G).section(60, 'Creatures');
  G.menu.onOpen(() => {
    for (const k in more) delete more[k];
    const all = [...of('land'), ...of('water')], got = all.filter(p => p.s).length;
    sec.count(`${got} of ${all.length}`);
    sec.body.innerHTML = shelf(all.map(p => ({ name: p.name, found: !!p.s, pic: p.s?.src, icon: 'guide', note: p.note, hint: p.hint })))
      + (got ? '' : '<p class="muted3">Fly close by an animal and hold it in view a moment: it is noted here, with its portrait.</p>');
  });

  return {
    id: 'guide',
    update() {
      // mice are the food system's: sight the nearest
      const mice = G.systems.food?.mice;
      if (mice && !seen.mouse) for (const m of mice.values()) G.sight('mouse', m.x, m.y + .08, m.z, .25);
    },
    scene(S) {
      lastS = S;
      if (want.size) afterDraw(capture);
    },
  };
}
