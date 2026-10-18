// The hawk: flight model, ground/perch/water states and animation pose.
//
// Flight is an energy-trading glider. The player controls the path angle (where the nose
// points); gravity converts height into speed when diving and speed back into height when
// pulling up, while drag slowly bleeds energy away. Drag has an induced part that grows at
// low speed, so there is a best-glide speed: too fast or too slow both sink faster. Below
// stall speed the nose drops on its own. One tap = one flap = a fixed burst of energy.
import { TAU, clamp, lerp, smooth } from './util.js';
import * as W from './world.js';
import { TUNE as T } from './tune.js';

// Each flap spends stamina that refills while gliding, so spamming taps stops working
// and thermals and ridge lift matter. Nose-high near a landing spot is a flare: it
// brakes hard, which is how you set down softly.
export const FEET = 6;            // body centre to feet
const MAX_SPEED = 260;
const WALK = 26, PADDLE = 16;

export function createBird(x, y) {
  return {
    x, y, s: 80, g: T.relax, face: 1, state: 'fly', stamina: 1, restT: 0,
    vx: 80, vy: 0, kick: 0, turnT: 0, flapCD: 0, autoFlapT: 0,
    target: null, walkTo: null, perch: null, circling: false, stall: false, air: 0,
    // pose (shared with the demo's rig)
    phase: 0, flapLeft: 0, flapAmt: 0, gTheta: .06, theta: .06, bend: 0, L: 1, Lg: 1, tailFan: .3, splay: .3, pitch: 0, bob: 0,
    walkPh: 0, peckT: 0, landT: 0, tuck: 0, flare: 0,
  };
}

export function turn(b) {
  if (b.turnT > 0) return;
  b.face = -b.face; b.turnT = .32;
  if (b.state === 'fly' && !b.circling) b.s *= .84;
}

export function flap(b, power, G) {
  if (b.flapCD > 0) return false;
  if (b.state !== 'fly') takeOff(b);
  // a tired hawk still flaps, just weakly
  const tired = b.stamina >= T.stamina ? 1 : .3 + .7 * b.stamina / Math.max(T.stamina, .001);
  b.stamina = Math.max(0, b.stamina - T.stamina); b.restT = .7;
  power *= tired;
  // a flap is part thrust (speed) and part lift (a direct upward kick that fades)
  b.s = Math.min(MAX_SPEED, b.s + T.flap * power);
  b.g = Math.min(1.05, b.g + .08);
  b.kick = Math.max(-60, b.kick - T.kick * power);
  b.flapLeft = 1; b.flapCD = .14;
  if (b.phase > Math.PI) b.phase = 0;
  G.emit('flap');
  return true;
}

function takeOff(b) {
  if (b.perch) b.perch = null;
  b.state = 'fly'; b.s = 48; b.g = .6; b.kick = -24; b.walkTo = null; b.y -= 2; b.stall = false;
}

function land(b, kind, G, y, soft = false) {
  b.state = kind; b.s = 0; b.g = 0; b.y = y; b.target = null; b.landT = .35; b.flapLeft = 0;
  G.emit('land', { kind, soft });
}

export function perchOn(b, p, G, soft = false) {
  b.perch = p; b.x = p.x; land(b, 'perch', G, p.y - FEET, soft);
}

const dragOf = s => T.dragA * 1e-3 * s * s + T.dragB * 1e3 / Math.max(s, 40) ** 2;

// Where the current glide ends if the player lets go: a short hands-off simulation.
export function predictGlide(b, G, maxT = 3.5) {
  const pts = []; let x = b.x, y = b.y, s = b.s, g = b.g;
  const dt = .06;
  for (let t = 0; t < maxT; t += dt) {
    let gT = T.relax + clamp((s - 88) * .007, -.5, .45);
    if (s < T.stall) gT = -.85;
    const rate = 2.4 * clamp(s / 70, .25, 1.3);
    g += clamp(gT - g, -rate * dt, rate * dt);
    s = clamp(s + (-T.gravity * Math.sin(g) - dragOf(s)) * dt, 8, MAX_SPEED);
    x += (Math.cos(g) * s * b.face + W.windAt(y) * .5) * dt;
    y += (-Math.sin(g) * s - W.updraft(x, y, G.t)) * dt;
    pts.push([x, y]);
    const wy = W.waterAt(x), gy = wy ?? W.groundY(x);
    if (y + FEET >= gy) { pts.end = 'ground'; break; }
  }
  return pts;
}

export function updateBird(b, dt, inp, G) {
  b.turnT = Math.max(0, b.turnT - dt); b.flapCD = Math.max(0, b.flapCD - dt); b.autoFlapT = Math.max(0, b.autoFlapT - dt);
  b.peckT = Math.max(0, b.peckT - dt); b.landT = Math.max(0, b.landT - dt);
  b.restT = Math.max(0, b.restT - dt);
  if (b.restT <= 0) b.stamina = Math.min(1, b.stamina + dt * T.regen * (b.state === 'fly' ? 1 : 2.5));
  if (b.state === 'fly') fly(b, dt, inp, G);
  else if (b.state === 'perch') perched(b, dt, inp, G);
  else if (b.state === 'ground') ground(b, dt, inp, G);
  else swim(b, dt, inp, G);
  pose(b, dt, G);
}

function fly(b, dt, inp, G) {
  const thermal = W.lift(b.x, b.y, G.t), air = thermal + W.ridgeLift(b.x, b.y);
  b.air = air;
  // hands off, the hawk holds its attitude: extra speed lifts the nose, too little drops it
  let gT = T.relax + clamp((b.s - 88) * .007, -.5, .45), manual = false;
  if (inp.steer) {
    manual = true;
    const dx = inp.steer.wx - b.x, dy = b.y - inp.steer.wy;
    if (dx * b.face < -14) turn(b);
    gT = Math.atan2(dy, Math.max(Math.abs(dx), 4));
  } else if (inp.pitch) { manual = true; gT = b.g + inp.pitch * 1.5; }
  if (inp.face && inp.face !== b.face) { manual = true; turn(b); }
  if (manual) b.target = null;

  // thermal circling: hands off inside a column, the hawk turns back and forth to stay in it
  const th = thermal > 6 ? W.thermalAt(b.x) : null;
  b.circling = !!(th && !manual && !b.target);
  if (b.circling) {
    if ((b.x - th.c) * b.face > th.w * .4) turn(b);
    if (b.s > 60) b.s += (60 - b.s) * .9 * dt;
    gT = -.12;
  }

  // tap-a-branch assist: steer and slow toward the chosen perch, flapping if it is above
  const p = b.target;
  if (p) {
    const tx = p.x, ty = p.y - FEET - 3, dx = tx - b.x, dy = b.y - ty, dist = Math.hypot(dx, dy);
    if (dist > 380 || p.occupied) b.target = null;
    else {
      if (dx * b.face < 0 && Math.abs(dx) > 16) turn(b);
      gT = Math.atan2(dy, Math.max(Math.abs(dx), 10));
      if (dist < 120 && b.s > 58) b.s -= (b.s - 58) * 1.8 * dt;
      if (dy > 2 && b.s < 90 && b.autoFlapT <= 0) { flap(b, G.flapPower, G); b.autoFlapT = .42; }
    }
  }
  // a stall drops the nose until the bird has flying speed again
  if (b.s < T.stall) b.stall = true; else if (b.s > T.stall + 14) b.stall = false;
  if (b.stall) gT = Math.min(gT, -.85);
  gT = clamp(gT, -1.45, 1.0);

  // control authority grows with airspeed
  const rate = 2.4 * clamp(b.s / 70, .25, 1.3);
  b.g += clamp(gT - b.g, -rate * dt, rate * dt);
  if (b.stall) b.g -= (1 - b.s / (T.stall + 14)) * 2 * dt;
  if (b.y < W.CEILING) b.g = Math.min(b.g, -.2); // thin air
  b.g = clamp(b.g, -1.5, 1.1);

  // flare: nose up and the spread wings act as an airbrake
  b.flaring = b.g > .3 && b.s > 25;
  const brake = b.flaring ? (b.g - .3) * b.s * T.flare : 0;
  b.s = clamp(b.s + (-T.gravity * Math.sin(b.g) - dragOf(b.s) - brake) * dt, 8, MAX_SPEED);

  b.vx = Math.cos(b.g) * b.s * b.face + W.windAt(b.y) * .5;
  b.kick *= Math.exp(-dt * 2.6);
  b.vy = -Math.sin(b.g) * b.s - air + b.kick;
  const px = b.x, py = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt;
  G.passRings(px, py, b.x, b.y);

  // contact with water, ground and perches
  const wy = W.waterAt(b.x), gy = W.groundY(b.x);
  if (wy !== null && b.y + 3 >= wy) {
    G.emit('splash', { x: b.x, y: wy, big: b.s > 90 });
    if (b.s > 140) { b.y = wy - 4; b.g = .28; b.s *= .55; }   // skip off the surface
    else { land(b, 'swim', G, wy - 3); }
    return;
  }
  if (b.y + FEET >= gy) {
    if (b.s < 80 && b.g > -.75) land(b, 'ground', G, gy - FEET, b.s < 50);
    else { b.y = gy - FEET - 1; b.g = .35; b.s *= .45; G.emit('crash', { x: b.x, y: gy }); }
    return;
  }
  for (const t of W.treesIn(b.x - 50, b.x + 50)) for (const q of t.perches) {
    if (q.occupied) continue;
    const dx = q.x - b.x, dy = q.y - (b.y + FEET), d = Math.hypot(dx, dy), aimed = q === b.target;
    if (d < (aimed ? 13 : 8) && b.s < (aimed ? 105 : 80) && dy > -6) { perchOn(b, q, G, b.s < 55); return; }
  }
}

function perched(b, dt, inp, G) {
  const p = b.perch; b.x = p.x; b.y = p.y - FEET;
  let dir = inp.face;
  if (inp.steer) {
    const dx = inp.steer.wx - b.x, dy = b.y - inp.steer.wy;
    if (Math.abs(dx) > 10) dir = Math.sign(dx);
    if (dy < -40 && Math.abs(dx) > 14) { dropOff(b, Math.sign(dx)); return; }
  }
  if (inp.pitch < 0) { dropOff(b, b.face); return; }
  if (dir && dir !== b.face) turn(b);
}
function dropOff(b, dir) {
  if (dir !== b.face) b.face = dir;
  b.perch = null; b.state = 'fly'; b.s = 46; b.g = -.45;
}

function walkDir(b, inp) {
  if (b.walkTo !== null) {
    const dx = b.walkTo - b.x;
    if (Math.abs(dx) < 2) { b.walkTo = null; return 0; }
    return Math.sign(dx);
  }
  if (inp.steer) { const dx = inp.steer.wx - b.x; if (Math.abs(dx) > 8) return Math.sign(dx); }
  return inp.face || 0;
}

function ground(b, dt, inp, G) {
  if (inp.steer || inp.face) b.walkTo = null;
  const dir = walkDir(b, inp);
  if (dir) {
    if (dir !== b.face) turn(b);
    const nx = b.x + dir * WALK * dt;
    if (W.waterAt(nx) !== null) { b.x = nx; land(b, 'swim', G, W.waterAt(nx) - 3); G.emit('splash', { x: nx, y: W.waterAt(nx), big: false }); return; }
    b.x = nx; b.walkPh += dt * 11;
  }
  b.y = W.groundY(b.x) - FEET;
  b.moving = !!dir;
}

function swim(b, dt, inp, G) {
  const dir = walkDir(b, inp);
  const wy = W.waterAt(b.x) ?? W.groundY(b.x);
  if (dir) {
    if (dir !== b.face) turn(b);
    const nx = b.x + dir * PADDLE * dt;
    if (W.waterAt(nx) === null) { b.x = nx; b.state = 'ground'; b.y = W.groundY(nx) - FEET; return; }
    b.x = nx; b.walkPh += dt * 5;
  }
  b.y = wy - 3 + Math.sin(G.t * 2.2) * .5;
  b.moving = !!dir;
}

// animation pose for the rig and the perched drawing
function pose(b, dt, G) {
  const k = Math.min(1, dt * 7);
  if (b.state === 'fly') {
    if (b.flapLeft > 0 || b.flapAmt > .02) { b.phase += dt * TAU / .4; if (b.phase >= TAU) { b.phase -= TAU; if (b.flapLeft > 0) b.flapLeft--; } }
    b.flapAmt += ((b.flapLeft > 0 ? 1 : 0) - b.flapAmt) * k;
    const soar = b.circling ? 1 : clamp(b.air / 30, 0, 1);
    b.tuck += (smooth(-.45, -1.1, b.g) - b.tuck) * k;
    b.flare += (((b.target && b.s < 80) || b.flaring ? 1 : 0) - b.flare) * k;
    b.Lg = 1 - .38 * b.tuck;
    b.gTheta += (.06 + .14 * soar - .12 * b.tuck + .2 * b.flare + .02 * Math.sin(G.t * 1.7) - b.gTheta) * Math.min(1, dt * 3);
    const c = Math.cos(b.phase);
    b.theta = lerp(b.gTheta, .2 + .85 * Math.sin(b.phase), b.flapAmt);
    b.bend = -.5 * c * b.flapAmt;
    b.L = b.Lg * (1 - b.flapAmt * .24 * Math.max(0, c));
    b.bob = -1.6 * Math.sin(b.phase) * b.flapAmt;
    b.tailFan = .25 + .6 * Math.max(soar, b.flare) - .2 * b.tuck;
    b.splay = .3 + .7 * Math.max(soar, b.flare) - .3 * b.tuck;
    b.pitch += (clamp(-b.g, -1.2, 1.2) - b.pitch) * Math.min(1, dt * 8);
  } else {
    b.flapAmt = 0; b.phase = 0; b.pitch = 0; b.bob = 0;
  }
}
