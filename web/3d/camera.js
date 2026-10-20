// The chase camera, the hawk's frame in the world, and its pose (wing beats, fold, flare,
// feet, tail). Fills the camera, hawk and pose parts of the scene.
import { height, WATER } from './world.js';
import { angleTo, clamp, cross, lerp, mix3, norm, smooth } from './util.js';

export function createCamera(G) {
  const C = { cam: null, look: null, yaw: 0, pitch: 0, still: false };
  const b = G.b;

  C.update = (dt, S) => {
    // settling onto a perch (or hopping), the hawk is drawn gliding from where it was, turning as it
    // comes; the camera frames that drawn hawk, not the perch it has already arrived at
    let hp = b.p, vyaw = b.yaw;
    if (b.settle > 0 && b.from) {
      const t = smooth(0, 1, 1 - b.settle / (b.settleT || .45)); hp = mix3(b.from, b.p, t);
      if (b.hop > 0) hp = [hp[0], hp[1] + Math.sin(t * Math.PI) * b.hop, hp[2]];   // a hop arcs over
      if (b.fromYaw != null) vyaw = b.fromYaw + angleTo(b.fromYaw, b.yaw) * smooth(0, 1, Math.min(1, t * 1.4));
    }
    if (b.state === 'fly' && b.settle <= 0) b.from = null;
    const p = hp;
    let look, want;
    if (b.state === 'fly') {
      // the camera swings after the hawk's heading rather than its position, so it never falls behind
      C.yaw += angleTo(C.yaw, b.yaw) * Math.min(1, dt * 3.5);
      const fo = G.aim?.focus || 0;
      C.pitch += (b.gamma * (.45 + .4 * fo) - C.pitch) * Math.min(1, dt * 2.5);
      const cp = C.pitch, d = [Math.sin(C.yaw) * Math.cos(cp), Math.sin(cp), -Math.cos(C.yaw) * Math.cos(cp)];
      const dist = 2.4 + Math.min(b.s, 40) * .03 + fo * .8, h = 1.35 + Math.min(b.s, 40) * .005 + fo * 1.2;
      want = [p[0] - d[0] * dist, p[1] - d[1] * dist + h, p[2] - d[2] * dist];
      look = [p[0] + d[0] * 3, p[1] + d[1] * 3 + .2, p[2] + d[2] * 3];
      // diving at something: the view leans toward it so it is not hidden under the bird
      const tg = G.aim?.target;
      if (tg && fo > .1) { const k = .45 * fo; look = [look[0] + (tg.x - look[0]) * k, look[1] + (tg.y - look[1]) * k, look[2] + (tg.z - look[2]) * k]; }
    } else {
      // on the ground a drag turns the view itself (b.view), quickly; otherwise it drifts round the bird
      if (b.state === 'ground' && b.view != null) C.yaw += angleTo(C.yaw, b.view) * Math.min(1, dt * 8);
      else C.yaw += angleTo(C.yaw, vyaw + Math.sin(G.t * .15) * .3) * Math.min(1, dt * .8);
      C.pitch = 0;
      const d = [Math.sin(C.yaw), 0, -Math.cos(C.yaw)];
      // a little above and behind, the hawk just under the middle of the view (clear of the song box)
      want = [p[0] - d[0] * 2.6, p[1] + .9, p[2] - d[2] * 2.6];
      look = [p[0] + d[0] * 1.5, p[1] + .05, p[2] + d[2] * 1.5];
    }
    if (!C.cam) C.cam = want.slice();
    const k = b.state === 'fly' && !C.still ? 1 : Math.min(1, dt * 2);
    for (let i = 0; i < 3; i++) C.cam[i] += (want[i] - C.cam[i]) * k;
    if (b.state === 'fly' && Math.hypot(want[0] - C.cam[0], want[1] - C.cam[1], want[2] - C.cam[2]) < .05) C.still = false;
    if (b.state !== 'fly') C.still = true;
    C.cam[1] = Math.max(C.cam[1], height(C.cam[0], C.cam[2]) + 1.1, WATER + .6);
    if (!C.look) C.look = look.slice();
    for (let i = 0; i < 3; i++) C.look[i] += (look[i] - C.look[i]) * Math.min(1, dt * (b.state === 'fly' ? 12 : 4));

    // the hawk's frame: forward with a body pitch, banked by roll
    const pv = b.state === 'fly' ? b.gamma * .8 + b.flare * .45 - b.tuck * .1 : b.state === 'perch' ? .5 : b.state === 'ground' ? .3 : .08;
    const f = [Math.sin(vyaw) * Math.cos(pv), Math.sin(pv), -Math.cos(vyaw) * Math.cos(pv)];
    const r0 = [Math.cos(vyaw), 0, Math.sin(vyaw)], u0 = cross(r0, f), cr = Math.cos(b.roll), sr = Math.sin(b.roll);
    const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
    const u = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];

    const aspect = innerWidth / innerHeight;
    let fov = (52 + Math.min(b.s, 45) * .4) * Math.PI / 180; if (aspect < 1) fov = Math.min(1.9, fov * 1.35);
    S.cam = C.cam; S.look = C.look; S.fov = fov;
    // flaring to land (or sitting on a perch) the trees open up wider, to find a perch
    C.seek = (C.seek || 0) + ((b.state === 'fly' ? clamp((b.flare - .15) / .6, 0, 1) : b.state === 'perch' ? .5 : 0) - (C.seek || 0)) * Math.min(1, dt * 3);
    S.seek = C.seek;
    S.camUp = norm([r0[0] * Math.sin(b.roll) * .3, 1, r0[2] * Math.sin(b.roll) * .3]);
    S.camHigh = C.cam[1] - height(C.cam[0], C.cam[2]);
    S.focus = hp;
    S.hawk = { p: hp, r: [-r[0], -r[1], -r[2]], u, f };
    S.pose = pose(dt);
  };

  // wing beats: up, a long down stroke, back to the glide; the hand lags behind the arm.
  // Each wing has an amplitude: a one-sided flap still moves the other wing a little.
  function pose() {
    const glide = b.state !== 'fly' ? 0 : .1 + Math.sin(G.t * 1.7) * .025 + (b.lift > 1 ? .05 : 0) - b.tuck * .12 + b.flare * .2;
    const beat = (t0, amp) => {
      const D = .42, ph = t0 / D;
      if (ph >= 1) return [glide, 0];
      const fa = ph < .28 ? lerp(glide, 1.05, smooth(0, 1, ph / .28)) : ph < .72 ? lerp(1.05, -.8, smooth(0, 1, (ph - .28) / .44)) : lerp(-.8, glide, smooth(0, 1, (ph - .72) / .28));
      const hand = ph < .28 ? -.35 : ph < .72 ? .45 * Math.sin((ph - .28) / .44 * Math.PI) : -.2 * (1 - (ph - .72) / .28);
      return [glide + (fa - glide) * amp, hand * amp];
    };
    const [fl, hl] = beat(b.flapL, b.ampL ?? 1), [fr, hr] = beat(b.flapR, b.ampR ?? 1);
    const settled = b.state !== 'fly' && !(b.hop > 0 && b.settle > .08), pm = G.perchMark, p = b.p;
    if (b.eating > 0) {   // mantling over the catch: wings half open, hunched, tail spread
      const m = Math.min(1, b.eating), bob = Math.sin(G.t * 9) * .05;
      return { flapL: .25 + bob, flapR: .25 + bob, handL: -.2, handR: -.2, fold: .35 * m + (1 - m), flare: .6 * m, legs: 1, tail: .6 * m, tailPitch: .2, t: G.t, tailRed: G.tailRed ?? 1 };
    }
    return {
      flapL: settled ? .05 : fl, flapR: settled ? .05 : fr, handL: hl, handR: hr,
      fold: settled ? clamp(1 - b.settle * 1.6, 0, 1) : clamp(b.tuck * .75 + b.canopy * .25, 0, 1),
      flare: settled ? clamp(b.settle * 2, 0, 1) : b.flare,
      legs: settled ? 1 : clamp(Math.max(b.flare, b.reach || 0, pm && Math.hypot(pm.x - p[0], pm.y - p[1], pm.z - p[2]) < 8 ? 1 : 0), 0, 1) * .9,
      tail: settled ? .05 : clamp(b.flare * .9 + Math.abs(b.roll) * .35 + (b.ride ? .3 : 0), 0, 1), tailPitch: b.flare * .3, t: G.t, tailRed: G.tailRed ?? 1,
    };
  }
  return C;
}
