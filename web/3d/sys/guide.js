// The field guide: a page for each kind of animal the hawk has seen, kept across journeys. The
// first time one is in view near enough to make out, its portrait is cut from that very frame,
// faded onto a little round of paper, and noted with the day, the season and the place.
// Systems that draw an animal call G.sight(key, x, y, z, r) every frame (r: about its radius,
// in metres; cheap when already seen) and may add or rename its page with G.guide.page().
import { SPECIES } from '../../src/songs.js';
import { project, afterDraw, portrait } from '../shot.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';
import { continentAt } from '../earth.js';

const NOTES = {
  mouse: ['Meadow vole', 'A red-tail’s favourite meal: it runs in hidden tunnels through the grass.'],
  deer: ['White-tailed deer', 'Grazes the forest edge at dawn and dusk, and flags its white tail as it bolts.'],
  reddeer: ['Red deer', 'Grazes the forest edge at dawn and dusk; in autumn the stags roar across the valleys.'],
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
  G.guide = { page, seen: key => !!seen[key], name: key => pages.get(key)?.name || key, note: key => pages.get(key)?.note || '' };

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
    for (const k of got) { G.hud.tally(`Field guide: ${G.guide.name(k)}`, 'guide'); G.emit('sighted', k); }
  }

  // Guide > Field guide: chips to show one kind at a time (songbirds near here by default), the ones
  // seen as cards with their portraits, then the ones still to find, small, each with a hint
  const KINDS = [['all', 'All'], ['song', 'Songbirds'], ['bird', 'Other birds'], ['land', 'Animals'], ['water', 'Water life']];
  const BIRDY = /eagle|hawk|owl|gull|kestrel|heron|egret|crow|raven|starling|buzzard|falcon|kite|vulture|tern|puffin|albatross|gannet|pelican|booby|frigate|swan|duck|goose|stork|crane|ibis|flamingo|penguin|parrot|cormorant/i;
  const WET = /whale|turtle|fish|seal|dolphin|shark|orca|walrus|crab|ray\b|sunfish/i;
  const kindOf = p => p.key.startsWith('sp') ? 'song' : BIRDY.test(p.name) ? 'bird' : WET.test(p.name) ? 'water' : 'land';
  const spOf = new Map(SPECIES.map(sp => ['sp' + sp.id, sp]));
  const F = { kind: G.store.get('guideKind', 'all'), here: G.store.get('guideHere', true), more: false };
  const sec = journal(G).section(60);
  sec.body.innerHTML = '<div class="gbar3"></div><ul class="guide3"></ul><h4 class="gtodo3"></h4><ul class="gnot3"></ul>';
  const q = c => sec.body.querySelector(c);
  function draw() {
    const cont = continentAt(G.b.p[0], G.b.p[2]);
    const all = [...pages.values()].map(p => ({ ...p, s: seen[p.key], k: kindOf(p) }));
    const near = p => !F.here || p.k !== 'song' || !cont || (spOf.get(p.key)?.cont || []).includes(cont);
    const shown = all.filter(p => (F.kind === 'all' || p.k === F.kind) && (p.s || near(p)));
    const n = k => { const l = all.filter(p => k === 'all' || p.k === k); return `${l.filter(p => p.s).length}/${l.length}`; };
    q('.gbar3').innerHTML = KINDS.map(([k, t]) => `<button data-kind="${k}" class="${F.kind === k ? 'on' : ''}">${t} <small>${n(k)}</small></button>`).join('')
      + `<button data-here class="here3g${F.here ? ' on' : ''}" title="Only the songbirds of this continent">${icon('pin')}Near here</button>`;
    const got = shown.filter(p => p.s), todo = shown.filter(p => !p.s);
    q('.guide3').innerHTML = got.map(p => `<li class="seen"><div class="pic"><img alt="" src="${p.s.src}"></div><div><b>${esc(p.name)}</b><small>${esc(p.note)}</small><small class="when3g">${esc(p.s.note)}</small></div></li>`).join('')
      || '<li class="none3g">Nothing seen here yet. Fly close to an animal or a bird and hold it in view a moment.</li>';
    q('.gtodo3').textContent = todo.length ? `Still to find: ${todo.length}` : '';
    const few = F.more ? todo : todo.slice(0, 6);
    q('.gnot3').innerHTML = few.map(p => `<li><span>?</span><small>${esc(p.hint || (p.k === 'song' ? 'A songbird.' : 'Keep your eyes open.'))}</small></li>`).join('')
      + (todo.length > few.length ? `<li class="more3g"><button data-more>Show all ${todo.length}</button></li>` : '');
  }
  sec.body.addEventListener('click', e => {
    const k = e.target.closest('[data-kind]'), h = e.target.closest('[data-here]');
    if (e.target.closest('[data-more]')) { F.more = true; draw(); }
    else if (k) { F.kind = k.dataset.kind; F.more = false; G.store.set('guideKind', F.kind); draw(); }
    else if (h) { F.here = !F.here; G.store.set('guideHere', F.here); draw(); }
  });
  G.menu.onOpen(() => { F.more = false; draw(); });

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
