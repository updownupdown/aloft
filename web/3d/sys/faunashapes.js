// Low-poly meshes for the wildlife, all facing +x with y up and about a metre of real size per
// unit (instances scale them). An instance's yaw turns +x toward (cos yaw, sin yaw) on x, z.
import { builder, blob, reseed } from '../shapes.js';
import { buildHawk, HAWK_SCALE } from '../hawk.js';

const quad = (B, a, b, c, d, col) => { B.tri(a, b, c, col); B.tri(a, c, d, col); };
// a leg or neck: a thin four-sided tube from p to q
function limb(B, p, q, r, col) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...d) || 1;
  const u = Math.abs(d[1] / l) > .9 ? [1, 0, 0] : [0, 1, 0];
  let s = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]; const sl = Math.hypot(...s); s = s.map(v => v / sl * r);
  let t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; const tl = Math.hypot(...t); t = t.map(v => v / tl * r);
  const ring = c => [[c[0] + s[0], c[1] + s[1], c[2] + s[2]], [c[0] + t[0], c[1] + t[1], c[2] + t[2]], [c[0] - s[0], c[1] - s[1], c[2] - s[2]], [c[0] - t[0], c[1] - t[1], c[2] - t[2]]];
  const A = ring(p), Q = ring(q);
  for (let i = 0; i < 4; i++) quad(B, A[i], A[(i + 1) % 4], Q[(i + 1) % 4], Q[i], col);
}

// a small songbird or starling, wings up or down (two frames make the flap)
export function smallBird(up) {
  reseed(41); const B = builder(), body = [.22, .21, .23], wing = [.17, .16, .18];
  blob(B, 0, 0, 0, .09, body, wing, [1.6, .8, .9]);
  blob(B, .12, .03, 0, .05, body, body);
  B.tri([.17, .03, -.01], [.17, .03, .01], [.21, .02, 0], [.6, .5, .3]);
  B.tri([-.12, .01, -.04], [-.12, .01, .04], [-.24, .0, 0], wing);
  const y = up ? .14 : -.1, tip = up ? .1 : -.05;
  for (const s of [1, -1]) { B.tri([.06, .02, .02 * s], [-.06, .02, .02 * s], [-.02, y, .22 * s], wing); B.tri([.02, y, .2 * s], [-.04, y, .22 * s], [-.04, tip, .36 * s], wing); }
  return B.out();
}

// a grey heron standing in the shallows: grey back, pale neck, dark crest, long yellow bill
export function heronStanding() {
  reseed(43); const B = builder(), grey = [.55, .57, .6], pale = [.86, .86, .84], dark = [.18, .18, .2], leg = [.62, .55, .38], bill = [.85, .7, .3];
  blob(B, 0, .95, 0, .26, grey, [.6, .62, .65], [1.6, .9, .85]);
  B.tri([-.25, 1.02, -.12], [-.25, 1.02, .12], [-.55, .88, 0], [.45, .47, .5]);
  limb(B, [.3, 1.05, 0], [.38, 1.3, 0], .045, pale); limb(B, [.38, 1.3, 0], [.3, 1.5, 0], .04, pale); limb(B, [.3, 1.5, 0], [.4, 1.62, 0], .04, pale);
  blob(B, .42, 1.64, 0, .07, pale, pale, [1.3, 1, .9]);
  B.tri([.36, 1.69, -.015], [.36, 1.69, .015], [.18, 1.73, 0], dark);
  limb(B, [.47, 1.65, 0], [.72, 1.6, 0], .02, bill);
  for (const s of [.08, -.08]) { limb(B, [0, .78, s], [.02, .02, s * .6], .022, leg); }
  return B.out();
}
// a heron in flight: broad bowed wings (up or down), neck folded back, legs trailing
export function heronFlying(up) {
  reseed(44); const B = builder(), grey = [.55, .57, .6], dark = [.3, .31, .35], pale = [.86, .86, .84], leg = [.62, .55, .38], bill = [.85, .7, .3];
  blob(B, 0, 0, 0, .24, grey, [.62, .63, .66], [1.6, .75, .8]);
  blob(B, .32, .06, 0, .12, pale, grey);
  limb(B, [.4, .07, 0], [.62, .05, 0], .02, bill);
  limb(B, [-.3, -.02, .06], [-1.05, -.05, .06], .02, leg); limb(B, [-.3, -.02, -.06], [-1.05, -.05, -.06], .02, leg);
  const y = up ? .55 : -.4, y2 = up ? .35 : -.55;
  for (const s of [1, -1]) {
    quad(B, [.25, .05, .12 * s], [-.2, .05, .12 * s], [-.25, y * .6, .9 * s], [.22, y * .6, .9 * s], grey);
    quad(B, [.22, y * .6, .9 * s], [-.25, y * .6, .9 * s], [-.2, y2, 1.65 * s], [.1, y2, 1.6 * s], dark);
  }
  return B.out();
}

// a roe deer, standing alert or grazing with its head down
export function deer(grazing) {
  reseed(47); const B = builder(), coat = [.62, .43, .27], dark = [.45, .3, .2], rump = [.9, .86, .78], hoof = [.2, .16, .14];
  blob(B, 0, .95, 0, .32, coat, dark, [1.9, .9, .75]);
  blob(B, -.55, 1.0, 0, .15, rump, coat, [.8, 1, .9]);
  const nk = grazing ? [[.45, 1.0, 0], [.75, .55, 0], [.85, .3, 0]] : [[.45, 1.05, 0], [.6, 1.32, 0], [.72, 1.38, 0]];
  limb(B, nk[0], nk[1], .085, coat);
  blob(B, nk[2][0], nk[2][1], 0, .12, coat, dark, [1.5, .9, .8]);
  for (const s of [.06, -.06]) B.tri([nk[2][0] - .08, nk[2][1] + .08, s], [nk[2][0] - .02, nk[2][1] + .1, s * 2.4], [nk[2][0] - .14, nk[2][1] + .25, s * 2.2], dark);
  for (const [x, z] of [[.4, .12], [.4, -.12], [-.42, .12], [-.42, -.12]]) { limb(B, [x, .8, z], [x + .02, .08, z], .04, coat); limb(B, [x + .02, .08, z], [x + .03, 0, z], .035, hoof); }
  return B.out();
}

// a fish: a silver-brown spindle with a tail fan
export function fish() {
  reseed(53); const B = builder(), back = [.42, .45, .38], side = [.78, .78, .72];
  blob(B, 0, 0, 0, .14, back, side, [2.2, .8, .55]);
  B.tri([-.28, 0, 0], [-.42, .1, 0], [-.42, -.1, 0], back);
  B.tri([.0, .1, 0], [-.12, .18, 0], [-.15, .08, 0], back);
  return B.out();
}

// a wild hawk soaring, built from the player's hawk mesh in a still glide, turned to face +x
export function soaringHawk() {
  const tris = buildHawk({ flapL: .08, flapR: .08, handL: .05, handR: .05, fold: 0, flare: 0, legs: 0, tail: .7, t: 0 }, 'hawk');
  const out = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 12) {
    const [x, y, z, nx, ny, nz] = tris.subarray(i, i + 6);
    out.set([z * HAWK_SCALE, y * HAWK_SCALE, -x * HAWK_SCALE, nz, ny, -nx], i);
    out.set(tris.subarray(i + 6, i + 12), i + 6);
  }
  return out;
}

// the same soaring hawk seen far off (past ~70 m, where it is a few pixels): its outline in a dozen
// facets, brown above and pale below, the rufous tail, at the same size (892 triangles each was a
// kettle of thirty costing more than the trees)
export function soaringHawkFar() {
  const a = [], back = [.43, .29, .18], under = [.92, .87, .78], tail = [.6, .33, .2], tailU = [.9, .82, .76];
  const tri = (p, q, r, top, bot) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) { [q, r] = [r, q]; nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    for (const v of [p, q, r]) a.push(v[0], v[1], v[2], nx / l, ny / l, nz / l, ...top, ...bot);
  };
  const nose = [.28, .03, 0], neck = [.12, .07, 0], rump = [-.2, .04, 0], chin = [.14, -.03, 0], belly = [-.12, -.04, 0];
  for (const s of [1, -1]) {
    const side = [0, .02, .07 * s], hip = [-.15, .02, .05 * s];
    tri(nose, neck, side, back, under); tri(neck, rump, side, back, under); tri(rump, hip, side, back, under);
    tri(nose, side, chin, under, under); tri(chin, side, belly, under, under); tri(belly, side, hip, under, under);
    // the wing: broad inner wing, then the hand out to the slotted tip, a little dihedral
    const lead = [.1, .04, .08 * s], trail = [-.16, .04, .08 * s], wrist = [.12, .09, .48 * s], back2 = [-.2, .08, .46 * s], tip = [-.04, .11, .8 * s], tipB = [-.16, .1, .74 * s];
    tri(lead, wrist, trail, back, under); tri(trail, wrist, back2, back, under); tri(wrist, tip, back2, back, under); tri(back2, tip, tipB, back, under);
    // the tail, fanned
    tri([-.18, .03, 0], [-.34, .03, .1 * s], [-.36, .03, 0], tail, tailU);
  }
  return new Float32Array(a);
}

// a lens (lenticular) cloud: smooth, flat, stacked like plates
export function lens() {
  reseed(59); const B = builder(), W = [.98, .96, .93], S = [.9, .88, .9];
  blob(B, 0, 0, 0, 1, W, S, [1.7, .16, 1]); blob(B, .1, .13, 0, .75, W, W, [1.6, .12, .95]); blob(B, -.05, -.1, .05, .8, S, W, [1.5, .12, 1]);
  return B.out();
}
