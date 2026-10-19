// The great ridge: once on the way south the land lifts into one long ridge, and the wind up its
// face gives easy lift all along its crest. In autumn, raptors stream down it by the hundred, as
// they do past the famous hawk-watch ridges: broad-winged hawks in kettles, sharp-shinned hawks
// flap-flap-gliding, kestrels, ospreys, red-tails and the odd eagle. A tally counts the ones that
// pass you, and the day's count goes in the journal.
import { TAU, clamp, smooth, hash, C, mix, shade } from './util.js';
import * as W from './world.js';
import { wash, stroke, ellP, circP, stamp, put } from './paint.js';
import { sight } from './guide.js';
W.extraLifts.push((x, y) => ridgeFaceLift(x, y));

export const RIDGE = W.GREAT_RIDGE ?? { x0: W.JOURNEY * .42, x1: W.JOURNEY * .42 + 3400, name: 'The Great Ridge' };
export const onRidge = x => x > RIDGE.x0 && x < RIDGE.x1;
const crest = x => W.groundY(Math.round(x));
// the wind up the face: steady lift along the crest whenever a breeze blows, more on the big days
export function ridgeFaceLift(x, y) {
  if (!onRidge(x)) return 0;
  const up = crest(x) - y;
  if (up < 0 || up > 320) return 0;
  const ends = smooth(RIDGE.x0, RIDGE.x0 + 300, x) * (1 - smooth(RIDGE.x1 - 300, RIDGE.x1, x));
  return 30 * ends * smooth(0, 25, up) * (1 - smooth(200, 320, up)) * (.6 + .4 * Math.min(1, Math.abs(W.env.wind) / 14));
}

// the passage: a big day in autumn, a smaller one in spring, a trickle otherwise
const passage = G => (G.tod < .3 || G.tod > .74 || G.storm > .4) ? 0 : G.sea.autumn > .4 ? 1 : G.sea.spring > .4 ? .5 : .15;
const KINDS = [
  // name, guide key, scale, colour key, wing shape, flaps, share of the flight
  { key: 'broadwing', name: 'broad-winged hawk', s: .62, col: 'bird', shape: 'buteo', w: .5 },
  { key: 'sharpie', name: 'sharp-shinned hawk', s: .45, col: 'birdWing', shape: 'accip', w: .2 },
  { key: 'kestrel', name: 'American kestrel', s: .42, col: 'tail', shape: 'falcon', w: .1 },
  { key: 'redtail', name: 'red-tailed hawk', s: .85, col: 'bird', shape: 'buteo', w: .1 },
  { key: 'osprey', name: 'osprey', s: .95, col: 'birdFar', shape: 'osprey', w: .06 },
  { key: 'eagle', name: 'bald eagle', s: 1.25, col: 'eagle', shape: 'eagle', w: .04 },
];
const pick = r => { let a = 0; for (const k of KINDS) { a += k.w; if (r < a) return k; } return KINDS[0]; };

export const createRidge = store => ({ birds: [], spawnT: 0, count: 0, countDay: -1, best: store.get('ridgeBest', 0), store, here: false });
export function updateRidge(G, dt, { once, toast, audio }) {
  const R = G.ridge, b = G.bird, dir = G.sea.spring > G.sea.autumn ? -1 : 1, here = onRidge(b.x) || onRidge(G.cam.x + G.view.w / 2);
  if (here && !R.here) {
    if (!G.found.ridge) { G.found.ridge = { name: RIDGE.name, x: Math.round((RIDGE.x0 + RIDGE.x1) / 2), note: `Found on day ${G.day}` }; audio.learned?.(); }
    once('ridge5', `${RIDGE.name}. The wind up its face lifts you all along the crest, and in autumn hawks stream south down it by the hundred.`, 7);
  }
  R.here = here;
  if (R.countDay !== G.day) {
    if (R.count > 0) { R.best = Math.max(R.best, R.count); R.store.set('ridgeBest', R.best); G.found.ridge && (G.found.ridge.note = `Best day's count: ${R.best} raptors`); }
    R.countDay = G.day; R.count = 0;
  }
  const pass = passage(G);
  if (here && pass > 0 && (R.spawnT -= dt * pass) <= 0) {
    // most come in loose lines of a few, the odd big one alone
    R.spawnT = .5 + Math.random() * 1.5;
    const k = pick(Math.random()), n = k.shape === 'buteo' && k.s < .7 ? 2 + (Math.random() * 4 | 0) : 1;
    const x = dir > 0 ? G.cam.x - 50 : G.cam.x + G.view.w + 50, base = crest(x) - 50 - Math.random() * 230;
    for (let i = 0; i < n; i++) R.birds.push({ k, x: x - dir * i * (24 + Math.random() * 20), y: base - i * 6 + (Math.random() - .5) * 20, v: dir * (48 + Math.random() * 22) * (k.shape === 'falcon' || k.shape === 'accip' ? 1.15 : 1), ph: Math.random() * TAU, seed: Math.random() * 99, passed: false });
  }
  for (const r of R.birds) {
    r.x += r.v * dt; r.ph += dt;
    const c = crest(r.x); r.y += ((c - 60 - (r.seed % 1) * 200) - r.y) * dt * .2 + Math.sin(G.t * .7 + r.seed) * 6 * dt;
    // the tally: one more each time a bird goes by you
    if (!r.passed && (r.x - b.x) * Math.sign(r.v) > 0 && Math.abs(r.y - b.y) < 260 && b.state !== 'swim') { r.passed = true; R.count++; }
  }
  R.birds = R.birds.filter(r => r.x > G.cam.x - 120 && r.x < G.cam.x + G.view.w + 120);
  if (R.count >= 25 && R.toldDay !== G.day) { R.toldDay = G.day; toast('Twenty-five raptors past you so far today. The journal keeps the best count.', 3.5); }
}
export const ridgeCount = G => G.ridge?.here && G.ridge.count > 0 ? G.ridge.count : 0;

// drawing: wing shapes painted once per kind and wingbeat
function art(k, frame, P, spx) {
  const col = P[k.col] ?? P.bird;
  return stamp('rr' + k.key + frame, col.join() + P.paper.join(), -20, -20, 14, 12, spx, x => {
    const dk = shade(col, .8), f = frame === 1 ? 1.2 : frame === 2 ? -.55 : 1;
    // the wings held up in a shallow V, as the hawk is drawn; their outline tells the kind
    const wing = {
      buteo: [[3, -1], [0, -6], [-2, -12], [-6, -13], [-8, -11], [-7, -6], [-5, -1]],
      accip: [[3, -1], [1, -6], [-1, -9], [-4, -9], [-5, -5], [-4, -1]],
      falcon: [[3, -1], [1, -5], [-3, -12], [-4.5, -11], [-3, -5], [-2, -1]],
      osprey: [[3, -1], [1, -6], [2, -10], [-2, -15], [-6, -14], [-3, -9], [-4, -5], [-3, -1]],
      eagle: [[4, -1], [1, -7], [-1, -14], [-8, -16], [-10, -13], [-8, -6], [-6, -1]],
    }[k.shape].map(([a, b]) => [a, b * f]);
    wash(x, wing.map(([a, b]) => [a + 2.5, b * .75 - .5]), dk, .55, { passes: 1, amp: .3, seed: 3, rim: .25 });   // the far wing
    const long = k.shape === 'accip' ? 9 : k.shape === 'eagle' ? 10 : 7;
    wash(x, [[-6, -1.2], [-6 - long, -2.4], [-7 - long, 1.6], [-6, 1.4]], k.shape === 'eagle' ? mix(P.paper, P.birdPale, .3) : col, .7, { passes: 1, amp: .3, seed: 4, rim: .3 });
    wash(x, ellP(0, 0, 7, 2.6, -.05), k.shape === 'osprey' ? mix(P.paper, P.birdPale, .4) : col, .8, { passes: 2, amp: .4, seed: 5, rim: .4 });
    wash(x, circP(6.6, -1, 2.2, 10), k.shape === 'eagle' ? mix(P.paper, P.birdPale, .2) : col, .85, { passes: 1, amp: .2, seed: 6, rim: .4 });
    stroke(x, [[8.4, -1.2], [10, -.2]], P.beak, .9, .8, 7);
    wash(x, wing, col, .75, { passes: 2, amp: .4, seed: 8, rim: .4 });
  });
}
export function drawRidge(ctx, G, P) {
  const R = G.ridge; if (!R?.birds.length) return;
  for (const r of R.birds) {
    const k = r.k;
    // buteos and eagles soar; accipiters go flap-flap-glide; kestrels row along
    const flap = k.shape === 'accip' ? (r.ph % 1.6 < .6) : k.shape === 'falcon' ? (r.ph % 1.2 < .7) : false;
    const frame = flap ? 1 + (Math.floor(r.ph * 10) % 2) : 0;
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(Math.sign(r.v) * k.s * 1.3, k.s * 1.3);
    put(ctx, art(k, frame, P, G.view.spx * 1.3 * k.s * 1.4), .85);
    ctx.restore();
    sight(G, k.key === 'eagle' ? 'eagle' : k.key, r.x, r.y, 14 * k.s + 4);
  }
}
