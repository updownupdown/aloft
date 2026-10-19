// Gentle daily intentions: each dawn the journal offers one optional aim for the day. Finish
// it and a feather goes in the journal. Nothing nags; the toast at dawn is the only prompt.
// The day's aim and its count are saved with the journey; feathers are kept across journeys.
import { hash } from './util.js';

const AIMS = [
  { key: 'thermals', n: 3, text: 'Ride three thermals', unit: 'thermals ridden' },
  { key: 'fish', n: 1, text: 'Catch a fish', unit: 'caught' },
  { key: 'mouse', n: 1, text: 'Catch a mouse', unit: 'caught' },
  { key: 'song', n: 1, text: 'Sing with a songbird', unit: 'songs' },
  { key: 'drink', n: 2, text: 'Drink at two different ponds', unit: 'ponds' },
  { key: 'rings', n: 5, text: 'Fly through five rings', unit: 'rings' },
  { key: 'perch', n: 4, text: 'Perch in four different trees', unit: 'trees' },
  { key: 'glide', n: 1500, text: 'Glide a long way without a wingbeat', unit: 'of 1500' },
  { key: 'roost', n: 1, text: 'Roost through the night', unit: 'done' },
  { key: 'high', n: 1, text: 'Climb above the cloudbase', unit: 'done' },
  { key: 'kite', n: 1, text: 'Hang on the wind over a field', unit: 'done' },
];

export function createIntentions(G, store, { toast, audio, spark }) {
  G.feathers = store.get('feathers', 0);
  const I = { aim: null, count: 0, done: false, day: 0, seen: new Set(), best: 0 };
  Object.assign(I, G.intent || {});
  if (I.seen && !(I.seen instanceof Set)) I.seen = new Set(I.seen);
  G.intent = I;

  function pick(day) {
    const a = AIMS[Math.floor(hash(day * 3.7 + G.journeys * 11 + 1) * AIMS.length) % AIMS.length];
    I.aim = a.key; I.count = 0; I.done = false; I.day = day; I.seen = new Set(); I.best = 0;
  }
  const aim = () => AIMS.find(a => a.key === I.aim);
  // called every frame; a new day picks a new aim and says so
  function update() {
    if (I.day !== G.day) { pick(G.day); toast(`Today: ${aim().text.toLowerCase()}. A feather if you do.`, 4); }
  }
  // game events: kind is an aim key, id tells distinct things apart (ponds, trees)
  function note(kind, id, amount = 1) {
    if (I.done || I.aim !== kind) return;
    if (id !== undefined) { if (I.seen.has(id)) return; I.seen.add(id); }
    if (kind === 'glide') { I.best = Math.max(I.best, amount); I.count = Math.round(I.best); } else I.count += amount;
    const a = aim();
    if (I.count >= a.n) {
      I.done = true; G.feathers++; store.set('feathers', G.feathers); audio.feather();
      const b = G.bird; for (let k = 0; k < 10; k++) spark(b.x + (Math.random() - .5) * 24, b.y - 8 + (Math.random() - .5) * 16);
      toast(`${a.text}: done. A feather for your journal (${G.feathers} so far).`, 4);
    }
  }
  // for the journal
  function status() {
    const a = aim(); if (!a) return '';
    return I.done ? `Today's intention, ${a.text.toLowerCase()}: done.` : `Today's intention: ${a.text.toLowerCase()} (${I.count} ${a.n > 1 && a.key !== 'glide' ? `of ${a.n} ` : ''}${a.unit}).`;
  }
  // what to save
  const save = () => ({ aim: I.aim, count: I.count, done: I.done, day: I.day, seen: [...I.seen], best: I.best });
  return { update, note, status, save };
}
