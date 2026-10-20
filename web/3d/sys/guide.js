// The field guide: a page for each kind of animal the hawk has seen, kept across journeys. The
// first time one is in view near enough to make out, its portrait is cut from that very frame,
// faded onto a little round of paper, and noted with the day, the season and the place.
// Systems that draw an animal call G.sight(key, x, y, z, r) every frame (r: about its radius,
// in metres; cheap when already seen) and may add or rename its page with G.guide.page().
import { SPECIES } from '../../src/songs.js';
import { project, afterDraw, portrait } from '../shot.js';
import { journal, esc } from '../journal.js';

const NOTES = {
  mouse: ['Meadow vole', 'A red-tail’s favourite meal: it runs in hidden tunnels through the grass.'],
  deer: ['White-tailed deer', 'Grazes the forest edge at dawn and dusk, and flags its white tail as it bolts.'],
  heron: ['Great blue heron', 'Stands still in the shallows for minutes at a time, then spears a fish in one strike.'],
  squirrel: ['Eastern gray squirrel', 'Buries nuts all autumn; the ones it never digs up grow into oaks.'],
  fish: ['Pumpkinseed sunfish', 'Rises to snap insects off the surface on calm evenings.'],
  crow: ['American crow', 'Crows gang up to chase hawks away from their trees, calling the whole neighbourhood in.'],
  starling: ['European starling', 'At dusk thousands wheel together in one cloud, a murmuration, before they roost.'],
  kettlehawk: ['Broad-winged hawk', 'Migrates in great kettles of hundreds, riding one thermal after another all the way to South America.'],
  redtail: ['Red-tailed hawk', 'Your own kind: the brick-red tail comes with the first full year.'],
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
  G.guide = { page, seen: key => !!seen[key], name: key => pages.get(key)?.name || key };

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
      try { seen[key] = { src: portrait(canvas, w.x, w.y, w.side), note: G.placeNote?.() || `Seen on day ${G.day}, in ${G.season.name}.` }; got.push(key); } catch { /* try another time */ }
    }
    want.clear();
    if (!got.length) return;
    G.store.set('guide3d', seen);
    for (const k of got) { G.hud.toast(`A new page in your field guide: ${G.guide.name(k)}.`, 3.5); G.emit('sighted', k); }
  }

  // the journal's field guide: every page, the ones seen first
  const sec = journal(G).section(60, 'Field guide <span class="count3"></span>');
  sec.body.innerHTML = '<ul class="guide3"></ul>';
  G.menu.onOpen(() => {
    const all = [...pages.values()].map(p => ({ ...p, s: seen[p.key] }));
    const list = [...all.filter(p => p.s), ...all.filter(p => !p.s)];
    sec.el.querySelector('.count3').textContent = `${list.filter(p => p.s).length} of ${list.length} seen`;
    sec.body.firstChild.innerHTML = list.map(p => `<li class="${p.s ? 'seen' : ''}"><div class="pic">${p.s ? `<img alt="" src="${p.s.src}">` : ''}</div><div><b>${esc(p.s ? p.name : 'Not yet seen')}</b><small>${esc(p.s ? `${p.note} ${p.s.note}` : p.hint || 'Keep your eyes open.')}</small></div></li>`).join('');
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
