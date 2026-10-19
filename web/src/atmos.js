// The sky's moods and the hawk's own slow changes, all decided from the clock, the weather and
// the hash (so a given day always has the same sky): dawn fog in the hollows, a rainbow when a
// shower clears, a meteor shower on a rare clear night, northern lights early in the journey,
// the moon's phase. Also the hawk's feathers wearing and moulting with its health, the day's
// flight remembered for dreams, and a hint of the way when the hawk has been going nowhere.
import { clamp, lerp, hash, smooth } from './util.js';
import * as W from './world.js';
import { nightness } from './palette.js';

export function initAtmos(G, s) {
  G.fog = 0; G.rainbowT = 0; G.rainSeen = false; G.meteorDay = 0; G.meteors = false; G.aurora = 0;
  G.wear = s?.wear ?? 0; G.molted = []; G.moltDay = s?.moltDay ?? 0;
  G.dream = []; G.dreamT = 0; G.whisper = 0; G.bestX = null; G.stuckT = 0;
  G.skyNotes = s?.skyNotes ?? []; G.seasonShift = s?.seasonShift ?? 0;
}
export const saveAtmos = G => ({ wear: +G.wear.toFixed(3), moltDay: G.moltDay, skyNotes: G.skyNotes.slice(-12), seasonShift: G.seasonShift || 0 });

export function updateAtmos(G, dt, { toast, once, place }) {
  const b = G.bird, night = nightness(G.tod), clear = 1 - G.overcast;
  // dawn fog: most still mornings, thickest in the lakelands and the marsh, gone by mid-morning
  const bio = W.biomeAt(b.x).name, foggy = hash(G.day * 5.3 + G.seed) < .6 && G.storm < .3;
  const window = smooth(.19, .25, G.tod) * (1 - smooth(.32, .42, G.tod));
  G.fog = lerp(G.fog, foggy ? window * (bio === 'lakeland' || bio === 'marsh' ? 1 : .75) : 0, Math.min(1, dt * .4));
  if (G.fog > .4) once('fog', 'Morning fog fills the hollows. The treetops stand out of it, and low down the world goes quiet.');
  // a rainbow when an afternoon shower clears
  if (G.rain > .35) G.rainSeen = true;
  if (G.rainSeen && G.rain < .1) {
    G.rainSeen = false;
    if (G.tod > .3 && G.tod < .72 && G.overcast < .7) { G.rainbowT = 80; toast('The shower passes, and a rainbow stands over the land.', 4); }
  }
  G.rainbowT = Math.max(0, G.rainbowT - dt);
  // the moon goes through its phases over sixteen days (0 new, .5 full)
  G.moonPhase = ((G.day - 1) % 16 + G.tod) / 16;
  // nightfall: is tonight one of the rare meteor-shower nights?
  if (G.tod > .78 && G.meteorDay !== G.day) {
    G.meteorDay = G.day;
    G.meteors = hash(G.day * 7.7 + G.seed) < .14 && G.overcast < .3;
    if (G.meteors) {
      toast('A meteor shower tonight. Watch the sky.', 4);
      G.skyNotes.push(`Day ${G.day}: a meteor shower over ${place(b.x)}.`);
    }
  }
  if (night < .3) G.meteors = G.meteors && G.tod > .5;
  // northern lights: cold, clear nights in the north, early in the journey
  const north = 1 - smooth(W.START_X + 4000, W.START_X + 14000, b.x), cold = clamp((G.sea.autumn || 0) + (G.sea.winter || 0) + (G.sea.spring || 0) * .5, 0, 1);
  const lights = hash(G.day * 2.1 + G.seed + 3) < .45 ? night * clear * north * cold : 0;
  G.aurora = lerp(G.aurora, lights, Math.min(1, dt * .3));
  if (G.aurora > .5 && !G.skyNotes.some(n => n.startsWith(`Day ${G.day}: northern`))) G.skyNotes.push(`Day ${G.day}: northern lights over ${place(b.x)}.`);

  // feathers: flying wears them, faster when the hawk is in poor health; a healthy hawk moults
  // the worn ones and grows fresh (the old ones drift down and lie where they fell)
  if (b.state === 'fly') G.wear = Math.min(1, G.wear + dt / 2400 * (1.6 - G.health));
  if (G.wear > .3 && G.health > .7 && G.moltDay !== G.day && b.state !== 'fly') {
    G.moltDay = G.day; G.wear = 0;
    for (let k = 0; k < 3; k++) { const x = b.x + (k - 1) * 9 + Math.random() * 4; G.molted.push({ x, y: W.groundY(x), a: Math.random() * 3, day: G.day }); }
    toast('You moult: the worn flight feathers drop, and fresh ones grow in. Your wings feel crisp again.', 5);
  }
  if (G.wear > .5) once('wear', 'Your flight feathers are fraying, so glides fall a little short. Eat, drink and fly well: a healthy hawk moults them for new ones.', 6);
  b.wear = G.wear;
  if (G.molted.length > 12) G.molted.shift();

  // the day's flight, remembered for dreams: where the hawk was, every second and a half
  G.dreamT -= dt;
  if (b.state === 'fly' && G.dreamT <= 0) { G.dreamT = 1.5; G.dream.push([b.x, W.groundY(b.x) - b.y]); if (G.dream.length > 200) G.dream.shift(); }

  // a whisper of the way: going the wrong way, or circling, for a long time
  const dir = G.goal === 'south' ? 1 : -1;
  if (G.bestX === null || (b.x - G.bestX) * dir > 0) { G.bestX = b.x; G.stuckT = 0; }
  else if (b.state === 'fly') G.stuckT += dt;
  if ((G.bestX - b.x) * dir > 2500) G.stuckT += dt * 2;
  G.whisper = lerp(G.whisper, G.stuckT > 120 ? 1 : 0, Math.min(1, dt * .5));
  if (G.whisper > .5) once('whisper', `A faint wind arrow in the sky leans ${dir > 0 ? 'south' : 'north'}: that way lies the next landmark.`, 5);
}
// after the night: the dream is over, a new day's flight begins
export function wakeAtmos(G) { G.dream = []; }
