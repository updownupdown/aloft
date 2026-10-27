// The chase camera, the hawk's frame in the world, and its pose (wing beats, fold, flare,
// feet, tail). Fills the camera, hawk and pose parts of the scene.
import { height, solidsNear, surface, WATER } from './world.js';
import { local, roofAt } from './caves.js';
import { angleTo, clamp, cross, lerp, mix3, norm, smooth, store } from './util.js';

export function createCamera(G) {
  const C = { cam: null, look: null, yaw: 0, pitch: 0, still: false, zoom: clamp(+store.get('groundZoom3d', .5) || .5, .25, 1), zm: 1 };
  const b = G.b;
  // how far the view can stand from the eye toward `to` before something is in the way: in a cave its
  // rock (the floor and walls, world.js height, and the roof's underside), anywhere the rocks, ruins,
  // towers and standing stones (world.js solidsNear: upright columns; one the bird is inside, a
  // hollow ruin, is a room to keep within). Marched in half-metre steps; it stops short of the hit
  let near = [], nearAt = null;
  function clear(eye, to, cave) {
    const v = [to[0] - eye[0], to[1] - eye[1], to[2] - eye[2]], l = Math.hypot(v[0], v[1], v[2]);
    if (l < .01) return l;
    if (!nearAt || Math.hypot(eye[0] - nearAt[0], eye[2] - nearAt[2]) > 3) { nearAt = eye.slice(); near = solidsNear(eye[0], eye[2], 14).filter(o => !o.soft); }
    const room = near.filter(o => Math.hypot(eye[0] - o.x, eye[2] - o.z) < o.r && eye[1] > o.y0 && eye[1] < o.top);
    const max = cave ? Math.min(l, 4) : l, n = Math.ceil(max / .5);
    for (let i = 1; i <= n; i++) {
      const t = max * i / n, x = eye[0] + v[0] / l * t, y = eye[1] + v[1] / l * t, z = eye[2] + v[2] / l * t;
      let hit = false;
      if (cave) {
        const r = roofAt(x, z);
        hit = y < height(x, z) + .3 || (r && y > r.under - .35);
      }
      if (!hit) for (const o of near) {
        const d = Math.hypot(x - o.x, z - o.z);
        if (room.includes(o) ? d > o.r - .3 : d < o.r + .25 && y > o.y0 && y < o.top + .25) { hit = true; break; }
      }
      if (hit) return Math.max(0, t - .5);
    }
    return max;
  }

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
    const roof = roofAt(b.p[0], b.p[2]), cave = b.inCave || (roof && b.p[1] < (roof.under + roof.top) / 2 ? roof.cv : null);
    let look, want;
    if (b.state === 'fly') {
      // the camera swings after the hawk's heading rather than its position, so it never falls behind
      // and looks a little into a turn, by the bank (the controls study, 10-25)
      C.yaw += angleTo(C.yaw, b.yaw + b.roll * .5) * Math.min(1, dt * 3.5);
      const fo = G.aim?.focus || 0;
      C.pitch += (b.gamma * (.45 + .4 * fo) - C.pitch) * Math.min(1, dt * 2.5);
      const cp = C.pitch, d = [Math.sin(C.yaw) * Math.cos(cp), Math.sin(cp), -Math.cos(C.yaw) * Math.cos(cp)];
      const tight = 1 - .2 * (b.under || 0);   // under the canopy the camera tucks in closer, clear of trunks
      const dist = (2.4 + Math.min(b.s, 40) * .03 + fo * .8) * tight, h = (1.35 + Math.min(b.s, 40) * .005 + fo * 1.2) * tight;
      want = [p[0] - d[0] * dist, p[1] - d[1] * dist + h, p[2] - d[2] * dist];
      look = [p[0] + d[0] * 3, p[1] + d[1] * 3 + .2, p[2] + d[2] * 3];
      // diving at something: the view leans toward it so it is not hidden under the bird
      const tg = G.aim?.target;
      if (tg && fo > .1) { const k = .45 * fo; look = [look[0] + (tg.x - look[0]) * k, look[1] + (tg.y - look[1]) * k, look[2] + (tg.z - look[2]) * k]; }
    } else {
      // on the ground a drag turns the view itself (b.view), quickly; otherwise it drifts round the bird
      if (b.state === 'ground' && b.view != null) C.yaw += angleTo(C.yaw, b.view) * Math.min(1, dt * 8);
      else if (cave) {
        // in a cave the view lies along the passage (in or out, whichever the bird faces more), where
        // there is room to stand back
        const q = local(cave, b.p[0], b.p[2]), ax = Math.atan2(q.ux, -q.uz), a = Math.abs(angleTo(vyaw, ax)) < Math.PI / 2 ? ax : ax + Math.PI;
        C.yaw += angleTo(C.yaw, a + (C.swing || 0)) * Math.min(1, dt * 1.5);
      } else C.yaw += angleTo(C.yaw, vyaw + (C.swing || 0) + Math.sin(G.t * .15) * .3) * Math.min(1, dt * .8);
      C.pitch = 0;
      // looking round (b.lookYaw/lookPitch): the camera swings about the bird and tips up or down
      const ly = C.yaw + (b.lookYaw || 0), lp = b.lookPitch || 0, d = [Math.sin(ly), 0, -Math.cos(ly)];
      // a little above and behind, the hawk just under the middle of the view (clear of the song box)
      // on the ground the view stands back (C.zoom .5: twice as far) to show worms and water round
      // the bird; a pinch sets it from .25 (four times as far) to 1, and it is kept
      if (b.zoomPinch) { C.zoom = Math.max(.25, Math.min(1, C.zoom * b.zoomPinch)); b.zoomPinch = 0; store.set('groundZoom3d', C.zoom); }
      // mantling over a fresh catch (food.js b.mantle) the view comes in low and close a moment
      C.zm += ((b.state === 'ground' ? 1 / C.zoom : 1) * (b.mantle > 0 ? .55 : 1) - C.zm) * Math.min(1, dt * 4);
      const zm = C.zm;
      // tipping (lp, radians): the camera dips a little and the view turns up about it, up to ~70°
      // overhead into the boughs, or down toward the ground; at 0 it is the usual view
      want = [p[0] - d[0] * 2.6 * zm, p[1] + .9 * zm - Math.max(-.5, Math.min(.6, lp)) * .9, p[2] - d[2] * 2.6 * zm];
      const hz = 4.1 * zm, a0 = Math.atan2(.9 * zm - .05, hz), a = Math.max(-1.1, Math.min(1.25, lp - a0));
      look = [p[0] + d[0] * 1.5 * zm, want[1] + hz * Math.tan(a), p[2] + d[2] * 1.5 * zm];
      // asleep (b.skyView, sys/sleep.js): the view sinks below and behind the bird and turns up to the
      // stars, the roosting bird dark against them at the foot of the picture
      C.sky = (C.sky || 0) + ((b.skyView ? 1 : 0) - (C.sky || 0)) * Math.min(1, dt * .8);   // about four seconds each way (sys/sleep.js)
      if (C.sky > .001) {
        const k = C.sky * C.sky * (3 - 2 * C.sky), sw = [p[0] - d[0] * 2.4, p[1] - 1.1, p[2] - d[2] * 2.4], el = .72;
        const sl = [sw[0] + d[0] * Math.cos(el) * 10, sw[1] + Math.sin(el) * 10, sw[2] + d[2] * Math.cos(el) * 10];
        for (let i = 0; i < 3; i++) { want[i] += (sw[i] - want[i]) * k; look[i] += (sl[i] - look[i]) * k; }
      }
    }
    if (!C.cam) C.cam = want.slice();
    const k = (b.state === 'fly' && !C.still) || b.snapCam ? 1 : Math.min(1, dt * 2);
    for (let i = 0; i < 3; i++) C.cam[i] += (want[i] - C.cam[i]) * k;
    if (b.state === 'fly' && Math.hypot(want[0] - C.cam[0], want[1] - C.cam[1], want[2] - C.cam[2]) < .05) C.still = false;
    if (b.state !== 'fly') C.still = true;
    if (!cave) C.cam[1] = Math.max(C.cam[1], surface(C.cam[0], C.cam[2], C.cam[1]) + 1.1, WATER + .6);
    if (!C.look) C.look = look.slice();
    for (let i = 0; i < 3; i++) C.look[i] += (look[i] - C.look[i]) * (b.snapCam ? 1 : Math.min(1, dt * (b.state === 'fly' ? 12 : 4)));
    b.snapCam = false;   // a travel (main.js G.travelTo): the view jumps with the bird, once
    // the view keeps clear of what stands between it and the bird (clear() below): it comes in along
    // the line to the first thing in the way at once, and eases back out; with no room at all it
    // looks out from the bird's own head (the hawk not drawn)
    const eye = [p[0], p[1] + .3, p[2]], free = clear(eye, C.cam, cave);
    C.pull = Math.min(free, (C.pull ?? free) + dt * 3);
    const v = [C.cam[0] - eye[0], C.cam[1] - eye[1], C.cam[2] - eye[2]], vl = Math.hypot(v[0], v[1], v[2]) || 1, dl = Math.min(vl, C.pull);
    // sitting with a wall at its back the view swings round, slowly, to the side with more room
    if (b.state !== 'fly' && b.view == null && free < vl * .5) {
      const turn = a => { const c = Math.cos(a), s = Math.sin(a); return [eye[0] + v[0] * c - v[2] * s, C.cam[1], eye[2] + v[0] * s + v[2] * c]; };
      const l = Math.max(clear(eye, turn(-.8), cave), clear(eye, turn(-1.6), cave)), r = Math.max(clear(eye, turn(.8), cave), clear(eye, turn(1.6), cave));
      if (Math.max(l, r) > free + .5) C.swing = clamp((C.swing || 0) + (r > l ? 1 : -1) * dt * .9, -Math.PI, Math.PI);
    }
    if (b.state === 'fly') C.swing = 0;
    let cam = [eye[0] + v[0] / vl * dl, eye[1] + v[1] / vl * dl, eye[2] + v[2] / vl * dl], lk = C.look;
    const fp = clamp((1.6 - dl) / .6, 0, 1);   // 0 behind the bird .. 1 from its head
    if (fp > 0) {
      const fw = [C.look[0] - eye[0], C.look[2] - eye[2]], fl = Math.hypot(fw[0], fw[1]) || 1, head = [p[0] + fw[0] / fl * .25, p[1] + .35, p[2] + fw[1] / fl * .25];
      cam = cam.map((c, i) => c + (head[i] - c) * fp);
      lk = [C.look[0], C.look[1] + (eye[1] - C.look[1]) * .3 * fp, C.look[2]];
    }
    S.hideHawk = fp > .5;

    // the hawk's frame: forward with a body pitch, banked by roll
    const pv = b.state === 'fly' ? b.gamma * .8 + b.flare * .45 - b.tuck * .1 : b.state === 'perch' ? .5 : b.state === 'ground' ? .3 : .08;
    const f = [Math.sin(vyaw) * Math.cos(pv), Math.sin(pv), -Math.cos(vyaw) * Math.cos(pv)];
    const r0 = [Math.cos(vyaw), 0, Math.sin(vyaw)], u0 = cross(r0, f), cr = Math.cos(b.roll + (b.spin || 0)), sr = Math.sin(b.roll + (b.spin || 0));   // spin: a barrel roll
    const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
    const u = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];

    const aspect = innerWidth / innerHeight;
    let fov = (52 + Math.min(b.s, 45) * .4) * Math.PI / 180; if (aspect < 1) fov = Math.min(1.9, fov * 1.35);
    S.cam = cam; S.look = lk; S.fov = fov;
    // flaring to land (or sitting on a perch) the trees open up wider, to find a perch
    C.seek = (C.seek || 0) + ((b.state === 'fly' ? clamp((b.flare - .15) / .6, 0, 1) : b.state === 'perch' ? .5 : 0) - (C.seek || 0)) * Math.min(1, dt * 3);
    S.seek = C.seek;
    S.camUp = norm([r0[0] * Math.sin(b.roll) * .3, 1, r0[2] * Math.sin(b.roll) * .3]);
    S.camHigh = cam[1] - height(cam[0], cam[2]);
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
    if (b.eating > 0 || b.mantle > 0) {   // mantling over the catch: wings half open, hunched, tail spread
      const m = Math.min(1, Math.max(b.eating || 0, b.mantle || 0)), bob = Math.sin(G.t * 9) * .05;
      return { flapL: .25 + bob, flapR: .25 + bob, handL: -.2, handR: -.2, fold: .35 * m + (1 - m), flare: .6 * m, legs: 1, tail: .6 * m, tailPitch: .2, t: G.t, tailRed: G.tailRed ?? 1 };
    }
    const out = {
      flapL: settled ? .05 : fl, flapR: settled ? .05 : fr, handL: settled ? 0 : hl, handR: settled ? 0 : hr,
      fold: settled ? clamp(1 - b.settle * 1.6, 0, 1) : clamp(b.tuck * .75 + b.canopy * .25, 0, 1),
      flare: settled ? clamp(b.settle * 2, 0, 1) : b.flare,
      legs: settled ? 1 : clamp(Math.max(b.flare, b.reach || 0, b.carry ? 1 : 0, pm && Math.hypot(pm.x - p[0], pm.y - p[1], pm.z - p[2]) < 8 ? 1 : 0), 0, 1) * .9,
      tail: settled ? .05 : clamp(b.flare * .9 + Math.abs(b.roll) * .35 + (b.ride ? .3 : 0), 0, 1), tailPitch: b.flare * .3, t: G.t, tailRed: G.tailRed ?? 1,
      headYaw: 0, headPitch: 0, fluff: 0,
    };
    // sitting still (sys/still.js): preening, sunning, a rouse, hunched in the rain, the head turning
    const A = b.acting;
    if (A && settled && A.k > 0) for (const k in A.p) out[k] += (A.p[k] - out[k]) * A.k;
    return out;
  }
  return C;
}
