// The long arc of a hawk's year: health built up by eating, drinking and flying well (shown
// in how red and glossy the tail is), keepsakes gathered for a nest, acrobatics, songs, and
// the courtship down south they all add up to. Nothing here ever punishes: low meters only
// slow the health down, and a courtship that doesn't take can be tried again.
import { lerp, hash } from './util.js';
import * as W from './world.js';

/* ---------- health ---------- */
export const HEALTH_START = .35;
// well fed and watered, health climbs over about a quarter of an hour of play (faster with
// clean, synced wingbeats); with a meter run low it drifts back down, slowly, never below .15
export function updateHealth(G, dt) {
  const fed = G.thirst > 50 && G.hunger > 50, low = G.thirst < 20 || G.hunger < 20;
  if (fed) G.health = Math.min(1, G.health + dt / 900 * (.55 + .45 * G.flapQ) * (G.warmT > 0 ? 2 : 1));   // a cardinal's gift doubles it
  else if (low) G.health = Math.max(.15, G.health - dt / 2400);
  G.bird.health = G.health;
}
// each wingbeat nudges a running average of how well the hawk flaps: the synced two-thumb flap
// reports its own quality; otherwise a beat on fresh wings counts as good, one on spent wings as poor
export function noteFlap(G, q) {
  const b = G.bird;
  if (q === undefined) q = b.stamina > .35 ? .8 : b.stamina > .15 ? .5 : .2;
  G.flapQ = lerp(G.flapQ, q, .08);
}
export const healthWord = h => h < .3 ? 'thin and dull' : h < .55 ? 'fair' : h < .8 ? 'good, the tail reddening' : 'glossy, the tail bright red';

/* ---------- keepsakes: rare things for the nest ---------- */
export const KEEPSAKES = ['blue jay feather', 'snail shell', 'smooth white pebble', 'curl of birch bark', "robin's eggshell", 'tuft of thistledown', 'acorn cap', 'heron feather'];
const KC = 1300;
export function keepsakesIn(x0, x1) {
  const out = [];
  for (let i = Math.floor(x0 / KC); i <= Math.ceil(x1 / KC); i++) {
    if (hash(i * 8.3 + 1) > .45) continue;
    const x = i * KC + 100 + hash(i * 2.7) * (KC - 200);
    if (x < x0 - 20 || x > x1 + 20 || W.pondNear(x, 1.4) || Math.abs(W.groundY(x + 6) - W.groundY(x - 6)) > 8) continue;
    out.push({ id: `k${i}`, x, y: W.groundY(x), kind: Math.floor(hash(i * 4.9) * KEEPSAKES.length) });
  }
  return out;
}
export function takeKeepsake(G, k, toast) {
  G.kept.add(k.id); G.keepsakes.push(k.kind);
  const name = KEEPSAKES[k.kind], n = G.keepsakes.length;
  toast(G.nest ? `A ${name}, tucked into your nest. Keepsakes: ${n}.` : `A ${name}, kept for a nest one day. Keepsakes: ${n}.`, 3);
}

/* ---------- acrobatics ---------- */
// loops and flips come from the flight controls as 'trick' events; a full-speed stoop counts too
export function noteTrick(G, kind) {
  G.tricks++;
  if (inMarsh(G)) G.courtBonus += .06;   // showing off where the other hawks can see
  return kind;
}

/* ---------- courtship ---------- */
const inMarsh = G => G.bird.x > W.JOURNEY - 1800;
export function courtship(G) {
  const parts = { health: G.health, keepsakes: Math.min(1, G.keepsakes.length / 5), songs: Math.min(1, G.learned.size / 5), acrobatics: Math.min(1, G.tricks / 8) };
  return { parts, score: .35 * parts.health + .2 * parts.keepsakes + .25 * parts.songs + .2 * parts.acrobatics + G.courtBonus };
}
export function courtNote(G) {
  if (G.mate) return `Your mate, met ${G.mate.note}, flies with you.`;
  const { parts } = courtship(G);
  return `Courtship, down south: health ${healthWord(parts.health).split(',')[0]}, ${G.keepsakes.length} of 5 keepsakes, ${G.learned.size} of 5 songs, ${G.tricks} of 8 acrobatics.`;
}
// In the wintering marsh a hawk comes to look you over. It circles while you show off (each
// trick and song there helps); a strong enough showing and it stays as your mate.
export function updateCourtship(G, dt, { toast, audio, makeHawk, place }) {
  const b = G.bird;
  if (G.mate) {
    if (!G.hawks.some(h => h.kind === 'mate')) G.hawks.push(makeHawk(b.x - b.face * 120, b.y - 60, 'mate'));
    // a mate helps raise the chick, bringing a meal now and then (the last is left to you)
    const n = G.nest;
    if (n?.chick && n.fed < 4) { G.mateFeedT += dt; if (G.mateFeedT > 120) { G.mateFeedT = 0; n.fed++; toast(`Your mate brought the chick a meal: ${n.fed} of 5.`, 3); } }
    return;
  }
  const S = G.suitor;
  if (!S) {
    if (!inMarsh(G) || G.courtDay === G.day || b.state !== 'fly') return;
    G.courtDay = G.day; G.courtBonus = 0;
    const h = makeHawk(b.x + b.face * 260, b.y - 120, 'suitor'); G.hawks.push(h);
    G.suitor = { t: 0, h }; audio.scream(true);
    toast('A hawk comes circling over the reeds to look at you. Show it what you can do: loops, songs, a glossy tail, keepsakes.', 6);
    return;
  }
  S.t += dt;
  const { score } = courtship(G);
  if (score >= .62) {
    S.h.kind = 'mate'; G.mate = { day: G.day, note: `on day ${G.day} in ${place}` }; G.suitor = null;
    audio.scream(true); audio.learned?.();
    toast('The hawk answers your display and stays at your side. You have found a mate.', 6);
  } else if (S.t > 75) {
    S.h.leaving = true; G.suitor = null;
    toast(`The hawk circles a while, then drifts off. ${tip(G)} Another may come another day.`, 7);
  }
}
// the weakest part of the showing, in words
function tip(G) {
  const p = courtship(G).parts, low = Object.entries(p).sort((a, c) => a[1] - c[1])[0][0];
  return { health: 'A redder, glossier tail would catch its eye: keep well fed and watered, and flap cleanly.', keepsakes: 'Keepsakes for a nest would help: rare things glint in the grass along the way.', songs: 'More songs would help: learn them from the songbirds.', acrobatics: 'Some acrobatics would help: loops and flips, or a full-speed stoop.' }[low];
}

/* ---------- saving ---------- */
export function loadStory(G, s) {
  G.health = s?.health ?? HEALTH_START; G.flapQ = .6;
  G.keepsakes = s?.keepsakes ?? []; G.kept = new Set(s?.kept ?? []);
  G.tricks = s?.tricks ?? 0; G.mate = s?.mate ?? null;
  G.courtBonus = 0; G.courtDay = 0; G.suitor = null; G.mateFeedT = 0;
}
export const saveStory = G => ({ health: +G.health.toFixed(3), keepsakes: G.keepsakes, kept: [...G.kept], tricks: G.tricks, mate: G.mate });
