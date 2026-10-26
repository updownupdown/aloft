// The nest: twigs lie under some trees; land beside one to pick it up, then perch on a branch to
// start a nest there. Five twigs and there is an egg; a day later a chick, hungry: catch mice and
// keep part of each for it, and carry it home. Five meals and it fledges and flies with you.
// Last year's nest tree is remembered, and a few twigs there start this year's. A nest built on
// year after year grows deeper (a layer of old sticks under it for each year) and keeps its trinkets.
// You choose the tree (N1): perched with your first twig, Build here starts it; until there is an
// egg, Move the nest here carries it and its twigs to the tree you are in. The nest tree's own
// branches hold a few dead twigs (N2): hop to one to snap it off, hop back to lay it. The egg comes
// only in spring (N3; the tropics any time, and the first half of summer too); a nest finished
// out of season lies ready until then. The chick's hunger shows on Today (N4).
import { height, treesNear, perchesOf, ih } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { DAY } from '../sky.js';
import { journal } from '../journal.js';
import { icon, birdKey } from '../icons.js';
import { BIRD } from '../hawk.js';

export const NEST_TWIGS = 5, CHICK_MEALS = 5;
export const NESTING = { crown: 2, hungry: 240 };   // dead twigs on the nest tree a day; seconds unfed before the chick is hungry
const NEAR = 3.2;   // metres from the nest that count as at it
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

function twigShape() {
  const B = builder(), c = [.45, .33, .22], c2 = [.38, .27, .18];
  const stick = (a, b, w, col) => { B.tri([a[0], a[1] + w, a[2]], [b[0], b[1] + w, b[2]], [b[0], b[1], b[2] + w], col); B.tri([a[0], a[1] + w, a[2]], [b[0], b[1], b[2] + w], [a[0], a[1], a[2] + w], col); };
  stick([-.25, .02, 0], [.25, .03, .02], .025, c); stick([.05, .025, .01], [.16, .03, .1], .018, c2); stick([-.1, .02, 0], [-.18, .025, -.08], .015, c2);
  return B.out();
}
function nestShape() {
  // a shallow bowl of crossed sticks
  const B = builder();
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * 6.283, a2 = a + 1.1 + (i % 3) * .3, r = .32 + (i % 2) * .04, y = .05 + (i % 4) * .03;
    const p = [Math.cos(a) * r, y, Math.sin(a) * r], q = [Math.cos(a2) * r, y + .02, Math.sin(a2) * r], col = i % 2 ? [.45, .34, .22] : [.36, .27, .18];
    B.tri(p, q, [q[0], q[1] + .05, q[2]], col); B.tri(p, [q[0], q[1] + .05, q[2]], [p[0], p[1] + .05, p[2]], col);
  }
  B.tri([-.3, .05, -.2], [.3, .05, -.2], [0, .05, .32], [.3, .22, .14]);
  return B.out();
}
function eggShape() { reseed(3); const B = builder(); blob(B, 0, .1, 0, .07, [.92, .9, .84], [.85, .82, .74], [1, 1.25, 1]); return B.out(); }
function chickShape() {
  reseed(4); const B = builder(), down = [.93, .9, .84];
  blob(B, 0, .14, 0, .11, down, [.85, .8, .72]);
  blob(B, .06, .28, 0, .07, down, down);
  B.tri([.12, .29, -.015], [.12, .29, .015], [.17, .27, 0], [.3, .28, .25]);
  return B.out();
}

export function nestSystem(G) {
  const b = G.b;
  for (const [k, f] of [['twig', twigShape], ['nest', nestShape], ['egg', eggShape], ['chick', chickShape]]) G.R.shape(k, f());
  G.nest = null; G.carry = null;
  let old = null;          // last year's nest, to build on again
  let taken = new Set();   // trees whose twig was picked up today
  const twigOf = t => {
    if (t.kind || ih(t.id, 1, 401) > .3 || taken.has(t.id)) return null;
    const a = ih(t.id, 2, 402) * 6.283, x = t.x + Math.cos(a) * 2.4, z = t.z + Math.sin(a) * 2.4;
    return { id: t.id, x, y: height(x, z), z, yaw: a };
  };
  const twigsNear = (x, z, r) => treesNear(x, z, r).map(twigOf).filter(Boolean);
  const atNest = (p, n = G.nest) => n && Math.hypot(p.x - n.x, p.y - n.y, p.z - n.z) < NEAR;
  const say = (m, s = 4) => G.hud.toast(m, s), tally = m => G.hud.tally(m, 'twig');
  const trinkets = () => G.story?.keepsakes?.length || 0;
  G.dev?.add({ id: 'nest-years', area: 'Journal and story', round: 'R8 F2', pr: 182, title: 'The nest grows over the years and keeps its trinkets',
    how: 'Mend last year’s nest each spring: a layer of old sticks for each year, keepsakes on the rim; the Journal counts its years. Try it ages your nest a year.',
    go: () => { if (G.nest) G.nest.years = (G.nest.years || 1) + 1; else G.hud.reply('Build a nest first: Try it ages the nest you have.', 3); } });

  G.hud.tip('twig', () => !G.carry && b.state === 'fly' && b.p[1] - height(b.p[0], b.p[2]) < 25 && twigsNear(b.p[0], b.p[2], 20).length > 0 && !(G.nest?.twigs >= NEST_TWIGS), 'A twig under the tree. Land beside it to pick it up, then perch on a branch to start a nest.');
  G.hud.tip('nestbranch', () => G.carry === 'twig' && !G.nest, 'Carrying a twig. Perch on a branch (fly slowly into a tree) and tap Build here to start your nest there.');

  // the egg's season: spring, the first half of summer, or any time in the tropics
  const eggTime = () => { const s = G.season || {}; return s.tropic || s.i === 3 || (s.i === 0 && s.d < 4); };
  // the nest tree's own dead twigs (N2): on its branches a short hop from the nest, a few a day
  let crownTaken = new Set();
  const nestTree = () => { const n = G.nest; return n && treesNear(n.x, n.z, 6).find(t => perchesOf(t).some(p => Math.hypot(p.x - n.x, p.y - n.y, p.z - n.z) < .5)); };
  function crown() {
    const n = G.nest; if (!n || n.twigs >= NEST_TWIGS || n.eggAt !== undefined) return [];
    const t = nestTree(); if (!t) return [];
    return perchesOf(t).map((p, i) => ({ p, i, id: t.id * 64 + i })).filter(q => !q.p.top && Math.hypot(q.p.x - n.x, q.p.y - n.y, q.p.z - n.z) > 1.5 && ih(q.id, G.day || 0, 403) < .5 && !crownTaken.has(q.id)).slice(0, NESTING.crown);
  }
  // perched with a twig, no nest yet (or one without an egg, in another tree): build or move it here
  const canBuild = () => G.carry === 'twig' && b.state === 'perch' && b.perch && !(b.settle > 0) && !b.asleep && !(old && atNest(b.perch, old));
  (G.actions ||= {}).build = {
    run: () => build(b.perch),
    when: () => canBuild() && !G.nest,
  };
  G.actions.movenest = {
    run: () => move(b.perch),
    when: () => canBuild() && !!G.nest && G.nest.eggAt === undefined && !atNest(b.perch) && !b.carry,
  };
  function build(p) {
    G.nest = { x: p.x, y: p.y, z: p.z, twigs: 1, fed: 0, years: 1, place: G.placeName?.(p.x, p.z) || 'the woods' };
    G.carry = null; G.audio.rustle?.(.8); G.hud.did('nestbranch'); tally('Nest started: 1 of 5 twigs');
    G.hud.glint('Your nest tree', 'Dead twigs hang on your nest tree’s own branches: hop to one to snap it off, and hop back to lay it. More lie under broadleaf trees.', 'twig');
  }
  function move(p) {
    const n = G.nest; Object.assign(n, { x: p.x, y: p.y, z: p.z, place: G.placeName?.(p.x, p.z) || n.place });
    n.twigs = Math.min(NEST_TWIGS, n.twigs + 1); G.carry = null; G.audio.rustle?.(.8); crownTaken = new Set();
    tally(`Nest moved here: ${n.twigs} of ${NEST_TWIGS} twigs`);
    if (n.twigs === NEST_TWIGS) finished(n);
  }
  function finished(n) {
    G.audio.learned?.();
    if (eggTime()) { n.eggAt = G.clock; say('The nest is finished, and there is an egg in it! It hatches in about a day.', 5); }
    else say('The nest is finished. It lies ready until spring, when an egg comes.', 5);
  }

  G.on('land', kind => {
    if (kind === 'perch' && b.perch && !G.carry) {   // a dead twig on the nest tree: snapped off
      const q = crown().find(c => c.p === b.perch || Math.hypot(c.p.x - b.perch.x, c.p.y - b.perch.y, c.p.z - b.perch.z) < .3);
      if (q) { crownTaken.add(q.id); G.carry = 'twig'; G.audio.rustle?.(.5); tally('A twig snapped off: hop back to the nest'); return; }
    }
    if (kind === 'ground' && !G.carry) {
      const t = twigsNear(b.p[0], b.p[2], 12).find(w => Math.hypot(w.x - b.p[0], w.z - b.p[2]) < 3.5);
      if (t) { taken.add(t.id); G.carry = 'twig'; G.audio.rustle?.(.5); G.hud.did('twig'); if (G.nest) tally('A twig for the nest'); else G.hud.glint('A twig', 'A twig. Perch on a branch to start a nest with it.', 'twig'); }
    }
    if (kind === 'perch' && b.perch) atPerch(b.perch);
  });
  // a catch carried home in the feet drops into the nest (food.js asks on landing there): the
  // chick eats it; with no chick it is kept in the nest (food.js)
  G.nestDrop = () => {
    const n = G.nest; if (!n?.chick) return false;
    n.fed++; n.fedAt = G.clock; G.audio.eat?.();
    for (let k = 0; k < 10; k++) G.part([n.x, n.y + .3, n.z], [(Math.random() - .5) * 1.5, 1 + Math.random(), (Math.random() - .5) * 1.5], .8, [1, .9, .6], .07);
    if (n.fed >= CHICK_MEALS) {
      n.chick = false; n.fledged = true; if (G.journey) G.journey.yearChicks++;
      G.audio.learned?.(); say('Your chick has fledged! It flies with you now.', 5); G.emit('fledged');
    } else G.hud.tally(`Chick fed: ${n.fed} of ${CHICK_MEALS}`, 'nest');
    return true;
  };

  function atPerch(p) {
    const n = G.nest;
    if (G.carry === 'twig') {
      if (!n) {
        if (old && atNest(p, old)) {
          const years = (old.years || 1) + 1;
          G.nest = { ...old, twigs: 3, fed: 0, years }; delete G.nest.chick; delete G.nest.fledged; delete G.nest.eggAt; old = null; G.carry = null; G.audio.rustle?.(.8);
          tally(`Last year’s nest: two more twigs`); G.emit('nestYear', years); return;
        }
        // a new nest waits for you to choose: Build here (with the one action button off, it is built at once)
        if (!G.settings?.oneAction) return build(p);
        if (!G.flags.buildHere) { G.flags.buildHere = 1; G.hud.glint('Build here?', 'Tap Build here to start your nest in this tree, or fly on and choose another.', 'nest'); }
        return;
      }
      if (!atNest(p)) {
        if (n.eggAt === undefined) { if (!G.flags.moveNest) { G.flags.moveNest = 1; G.hud.glint('Move the nest?', 'Until there is an egg you can still move your nest: tap Move the nest here, and it comes with its twigs.', 'nest'); } return; }
        G.hud.say('Twigs go to your nest. The compass shows where it is.', { kind: 'warn', secs: 3, icon: 'nest' }); return;
      }
      if (n.twigs < NEST_TWIGS) {
        n.twigs++; G.carry = null; G.audio.rustle?.(.8);
        if (n.twigs === NEST_TWIGS) finished(n);
        else tally(`Nest: ${n.twigs} of ${NEST_TWIGS} twigs`);
      }
      return;
    }
  }

  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  // (a quarter: a nest begun in the nearest tree; a half: finished, an egg in it; all: a chick fledged)
  G.on('mock', k => {
    G.nest = null; old = null; G.carry = null;
    const t = k && treesNear(b.p[0], b.p[2], 400).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0], p = t && perchesOf(t).find(q => !q.top);
    if (!p) return;
    G.nest = { x: p.x, y: p.y, z: p.z, twigs: k >= .5 ? NEST_TWIGS : 3, fed: 0, years: 1, place: G.placeName?.(p.x, p.z) || 'the woods' };
    if (k >= 1) G.nest.fledged = true; else if (k >= .5) G.nest.eggAt = G.clock;
  });
  // the year turns: the nest becomes last year's, waiting to be built on
  G.on('newYear', () => { if (G.nest) { old = { x: G.nest.x, y: G.nest.y, z: G.nest.z, place: G.nest.place, years: G.nest.years || 1 }; G.nest = null; } if (old) G.hud.glint('Your old nest', 'Your old nest tree still stands; a few twigs there start this year’s nest.', 5); });
  G.on('newDay', () => { taken = new Set(); crownTaken = new Set(); });

  const status = () => {
    const n = G.nest;
    if (!n) return old ? `Last year’s nest waits in ${old.place}${old.years > 1 ? `, ${old.years} years old` : ''}. Bring a twig there to mend it.` : 'No nest yet. Twigs lie under some broadleaf trees: land beside one to pick it up, then perch on a branch to start a nest.';
    if (n.fledged) return 'Your chick has fledged and flies with you.';
    if (n.twigs < NEST_TWIGS) return `Building a nest in ${n.place}: ${n.twigs} of ${NEST_TWIGS} twigs.`;
    if (n.eggAt === undefined) return `Your nest in ${n.place} is finished, and lies ready until spring, when an egg comes.`;
    if (!n.chick) return `An egg in your nest in ${n.place}. It hatches ${G.clock - n.eggAt > DAY * .6 ? 'very soon' : 'in about a day'}.`;
    return `A chick in your nest in ${n.place}, hungry: ${n.fed} of ${CHICK_MEALS} meals brought. Catch something and carry it home in your feet: it drops into the nest.`;
  };
  // Journal > Nest and family: the nest's four steps (twigs, egg, chick, fledged) as a track, then
  // where it stands in words
  const sec = journal(G).section(30, 'Your nest');
  sec.el.classList.add('fam3');
  sec.body.innerHTML = '<ol class="steps3"></ol><p class="fnote3"></p>';
  const age = () => G.nest?.years > 1 ? ` This nest has stood ${G.nest.years} years, deeper each spring, with ${trinkets()} ${trinkets() === 1 ? 'trinket' : 'trinkets'} woven in.` : '';
  const pips = (n, of) => `<span class="pips3f">${Array.from({ length: of }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
  G.menu.onOpen(() => {
    const n = G.nest, at = !n ? 0 : n.fledged ? 4 : n.chick ? 3 : n.twigs >= NEST_TWIGS ? 2 : 1;
    const steps = [
      ['twig', 'Twigs', n ? pips(Math.min(n.twigs, NEST_TWIGS), NEST_TWIGS) : `<small>${NEST_TWIGS} to build</small>`],
      ['nest', 'Egg', `<small>${at > 2 ? 'hatched' : at === 2 ? n.eggAt === undefined ? 'in spring' : 'in the nest' : 'when it’s built'}</small>`],
      [birdKey(BIRD), 'Chick', at === 3 ? pips(n.fed, CHICK_MEALS) : `<small>${at > 3 ? 'grown' : `${CHICK_MEALS} meals`}</small>`],
      ['takeoff', 'Fledged', '<small>flies with you</small>'],
    ];
    sec.body.firstChild.innerHTML = steps.map(([ic, t, sub], i) => `<li class="${i + 1 < at || at === 4 ? 'done' : i + 1 === at ? 'now' : ''}"><span class="si3">${icon(ic)}</span><b>${t}</b>${sub}</li>`).join('');
    sec.body.lastChild.textContent = status() + age() + (G.carry === 'twig' ? ' You are carrying a twig.' : '');
  });

  return {
    id: 'nest',
    update() {
      const n = G.nest;
      // a nest that lay ready: spring comes, and an egg
      if (n && n.twigs >= NEST_TWIGS && n.eggAt === undefined && !n.fledged && eggTime()) { n.eggAt = G.clock; G.hud.glint('An egg', 'Spring: there is an egg in your nest. It hatches in about a day.', 'nest'); }
      if (n && n.eggAt !== undefined && !n.chick && !n.fledged && G.clock - n.eggAt > DAY) {
        n.chick = true; n.fed = 0; n.fedAt = G.clock;
        say('Your egg has hatched! Bring the chick food: catch something and fly it home in your feet.', 6);
      }
      // the chick's hunger (Today shows it; story.js's mate feeds it too, and sets fedAt)
      if (n?.chick) {
        if (n.fedAt === undefined) n.fedAt = G.clock;
        const hungry = G.clock - n.fedAt > NESTING.hungry;
        if (hungry && !n.hungry) G.hud.glint('Your chick is hungry', 'Your chick is calling for food. Catch something and carry it home in your feet.', 'nest');
        n.hungry = hungry;
      }
    },
    scene(S) {
      const tw = S.props.twig ||= [];
      for (const t of twigsNear(S.cam[0], S.cam[2], 70)) tw.push(t.x, t.y + .02, t.z, 1, t.yaw, .5, 0, 0);
      if (G.nest && Math.hypot(G.nest.x - S.cam[0], G.nest.z - S.cam[2]) < 80) for (const q of crown()) tw.push(q.p.x, q.p.y + .06, q.p.z, .9, (q.p.a ?? 0) + .4, .35, 0, 0);
      if (G.carry === 'twig' && S.hawk) tw.push(S.hawk.p[0], S.hawk.p[1] - .28, S.hawk.p[2], .8, b.yaw, .5, 0, 0);
      const n = G.nest; if (!n) return;
      const k = Math.min(1, .45 + n.twigs * .11), yrs = Math.min(5, n.years || 1), ns = S.props.nest ||= [];
      ns.push(n.x, n.y - .08, n.z, k * (1 + (yrs - 1) * .06), 0, .5, 0, 0);
      // the years beneath: a layer of older, greyer sticks for each spring, each a little wider
      for (let i = 1; i < yrs; i++) ns.push(n.x, n.y - .08 - i * .085, n.z, k * (1 + (yrs - 1 - i) * .06 + .03), i * 1.3, .5 - i * .08, 0, 0);
      // its trinkets: the keepsakes you have found, tucked into the rim
      const kn = Math.min(6, trinkets()), ks = S.props.keepsake ||= [];
      for (let i = 0; i < kn; i++) { const a = i * 2.4 + n.x, r = .3 * k; ks.push(n.x + Math.cos(a) * r, n.y + .02, n.z + Math.sin(a) * r, .7, a, .5, 0, 0); }
      if (n.eggAt !== undefined && !n.chick && !n.fledged) S.props.egg = (S.props.egg || []).concat([n.x, n.y - .02, n.z, 1, 0, .5, 0, 0]);
      if (n.chick) S.props.chick = (S.props.chick || []).concat([n.x, n.y - .02, n.z, 1 + Math.sin(G.t * 3) * .04, G.t * .4 % 6.283, .5, 0, 0]);
    },
    save: () => ({ nest: G.nest && { ...G.nest, hungry: undefined }, old, carry: G.carry }),
    load(o) { G.nest = o.nest || null; old = o.old || null; G.carry = o.carry === 'twig' ? 'twig' : null; },
  };
}
