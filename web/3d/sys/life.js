// A life goal for each bird, the shape of its years: the red-tail raises a family, the osprey
// builds a nest by the sea and fishes for its mate, the barn owl claims an old barn and hunts by
// moonlight, the raven gathers a hoard of shiny things and plays in the wind. Steps are ticked off
// from the bus (catches, tricks, keepsakes, songs learned, fledging) and from the story's state.
// G.life = { bird, title, steps: [{ id, text, n, need, done }], done } for the Journal, and 'life'
// is emitted whenever a step is done. Progress is kept per bird, so switching birds loses nothing.
import { height, WATER, landmarksNear } from '../world.js';
import { buildingsNear } from '../settle.js';
import { BIRD } from '../hawk.js';
import { NEST_TWIGS } from './nest.js';
import { oceanAt } from '../earth.js';

// [id, text, how many]; barns and sea stacks also count once the world has them (kinds 'barn', 'stack')
export const GOALS = {
  hawk: { title: 'Raise a family', steps: [
    ['mate', 'Find a mate: show off with stoops and wingovers'],
    ['nest', 'Build a nest of five twigs'],
    ['chick', 'Hatch a chick'],
    ['fledge', 'Feed your chick until it fledges'],
  ] },
  osprey: { title: 'A nest by the sea', steps: [
    ['plunge', 'Plunge feet first for three fish', 3],
    ['mate', 'Find a mate'],
    ['nest', 'Build your nest beside the water, on a sea stack or a tall tree'],
    ['feed', 'Catch three fish with your mate beside you', 3],
    ['fledge', 'Raise a chick until it fledges'],
  ] },
  owl: { title: 'The old barn', steps: [
    ['moon', 'Catch three mice by moonlight', 3],
    ['silent', 'Glide in silently on five mice, never flapping', 5],
    ['home', 'Claim a roost: perch on an old barn, a chapel tower, a ruined tower or a great oak'],
    ['mate', 'Find a mate'],
    ['fledge', 'Raise an owlet until it fledges'],
  ] },
  albatross: { title: 'Wanderer of the southern seas', steps: [
    ['soar', 'Ride the sea wind: two minutes of dynamic soaring, weaving low over the swells', 4, 'quiet'],
    ['fish', 'Snatch three fish from the open sea', 3],
    ['sea', 'Fly 30 km over open sea', 30, 'quiet'],
    ['mate', 'Find a mate'],
    ['fledge', 'Raise a chick until it fledges'],
  ] },
  raven: { title: 'A hoard and the wind', steps: [
    ['hoard', 'Gather five shiny things for your hoard', 5],
    ['tumble', 'Tumble three times: flick a bank twice the same way', 3],
    ['wind', 'Tumble while rising air carries you'],
    ['mimic', 'Learn three songbirds’ songs to copy', 3],
    ['mate', 'Find a mate'],
  ] },
};
const ROOSTS = new Set(['barn', 'chapel', 'tower', 'oak']), COASTS = new Set(['stack', 'lighthouse']);

export function lifeSystem(G) {
  const b = G.b, prog = {};   // prog[bird][step] = count
  let quiet = true;           // the first check after loading ticks off what's already true without fanfare
  const goal = () => GOALS[BIRD] ? BIRD : 'hawk';
  function view() {
    const id = goal(), g = GOALS[id], p = prog[id] || {};
    const steps = g.steps.map(([sid, text, need = 1]) => ({ id: sid, text, n: Math.min(need, p[sid] || 0), need, done: (p[sid] || 0) >= need }));
    G.life = { bird: id, title: g.title, steps, done: steps.every(s => s.done) };
  }
  // count a step for the bird you are now; announce it when it completes
  function tick(sid, by = 1, set) {
    const id = goal(), step = GOALS[id].steps.find(s => s[0] === sid); if (!step) return;
    const need = step[2] || 1, p = prog[id] ||= {}, was = p[sid] || 0;
    if (was >= need) return;
    p[sid] = set ? Math.max(was, by) : was + by;
    view();
    if (p[sid] >= need) {
      if (!quiet) {
        G.audio.learned?.();
        if (G.life.done) G.hud.toast(`Your life goal is complete: ${GOALS[id].title.toLowerCase()}.`, 4.5); else G.hud.tally(`Life goal: ${step[1].split(':')[0].toLowerCase()}. Done!`, 'done');
      }
      G.emit('life', G.life);
    } else if (!quiet && need > 1 && !step[3]) G.hud.tally(`${step[1].split(':')[0]}: ${p[sid]} of ${need}`, 'done');
  }
  const nightNow = () => (G.light?.daylight ?? 1) < .3;
  const nearWater = (x, z) => {
    for (let a = 0; a < 8; a++) for (const r of [25, 55]) if (height(x + Math.cos(a * .785) * r, z + Math.sin(a * .785) * r) < WATER) return true;
    return false;
  };
  // a landmark of a kind, or one of the empty farms' and villages' buildings (settle.js)
  const nearKind = (x, z, kinds, r) => landmarksNear(x, z, r).some(l => kinds.has(l.kind) && Math.hypot(l.x - x, l.z - z) < r)
    || buildingsNear(x, z, r).some(bd => kinds.has(bd.kind) && Math.hypot(bd.x - x, bd.z - z) < r);

  G.on('catch', e => {
    if (BIRD === 'osprey' && e.kind === 'fish') { if (b.plunge) tick('plunge'); if (G.story?.mate) tick('feed'); }
    if (BIRD === 'owl' && e.kind === 'mouse') { if (nightNow()) tick('moon'); if (G.silent) tick('silent'); }
  });
  G.on('trick', (kind, lift) => { if (kind !== 'tumble') return; tick('tumble'); if (lift) tick('wind'); });
  G.on('dynSoar', () => tick('soar'));
  G.on('seaKm', () => tick('sea'));
  G.on('catch', e => { if (BIRD === 'albatross' && e.kind === 'fish' && oceanAt(b.p[0], b.p[2])) tick('fish'); });
  G.on('keepsake', () => { if (BIRD === 'raven') tick('hoard'); });
  G.on('learn', () => { if (BIRD === 'raven') tick('mimic'); });
  G.on('fledged', () => tick('fledge'));
  G.on('land', kind => { if (BIRD === 'owl' && kind === 'perch' && nearKind(b.p[0], b.p[2], ROOSTS, 45)) tick('home'); });
  G.on('bird', () => { view(); G.emit('life', G.life); });

  // the story's state, checked now and then: a mate, a nest, a chick
  let checkT = 0;
  function check() {
    const n = G.nest;
    if (G.story?.mate) tick('mate');
    if (n && n.twigs >= NEST_TWIGS) {
      if (BIRD !== 'osprey' || nearWater(n.x, n.z) || nearKind(n.x, n.z, COASTS, 120)) tick('nest');
      if (n.chick || n.fledged) tick('chick');
    }
    quiet = false;
  }
  view();
  return {
    id: 'life',
    update(dt) { if ((checkT -= dt) <= 0) { checkT = 1; check(); } },
    save() { return { prog }; },
    load(o) { Object.assign(prog, o?.prog || {}); view(); },
  };
}
