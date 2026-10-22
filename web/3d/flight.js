// The hawk's flight in 3D: an energy model. Airspeed is traded for height (climb slows you,
// diving speeds you up), drag depends on the wing shape (tucked, gliding, flared), banking
// turns, and below stall speed the nose drops. Rising air (thermals, ridges) lifts the whole
// air mass, so it never changes airspeed. With no input the hawk trims to its best glide.
import { height, normalAt, WATER, treesNear, TREE, perchesOf, airLift, thermalsNear, thermalCentre, solidsNear } from './world.js';

const g = 9.8;
export const FLY = {
  best: 12, maxS: 46, cd: .0058, cdTuck: .0024, cdFlare: .03, stall: 7.5, stallFlare: 3.6,
  climb: .55, dive: .9, roll: 1.0, yaw: 1.2, flapS: 3.0, flapUp: 1.3, flapHover: 3.2, flapCost: .065,
  perchR: 1.6, landS: 10.5,
  skimH: 2.6, skimDrag: .45,   // ground effect: within skimH metres of water or flat ground, drag falls by up to skimDrag
  // flared with both thumbs up (float): flare drag falls by up to floatDrag, the stall speed by
  // floatStall, and perches are caught from floatReach metres farther and at floatLand m/s more
  floatDrag: .45, floatStall: 1.2, floatReach: .7, floatLand: 3,
  // the wings spread wide and level: soaring, slow and buoyant (soarDrag of the flare's drag), the
  // way to ride a thermal. Spread and down: braking, the wings dump lift and the hawk sinks by up to
  // flareSink/1.6 m/s more, to come down gently where it is (a landing, a perch)
  soarDrag: .45, flareSink: 3.2,
  // folded in: level, a fast glide between thermals (nose down tuckGlide); folded and down, the
  // stoop; folded and up, a swept zoom climb that carries speed (climb x 1+tuckZoom)
  tuckGlide: .1, tuckStoop: .35, tuckZoom: .3,
  // the barrel roll (both sticks turned a full circle together, input.js): seconds, speed kept
  barrelT: 1.1, barrelKeep: .93,
  // flared, thumbs up and slow (under hoverS): the hawk hangs on beating wings (hoverBeat seconds
  // a beat), for hoverCost stamina a second; spent, it drops at hoverDrop m/s² more
  hoverS: 5.5, hoverBeat: .3, hoverCost: .075, hoverDrop: 5,
  // the wind (b.wind, m/s, set from the weather each frame) carries the hawk with the air, less
  // near the ground; landing counts speed over the ground, so into the wind you land slow and
  // soft, and with it you come in fast and run on (runOn metres for each m/s over runS)
  windNear: .45, runS: 5, runOn: .8,
  // wet feathers (b.wet 0..1: rain, a plunge): more drag, a higher stall, weaker beats
  wetDrag: .3, wetStall: 1.2, wetFlap: .3,
};
// speed over the ground: the airspeed's level part plus the wind
export const groundSpeed = b => { const f = fwd(b), w = b.wind || [0, 0]; return Math.hypot(f[0] * b.s + w[0], f[2] * b.s + w[1]); };

export function createHawk(x, z) {
  const y = height(x, z);
  return {
    p: [x, Math.max(y, WATER) + 0.35, z], yaw: 0, gamma: 0, s: 0, roll: 0, vy: 0, lift: 0,
    state: 'ground', stamina: 1, tuck: 0, flare: 0, flapL: 9, flapR: 9, perch: null, settle: 0,
    tree: null, canopy: 0, inThermal: null, ride: false, lastHit: 0, t: 0, ampL: 1, ampR: 1, prev: null,
  };
}

export const fwd = b => [Math.sin(b.yaw) * Math.cos(b.gamma), Math.sin(b.gamma), -Math.cos(b.yaw) * Math.cos(b.gamma)];

export function step(b, c, dt, E) {
  b.t += dt;
  b.flapL += dt; b.flapR += dt;
  // the tuck eases in over a dead zone and saturates well before the thumbs meet, so how far the
  // thumbs happen to slide doesn't swing the dive (and the aim's focus) about
  const tw = Math.min(1, Math.max(0, (-c.spread - .1) / .5)), tuckT = tw * tw * (3 - 2 * tw);
  b.tuck += (tuckT - b.tuck) * Math.min(1, dt * 5);
  b.flare += (Math.max(0, c.spread) - b.flare) * Math.min(1, dt * 6);
  if (b.state !== 'fly') { b.spin = 0; b.barrel = null; return still(b, c, dt, E); }
  // the wing's shape with the thumbs up or down: spread and up floats (and hovers when slow), spread
  // and down brakes; folded and down stoops, folded and up zooms
  const up = Math.max(0, Math.min(1, c.pitch / .6)), dn = Math.max(0, Math.min(1, -c.pitch / .6));
  b.float = b.flare * up;
  b.brake = b.flare * dn;
  b.stoop = b.tuck * dn;
  barrel(b, c, dt, E);
  // how fast the hawk is gaining speed (smoothed): no perching while it is
  b.acc = (b.acc || 0) + ((b.s - (b.sPrev ?? b.s)) / Math.max(dt, 1e-3) - (b.acc || 0)) * Math.min(1, dt * 4);
  b.sPrev = b.s; b.view = null;
  aimB = b; if ((b.aimPerchT = (b.aimPerchT || 0) - dt) <= 0) b.aimPerch = null;

  // flaps
  if (c.flap) {
    const weak = b.stamina < .08 ? .3 : 1, q = c.flap.q * weak * (1 - FLY.wetFlap * (b.wet || 0));
    // two wings together tire you less: a perfectly paired tap costs about half a ragged one
    b.stamina = Math.max(0, b.stamina - FLY.flapCost * (c.flap.side ? .6 : 1.2 - .6 * (c.flap.sync ?? 0)));
    const stall = stallness(b);
    b.s = Math.min(FLY.maxS, b.s + FLY.flapS * q * (.35 + .65 * (1 - b.flare)));
    b.vy += (FLY.flapUp + FLY.flapHover * b.flare + 1.6 * stall) * q;
    if (c.flap.side) b.yaw += -c.flap.side * .12;      // one wing leading pushes you round
    // a bird never beats one wing alone: the other follows, more lightly
    b.flapL = b.flapR = 0;
    b.ampL = c.flap.side > 0 ? .35 : 1; b.ampR = c.flap.side < 0 ? .35 : 1;
    E.flap(q, c.flap.side, c.flap.sync);
    if (weak < 1) E.tired();
  }

  const sStall = FLY.stall + (FLY.stallFlare - FLY.stall) * b.flare + 2 * b.tuck - FLY.floatStall * b.float + FLY.wetStall * (b.wet || 0);
  // ground effect: skimming low over water or a flat field, the air cushions the wings and you carry
  const gy = height(b.p[0], b.p[2]), wet = gy < WATER, agl = b.p[1] - Math.max(gy, WATER) - .35;
  const flat = wet ? 1 : Math.max(0, (normalAt(b.p[0], b.p[2])[1] - .94) / .05);
  b.skim = agl < FLY.skimH ? Math.min(1, flat) * (1 - Math.max(0, agl) / FLY.skimH) * (1 - b.tuck) * (1 - b.flare) : 0;
  b.skimWet = wet;
  const cd = (FLY.cd + (FLY.cdTuck - FLY.cd) * b.tuck + .004 * Math.sin(b.roll) ** 2) * (1 - FLY.skimDrag * b.skim) * (1 - .3 * (b.slip || 0)) + FLY.cdFlare * b.flare * (FLY.soarDrag + (1 - FLY.soarDrag) * b.brake) * (1 - FLY.floatDrag * b.float);
  const cdW = cd * (1 + FLY.wetDrag * (b.wet || 0));
  const trim = Math.asin(Math.max(-1, -FLY.cd * FLY.best * FLY.best / g));
  let gT = trim + (b.s - FLY.best) * .022 + (c.pitch > 0 ? c.pitch * FLY.climb * (1 - .7 * b.float) * (1 + FLY.tuckZoom * b.tuck) : c.pitch * FLY.dive * (1 - .75 * b.flare))
    - b.tuck * (FLY.tuckGlide + FLY.tuckStoop * dn) + b.flare * .12;
  if (b.s < sStall) gT = Math.min(gT, -(sStall - b.s) * .13);
  gT = Math.max(-1.35, Math.min(.8, gT));
  b.gamma += (gT - b.gamma) * Math.min(1, dt * (1.1 + b.s * .1));
  b.s += (-g * Math.sin(b.gamma) - cdW * b.s * b.s) * dt;
  b.s = Math.max(0, Math.min(FLY.maxS, b.s));

  // bank and turn; soaring (wings spread) in a thermal, the rising air under the outer wing eases the
  // hawk a little toward the core: you steer the circle, it only helps you keep it
  let rT = c.roll * FLY.roll + (c.yaw || 0) * .2;
  b.inThermal = null; b.ride = false;
  b.lift = airLift(b.p[0], b.p[1], b.p[2], E.sun);
  if (b.lift > .8) {
    for (const t of thermalsNear(b.p[0], b.p[2], 140)) {
      const [tx, tz] = thermalCentre(t, b.p[1]), d = Math.hypot(b.p[0] - tx, b.p[2] - tz);
      if (d < t.r * 1.3) { b.inThermal = { t, tx, tz, d }; break; }
    }
  }
  if (b.inThermal) {
    const { t, tx, tz, d } = b.inThermal;
    const f = fwd(b), toC = [(tx - b.p[0]) / (d || 1), (tz - b.p[2]) / (d || 1)];
    const side = Math.sign(f[0] * toC[1] - f[2] * toC[0]) || 1;     // which side the core lies on
    const soar = Math.max(0, Math.min(1, (b.flare - .25) / .4)) * (1 - b.brake);
    rT += side * Math.max(0, Math.min(.12, (d - t.r * .35) * .006)) * soar * (1 - Math.min(1, Math.abs(c.roll) * 3));
    b.ride = soar > .5;
  }
  b.roll += (rT - b.roll) * Math.min(1, dt * 3.2);
  // in a stoop the tail and half-closed wings still steer: the turn doesn't fade with speed as a glide's does
  const sTurn = Math.max(5, b.s * (1 - .65 * b.tuck));
  const yawRate = Math.max(-1.9, Math.min(1.9, g * Math.tan(b.roll) / sTurn * (1 + b.flare * .3)));
  b.yaw += (yawRate + (c.yaw || 0) * FLY.yaw) * dt;   // both thumbs slid one way: a flat yaw on top

  // stall sink and flap lift live in vy, which settles back to zero
  const st = stallness(b, sStall);
  b.vy += (-g * st * .85 - b.vy * 1.6 + b.skim * 1.2 - FLY.flareSink * b.brake) * dt;
  hover(b, c, dt, E);

  // steer softly round trunks a moment ahead, so threading a wood is about lines, not luck
  avoid(b, dt);

  const f = fwd(b);
  b.prev = [b.p[0], b.p[1], b.p[2]];
  b.p[0] += f[0] * b.s * dt; b.p[2] += f[2] * b.s * dt;
  b.p[1] += (f[1] * b.s + b.vy + b.lift) * dt;
  b.p[1] = Math.min(b.p[1], 700);
  if (b.wind) { const k = FLY.windNear + (1 - FLY.windNear) * Math.min(1, Math.max(0, agl) / 40); b.p[0] += b.wind[0] * k * dt; b.p[2] += b.wind[1] * k * dt; }
  b.stamina = Math.min(1, b.stamina + dt * (b.lift > .5 ? .06 : .035) * (b.recover ?? 1));

  trees(b, dt, E);
  if (b.state === 'fly') solids(b, E, dt);
  if (b.state === 'fly') ground(b, E);
}

// the barrel roll: the sticks asked for one (c.barrel: 1 counter-clockwise, rolling left; -1
// clockwise, right). The body turns a full circle about its long axis (b.spin, camera.js) over
// barrelT seconds along a short corkscrew, losing a little speed
function barrel(b, c, dt, E) {
  if (c.barrel && !b.barrel && b.s > 6) { b.barrel = { t: 0, dir: c.barrel }; E.barrel?.(c.barrel); }
  if (!b.barrel) { b.spin = 0; return; }
  const B = b.barrel; B.t += dt;
  const k = Math.min(1, B.t / FLY.barrelT), e = k * k * (3 - 2 * k);
  b.spin = -B.dir * Math.PI * 2 * e;
  b.vy += Math.sin(k * Math.PI * 2) * 2.2 * dt;            // up over the top, down through the bottom
  b.yaw += -B.dir * Math.sin(k * Math.PI) * .5 * dt;        // a little sideways, the way it rolls
  b.s *= Math.pow(FLY.barrelKeep, dt / FLY.barrelT);
  if (k >= 1) { b.barrel = null; b.spin = 0; E.barrelDone?.(B.dir); }
}

// hover: flared hard, both thumbs up and slow, the hawk beats its wings and hangs in place (it can
// still yaw and bank round); each second costs stamina, and with none left it sinks fast instead
function hover(b, c, dt, E) {
  const want = b.flare > .55 && c.pitch > .45 && b.s < FLY.hoverS ? 1 : 0;
  b.hover = (b.hover || 0) + (want - (b.hover || 0)) * Math.min(1, dt * 4);
  if (b.hover < .05) { b.hoverT = 0; return; }
  const h = b.hover;
  if (b.stamina > .02) {
    b.stamina = Math.max(0, b.stamina - FLY.hoverCost * h * dt);
    b.s += (.6 - b.s) * Math.min(1, dt * 2) * h;   // a slow creep forward
    b.gamma += (.05 - b.gamma) * Math.min(1, dt * 4) * h;
    b.vy += (g * stallness(b) * .85 - b.vy * 3 - (b.lift > 0 ? b.lift * .6 : 0)) * dt * h;   // beats hold the height
    if ((b.hoverT = (b.hoverT || 0) - dt) <= 0) {
      b.hoverT = FLY.hoverBeat; b.flapL = b.flapR = 0; b.ampL = b.ampR = .8;
      E.flap(.45 * h, 0, 1);
    }
  } else {
    b.vy -= FLY.hoverDrop * h * dt;
    if ((b.hoverT = (b.hoverT || 0) - dt) <= 0) { b.hoverT = 1.5; E.tired(); }
  }
}

const stallness = (b, sStall = FLY.stall) => Math.max(0, Math.min(1, (sStall - b.s) / sStall));

function still(b, c, dt, E) {
  b.s = 0; b.vy = 0; b.gamma = 0; b.roll *= .8; b.lift = 0;
  b.settle = Math.max(0, b.settle - dt);
  if (b.settle <= 0) b.hop = 0;
  else if (b.hop > 0 && b.flapL > .42) b.flapL = b.flapR = 0;   // keep beating across a hop
  b.stamina = Math.min(1, b.stamina + dt * .2 * (b.recover ?? 1));
  // turn on the spot to choose a way out: drag sideways (the bird turns against the swipe, as if
  // you were turning the view) or A/D; on the ground the drag turns the view and the bird turns
  // briskly with it, so it always faces away from you
  const turn = (c.keyRoll ?? 0) * dt * 1.6 - (c.dragX ?? 0) * 3.4;
  if (b.state === 'ground') {
    if (b.view == null) b.view = b.yaw;
    b.view += turn;
    b.yaw += Math.atan2(Math.sin(b.view - b.yaw), Math.cos(b.view - b.yaw)) * Math.min(1, dt * 7) + turn * .5;
    // pinch: two fingers together pull the view out, apart bring it in (camera.js reads b.zoom)
    if (c.pinch && c.pinch !== 1) b.zoomPinch = (b.zoomPinch || 1) * c.pinch;
  } else { b.yaw += turn; b.view = null; }
  b.sPrev = 0; b.acc = 0;
  // look round (two fingers, or the gyro): the view swings, then drifts back after a pause
  const lk = c.look || [0, 0];
  if (Math.abs(lk[0]) + Math.abs(lk[1]) > 1e-4) {
    b.lookT = 2.2;
    b.lookYaw = Math.max(-2.6, Math.min(2.6, (b.lookYaw || 0) + lk[0]));
    b.lookPitch = Math.max(-.7, Math.min(1.45, (b.lookPitch || 0) + lk[1]));
  } else if ((b.lookT = (b.lookT || 0) - dt) < 0) { const k = Math.min(1, dt * 2); b.lookYaw = (b.lookYaw || 0) * (1 - k); b.lookPitch = (b.lookPitch || 0) * (1 - Math.min(1, dt * .7)); }   // the tip comes back slowly
  // perched or standing, one finger dragged up or down tips the view (down looks up, far enough to
  // see into the boughs overhead), and it eases back a few seconds after; nothing walks: on the
  // ground the bird gets about by hops
  if ((b.state === 'perch' || b.state === 'ground') && c.dragY) { b.lookPitch = Math.max(-.7, Math.min(1.45, (b.lookPitch || 0) + c.dragY * 2.6)); b.lookT = 3.5; }
  // a tapped spot on the ground (aim.js sets b.goTo): hop there, a hop at a time, stopping at water
  if (b.state === 'ground' && b.goTo && b.settle <= 0 && !(b.eating > 0) && !b.asleep && !(b.wantOff > 0)) {
    const d = Math.hypot(b.goTo[0] - b.p[0], b.goTo[2] - b.p[2]);
    if (d < .6) b.goTo = null;
    else { const at = [...b.p]; groundHop(b, E, b.goTo); if (b.p[0] === at[0] && b.p[2] === at[2]) b.goTo = null; return; }
  }
  if (b.state === 'swim') b.p[1] = WATER + .12 + Math.sin(b.t * 2) * .03;
  if (b.wantOff > 0) b.wantOff -= dt;
  // perched or standing, only Take off takes off; a tap on the ground is a hop (to a worm close by,
  // or forward); on the water a tap still lifts off
  if (c.flap && b.settle <= 0 && b.state === 'ground' && !(b.eating > 0) && !b.asleep) return groundHop(b, E);
  if ((c.flap && b.settle <= 0 && b.state === 'swim') || (b.wantOff > 0 && b.settle < .2)) {
    b.asleep = false;
    b.wantOff = 0; b.noPerch = 1.6; b.settle = 0; b.hop = 0;
    // take off: a strong stroke forward and up
    const wet = b.state === 'swim';
    b.yaw = clearYaw(b);   // facing a slope, turn to open air first (the camera swings round after)
    b.state = 'fly'; b.perch = null; b.tree = null; b.view = null; b.goTo = null; b.lookYaw = b.lookPitch = 0;
    b.s = 8; b.gamma = .35; b.vy = wet ? 3.5 : 4.5;
    if (wet) b.p[1] = WATER + .5;   // clear of the surface, or the first frame would settle back onto it b.flapL = b.flapR = 0; b.ampL = b.ampR = 1;
    b.stamina = Math.max(0, b.stamina - FLY.flapCost);
    E.flap(1, 0); E.takeoff();
  }
}

// the way to take off: straight ahead if the climb out clears the ground, else the nearest heading
// either side that does, else straight down the slope
function clearYaw(b) {
  const ok = a => { for (const d of [2, 4, 7, 11, 16]) if (height(b.p[0] + Math.sin(a) * d, b.p[2] - Math.cos(a) * d) + .5 > b.p[1] + d * .28) return false; return true; };
  if (ok(b.yaw)) return b.yaw;
  for (let k = .3; k < Math.PI; k += .3) for (const a of [b.yaw + k, b.yaw - k]) if (ok(a)) return a;
  const n = normalAt(b.p[0], b.p[2]);
  return Math.atan2(n[0], -n[2]);
}

// a hop along the ground: toward to (a tapped spot), else b.hopAim (a worm, set by food.js) if it is
// close, else a step forward
function groundHop(b, E, to) {
  const a = to || b.hopAim, d = a ? Math.hypot(a[0] - b.p[0], a[2] - b.p[2]) : 0;
  if (a && d > .2) b.view = b.yaw = Math.atan2(a[0] - b.p[0], -(a[2] - b.p[2]));   // the camera comes round behind
  const step = a ? Math.min(d, 2.5) : 1.4, nx = b.p[0] + Math.sin(b.yaw) * step, nz = b.p[2] - Math.cos(b.yaw) * step;
  if (height(nx, nz) < WATER) return;
  b.from = [...b.p]; b.p = [nx, height(nx, nz) + .35, nz];
  b.settle = b.settleT = .32; b.hop = .35; b.flapL = b.flapR = 0; b.ampL = b.ampR = .6;
  E.flap(.4, 0); E.hopped?.();
}

function avoid(b, dt) {
  if (b.s < 4) return;
  const f = fwd(b), look = Math.min(14, b.s * .8);
  let push = 0;
  for (const t of treesNear(b.p[0], b.p[2], look + 4)) {
    const top = t.y + t.s * TREE.trunkH[t.kind];
    if (b.p[1] > top + 1 || b.p[1] < t.y) continue;
    const dx = t.x - b.p[0], dz = t.z - b.p[2], ahead = dx * f[0] + dz * f[2];
    if (ahead < 0 || ahead > look) continue;
    const side = dx * f[2] - dz * f[0];                  // + means the trunk is to the left
    const clear = t.s * TREE.trunkR[t.kind] + 1.1;
    if (Math.abs(side) < clear) push += (side >= 0 ? 1 : -1) * (1 - ahead / look) * (clear - Math.abs(side)) / clear;
  }
  // towers, stones and cairns too, unless you are coming in slow to land on top
  for (const o of solidsNear(b.p[0], b.p[2], look + 6)) {
    if (b.p[1] > o.top + 1 || b.p[1] < o.y0 || (b.s < FLY.landS && b.p[1] > o.top - 2)) continue;
    const dx = o.x - b.p[0], dz = o.z - b.p[2], ahead = dx * f[0] + dz * f[2];
    if (ahead < 0 || ahead > look + o.r) continue;
    const side = dx * f[2] - dz * f[0], clear = o.r + 1.2;
    if (Math.abs(side) < clear) push += (side >= 0 ? 1 : -1) * (1 - ahead / (look + o.r)) * (clear - Math.abs(side)) / clear;
  }
  b.yaw += Math.max(-1, Math.min(1, push)) * 1.4 * dt;
}

function trees(b, dt, E) {
  b.canopy = Math.max(0, b.canopy - dt * 2);
  if (b.noPerch > 0) b.noPerch -= dt;
  const mayPerch = canPerch(b);
  let below = 0;
  for (const t of treesNear(b.p[0], b.p[2], 14)) {
    const dx = b.p[0] - t.x, dz = b.p[2] - t.z, hd = Math.hypot(dx, dz), y = b.p[1] - t.y;
    if (hd < 13 && y > 0 && y < t.s * .8) below++;
    // the trunk is hard
    const tr = t.s * TREE.trunkR[t.kind] + .35;
    if (hd < tr && y > 0 && y < t.s * (t.kind ? .55 : TREE.trunkH[0])) {
      b.p[0] = t.x + dx / (hd || 1) * tr; b.p[2] = t.z + dz / (hd || 1) * tr;
      if (b.t - b.lastHit > .5) { b.s *= .45; b.lastHit = b.t; b.stamina = Math.max(0, b.stamina - .08); E.bump(b.p, 'trunk'); }
    }
    // leaves are soft: they slow you; slow enough, you settle on the limb you were lined up on (never
    // one you didn't pick, and never the foliage itself)
    let inside = false;
    if (!t.kind) {
      const cy = y - t.s * TREE.crownY, R = t.s * TREE.crownR * 1.15;
      inside = hd * hd + cy * cy * 1.4 < R * R;
    } else {
      const k = (y - t.s * .18) / (t.s * .82);
      inside = k > 0 && k < 1 && hd < t.s * .26 * (1 - k) + .2;
    }
    if (inside) {
      b.s *= 1 - Math.min(.9, dt * (1.6 + b.s * .05));
      if (b.canopy < .2) E.leaves(b.p, b.s);
      b.canopy = 1;
      const mine = perchesOf(t).find(p => !p.top && aimed(p)), over = y > t.s * (t.kind ? .8 : TREE.crownY + TREE.crownR * .45);
      if (b.s < 6 && mayPerch && !over && mine) { settleOn(b, mine, t, E); return; }
    }
    // a perch close by while slow: land on it
    if (mayPerch && groundSpeed(b) < FLY.landS + FLY.floatLand * (b.float || 0) && b.vy < 3) for (const p of perchesOf(t)) if (!p.top && (!b.aimPerch || aimed(p))) {
      if (Math.hypot(p.x - b.p[0], p.y + PERCH_Y - b.p[1], p.z - b.p[2]) < FLY.perchR + b.flare * .8 + FLY.floatReach * (b.float || 0)) { settleOn(b, p, t, E); return; }
    }
  }
  // under the canopy: three or more trees round you whose crowns are above you
  b.under = (b.under || 0) + ((below >= 3 ? 1 : 0) - (b.under || 0)) * Math.min(1, dt * 2);
}
// towers, standing stones and cairns: hard sides, a perch on top; bushes (soft): brushed through, a perch on top
// not right after taking off, nor while speeding up or tucked in a dive
const canPerch = b => !(b.noPerch > 0) && !(b.acc > 1.2) && b.tuck < .4;
// lined up on a perch (aim.js sets b.aimPerch, held a moment after the line loses it), the hawk
// lands on that one only, never one it brushes past on the way
let aimB = null;
const aimed = p => !!aimB?.aimPerch && Math.abs(p.x - aimB.aimPerch.x) + Math.abs(p.y - aimB.aimPerch.y) + Math.abs(p.z - aimB.aimPerch.z) < .05;
function solids(b, E, dt) {
  const mayPerch = canPerch(b);
  for (const o of solidsNear(b.p[0], b.p[2], 10)) {
    const dx = b.p[0] - o.x, dz = b.p[2] - o.z, hd = Math.hypot(dx, dz);
    if (mayPerch && (!b.aimPerch || aimed(o.perch)) && groundSpeed(b) < FLY.landS + FLY.floatLand * (b.float || 0) && b.vy < 3 && Math.hypot(o.perch.x - b.p[0], o.perch.y + PERCH_Y - b.p[1], o.perch.z - b.p[2]) < FLY.perchR + o.r * .5 + b.flare * .8) { settleOn(b, o.perch, null, E); return; }
    const tr = o.r + .35;
    if (hd >= tr || b.p[1] < o.y0 || b.p[1] > o.top + .3) continue;
    // over the top edge: hop up onto it; otherwise the side is hard
    if (b.p[1] > o.top - .6) { b.p[1] = o.top + .3; b.vy = Math.max(b.vy, .5); continue; }
    // a bush is soft: you brush through it, slowed, with a swish of leaves (never a bump)
    if (o.soft) { b.s *= 1 - Math.min(.8, dt * (1.4 + b.s * .05)); if (b.canopy < .2) E.leaves(b.p, b.s); b.canopy = 1; continue; }
    b.p[0] = o.x + dx / (hd || 1) * tr; b.p[2] = o.z + dz / (hd || 1) * tr;
    if (b.t - b.lastHit > .5) { b.s *= .45; b.lastHit = b.t; b.stamina = Math.max(0, b.stamina - .08); E.bump(b.p, 'stone'); }
  }
}
// how high the hawk's centre sits above a perch point (the top of the limb), feet on it
const PERCH_Y = .14;
function settleOn(b, p, t, E, dur) {
  // the glide onto it takes longer the farther it has to go, so it never jumps
  const far = Math.hypot(p.x - b.p[0], p.y + PERCH_Y - b.p[1], p.z - b.p[2]);
  dur ??= Math.min(.75, Math.max(.35, .3 + far * .12));
  b.state = 'perch'; b.perch = p; b.tree = t; b.settle = b.settleT = dur; b.s = 0; b.vy = 0; b.aimPerch = null;
  b.from = [b.p[0], b.p[1], b.p[2]]; b.fromYaw = b.yaw;
  b.p = [p.x, p.y + PERCH_Y, p.z];
  // sit across a limb, facing whichever way along it is nearer the way you came in
  if (p.a !== undefined) { const d = Math.atan2(Math.sin(p.a - b.yaw), Math.cos(p.a - b.yaw)); b.yaw = Math.abs(d) < Math.PI / 2 ? p.a : p.a + Math.PI; }
  E.land('perch');
}

// perches a short hop away from where the hawk sits or stands, nearest first (limbs and stone
// tops, never treetops)
export const HOP = 14;
export function hopPerches(b, n = 3) {
  if (b.state === 'fly' || b.state === 'swim') return [];
  const out = [], add = (p, t) => {
    const d = Math.hypot(p.x - b.p[0], p.y - b.p[1], p.z - b.p[2]);
    if (p !== b.perch && d > 1.2 && d < HOP && p.y - b.p[1] < 9 && !(b.perch && Math.hypot(p.x - b.perch.x, p.y - b.perch.y, p.z - b.perch.z) < .3)) out.push({ p, t, d });
  };
  for (const t of treesNear(b.p[0], b.p[2], HOP + 4)) for (const p of perchesOf(t)) if (!p.top) add(p, t);
  for (const o of solidsNear(b.p[0], b.p[2], HOP + 4)) add(o.perch, null);
  return out.sort((a, q) => a.d - q.d).slice(0, n);
}
// a hop: a few wing beats across to another perch, in a low arc
export function hopTo(b, h, E) {
  if (b.settle > 0 || b.eating > 0) return false;
  b.yaw = Math.atan2(h.p.x - b.p[0], -(h.p.z - b.p[2]));
  b.flapL = b.flapR = 0; b.ampL = b.ampR = 1; b.hop = Math.min(2.2, .4 + h.d * .12);
  settleOn(b, h.p, h.t, E, .35 + h.d * .045);
  E.flap(.6, 0);
  return true;
}

// from a perch, down to a tapped spot on the ground (aim.js): a glide like a hop between perches
export function hopDown(b, to, E) {
  if (b.settle > 0 || b.eating > 0 || b.state !== 'perch') return false;
  const d = Math.hypot(to[0] - b.p[0], to[1] + .35 - b.p[1], to[2] - b.p[2]), dur = Math.min(1.4, .45 + d * .05);
  b.from = [...b.p]; b.fromYaw = b.yaw;
  b.view = b.yaw = Math.atan2(to[0] - b.p[0], -(to[2] - b.p[2]));
  b.state = 'ground'; b.perch = null; b.tree = null; b.settle = b.settleT = dur; b.s = 0; b.vy = 0; b.goTo = null;
  b.p = [to[0], to[1] + .35, to[2]];
  b.flapL = b.flapR = 0; b.ampL = b.ampR = 1; b.hop = Math.min(2.2, .4 + d * .1);
  E.flap(.6, 0); E.land('ground');
  return true;
}

// the closest perch within reach, for the landing mark
export function perchAhead(b) {
  if (b.state !== 'fly' || b.s > 14) return null;
  const f = fwd(b); let best = null, bd = 1e9;
  for (const t of treesNear(b.p[0], b.p[2], 30)) for (const p of perchesOf(t)) if (!p.top) {
    const dx = p.x - b.p[0], dy = p.y - b.p[1], dz = p.z - b.p[2], d = Math.hypot(dx, dy, dz);
    if (d > 28 || d < 1 || (dx * f[0] + dy * f[1] + dz * f[2]) / d < .75) continue;
    if (d < bd) { bd = d; best = p; }
  }
  for (const o of solidsNear(b.p[0], b.p[2], 30)) {
    const p = o.perch, dx = p.x - b.p[0], dy = p.y - b.p[1], dz = p.z - b.p[2], d = Math.hypot(dx, dy, dz);
    if (d > 28 || d < 1 || (dx * f[0] + dy * f[1] + dz * f[2]) / d < .75) continue;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function ground(b, E) {
  const gy = height(b.p[0], b.p[2]), floor = Math.max(gy, WATER) + .35;
  if (b.p[1] >= floor) return;
  const f = fwd(b), down = -(f[1] * b.s + b.vy + b.lift);
  if (gy < WATER) {
    if (b.s < 9 && down > 0 && down < 6 && !(b.noPerch > 1.2)) { b.state = 'swim'; b.p[1] = WATER + .12; b.settle = .5; E.land('water'); }
    else { b.p[1] = floor; b.gamma = Math.max(b.gamma, .12); b.s *= .82; b.vy = Math.max(b.vy, 1); E.splash(b.p, b.s); }
    return;
  }
  b.p[1] = floor;
  const gs = groundSpeed(b);
  if (gs < FLY.landS && down < 6) {
    // with the wind behind, the hawk comes in fast and runs on a few steps; into it, it just stops
    const run = Math.max(0, gs - FLY.runS) * FLY.runOn, v = [f[0] * b.s + (b.wind?.[0] || 0), f[2] * b.s + (b.wind?.[1] || 0)], vl = Math.hypot(v[0], v[1]) || 1;
    b.state = 'ground'; b.settle = b.settleT = .3 + run * .08; b.from = null; b.landRun = run;
    if (run > .6) {
      const to = [b.p[0] + v[0] / vl * run, b.p[2] + v[1] / vl * run], ty = height(to[0], to[1]);
      if (ty > WATER && Math.abs(ty - gy) < 1.5) { b.from = [...b.p]; b.p = [to[0], ty + .35, to[1]]; b.hop = .08; b.fromYaw = b.yaw; b.view = b.yaw = Math.atan2(v[0], -v[1]); }
    }
    E.land('ground'); return;
  }
  if (b.t - b.lastHit > .4) { b.lastHit = b.t; b.stamina = Math.max(0, b.stamina - .1); E.bump(b.p, 'ground'); }
  b.gamma = Math.max(b.gamma, .25); b.s *= .6; b.vy = Math.max(b.vy, 1.5);
}
