// Soft aims: an intention for each day, the bird's life goal on the Log (sys/life.js), the lands
// collection and racing the companion. Each dawn the Journal offers one optional aim (fly a ring
// course, sing with a songbird, see a land you haven't, ...); doing it earns a feather. The lands
// collection is a page of small faceted tiles, one for each land of the world, that fill in as you
// fly over them, with a star when its sight is found (world.js LANDS). Now and then the companion
// races you round a ring course.
import * as W from '../world.js';
import { BIOMES, blend } from '../biomes.js';
import { facets } from '../facet.js';
import { journal, esc } from '../journal.js';
import { FOOD } from './food.js';

// the aims: a line for the Journal and the toast, and what does it (an event and a test)
const AIMS = {
  course: { text: 'Fly a whole ring course in one go.', on: 'ringLoop' },
  rings: { text: 'Fly through five rings of cloud.', on: 'ring', n: 5 },
  sing: { text: 'Sing with a songbird until it answers.', on: 'song' },
  mouse: { text: 'Catch a mouse.', on: 'catch', ok: e => e.kind === 'mouse' },
  fish: { text: 'Take a fish from the water.', on: 'catch', ok: e => e.kind === 'fish' },
  land: { text: 'Fly over a land you have not seen yet.', on: 'newLand' },
  sight: { text: 'Find a landmark.', on: 'landmark' },
  guide: { text: 'Add a page to your field guide.', on: 'sighted' },
  high: { text: 'Ride a thermal 250 m above the ground.', on: 'high' },
  pin: { text: 'Mark a good place on your map with a pin.', on: 'pin' },
  // what the lessons teach (sys/lessons.js): never offered as aims
  perch: { text: 'Land on a branch.', on: 'land', ok: k => k === 'perch', lesson: 1 },
  drink: { text: 'Land by water and drink.', on: 'drink', lesson: 1 },
  sleep: { text: 'Roost on a branch and sleep through a night.', on: 'sleep', lesson: 1 },
  far: { text: 'Fly two kilometres from where you were at dawn.', on: 'far', lesson: 1 },
};
const HIGH = 250;

export function aimsSystem(G) {
  const b = G.b;
  const A = { day: 0, aim: null, done: false, count: 0, feathers: 0, seen: {}, sights: {}, last: [] };

  // ---- the day's aim ------------------------------------------------------------------------
  function pick() {
    const pool = Object.keys(AIMS).filter(k => !AIMS[k].lesson && !A.last.includes(k) && !(k === 'land' && seenAll()));
    A.aim = pool[Math.floor(Math.random() * pool.length)] || 'rings'; A.day = G.day; A.done = false; A.count = 0;
    A.last = [...A.last, A.aim].slice(-4);
  }
  const offer = () => G.hud.glint('Today’s aim', `If you like: ${AIMS[A.aim].text[0].toLowerCase()}${AIMS[A.aim].text.slice(1)}`, 'keepsake');
  G.on('newDay', () => { pick(); if (!G.lessons?.learning) offer(); });   // while the lessons run (sys/lessons.js) they are the day's things to do
  for (const ev of new Set(Object.values(AIMS).map(a => a.on))) G.on(ev, e => {
    const a = AIMS[A.aim]; if (!a || A.done || a.on !== ev || (a.ok && !a.ok(e))) return;
    if (++A.count < (a.n || 1)) return;
    A.done = true; A.feathers++;
    G.hud.tally(`Aim done: feather ${A.feathers}`, 'keepsake');
    G.audio.ring?.();
  });
  // a thermal ride high above the ground: held for a moment and a half; and a few things other
  // systems don't announce (a drink, a night's sleep, two kilometres since dawn)
  let highT = 0, high = false, drank = 0, asleep = false, farFrom = null;

  // ---- racing the companion ----------------------------------------------------------------
  // through the first ring of a course, now and then (more often when it is with you) it races you round
  // the rest (sys/fauna.js G.companion.fly). Finish the course first and it brings you a mouse
  let race = null;   // { circuit, them: done?, t }
  const RACE = { odds: .5, join: .2, speed: 15, gift: FOOD.mouse };   // odds when it is with you, or must fly in to join
  G.on('ring', r => {
    const C = G.companion;
    if (race || r.k !== 0 || !C || C.busy || Math.random() > (C.here ? RACE.odds : RACE.join)) return;
    const course = W.ringsNear(r.x, r.z, 900).filter(q => q.circuit === r.circuit && q.k > 0).sort((a, c) => a.k - c.k);
    if (!course.length) return;
    race = { circuit: r.circuit, them: false, t: G.clock };
    C.fly(course.map(q => [q.x, q.y, q.z]), RACE.speed, () => { if (race?.circuit === r.circuit) race.them = true; });
    G.hud.toast('Your companion calls and races you round the course.', 3);
  });
  G.on('ringLoop', e => {
    if (!race || e.circuit !== race.circuit) return;
    if (!race.them) {
      G.hunger = Math.min(1, G.hunger + RACE.gift);
      G.hud.tally('Round first! A mouse for you', 'ring'); G.emit('raceWon');
    } else G.hud.tally('Your companion was first', 'ring');
    race = null;
  });

  // ---- the lands ----------------------------------------------------------------------------
  const KEYS = Object.keys(BIOMES);
  const landOf = (x, z) => { let best = null; for (const e of blend(x, z)) if (!best || e.w > best.w) best = e; return best?.name; };
  const seenAll = () => KEYS.every(k => A.seen[k]);
  // for the Map: the lands seen, of how many, and the feathers for aims kept
  G.collection = () => ({ lands: KEYS.filter(k => A.seen[k]).length, of: KEYS.length, sights: Object.keys(A.sights).length, feathers: A.feathers });
  let landT = 0;
  // a found landmark counts as its land's sight when it is the kind that land is known for
  G.on('landmark', l => {
    const land = landOf(l.x, l.z), want = (W.LANDS || []).find(e => e.key === land)?.sight;
    if (land && want && (l.kind === want || (want === 'summit' && l.summit)) && !A.sights[land]) {
      A.sights[land] = 1; G.hud.tally(`${BIOMES[land]?.label || 'This land'}: in your lands`, 'lands');
    }
  });

  // ---- the Journal: the day's aim on the Log, the lands on their own page --------------------
  const today = journal(G).section(5, 'Today');
  const lands = journal(G).section(45);
  // the chosen bird's life goal (sys/life.js G.life), as a checklist with counts
  const life = journal(G).section(7, 'Your life');
  const tile = {};
  G.menu.onOpen(() => {
    const a = AIMS[A.aim];
    today.el.classList.toggle('hidden', !!G.lessons?.learning);
    today.body.innerHTML = a ? `<p class="aim3 ${A.done ? 'done' : ''}"><i></i><span>${esc(a.text)}</span>${a.n && !A.done ? ` <small>${A.count} of ${a.n}</small>` : ''}</p>
      <p class="feathers3">${A.feathers ? `Feathers for aims kept: ${A.feathers}` : 'Each day brings one aim. It is only an offer.'}</p>` : '';
    const L = G.life;
    life.el.classList.toggle('hidden', !L);
    if (L) life.body.innerHTML = `<p class="life3t">${esc(L.title)}${L.done ? ' <small>Done.</small>' : ''}</p><ul class="life3">${L.steps.map(s => `<li class="${s.done ? 'done' : ''}"><i></i><span>${esc(s.text)}</span>${s.need > 1 ? ` <small>${Math.min(s.n, s.need)} of ${s.need}</small>` : ''}</li>`).join('')}</ul>`;
    const n = KEYS.filter(k => A.seen[k]).length;
    lands.body.innerHTML = `<p class="lands3sum">${n} of ${KEYS.length} lands flown over${(W.LANDS || []).length ? `, ${Object.keys(A.sights).length} sights found` : ''}.</p>
      <div class="lands3">${KEYS.map(k => `<figure class="${A.seen[k] ? 'seen' : ''}"><img alt="" src="${pic(k)}"><figcaption>${A.seen[k] ? esc(cap(BIOMES[k].label)) : '?'}${A.sights[k] ? ' <b title="sight found">★</b>' : ''}</figcaption></figure>`).join('')}</div>`;
  });
  const cap = t => t.replace(/^the /, '').replace(/^./, c => c.toUpperCase());
  // a small faceted tile in the land's own ground colours (cached)
  function pic(k) {
    if (tile[k]) return tile[k];
    const c = document.createElement('canvas'); c.width = 96; c.height = 64;
    const x = c.getContext('2d'), B = BIOMES[k];
    facets(x, 0, 0, 96, 64, 14, (px, py) => {
      const col = B.c(400 + px * 7, 20 + (64 - py) * 1.2, 300 + py * 9);
      return [col[0] * 255, col[1] * 255, col[2] * 255];
    }, { seed: k.length * 13 + k.charCodeAt(0), relief: .8 });
    return (tile[k] = c.toDataURL('image/png'));
  }

  return {
    id: 'aims',
    update(dt) {
      // a race left behind (the course broken off) ends quietly
      if (race && G.clock - race.t > 90) { G.companion?.stop?.(); race = null; }
      if (!A.aim || A.day !== G.day) { pick(); if (G.t > 3 && !G.lessons?.learning) offer(); }
      if ((landT -= dt) <= 0) {
        landT = 2;
        const k = landOf(b.p[0], b.p[2]);
        if (k && !A.seen[k]) { A.seen[k] = 1; if (Object.keys(A.seen).length > 1) { G.hud.tally(`New land: ${BIOMES[k]?.label || k}`, 'lands'); G.emit('newLand', k); } }
      }
      if (G.thirst < drank || b.eating > 0) drank = G.thirst; else if (G.thirst - drank > .05 && b.state !== 'fly') { G.emit('drink'); drank = G.thirst; }
      if (b.asleep && !asleep) G.emit('sleep'); asleep = !!b.asleep;
      if (farFrom?.day !== G.day) farFrom = { day: G.day, x: b.p[0], z: b.p[2], done: false };
      if (!farFrom.done && Math.hypot(W.wrapX(b.p[0] - farFrom.x), b.p[2] - farFrom.z) > 2000) { farFrom.done = true; G.emit('far'); }
      const up = b.state === 'fly' && b.lift > .8 && b.p[1] - Math.max(W.height(b.p[0], b.p[2]), W.WATER) > HIGH;
      if (!up) { high = false; highT = 0; } else if (!high && (highT += dt) > 1.5) { high = true; G.emit('high'); }
    },
    save: () => A,
    load(o) { Object.assign(A, o); },
  };
}
