// One rig for every four-legged animal (goats and ibex, deer, the fox, bison, wildebeest and
// muskox): a body, a neck and head, a tail and four legs jointed at the knee, posed and baked
// into a few frames of each gait (a walk, a run, grazing, heads up). Each frame is its own
// instanced shape, so a herd costs one draw call per frame in use and no work per vertex; the
// systems pick a frame by the animal's speed and its stride (frameOf).
// Facing +x, y up, metres at scale 1 (as critshapes.js).
import { builder, blob, tube, reseed } from '../shapes.js';

export const GAIT = { walk: 8, run: 6, graze: 2 };   // frames per gait

// the looks: sizes (len: shoulder to haunch, h: leg length, w: half the width, girth: the body's
// radius), the parts and their colours, and how the animal stands
export const BEASTS = {
  goat: { len: .62, h: .52, w: .13, girth: .3, neck: .32, head: .13, muzzle: .1, fur: [.93, .92, .87], fur2: [.84, .83, .78], leg: [.88, .87, .82], hoof: [.12, .11, .1],
    horns: 'spikes', hornCol: [.12, .11, .1], beard: [.86, .85, .8], tail: [.1, .9], ears: .07, shag: .12, stride: 1.1 },
  ibex: { len: .62, h: .55, w: .13, girth: .28, neck: .3, head: .13, muzzle: .1, fur: [.55, .45, .34], fur2: [.42, .34, .26], leg: [.38, .3, .23], hoof: [.15, .12, .1],
    horns: 'scimitar', hornCol: [.5, .43, .34], beard: [.3, .24, .18], tail: [.1, .9], ears: .06, belly: [.82, .76, .66], stride: 1.1 },
  deer: { len: .82, h: .82, w: .14, girth: .3, neck: .45, head: .12, muzzle: .14, fur: [.62, .43, .27], fur2: [.48, .32, .2], leg: [.55, .38, .24], hoof: [.2, .16, .14],
    tail: [.16, .6], tailCol: [.92, .9, .84], flag: 1, ears: .14, belly: [.9, .86, .78], rump: [.92, .88, .8], stride: 1.6 },
  reddeer: { len: .9, h: .88, w: .16, girth: .34, neck: .5, head: .13, muzzle: .15, fur: [.58, .34, .22], fur2: [.45, .26, .17], leg: [.5, .32, .22], hoof: [.2, .16, .14],
    tail: [.1, .5], ears: .14, rump: [.86, .76, .6], antlers: 1, stride: 1.7 },
  fox: { len: .42, h: .3, w: .08, girth: .15, neck: .2, head: .1, muzzle: .13, fur: [.8, .42, .19], fur2: [.68, .35, .16], leg: [.16, .12, .1], hoof: [.12, .1, .09],
    tail: [.55, .25], tailCol: [.78, .42, .2], tailTip: [.95, .92, .86], brush: 1, ears: .1, earCol: [.2, .15, .12], belly: [.94, .9, .82], bib: 1, stride: 1.2, pointy: 1 },
  bison: { len: 1.1, h: .75, w: .26, girth: .55, neck: .3, head: .3, muzzle: .14, fur: [.32, .24, .18], fur2: [.25, .19, .14], leg: [.24, .18, .14], hoof: [.12, .11, .1],
    hump: [.42, .32, .22], horns: 'hooks', hornCol: [.15, .14, .13], beard: [.38, .28, .2], tail: [.45, .5], ears: .05, shag: .3, low: 1, stride: 1.6 },
  wildebeest: { len: 1, h: .82, w: .2, girth: .42, neck: .36, head: .24, muzzle: .26, fur: [.52, .52, .54], fur2: [.42, .42, .44], leg: [.4, .4, .41], hoof: [.12, .11, .1],
    hump: [.4, .4, .4], horns: 'hooks', hornCol: [.18, .17, .16], mane: [.15, .14, .14], beard: [.15, .14, .14], tail: [.5, .9], tailCol: [.12, .12, .12], ears: .08, low: .6, stride: 1.7 },
  muskox: { len: .9, h: .55, w: .26, girth: .5, neck: .2, head: .26, muzzle: .12, fur: [.25, .19, .15], fur2: [.19, .15, .12], leg: [.66, .6, .5], hoof: [.12, .11, .1],
    hump: [.3, .23, .18], horns: 'boss', hornCol: [.75, .7, .6], skirt: [.22, .17, .13], tail: [.08, .9], ears: .03, low: .9, stride: 1.2 },
};

// one pose: gait 'walk' | 'run' | 'stand', ph the stride (0..1), head 'up' | 'graze' | 'alert', chew 0..1
export function beast(key, pose) {
  const L = BEASTS[key]; reseed(301 + key.length * 7);
  const B = builder(), { len, h, w, girth } = L, run = pose.gait === 'run', walk = pose.gait === 'walk', ph = pose.ph || 0;
  // the body bobs and pitches through a run, sways a little on the walk
  const bob = run ? Math.abs(Math.sin(ph * Math.PI * 2)) * h * .12 : walk ? Math.cos(ph * Math.PI * 4) * h * .02 : 0;
  const pitch = run ? Math.sin(ph * Math.PI * 2) * .12 : 0;
  const by = h + girth * .55 + bob, at = x => [x, by + x * pitch];   // a point along the spine
  // legs: [x along the body, side, phase offset, front?]; a walk sets each foot down in turn, a run
  // gathers the hind legs under then reaches with the fore
  const legs = [[len * .5, 1, 0, 1], [len * .5, -1, .5, 1], [-len * .5, 1, .25, 0], [-len * .5, -1, .75, 0]];
  if (run) { legs[0][2] = 0; legs[1][2] = .1; legs[2][2] = .5; legs[3][2] = .6; }
  for (const [x, s, off, front] of legs) {
    const p = (ph + off) % 1, a = Math.PI * 2 * p;
    const swing = run ? Math.cos(a) * .7 : walk ? Math.cos(a) * .32 : 0;              // forward (+) and back
    const lift = run ? Math.max(0, Math.sin(a)) * 1.1 : walk ? Math.max(0, Math.sin(a)) * .7 : 0;   // the knee folds as the foot comes forward
    const [hx, hy] = at(x), z = w * s, up = h * .52, lo = h * .5;
    const knee = [hx + Math.sin(swing) * up, hy - Math.cos(swing) * up - girth * .2, z];
    const t2 = swing + (front ? -lift : lift * .8);
    const foot = [knee[0] + Math.sin(t2) * lo, Math.max(0, knee[1] - Math.cos(t2) * lo), z];
    tube(B, [hx, hy - girth * .1, z], knee, girth * (front ? .16 : .2) * (L.low ? 1.2 : 1), s > 0 ? L.fur2 : L.fur);
    tube(B, knee, foot, girth * .09 * (L.low ? 1.3 : 1), L.leg);
    tube(B, foot, [foot[0] + .03, Math.max(0, foot[1] - .04), z], girth * .1, L.hoof);
  }
  // the body: chest and haunch, a hump over the shoulders, a pale belly, a long skirt of hair
  const [cx, cy] = at(len * .25), [rx, ry] = at(-len * .3);
  blob(B, cx, cy, 0, girth, L.fur, L.belly || L.fur2, [1.5, 1, w / girth * 2.2], 2);
  blob(B, rx, ry, 0, girth * .92, L.fur, L.belly || L.fur2, [1.4, .95, w / girth * 2.2], 2);
  if (L.rump) blob(B, -len * .62, ry + girth * .1, 0, girth * .45, L.rump, L.rump, [.6, 1, 1.2]);
  if (L.hump) blob(B, len * .35, cy + girth * .55, 0, girth * .75, L.hump, L.fur, [1.3, 1, w / girth * 2]);
  if (L.shag) blob(B, len * .45, cy - girth * .1, 0, girth * .85 + L.shag * .3, L.hump || L.fur, L.fur2, [1, 1.1, w / girth * 2.4], 2);
  if (L.skirt) for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x0 = len * (.6 - i * .4), x1 = x0 - len * .4, y0 = cy - girth * .2, y1 = h * .35 + bob;
    B.tri([x0, y0, (w + .05) * s], [x1, y0, (w + .05) * s], [(x0 + x1) / 2, y1, (w + .08) * s], L.skirt);
  }
  // the neck and head: held up, alert (higher and still), or down to the grass
  const sh = at(len * .62), hd = pose.head;
  const nA = hd === 'graze' ? -1.05 : hd === 'alert' ? 1.05 : run ? .25 : .6, nl = L.neck * (L.low ? .7 : 1);
  const top = [sh[0] + Math.cos(nA) * nl + (L.low ? .1 : 0), sh[1] + girth * .3 + Math.sin(nA) * nl - (L.low ? girth * .3 : 0), 0];
  const head = hd === 'graze' ? [top[0] + .04, Math.max(L.head * .7, top[1] - (pose.chew || 0) * .03), 0] : top;
  tube(B, [sh[0], sh[1] + girth * .2, 0], head, girth * (L.low ? .5 : .32), L.fur);
  if (L.mane) for (let i = 0; i < 5; i++) { const k = i / 5, mx = sh[0] - .15 + (head[0] - sh[0] + .15) * k, my = sh[1] + girth * .6 + (head[1] - sh[1]) * k; B.tri([mx, my, -.02], [mx + .1, my, .02], [mx + .02, my + .14, 0], L.mane); }
  const hA = hd === 'graze' ? -1.25 : hd === 'alert' ? -.25 : -.45;   // the face's tilt
  const hx = head[0], hy = head[1], mz = [hx + Math.cos(hA) * (L.head + L.muzzle), hy + Math.sin(hA) * (L.head + L.muzzle), 0];
  blob(B, hx, hy, 0, L.head, L.fur, L.fur2, [1.15, .95, .85]);
  tube(B, [hx + Math.cos(hA) * L.head * .5, hy + Math.sin(hA) * L.head * .5, 0], mz, L.head * (L.pointy ? .38 : .55), L.bib ? L.belly : L.fur2);
  if (L.bib) blob(B, sh[0] + .04, sh[1] + .02, 0, girth * .5, L.belly, L.belly, [.8, 1, .9]);
  // ears, horns, antlers, beard
  const back = [-Math.cos(hA), -Math.sin(hA)], upv = [-Math.sin(hA), Math.cos(hA)];
  const on = (a, u, z) => [hx + back[0] * a + upv[0] * u, hy + back[1] * a + upv[1] * u, z];
  if (L.ears) for (const s of [-1, 1]) B.tri(on(.02, L.head * .6, L.head * .45 * s), on(.08, L.head * .5, L.head * .5 * s), on(.04, L.head * .6 + L.ears, (L.head * .5 + L.ears * .4) * s), L.earCol || L.fur2);
  if (L.horns) for (const s of [-1, 1]) {
    const base = on(0, L.head * .75, L.head * .3 * s);
    if (L.horns === 'spikes') tube(B, base, on(L.head * .9, L.head * 1.8, L.head * .35 * s), .018, L.hornCol);
    if (L.horns === 'scimitar') { let p = base; for (let i = 1; i <= 5; i++) { const a = i / 5 * 2.2, q = on(Math.sin(a) * L.head * 2.4, L.head * .75 + (1 - Math.cos(a)) * L.head * 1.3 + i * .02, L.head * (.3 + i * .03) * s); tube(B, p, q, .035 - i * .005, L.hornCol); p = q; } }
    if (L.horns === 'hooks') { const m = on(0, L.head * .9, L.head * 1.15 * s); tube(B, base, m, .035, L.hornCol); tube(B, m, on(-L.head * .1, L.head * 1.5, L.head * 1.05 * s), .025, L.hornCol); }
    if (L.horns === 'boss') { const m = on(-.02, L.head * .7, L.head * 1.1 * s); tube(B, on(0, L.head * .95, .02 * s), m, .06, L.hornCol); tube(B, m, on(-L.head * .4, L.head * .1, L.head * 1.2 * s), .04, L.hornCol); tube(B, on(-L.head * .4, L.head * .1, L.head * 1.2 * s), on(-L.head * .2, -L.head * .1, L.head * 1.3 * s), .03, L.hornCol); }
  }
  if (L.antlers) for (const s of [-1, 1]) {
    const base = on(0, L.head * .8, L.head * .3 * s), m = on(L.head * .9, L.head * 3, L.head * 1.4 * s), tip = on(L.head * .4, L.head * 5, L.head * 1.8 * s), col = [.72, .64, .5];
    tube(B, base, m, .025, col); tube(B, m, tip, .02, col);
    tube(B, on(L.head * .3, L.head * 1.6, L.head * .7 * s), on(-L.head * .8, L.head * 2.1, L.head * .9 * s), .015, col);
    tube(B, m, on(-L.head * .3, L.head * 3.8, L.head * 1.9 * s), .015, col);
  }
  if (L.beard) B.tri(on(-.02, -L.head * .4, -.04), on(-.02, -L.head * .4, .04), [mz[0] - .08, mz[1] - L.head * 1.1, 0], L.beard);
  // the tail: a short flag (up and white when a deer runs), a fox's brush held out behind
  const [tx, ty] = at(-len * .7), [tl, droop] = L.tail || [.1, .9];
  const tA = L.flag && run ? .9 : L.brush ? (run ? -.05 : -.35) : -droop * 1.4, tEnd = [tx - Math.cos(tA) * tl, ty + girth * .3 + Math.sin(tA) * tl, 0];
  if (L.brush) {
    blob(B, (tx + tEnd[0]) / 2, (ty + girth * .3 + tEnd[1]) / 2, 0, tl * .3, L.tailCol, L.fur2, [1.9, .7, .7], 2);
    blob(B, tEnd[0], tEnd[1], 0, tl * .12, L.tailTip, L.tailTip, [1.4, 1, 1]);
  } else tube(B, [tx, ty + girth * .3, 0], tEnd, L.flag ? .05 : .03, L.tailCol || L.fur2);
  return B.out();
}

// a fox in its pounce: arched high, forepaws reaching down
export function foxPounce() {
  return beast('fox', { gait: 'run', ph: .25, head: 'graze' });
}

// which frame to draw, as a shape name (name + 'W0'.., 'R0'.., 'G0', 'G1', 'A', 'S'), built and
// registered the first time it is wanted (all eight looks' frames at once would cost ~1 s at boot
// on a phone and 10 MB): a walking animal a keeps a stride s (metres walked; the system adds
// speed * dt), its speed sp and a state ('graze', 'alert', or moving)
const made = new Set();
export function frameOf(R, look, a) {
  const L = BEASTS[look] || BEASTS.goat;
  let f, pose;
  if (a.state === 'graze') { const i = Math.floor((a.t || 0) * 1.6) % 2; f = 'G' + i; pose = { gait: 'stand', head: 'graze', chew: i }; }
  else if (a.state === 'alert') { f = 'A'; pose = { gait: 'stand', head: 'alert' }; }
  else if (!(a.sp > .05)) { f = 'S'; pose = { gait: 'stand', head: 'up' }; }
  else {
    const run = a.sp > L.stride * 2.2, n = run ? GAIT.run : GAIT.walk, i = (Math.floor((a.s || 0) / (L.stride * (run ? 2.4 : 1)) * n) % n + n) % n;
    f = (run ? 'R' : 'W') + i; pose = { gait: run ? 'run' : 'walk', ph: i / n, head: 'up' };
  }
  const name = look + f;
  if (!made.has(name)) { made.add(name); R.shape(name, beast(look, pose)); }
  return name;
}
