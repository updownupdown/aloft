// Low-poly meshes for the animals of the other lands (sys/critters.js) and the other hunters
// and pests in the air (sys/hunters.js). Facing +x, y up, real size at scale 1 (as
// faunashapes.js). Two-frame flappers are built as (up) and (down).
import { builder, blob, tube, reseed } from '../shapes.js';

const leg = (B, x, z, top, r, col) => tube(B, [x, top, z], [x, 0, z], r, col);

// a jackrabbit: long ears, long hind legs, a pale scut
export function jackrabbit(run) {
  reseed(201); const B = builder(), fur = [.62, .52, .4], fur2 = [.55, .46, .36], pale = [.86, .82, .74], dark = [.2, .17, .15];
  blob(B, 0, .2, 0, .17, fur, fur2, [1.5, .9, .85], 2);
  blob(B, .22, .3, 0, .08, fur, fur2, [1.3, 1, .9]);
  for (const s of [-1, 1]) {
    const e = [.2, .36, .03 * s], tip = run ? [.05, .44, .06 * s] : [.18, .62, .07 * s];
    B.tri(e, [e[0] + .05, e[1], e[2]], tip, fur2); B.tri([e[0] + .05, e[1], e[2]], [tip[0] + .03, tip[1] - .02, tip[2]], tip, dark);
    leg(B, .1, .05 * s, .14, .018, fur2);
    tube(B, [-.12, .16, .07 * s], run ? [-.32, .06, .07 * s] : [-.16, .02, .07 * s], .03, fur);
  }
  blob(B, -.25, .24, 0, .05, pale, pale);
  return B.out();
}
// a lizard flat to the rock: a long tapering body and tail, splayed legs
export function lizard() {
  reseed(202); const B = builder(), sk = [.58, .5, .34], sk2 = [.45, .4, .28];
  blob(B, 0, .03, 0, .08, sk, sk2, [1.6, .4, .7]);
  blob(B, .13, .035, 0, .035, sk, sk2, [1.4, .6, .9]);
  tube(B, [-.1, .03, 0], [-.32, .02, .04], .018, sk2);
  for (const [x, s] of [[.06, 1], [.06, -1], [-.07, 1], [-.07, -1]]) tube(B, [x, .03, .02 * s], [x + .03, .0, .08 * s], .008, sk2);
  return B.out();
}
// a grass snake basking in loose S-curves (or stretched, slipping away): olive above, a pale
// yellow collar behind the head, along +x
export function snake(slip) {
  reseed(209); const B = builder(), olive = [.42, .46, .26], olive2 = [.34, .38, .22], collar = [.9, .82, .4], N = 14, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N, x = (t - .55) * (slip ? 1.05 : .8); pts.push([x, .03, Math.sin(t * Math.PI * (slip ? 1.2 : 2.4)) * (slip ? .05 : .12)]); }
  for (let i = 0; i < N; i++) {
    const r = .022 * Math.sin(Math.min(1, (i + .5) / N * 1.15) * Math.PI) ** .5 + .006;
    tube(B, pts[i], pts[i + 1], r, i === N - 2 ? collar : i % 2 ? olive : olive2);
  }
  blob(B, pts[N][0] + .03, .035, pts[N][2], .03, olive2, olive2, [1.5, .7, 1]);
  return B.out();
}
// a marmot sitting up to whistle (up) or low and running (down)
export function marmot(up) {
  reseed(203); const B = builder(), fur = [.5, .38, .26], fur2 = [.42, .32, .22], pale = [.74, .64, .5];
  if (up) { blob(B, 0, .22, 0, .14, fur, fur2, [.9, 1.5, .9], 2); blob(B, .03, .44, 0, .08, fur2, pale); }
  else { blob(B, 0, .12, 0, .14, fur, fur2, [1.5, .8, .9], 2); blob(B, .2, .15, 0, .08, fur2, pale); }
  tube(B, up ? [-.08, .08, 0] : [-.18, .12, 0], up ? [-.22, .04, 0] : [-.34, .1, 0], .03, fur2);
  return B.out();
}
// a shore crab, sideways on its legs, claws up
export function crab() {
  reseed(204); const B = builder(), sh = [.72, .32, .2], sh2 = [.6, .26, .16], cl = [.82, .4, .26];
  blob(B, 0, .05, 0, .07, sh, sh2, [.9, .45, 1.2], 2);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) tube(B, [-.02 + i * .025, .05, .05 * s], [-.04 + i * .03, 0, .12 * s], .007, sh2);
    tube(B, [.05, .06, .04 * s], [.1, .1, .07 * s], .012, sh); blob(B, .12, .11, .07 * s, .025, cl, sh);
  }
  return B.out();
}
// a mountain goat: shaggy white, black horns
export function goat() {
  reseed(205); const B = builder(), w = [.92, .91, .86], w2 = [.84, .83, .78], dark = [.12, .11, .1];
  blob(B, 0, .75, 0, .32, w, w2, [1.5, 1, .8], 2);
  blob(B, .5, .95, 0, .13, w, w2, [1.2, 1, .8]);
  tube(B, [.35, .85, 0], [.5, .95, 0], .1, w2);
  for (const s of [-1, 1]) { tube(B, [.5, 1.05, .04 * s], [.42, 1.22, .05 * s], .018, dark); }
  B.tri([.58, .86, -.03], [.58, .86, .03], [.55, .72, 0], w2);   // the beard
  for (const [x, s] of [[.3, 1], [.3, -1], [-.3, 1], [-.3, -1]]) leg(B, x, .13 * s, .6, .045, x > 0 ? w2 : w);
  return B.out();
}
// a bison: the great dark hump, a shaggy head held low
export function bison(graze) {
  reseed(206); const B = builder(), fur = [.32, .24, .18], fur2 = [.25, .19, .14], shag = [.42, .32, .22], horn = [.15, .14, .13];
  blob(B, -.3, 1.05, 0, .55, fur, fur2, [1.5, 1, .9], 2);
  blob(B, .45, 1.25, 0, .55, shag, fur, [1, 1.25, 1], 2);   // the hump and shaggy shoulders
  const hy = graze ? .45 : .95;
  blob(B, 1.0, hy, 0, .3, shag, fur2, [1.1, 1, .9], 2);
  for (const s of [-1, 1]) tube(B, [1.05, hy + .2, .2 * s], [1.05, hy + .35, .3 * s], .03, horn);
  for (const [x, s] of [[.5, 1], [.5, -1], [-.6, 1], [-.6, -1]]) leg(B, x, .22 * s, .8, .09, fur2);
  tube(B, [-1, 1.1, 0], [-1.15, .7, 0], .03, fur2);
  return B.out();
}
// a white egret standing in the shallows
export function egret() {
  reseed(207); const B = builder(), w = [.95, .95, .93], w2 = [.88, .88, .86], bill = [.9, .78, .3], legc = [.15, .14, .14];
  blob(B, 0, .55, 0, .14, w, w2, [1.6, .9, .85], 2);
  tube(B, [.18, .58, 0], [.24, .82, 0], .025, w); tube(B, [.24, .82, 0], [.2, .95, 0], .022, w);
  blob(B, .23, .97, 0, .04, w, w2, [1.3, 1, .9]);
  tube(B, [.26, .97, 0], [.42, .94, 0], .01, bill);
  for (const s of [-1, 1]) tube(B, [0, .45, .04 * s], [.01, 0, .03 * s], .012, legc);
  return B.out();
}
// a harbour seal hauled out on the rocks
export function seal() {
  reseed(208); const B = builder(), g = [.5, .5, .5], g2 = [.42, .42, .44], dark = [.2, .2, .22];
  blob(B, 0, .2, 0, .3, g, g2, [2, .7, .9], 2);
  blob(B, .58, .32, 0, .14, g, g2, [1.2, 1, 1], 2);
  blob(B, .7, .32, 0, .05, dark, g2);
  B.tri([-.55, .15, -.02], [-.55, .15, .02], [-.78, .25, .12], g2); B.tri([-.55, .15, .02], [-.55, .15, -.02], [-.78, .25, -.12], g2);
  return B.out();
}
// a red squirrel: bushy tail curled over its back
export function squirrel(run) {
  reseed(209); const B = builder(), r = [.68, .36, .2], r2 = [.58, .3, .17], pale = [.9, .82, .7];
  blob(B, 0, .1, 0, .08, r, r2, [1.4, .9, .9], 2);
  blob(B, .12, .14, 0, .05, r, pale);
  for (const s of [-1, 1]) B.tri([.13, .18, .02 * s], [.15, .18, .02 * s], [.13, .24, .03 * s], r2);
  blob(B, -.12, run ? .14 : .22, 0, .07, r, r2, run ? [1.6, .8, .9] : [.9, 1.8, .9], 2);
  return B.out();
}
// a monarch butterfly, wings up or down
export function monarch(up) {
  reseed(210); const B = builder(), o = [.95, .5, .12], o2 = [.85, .42, .1], dark = [.12, .1, .1];
  tube(B, [-.03, 0, 0], [.03, 0, 0], .005, dark);
  for (const s of [-1, 1]) {
    const y = up ? .05 : -.015, y2 = up ? .04 : -.02;
    B.tri([.02, 0, 0], [-.01, 0, 0], [.03, y, .05 * s], o); B.tri([.03, y, .05 * s], [.07, y * 1.1, .04 * s], [.02, 0, 0], dark);
    B.tri([0, 0, 0], [-.04, y2, .045 * s], [-.01, y2, .05 * s], o2);
  }
  return B.out();
}
// a dragonfly: a long thin body and two pairs of clear wings held out flat
export function dragonfly() {
  reseed(211); const B = builder(), body = [.2, .45, .55], eye = [.15, .3, .3], wing = [.82, .9, .92];
  tube(B, [-.07, 0, 0], [.03, 0, 0], .005, body); blob(B, .04, 0, 0, .009, eye, body);
  for (const s of [-1, 1]) for (const x of [.015, -.005]) { B.tri([x, .002, 0], [x - .008, .002, .055 * s], [x + .008, .002, .05 * s], wing); }
  return B.out();
}
// a bird of the air: body, head, tail and two wing panels; col sets the plumage
function flier(up, { body, wing, head, bill = [.85, .7, .3], span = 1, size = 1, tail = 1 }) {
  const B = builder(), k = size;
  blob(B, 0, 0, 0, .12 * k, body, wing, [1.8, .8, .9], 2);
  blob(B, .2 * k, .02 * k, 0, .065 * k, head, head);
  B.tri([.26 * k, .02 * k, -.012 * k], [.26 * k, .02 * k, .012 * k], [.32 * k, 0, 0], bill);
  B.tri([-.16 * k, 0, -.06 * k * tail], [-.16 * k, 0, .06 * k * tail], [-.36 * k, -.01 * k, 0], wing);
  const y = up === 'glide' ? .05 : up ? .18 : -.12, tip = up === 'glide' ? .08 : up ? .14 : -.06;   // 'glide': wings held out flat, soaring
  for (const s of [1, -1]) {
    B.tri([.08 * k, .02 * k, .04 * s * k], [-.08 * k, .02 * k, .04 * s * k], [-.02 * k, y * k, .34 * s * k * span], wing);
    B.tri([.04 * k, y * k, .32 * s * k * span], [-.06 * k, y * k, .34 * s * k * span], [-.1 * k, tip * k, .58 * s * k * span], wing);
  }
  return B.out();
}
export const crow = up => { reseed(212); return flier(up, { body: [.1, .1, .12], wing: [.07, .07, .09], head: [.1, .1, .12], bill: [.08, .08, .09], size: 1.1 }); };
export const eagle = up => { reseed(213); return flier(up, { body: [.25, .18, .12], wing: [.2, .14, .1], head: [.95, .94, .9], bill: [.95, .8, .2], size: 2.4, span: 1.15 }); };
export const kestrel = up => { reseed(214); return flier(up, { body: [.66, .4, .24], wing: [.6, .36, .22], head: [.55, .55, .62], size: .85, span: .95, tail: 1.3 }); };
// a broad-winged hawk soaring (round eight F1, the river of raptors): wings out flat, banded tail
export const broadwing = () => { reseed(216); return flier('glide', { body: [.42, .3, .2], wing: [.36, .26, .18], head: [.38, .27, .18], bill: [.3, .3, .32], size: 1.15, span: 1.1, tail: 1.1 }); };
export const gull = up => { reseed(215); return flier(up, { body: [.95, .95, .95], wing: [.72, .74, .78], head: [.97, .97, .97], size: 1.3, span: 1.2 }); };
export const raven = up => { reseed(216); return flier(up, { body: [.08, .08, .1], wing: [.06, .06, .08], head: [.08, .08, .1], bill: [.06, .06, .07], size: 1.6, span: 1.1 }); };
// what is left of a deer on the open hill (the ravens find it first)
export function carrion() {
  reseed(217); const B = builder(), hide = [.5, .38, .28], bone = [.86, .82, .72], red = [.45, .2, .16];
  blob(B, 0, .12, 0, .35, hide, red, [1.6, .4, .9], 2);
  for (let i = 0; i < 5; i++) tube(B, [-.2 + i * .1, .15, -.12], [-.18 + i * .1, .28, -.02], .015, bone);
  tube(B, [.45, .1, 0], [.62, .12, .05], .04, hide);
  return B.out();
}
