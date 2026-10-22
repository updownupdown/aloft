// The nest: twigs lie under some trees; land beside one to pick it up, then perch on a branch to
// start a nest there. Five twigs and there is an egg; a day later a chick, hungry: catch mice and
// keep part of each for it, and carry it home. Five meals and it fledges and flies with you.
// Last year's nest tree is remembered, and a few twigs there start this year's. A nest built on
// year after year grows deeper (a layer of old sticks under it for each year) and keeps its trinkets.
import { height, treesNear, ih } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { DAY } from '../sky.js';
import { journal } from '../journal.js';

export const NEST_TWIGS = 5, CHICK_MEALS = 5;
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
  const say = (m, s = 4) => G.hud.toast(m, s);
  const trinkets = () => G.story?.keepsakes?.length || 0;
  G.dev?.add({ id: 'nest-years', area: 'Journal and story', round: 'R8 F2', pr: 182, title: 'The nest grows over the years and keeps its trinkets',
    how: 'Mend last year’s nest each spring: a layer of old sticks for each year, keepsakes on the rim; the Journal counts its years. Try it ages your nest a year.',
    go: () => { if (G.nest) G.nest.years = (G.nest.years || 1) + 1; else say('Build a nest first: Try it ages the nest you have.', 3); } });

  G.hud.tip('twig', () => !G.carry && b.state === 'fly' && b.p[1] - height(b.p[0], b.p[2]) < 25 && twigsNear(b.p[0], b.p[2], 20).length > 0 && !(G.nest?.twigs >= NEST_TWIGS), 'A twig under the tree. Land beside it to pick it up, then perch on a branch to start a nest.');
  G.hud.tip('nestbranch', () => G.carry === 'twig' && !G.nest, 'Carrying a twig. Perch on a branch (fly slowly into a tree) to start your nest there.');

  G.on('land', kind => {
    if (kind === 'ground' && !G.carry) {
      const t = twigsNear(b.p[0], b.p[2], 12).find(w => Math.hypot(w.x - b.p[0], w.z - b.p[2]) < 3.5);
      if (t) { taken.add(t.id); G.carry = 'twig'; G.audio.rustle?.(.5); G.hud.did('twig'); say(G.nest ? 'A twig. Carry it to your nest.' : 'A twig. Perch on a branch to start a nest with it.', 3); }
    }
    if (kind === 'perch' && b.perch) atPerch(b.perch);
  });
  // a mouse caught while the chick is hungry: part of it is kept for the chick
  G.on('catch', () => { const n = G.nest; if (n?.chick && !G.carry) { G.carry = 'mouse'; say('You keep part of the mouse for your chick. Carry it home to the nest.', 4); } });

  function atPerch(p) {
    const n = G.nest;
    if (G.carry === 'twig') {
      if (!n) {
        if (old && atNest(p, old)) {
          const years = (old.years || 1) + 1;
          G.nest = { ...old, twigs: 3, fed: 0, years }; delete G.nest.chick; delete G.nest.fledged; delete G.nest.eggAt; old = null; G.carry = null; G.audio.rustle?.(.8);
          say(`Last year’s nest, mended for its ${ORD[years] || `${years}th`} spring: two more twigs.`); G.emit('nestYear', years); return;
        }
        G.nest = { x: p.x, y: p.y, z: p.z, twigs: 1, fed: 0, years: 1, place: G.placeName?.(p.x, p.z) || 'the woods' };
        G.carry = null; G.audio.rustle?.(.8); G.hud.did('nestbranch'); say('You started a nest. Bring four more twigs.'); return;
      }
      if (!atNest(p)) { say('Twigs go to your nest. The Journal map shows where it is.', 3); return; }
      if (n.twigs < NEST_TWIGS) {
        n.twigs++; G.carry = null; G.audio.rustle?.(.8);
        if (n.twigs === NEST_TWIGS) { n.eggAt = G.clock; G.audio.learned?.(); say('The nest is finished, and there is an egg in it! It hatches in about a day.', 5); }
        else say(`Nest: ${n.twigs} of ${NEST_TWIGS} twigs.`, 2.5);
      }
      return;
    }
    if (G.carry === 'mouse' && atNest(p) && n.chick) {
      n.fed++; G.carry = null; G.audio.eat?.();
      for (let k = 0; k < 10; k++) G.part([n.x, n.y + .3, n.z], [(Math.random() - .5) * 1.5, 1 + Math.random(), (Math.random() - .5) * 1.5], .8, [1, .9, .6], .07);
      if (n.fed >= CHICK_MEALS) {
        n.chick = false; n.fledged = true; if (G.journey) G.journey.yearChicks++;
        G.audio.learned?.(); say('Your chick has fledged! It flies with you now.', 5); G.emit('fledged');
      } else say(`Fed your chick: ${n.fed} of ${CHICK_MEALS}.`, 2.5);
    }
  }

  // the year turns: the nest becomes last year's, waiting to be built on
  G.on('marsh', () => { if (G.nest) old = { x: G.nest.x, y: G.nest.y, z: G.nest.z, place: G.nest.place, years: G.nest.years || 1 }; });
  G.on('newYear', () => { if (G.nest) { old = { x: G.nest.x, y: G.nest.y, z: G.nest.z, place: G.nest.place, years: G.nest.years || 1 }; G.nest = null; } if (old) say('Your old nest tree still stands; a few twigs there start this year’s nest.', 5); });
  G.on('newDay', () => { taken = new Set(); });

  const status = () => {
    const n = G.nest;
    if (!n) return old ? `Last year’s nest waits in ${old.place}${old.years > 1 ? `, ${old.years} years old` : ''}. Bring a twig there to mend it.` : 'No nest yet. Twigs lie under some broadleaf trees: land beside one to pick it up, then perch on a branch to start a nest.';
    if (n.fledged) return 'Your chick has fledged and flies with you.';
    if (n.twigs < NEST_TWIGS) return `Building a nest in ${n.place}: ${n.twigs} of ${NEST_TWIGS} twigs.`;
    if (!n.chick) return `An egg in your nest in ${n.place}. It hatches ${G.clock - n.eggAt > DAY * .6 ? 'very soon' : 'in about a day'}.`;
    return `A chick in your nest in ${n.place}, hungry: ${n.fed} of ${CHICK_MEALS} meals brought. Catch a mouse and carry part of it home.`;
  };
  const sec = journal(G).section(30);
  sec.body.innerHTML = '<p></p>';
  const age = () => G.nest?.years > 1 ? ` This nest has stood ${G.nest.years} years, deeper each spring, with ${trinkets()} ${trinkets() === 1 ? 'trinket' : 'trinkets'} woven in.` : '';
  G.menu.onOpen(() => { sec.body.firstChild.textContent = status() + age() + (G.carry ? ` You are carrying ${G.carry === 'twig' ? 'a twig' : 'a meal for the chick'}.` : ''); });

  return {
    id: 'nest',
    update() {
      const n = G.nest;
      if (n && n.eggAt !== undefined && !n.chick && !n.fledged && G.clock - n.eggAt > DAY) {
        n.chick = true; n.fed = 0;
        say('Your egg has hatched! Bring the chick food: catch a mouse and carry part of it to the nest.', 6);
      }
    },
    scene(S) {
      const tw = S.props.twig ||= [];
      for (const t of twigsNear(S.cam[0], S.cam[2], 70)) tw.push(t.x, t.y + .02, t.z, 1, t.yaw, .5, 0, 0);
      if (G.carry === 'twig' && S.hawk) tw.push(S.hawk.p[0], S.hawk.p[1] - .28, S.hawk.p[2], .8, b.yaw, .5, 0, 0);
      if (G.carry === 'mouse' && S.hawk && G.R) (S.props.mouse ||= []).push(S.hawk.p[0], S.hawk.p[1] - .32, S.hawk.p[2], 1.4, b.yaw - Math.PI / 2, .5, 0, 0);
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
    save: () => ({ nest: G.nest, old, carry: G.carry }),
    load(o) { G.nest = o.nest || null; old = o.old || null; G.carry = o.carry || null; },
  };
}
