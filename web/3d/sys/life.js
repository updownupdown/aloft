// A life goal for each bird, the shape of its years: the red-tail rules the open sky, the osprey
// fishes the coasts, the barn owl claims an old barn and hunts by moonlight, the albatross wanders
// the southern seas, the raven gathers a hoard of shiny things and plays in the wind. Steps are
// ticked off from the bus (catches, tricks, keepsakes, songs learned). (The mate, nest and chick
// steps went with the nest, James 2026-10-26.)
// G.life = { bird, title, steps: [{ id, text, n, need, done }], done } for the Journal, and 'life'
// is emitted whenever a step is done. Progress is kept per bird, so switching birds loses nothing.
import { landmarksNear } from '../world.js';
import { buildingsNear } from '../settle.js';
import { BIRD } from '../hawk.js';
import { oceanAt } from '../earth.js';

// [id, text, how many]; barns also count once the world has them (kind 'barn')
export const GOALS = {
  hawk: { title: 'The open sky', steps: [
    ['mice', 'Catch five mice', 5],
    ['stoop', 'Stoop at full speed, wings tucked, three times', 3],
    ['wingover', 'Three wingovers: bank hard one way, then the other', 3],
    ['barrel', 'A barrel roll: both wings round together'],
  ] },
  osprey: { title: 'The fishing coasts', steps: [
    ['plunge', 'Plunge feet first for three fish', 3],
    ['fish', 'Catch ten fish', 10],
    ['songs', 'Learn three songs from the shore birds', 3],
  ] },
  owl: { title: 'The old barn', steps: [
    ['moon', 'Catch three mice by moonlight', 3],
    ['silent', 'Glide in silently on five mice, never flapping', 5],
    ['home', 'Claim a roost: perch on an old barn, a chapel tower, a ruined tower or a great oak'],
  ] },
  albatross: { title: 'Wanderer of the southern seas', steps: [
    ['soar', 'Ride the sea wind: two minutes of dynamic soaring, weaving low over the swells', 4, 'quiet'],
    ['fish', 'Snatch three fish from the open sea', 3],
    ['sea', 'Fly 30 km over open sea', 30, 'quiet'],
  ] },
  raven: { title: 'A hoard and the wind', steps: [
    ['hoard', 'Gather five shiny things for your hoard', 5],
    ['tumble', 'Tumble three times: flick a bank twice the same way', 3],
    ['wind', 'Tumble while rising air carries you'],
    ['mimic', 'Learn three songbirds’ songs to copy', 3],
  ] },
};
const ROOSTS = new Set(['barn', 'chapel', 'tower', 'oak']);

export function lifeSystem(G) {
  const b = G.b, prog = {};   // prog[bird][step] = count
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
      G.audio.learned?.();
      if (G.life.done) G.hud.toast(`Your life goal is complete: ${GOALS[id].title.toLowerCase()}.`, 4.5); else G.hud.tally(`Life goal: ${step[1].split(':')[0].toLowerCase()}. Done!`, 'check');
      G.emit('life', G.life);
    } else if (need > 1 && !step[3]) G.hud.tally(`${step[1].split(':')[0]}: ${p[sid]} of ${need}`, 'check');
  }
  const nightNow = () => (G.light?.daylight ?? 1) < .3;
  // a landmark of a kind, or one of the empty farms' and villages' buildings (settle.js)
  const nearKind = (x, z, kinds, r) => landmarksNear(x, z, r).some(l => kinds.has(l.kind) && Math.hypot(l.x - x, l.z - z) < r)
    || buildingsNear(x, z, r).some(bd => kinds.has(bd.kind) && Math.hypot(bd.x - x, bd.z - z) < r);

  G.on('catch', e => {
    if (BIRD === 'hawk' && e.kind === 'mouse') tick('mice');
    if (BIRD === 'osprey' && e.kind === 'fish') { if (b.plunge) tick('plunge'); tick('fish'); }
    if (BIRD === 'owl' && e.kind === 'mouse') { if (nightNow()) tick('moon'); if (G.silent) tick('silent'); }
  });
  G.on('trick', (kind, lift) => {
    if (BIRD === 'hawk' && (kind === 'stoop' || kind === 'wingover' || kind === 'barrel')) tick(kind);
    if (kind === 'tumble') { tick('tumble'); if (lift) tick('wind'); }
  });
  G.on('dynSoar', () => tick('soar'));
  G.on('seaKm', () => tick('sea'));
  G.on('catch', e => { if (BIRD === 'albatross' && e.kind === 'fish' && oceanAt(b.p[0], b.p[2])) tick('fish'); });
  G.on('keepsake', () => { if (BIRD === 'raven') tick('hoard'); });
  G.on('learn', () => { if (BIRD === 'raven') tick('mimic'); if (BIRD === 'osprey') tick('songs'); });
  G.on('land', kind => { if (BIRD === 'owl' && kind === 'perch' && nearKind(b.p[0], b.p[2], ROOSTS, 45)) tick('home'); });
  G.on('bird', () => { view(); G.emit('life', G.life); });

  view();
  return {
    id: 'life',
    save() { return { prog }; },
    load(o) { Object.assign(prog, o?.prog || {}); view(); },
  };
}
