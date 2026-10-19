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
    yaw: null, yawSgn: 1, hover: 0, hop: null, left: null, leftT: 0, hopT: 0, noPerchT: 0,
    loop: null, flipT: 0, trim: 0,
    // pose (shared with the demo's rig)
    phase: 0, flapLeft: 0, flapAmt: 0, gTheta: .06, theta: .06, bend: 0, L: 1, Lg: 1, tailFan: .3, splay: .3, pitch: 0, bob: 0,
    walkPh: 0, peckT: 0, landT: 0, tuck: 0, flare: 0,
    kiteT: 0, kiteLeft: -9, adult: false,
  };
}

// Turning in the air is a flat turn: the hawk swings round toward the viewer or away from
// them, its forward speed passing through nothing while its wings sweep across the picture,
// then carries on the other way at the same height. Faster birds take a wider, slower turn.
export function turn(b, dur) {
  if (b.turnT > 0 || b.yaw) return;
  if (b.state === 'fly') { b.yawSgn = -b.yawSgn; b.yaw = { t: 0, dur: dur || (b.s > 60 ? .62 : .4), flipped: false }; return; }
  b.face = -b.face; b.turnT = .32;
  if (b.state === 'perch') b.hopT = .25;
}

// Out of stamina the wings won't beat at all: glide, or find rising air.
// `sync` (0 to 1) is how together the two thumbs struck: a clean beat costs a fraction of a
// ragged one and drives harder, so well-timed flapping goes a long way.
export function flap(b, power, G, sync = 1) {
  if (b.flapCD > 0) return false;
  const cost = T.stamina * (.3 + 1.4 * Math.pow(1 - sync, 1.5));
  if (b.stamina < cost * .99) { if (!b.tiredT) G.emit('tired'); b.tiredT = .6; return false; }
  if (b.state !== 'fly') takeOff(b);
  b.stamina = Math.max(0, b.stamina - cost); b.restT = .7;
  // a flap is part thrust (speed) and part lift (a direct upward kick that fades)
  b.s = Math.min(MAX_SPEED, b.s + T.flap * power * (.5 + .7 * sync));
  if (!b.loop) b.g = Math.min(1.05, b.g + .08);
  b.kick = Math.max(-60, b.kick - T.kick * power * (.6 + .4 * sync));
  b.flapLeft = 1; b.flapCD = .14;
  if (b.phase > Math.PI) b.phase = 0;
  G.emit('flap', { quality: sync });
  return true;
}

// leaving a branch: it can't catch the hawk again until it has flown clear of it
// (nor can any other branch for a moment, or one in the same tree would catch it straight back)
function takeOff(b) {
  if (b.perch) { b.left = b.perch; b.leftT = .8; b.perch = null; }
  b.state = 'fly'; b.s = 48; b.g = .6; b.kick = -24; b.walkTo = null; b.y -= 2; b.stall = false; b.yaw = null; b.hover = 0; b.hop = null; b.noPerchT = .5; b.loop = null;
}

// Dropping a level: from a branch, hop down to the next branch below in the same tree, or to
// the ground (or the water) under it, a little like stepping down in a platformer.
export function hopDown(b, G, dir = b.face) {
  if (b.state !== 'perch') return false;
  const p = b.perch;
  let to = null;
  for (const q of W.perchesIn(b.x - 40, b.x + 40)) {
    if (q === p || q.occupied || q.y < p.y + 6 || Math.abs(q.x - b.x) > 36) continue;
    if (!to || q.y < to.y || (q.y === to.y && Math.abs(q.x - b.x) < Math.abs(to.x - b.x))) to = q;
  }
  let x1, y1, kind = 'perch';
  if (to) { x1 = to.x; y1 = to.y - FEET; }
  else {
    x1 = b.x + dir * 10; const wy = W.waterAt(x1);
    if (wy !== null) { kind = 'swim'; y1 = wy - 3; } else { kind = 'ground'; y1 = W.groundY(x1) - FEET; }
  }
  if (x1 !== b.x && Math.sign(x1 - b.x) !== b.face && Math.abs(x1 - b.x) > 3) b.face = Math.sign(x1 - b.x);
  b.left = p; b.leftT = .8; b.perch = null; b.state = 'fly'; b.s = 20; b.g = .3; b.stall = false; b.yaw = null; b.kick = 0;
  b.hop = { t: 0, dur: clamp(.25 + (y1 - b.y) / 220, .3, .7), x0: b.x, y0: b.y, x1, y1, kind, to };
  b.flapLeft = 1;
  G.emit('hop');
  return true;
}

// a single tap on a perch, the ground or the water: turn toward it, take a step or a paddle
export function nudge(b, dir) {
  if (dir !== b.face) turn(b);
  if (b.state === 'perch') { b.hopT = .25; return; }
  b.walkTo = b.x + dir * (b.state === 'swim' ? 8 : 12);
}

function land(b, kind, G, y, soft = false) {
  const speed = b.s;
  b.state = kind; b.s = 0; b.g = 0; b.y = y; b.target = null; b.landT = .35; b.flapLeft = 0; b.kiteT = 0; b.hover = 0; b.yaw = null; b.hop = null; b.loop = null; b.pitch = 0;
  G.emit('land', { kind, soft, speed });
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
  b.tiredT = Math.max(0, (b.tiredT || 0) - dt); b.hopT = Math.max(0, b.hopT - dt); b.leftT = Math.max(0, b.leftT - dt);
  b.turnT = Math.max(0, b.turnT - dt); b.flapCD = Math.max(0, b.flapCD - dt); b.autoFlapT = Math.max(0, b.autoFlapT - dt);
  b.peckT = Math.max(0, b.peckT - dt); b.landT = Math.max(0, b.landT - dt);
  b.restT = Math.max(0, b.restT - dt); b.noPerchT = Math.max(0, b.noPerchT - dt); b.flipT = Math.max(0, b.flipT - dt);
  if (b.restT <= 0) b.stamina = Math.min(1, b.stamina + dt * T.regen * (b.state === 'fly' ? 1 : 2.5));
  if (b.state === 'fly') fly(b, dt, inp, G);
  else if (b.state === 'perch') perched(b, dt, inp, G);
  else if (b.state === 'ground') ground(b, dt, inp, G);
  else swim(b, dt, inp, G);
  pose(b, dt, G);
}

function fly(b, dt, inp, G) {
  if (b.hop) { hop(b, dt, G); return; }
  const thermal = W.lift(b.x, b.y, G.t), air = thermal + W.ridgeLift(b.x, b.y);
  b.air = air;
  // hands off, the hawk holds its attitude: extra speed lifts the nose, too little drops it
  let gT = T.relax + clamp((b.s - 88) * .007, -.5, .45), manual = false, aim = 0, adx = 0, ady = 0;
  if (inp.steer) {
    manual = true;
    adx = inp.steer.wx - b.x; ady = b.y - inp.steer.wy;
    aim = Math.atan2(ady, Math.abs(adx));
    // pointing almost straight down never swings the hawk round; it has to be clearly behind
    if (adx * b.face < (aim < -.9 ? -30 : -14)) turn(b);
    gT = Math.atan2(ady, Math.max(Math.abs(adx), 4));
  } else if (inp.pitch) { manual = true; gT = b.g + inp.pitch * 1.5; aim = inp.pitch < 0 ? -1.2 : 0; }
  // the two thumbs as a yoke: tilted (one up, one down) pitches the nose; both low settles the
  // hawk down to land, both high trims it for its longest glide (or, in a thermal, rides it).
  // Tilted hard at speed, it loops.
  const Y = inp.yoke; b.trim = 0; b.ride = null;
  if (!manual && Y) {
    if (Math.abs(Y.p) > .14) { manual = true; gT = b.g + Y.p * 1.8; }
    else if (Y.avg < -.4) { manual = true; aim = -1.2; if (b.s >= 88) gT = .3; }   // fast, it flares to slow first
    else if (Y.avg > .4) {
      const th = thermal > 2 && W.thermalAt(b.x);
      if (th) b.ride = th; else { b.trim = 1; gT = -.1; }
    }
    if (Math.abs(Y.p) > .7 && b.s > 88 && !b.loop && !b.yaw && !b.hover) { b.loop = { dir: Math.sign(Y.p), a: 0 }; G.emit('loop'); }
  }
  if (inp.face && inp.face !== b.face) { manual = true; turn(b); }
  if (manual) b.target = null;

  // Settling down: pointed steeply down while slow, the hawk stops gliding and lets itself
  // down on slow wingbeats, drifting toward the finger, so landing is easy. Fast, it dives.
  const wantHover = aim < -.9 && (b.s < 90 || b.hover > .5) && !b.target && b.kiteT < .2 && !inp.steer?.dive;   // (a focused stoop never settles)
  b.hover = clamp(b.hover + (wantHover ? 3 : -4) * dt, 0, 1);
  if (b.hover > 0) {
    // (a finger a little behind only draws the hawk back a touch; well behind, it turns)
    const k = b.hover, back = adx * b.face < 0, tvx = inp.steer ? clamp(adx * 1.1, back ? -12 : -30, back ? 12 : 30) : Y ? b.face * 12 : 0, tvy = inp.steer ? clamp(-ady * .7, 14, 34) : 28;
    b.s += (32 - b.s) * Math.min(1, dt * 4 * k); b.g += (.35 - b.g) * Math.min(1, dt * 5 * k);
    b.stall = false; b.restT = Math.max(b.restT, .3); b.circling = false;
    if (b.flapLeft < 1 && k > .5) b.flapLeft = 1;
    if (k >= 1) {
      b.vx = b.vx + (tvx + W.windAt(b.y) * .3 - b.vx) * Math.min(1, dt * 3);
      b.vy = b.vy + (tvy - air * .5 - b.vy) * Math.min(1, dt * 3);
      if (back && Math.abs(adx) > 45) turn(b);
      if (b.yaw) yawTurn(b, dt);
      return move(b, G);
    }
    if (!wantHover && k < .2) b.s = Math.max(b.s, T.stall + 8);   // leaving it, the hawk has flying speed again
  }

  // soaring: hands off in a thermal the hawk spreads its wings, slows and floats up, holding its line
  b.circling = thermal > 6 && !manual && !b.target;
  if (b.circling) {
    if (b.s > 64) b.s += (64 - b.s) * .8 * dt;
    gT = -.1;
  }
  // riding a thermal: the hawk spreads everything, slows to its gentlest sink so the air
  // lifts it as high as it will go, and turns softly back each time it reaches the edge
  if (b.ride) {
    b.circling = true; gT = -.04;
    b.s += (54 - b.s) * Math.min(1, dt * 3); b.stall = false;
    if ((b.x - b.ride.c) * b.face > b.ride.w * .5) turn(b, 1.1);
  }
  // kiting: held nose-up into a headwind, low and slow over open ground, the hawk hangs on
  // the air with small wing trims, scanning the grass below. Strong wind pushes it back a
  // little, weak wind lets it sink; pointing down drops it into a stoop.
  const head = -W.windAt(b.y, b.x) * b.face, up = W.groundY(b.x) - b.y;
  const canKite = !!inp.steer && head > 5 && b.s < 80 && gT > .12 && gT < .8 && up > 24 && up < 240 && thermal < 15 && !b.yaw && !b.target;
  b.kiteT = clamp(b.kiteT + (canKite ? 2 : -3) * dt, 0, 1);
  if (b.kiteT > .5) { b.kiteLeft = G.t; b.stall = false; }
  if (b.kiteT > 0) gT = lerp(gT, .3, b.kiteT);

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
  // a stall drops the nose until the bird has flying speed again (a kiting hawk hangs below
  // flying speed on purpose)
  if (b.s < T.stall && b.kiteT < .5 && !b.loop) b.stall = true; else if (b.s > T.stall + 14) b.stall = false;
  if (b.stall) gT = Math.min(gT, -.85);
  gT = clamp(gT, -1.45, 1.0);

  if (b.loop) {
    // a loop (nose up and over) or a front flip (nose down and under): the path angle turns
    // right round at a steady rate; too slow and the hawk falls out of it
    const L = b.loop, w = TAU / 1.5 * L.dir;
    b.g += w * dt; L.a += Math.abs(w) * dt;
    if (b.s < 32) { b.loop = null; b.g = Math.atan2(Math.sin(b.g), Math.cos(b.g)); b.pitch = -b.g; }
    else if (L.a >= TAU) { b.loop = null; b.g = Math.atan2(Math.sin(b.g), Math.cos(b.g)); b.pitch = -b.g; b.flipT = 3; G.emit('flip', { dir: L.dir }); G.emit('trick', { kind: L.dir > 0 ? 'loop' : 'frontflip' }); }
  } else {
    // control authority grows with airspeed; mid-turn the hawk levels out
    if (b.yaw) gT = lerp(gT, clamp(gT, -.3, .25), .7);
    const rate = 2.4 * clamp(b.s / 70, .25, 1.3);
    b.g += clamp(gT - b.g, -rate * dt, rate * dt);
    if (b.stall) b.g -= (1 - b.s / (T.stall + 14)) * 2 * dt;
    b.g = clamp(b.g, -1.5, 1.1);
  }
  // thermals end at the cloudbase, but flapping can still climb, up to where the air runs out
  if (b.y < W.SKY && !b.loop) b.g = Math.min(b.g, -.2);

  // flare: nose up and the spread wings act as an airbrake
  b.flaring = b.g > .3 && b.s > 25 && !b.yaw && !b.loop;
  const brake = b.flaring ? (b.g - .3) * b.s * T.flare : 0;
  // (a turn costs a little speed, the wings working against the swing)
  // (a loop is flown on momentum the wings help carry; trimmed for gliding, drag eases off)
  b.s = clamp(b.s + (-T.gravity * Math.sin(b.g) * (b.loop ? .35 : 1) - dragOf(b.s) * (b.trim ? .75 : 1) - brake - (b.yaw ? b.s * .22 : 0)) * dt, 8, MAX_SPEED);
  if (b.kiteT > 0) b.s = lerp(b.s, T.stall + 10, b.kiteT * Math.min(1, dt * 6));   // the wind holds a kiting hawk just above stall speed

  // through a turn the forward speed swings away from the picture and back
  const swing = b.yaw ? Math.abs(Math.cos(Math.PI * Math.min(1, b.yaw.t / b.yaw.dur))) : 1;
  b.vx = Math.cos(b.g) * b.s * b.face * swing + W.windAt(b.y) * .5;
  b.kick *= Math.exp(-dt * 2.6);
  b.vy = -Math.sin(b.g) * b.s - air + b.kick;
  if (b.kiteT > 0) {
    const k = b.kiteT, hover = (head - 14) * .25;
    b.vx = lerp(b.vx, -b.face * hover + Math.sin(G.t * 1.7) * 2, k);
    b.vy = lerp(b.vy, Math.max(-6, 7 - head * .5) + Math.sin(G.t * 2.3) * 3 + b.kick, k);
  }
  if (b.yaw) yawTurn(b, dt);
  move(b, G);
}

// move with the current velocity, then meet whatever is there: rings, prey, water, ground, branches
function move(b, G) {
  const dt = G.dt, px = b.x, py = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt;
  G.passRings(px, py, b.x, b.y);

  // a dive that reaches a mouse or a fish snatches it and swoops back up
  if (G.catchPrey?.(b)) return;
  // contact with water, ground and perches
  const wy = W.waterAt(b.x), gy = W.groundY(b.x);
  if (wy !== null && b.y + 3 >= wy) {
    G.emit('splash', { x: b.x, y: wy, big: b.s > 90 });
    if (b.s > 140) { b.y = wy - 4; b.g = .28; b.s *= .55; }   // skip off the surface
    else { land(b, 'swim', G, wy - 3); }
    return;
  }
  if (b.y + FEET >= gy) {
    // too fast or too steep is a hard landing, but the hawk stops where it hits
    const hard = b.s >= 80 || b.g <= -.75;
    land(b, 'ground', G, gy - FEET, b.s < 50);
    if (hard) { b.landT = .6; G.emit('crash', { x: b.x, y: gy }); }
    return;
  }
  if (b.left && (b.leftT <= 0 && Math.hypot(b.left.x - b.x, b.left.y - b.y) > 24)) b.left = null;
  for (const q of W.perchesIn(b.x - 50, b.x + 50)) {
    if (q.occupied || q === b.left) continue;
    const dx = q.x - b.x, dy = q.y - (b.y + FEET), d = Math.hypot(dx, dy), aimed = q === b.target;
    if (b.noPerchT > 0 && !aimed) continue;
    if (d < (aimed ? 13 : b.hover > .5 ? 11 : 8) && b.s < (aimed ? 105 : 80) && dy > -6) { perchOn(b, q, G, b.s < 55); return; }
  }
}

// the turn's clock: the facing swaps halfway, when the hawk is square to the viewer
function yawTurn(b, dt) {
  const Y = b.yaw; Y.t += dt;
  if (!Y.flipped && Y.t >= Y.dur / 2) { Y.flipped = true; b.face = -b.face; }
  if (Y.t >= Y.dur) b.yaw = null;
}

// a hop down a level: a short drop with the wings half open, then a soft landing
function hop(b, dt, G) {
  const H = b.hop; H.t += dt;
  const u = Math.min(1, H.t / H.dur), e = u * u;
  const px = b.x, py = b.y;
  b.x = lerp(H.x0, H.x1, smooth(0, 1, u)); b.y = lerp(H.y0, H.y1, e) - Math.sin(u * Math.PI) * 4;
  b.vx = (b.x - px) / Math.max(dt, 1e-3); b.vy = (b.y - py) / Math.max(dt, 1e-3);
  b.g = .3; b.s = 20; b.flare = 1;
  if (u < 1) return;
  if (H.kind === 'perch' && H.to && !H.to.occupied) perchOn(b, H.to, G, true);
  else if (H.kind === 'swim') { G.emit('splash', { x: b.x, y: H.y1 + 3, big: false }); land(b, 'swim', G, H.y1); }
  else land(b, 'ground', G, W.groundY(b.x) - FEET, true);
}

function perched(b, dt, inp, G) {
  const p = b.perch; b.x = p.x; b.y = p.y - FEET - Math.sin(b.hopT / .25 * Math.PI) * 2.5;
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
  b.left = b.perch; b.leftT = .8; b.perch = null; b.state = 'fly'; b.s = 46; b.g = -.45; b.noPerchT = .5;
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

// animation pose for the rig and the perched drawing (also drives the other hawks)
export function pose(b, dt, G) {
  const k = Math.min(1, dt * 7);
  if (b.state === 'fly') {
    if (b.flapLeft > 0 || b.flapAmt > .02) { b.phase += dt * TAU / (b.hover > .5 ? .55 : .4); if (b.phase >= TAU) { b.phase -= TAU; if (b.flapLeft > 0) b.flapLeft--; } }
    b.flapAmt += ((b.flapLeft > 0 ? 1 : 0) - b.flapAmt) * k;
    const kite = b.kiteT, soar = Math.max(kite, b.circling ? 1 : clamp(b.air / 30, 0, 1)), turning = b.yaw || b.turnT > 0 ? 1 : 0;
    // sinking air sweeps the wings back a little; a dive tucks them
    b.tuck += (Math.max(smooth(-.45, -1.1, b.g), .2 * smooth(20, 70, b.vy) * (1 - soar)) - b.tuck) * k;
    b.flare += (((b.target && b.s < 80) || b.flaring || b.hover > .3 || b.hop ? 1 : 0) - b.flare) * k;
    b.Lg = 1 - .38 * b.tuck;
    b.gTheta += (.06 + .14 * soar - .12 * b.tuck + .2 * b.flare + .02 * Math.sin(G.t * 1.7) - b.gTheta) * Math.min(1, dt * 3);
    const c = Math.cos(b.phase);
    // kiting: quick small trims of the wings hold the hawk still on the wind
    b.theta = lerp(b.gTheta, .2 + .85 * Math.sin(b.phase), b.flapAmt) + Math.sin(G.t * 22) * .09 * kite;
    b.bend = -.5 * c * b.flapAmt;
    b.L = b.Lg * (1 - b.flapAmt * .24 * Math.max(0, c));
    b.bob = -1.6 * Math.sin(b.phase) * b.flapAmt;
    b.tailFan = .25 + .6 * Math.max(soar, b.flare) + .35 * turning - .2 * b.tuck;
    b.splay = .3 + .7 * Math.max(soar, b.flare) - .3 * b.tuck;
    if (b.loop) b.pitch = -b.g;
    else b.pitch += (clamp(-b.g, -1.2, 1.2) - b.pitch) * Math.min(1, dt * 8);
  } else {
    b.flapAmt = 0; b.phase = 0; b.pitch = 0; b.bob = 0;
  }
}
