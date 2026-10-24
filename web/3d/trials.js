// Play tests (Settings > Advanced > Play tests): gameplay ideas on trial behind switches, off unless
// turned on, for trying on the phone (the daily gameplay study, 2026-10-24). Systems read
// G.trial.<id>. ?trial=water,pounce (or ?trial=all, or the letters) tries them for one visit
// without saving. Keep one for good by making it the rule and taking its switch away.
import { store } from './util.js';

export const TRIALS = [
  { id: 'water', letter: 'A', label: 'Water on the compass', sub: 'thirsty in flight, the nearest fresh water shows as a drop on the compass' },
  { id: 'pounce', letter: 'B', label: 'Pounce from a perch', sub: 'perched, tap a mouse within 35 m to drop on it; mice near a still perch show themselves' },
];

export function createTrials(G) {
  const q = new URLSearchParams(location.search).get('trial'), forced = q ? new Set(q.split(',')) : null;
  G.trial = {};
  for (const T of TRIALS) G.trial[T.id] = forced ? forced.has('all') || forced.has(T.id) || forced.has(T.letter) : !!store.get('trial.' + T.id, false);
  const set = (id, v) => {
    if (G.trial[id] === v) return;
    G.trial[id] = v; if (!forced) store.set('trial.' + id, v);
    G.emit('trial', G.trial);
  };
  for (const T of TRIALS) G.menu.toggle('play', { label: `${T.letter}. ${T.label}`, sub: T.sub, group: 'trials', get: () => G.trial[T.id], set: v => set(T.id, v) });
  G.dev?.add({ id: 'play-tests', area: 'Food and water', round: 'Daily play study', title: 'Play tests: A water on the compass, B pounce from a perch (switches, off unless turned on)',
    how: 'Settings > Advanced > Play tests. A: in flight with your water below 60%, a drop on the compass points to the nearest river, lake or puddle within 2.4 km. B: perch over a meadow and keep still; mice within 45 m squeak more; tap one within 35 m and you drop on it.' });
}
