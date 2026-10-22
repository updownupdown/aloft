// Things left at sea (wonders.js-style placement in sys/ruins.js by earth.js oceanAt): a rusting
// freighter run aground and listing, a yacht's hull on a reef, bell buoys, a dark lighthouse on its
// rock, and an old oil rig on its legs. All perches and shelter, none in the way of a crossing.
// Local metres, +y up, the water at y = 0 (WATER moves a little with the rain).
import { builder, blob, prism, tube, reseed, rnd } from '../shapes.js';
import { box } from './ruinshapes.js';

const DARK = [.11, .11, .12], RUST = [.48, .3, .22], RUST2 = [.4, .26, .2], HULL = [.28, .3, .32], WHITE = [.86, .85, .8], ROCK = [[.42, .4, .38], [.36, .35, .34], [.48, .46, .43]];
const pick = a => a[Math.floor(rnd() * a.length)];
const tilted = (roll, pitch) => { const B0 = builder(), cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = ([x, y, z]) => { const y1 = y * cr - z * sr, z1 = y * sr + z * cr; return [x * cp - y1 * sp, x * sp + y1 * cp, z1]; };
  return { tri: (p, q, r, c, j) => B0.tri(f(p), f(q), f(r), c, j), out: B0.out }; };

// a freighter aground, listing, its bow up: hull, deck, the bridge at the stern, cranes, rust
export function freighter() {
  reseed(951); const B = tilted(.16, .05), L = 80, W = 13;
  for (let i = 0; i < 10; i++) {
    const u = -L / 2 + (i + .5) * L / 10, f = Math.abs(u) / (L / 2), w = W * (u > L * .3 ? 1 - (f - .6) * 1.6 : 1);
    box(B, u, -7, 0, L / 10 + .05, 10, w, 0, i % 3 ? HULL : RUST2, [.38, .34, .3]);
    if (rnd() < .5) box(B, u + (rnd() - .5) * 4, -2 + rnd() * 3, (w / 2 + .03) * (rnd() < .5 ? 1 : -1), 3 + rnd() * 4, 1 + rnd() * 2, .05, 0, RUST);
  }
  box(B, -L / 2 + 8, 3, 0, 12, 12, 11, 0, WHITE, [.6, .58, .55]);   // the bridge
  for (const y of [6.5, 10.5]) for (const k of [-1, 1]) box(B, -L / 2 + 14.05, y, 0, .1, 1.2, 9, 0, DARK);
  prism(B, -L / 2 + 6, 0, 1.6, 1.4, 15, 22, 8, RUST);                // the funnel
  for (const u of [-10, 8, 24]) { tube(B, [u, 3, 0], [u, 14, 0], .4, RUST); tube(B, [u, 13, 0], [u + 12, 8, 0], .25, RUST2); }
  for (const u of [-14, -2, 14, 28]) box(B, u, 3, 0, 9, .3, 10, 0, RUST2);   // hatch covers, some askew
  return B.out();
}
// a yacht's hull on a reef, keel up, its mast in the water beside it
export function yacht() {
  reseed(961); const B = builder();
  for (let k = 0; k < 5; k++) blob(B, (rnd() - .5) * 18, -1.4, (rnd() - .5) * 10, 2 + rnd() * 2, pick(ROCK), pick(ROCK), [1.4, .6, 1]);
  blob(B, 0, .4, 0, 4.6, WHITE, [.78, .78, .74], [1.6, .45, .5], 2);
  box(B, 0, 1.9, 0, 4, 1.3, .25, 0, [.3, .32, .4]);                 // the keel
  tube(B, [2, 0, 1.8], [14, -.4, 4], .12, [.7, .7, .68]);
  return B.out();
}
// a bell buoy: a float, a cage, a bell that no one rings (it rocks; sys/ruins.js rings it now and then)
export function buoy() {
  reseed(971); const B = builder(), R = [.72, .26, .2], R2 = [.62, .22, .18];
  prism(B, 0, 0, 1.4, 1.6, -.8, .6, 10, R, .96);
  prism(B, 0, 0, 1.6, 1.2, .6, .9, 10, R2);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + .4; tube(B, [Math.cos(a) * 1, .9, Math.sin(a) * 1], [Math.cos(a) * .3, 4, Math.sin(a) * .3], .06, R2); }
  prism(B, 0, 0, .4, .4, 4, 4.2, 6, R2);
  prism(B, 0, 0, .1, .45, 2.4, 3.2, 8, [.5, .42, .24]);             // the bell
  return B.out();
}
// a lighthouse on a sea rock, its lamp dark, the keepers' stair cut into the rock
export function rockLight() {
  reseed(981); const B = builder(), S = [[.86, .85, .8], [.82, .81, .77]];
  for (let k = 0; k < 7; k++) blob(B, (rnd() - .5) * 14, -2 + rnd() * 2, (rnd() - .5) * 14, 4 + rnd() * 3, pick(ROCK), pick(ROCK), [1.2, .8, 1.2], 2);
  prism(B, 0, 0, 4, 3, 2, 26, 10, S[0]);
  for (const y of [8, 16]) prism(B, 0, 0, 4, 3.7, y, y + 1.6, 10, [.66, .3, .26]);
  prism(B, 0, 0, 3.8, 3.8, 26, 26.6, 10, [.3, .3, .32]);
  prism(B, 0, 0, 2, 2, 26.6, 29.4, 8, [.32, .36, .38]);             // the lantern, its glass dark
  prism(B, 0, 0, 2.3, .2, 29.4, 31.4, 8, [.3, .3, .32]);
  for (const y of [6, 12, 18]) box(B, 0, y, -3.9 + y * .034, .9, 1.4, .1, 0, DARK);
  return B.out();
}
// an oil rig on four legs: the deck, a derrick, a crane, a helipad, all rusting
export function rig() {
  reseed(991); const B = builder(), Y = [.72, .62, .3];
  for (const [x, z] of [[-14, -14], [14, -14], [14, 14], [-14, 14]]) {
    prism(B, x, z, 2.4, 2.2, -20, 22, 8, RUST2);
    for (const y of [-6, 6]) tube(B, [x, y, z], [x === 14 ? -14 : 14, y + 8, z], .35, RUST);
  }
  box(B, 0, 22, 0, 36, 4, 36, 0, [.4, .38, .36], [.46, .44, .4]);
  box(B, -8, 26, -8, 14, 6, 14, 0, WHITE, [.5, .5, .48]);
  for (const k of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) tube(B, [8 + k[0] * 4, 26, 8 + k[1] * 4], [8, 56, 8], .3, RUST);   // the derrick
  for (let y = 32; y < 54; y += 6) { const r = 4 * (1 - (y - 26) / 30); box(B, 8, y, 8, r * 2, .3, r * 2, 0, RUST2); }
  tube(B, [14, 26, -14], [14, 34, -14], .6, Y); tube(B, [14, 34, -14], [-2, 40, -24], .35, Y);   // the crane
  box(B, -12, 26, 12, 12, .5, 12, 0, [.34, .36, .34], [.36, .4, .36]);   // the helipad
  return B.out();
}
