// The hawk's flight in 3D: an energy model. Airspeed is traded for height (climb slows you,
// diving speeds you up), drag depends on the wing shape (tucked, gliding, flared), banking
// turns, and below stall speed the nose drops. Rising air (thermals, ridges) lifts the whole
// air mass, so it never changes airspeed. With no input the hawk trims to its best glide.
import { height, WATER, treesNear, TREE, perchesOf, airLift, thermalsNear, thermalCentre, solidsNear } from './world.js';

const g = 9.8;
export const FLY = {
  best: 12, maxS: 46, cd: .0058, cdTuck: .0024, cdFlare: .03, stall: 7.5, stallFlare: 3.6,
  climb: .55, dive: .9, roll: 1.0, flapS: 3.0, flapUp: 1.3, flapHover: 3.2, flapCost: .065,
  perchR: 1.6, landS: 10.5,
};

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
  b.tuck += (Math.max(0, -c.spread) - b.tuck) * Math.min(1, dt * 6);
  b.flare += (Math.max(0, c.spread) - b.flare) * Math.min(1, dt * 6);
  if (b.state !== 'fly') return still(b, c, dt, E);

  // flaps
  if (c.flap) {
    const weak = b.stamina < .08 ? .3 : 1, q = c.flap.q * weak;
    b.stamina = Math.max(0, b.stamina - FLY.flapCost * (c.flap.side ? .6 : 1));
    const stall = stallness(b);
    b.s = Math.min(FLY.maxS, b.s + FLY.flapS * q * (.35 + .65 * (1 - b.flare)));
    b.vy += (FLY.flapUp + FLY.flapHover * b.flare + 1.6 * stall) * q;
    if (c.flap.side) b.yaw += -c.flap.side * .12;      // one wing leading pushes you round
    // a bird never beats one wing alone: the other follows, more lightly
    b.flapL = b.flapR = 0;
    b.ampL = c.flap.side > 0 ? .35 : 1; b.ampR = c.flap.side < 0 ? .35 : 1;
    E.flap(q, c.flap.side);
    if (weak < 1) E.tired();
  }

  const sStall = FLY.stall + (FLY.stallFlare - FLY.stall) * b.flare + 2 * b.tuck;
  const cd = FLY.cd + (FLY.cdTuck - FLY.cd) * b.tuck + FLY.cdFlare * b.flare + .004 * Math.sin(b.roll) ** 2;
  const trim = Math.asin(Math.max(-1, -FLY.cd * FLY.best * FLY.best / g));
  let gT = trim + (b.s - FLY.best) * .022 + (c.pitch > 0 ? c.pitch * FLY.climb : c.pitch * FLY.dive) - b.tuck * .55 + b.flare * .12;
  if (b.s < sStall) gT = Math.min(gT, -(sStall - b.s) * .13);
  gT = Math.max(-1.35, Math.min(.8, gT));
  b.gamma += (gT - b.gamma) * Math.min(1, dt * (1.1 + b.s * .1));
  b.s += (-g * Math.sin(b.gamma) - cd * b.s * b.s) * dt;
  b.s = Math.max(0, Math.min(FLY.maxS, b.s));

  // bank and turn; inside a thermal a held thumb with no bank asked for circles the core
  let rT = c.roll * FLY.roll;
  b.inThermal = null; b.ride = false;
  b.lift = airLift(b.p[0], b.p[1], b.p[2], E.sun);
  if (b.lift > .8) {
    for (const t of thermalsNear(b.p[0], b.p[2], 80)) {
      const [tx, tz] = thermalCentre(t, b.p[1]), d = Math.hypot(b.p[0] - tx, b.p[2] - tz);
      if (d < t.r * 1.3) { b.inThermal = { t, tx, tz, d }; break; }
    }
  }
  if (b.inThermal && c.held && Math.abs(c.roll) < .2 && c.pitch > -.4) {
    const { t, tx, tz, d } = b.inThermal;
    const f = fwd(b), toC = [(tx - b.p[0]) / (d || 1), (tz - b.p[2]) / (d || 1)];
    const side = Math.sign(f[0] * toC[1] - f[2] * toC[0]) || 1;     // which side the core lies on
    const want = t.r * .4, ideal = Math.atan(b.s * b.s / (g * want));
    rT = side * Math.min(.85, ideal + (d - want) * .02);
    b.ride = true;
  }
  b.roll += (rT - b.roll) * Math.min(1, dt * 3.2);
  const yawRate = Math.max(-1.9, Math.min(1.9, g * Math.tan(b.roll) / Math.max(b.s, 5) * (1 + b.flare * .3)));
  b.yaw += yawRate * dt;

  // stall sink and flap lift live in vy, which settles back to zero
  const st = stallness(b, sStall);
  b.vy += (-g * st * .85 - b.vy * 1.6) * dt;

  // steer softly round trunks a moment ahead, so threading a wood is about lines, not luck
  avoid(b, dt);

  const f = fwd(b);
  b.prev = [b.p[0], b.p[1], b.p[2]];
  b.p[0] += f[0] * b.s * dt; b.p[2] += f[2] * b.s * dt;
  b.p[1] += (f[1] * b.s + b.vy + b.lift) * dt;
  b.p[1] = Math.min(b.p[1], 700);
  b.stamina = Math.min(1, b.stamina + dt * (b.lift > .5 ? .06 : .035) * (b.recover ?? 1));

  trees(b, dt, E);
  if (b.state === 'fly') solids(b, E);
  if (b.state === 'fly') ground(b, E);
}

const stallness = (b, sStall = FLY.stall) => Math.max(0, Math.min(1, (sStall - b.s) / sStall));

function still(b, c, dt, E) {
  b.s = 0; b.vy = 0; b.gamma = 0; b.roll *= .8; b.lift = 0;
  b.settle = Math.max(0, b.settle - dt);
  b.stamina = Math.min(1, b.stamina + dt * .2 * (b.recover ?? 1));
  // turn on the spot to choose a way out; on the ground a push forward walks
  b.yaw += c.roll * dt * 1.6;
  if (b.state === 'ground' && Math.abs(c.pitch) > .3) {
    const sp = c.pitch * 1.4 * dt; b.p[0] += Math.sin(b.yaw) * sp; b.p[2] -= Math.cos(b.yaw) * sp;
    b.p[1] = Math.max(height(b.p[0], b.p[2]), WATER) + .35;
  }
  if (b.state === 'swim') b.p[1] = WATER + .12 + Math.sin(b.t * 2) * .03;
  if (c.flap && b.settle <= 0) {
    // take off: a strong stroke forward and up
    const wet = b.state === 'swim';
    b.state = 'fly'; b.perch = null; b.tree = null;
    b.s = 6.5; b.gamma = .3; b.vy = wet ? 3 : 4; b.flapL = b.flapR = 0; b.ampL = b.ampR = 1;
    b.stamina = Math.max(0, b.stamina - FLY.flapCost);
    E.flap(1, 0); E.takeoff();
  }
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
  for (const t of treesNear(b.p[0], b.p[2], 14)) {
    const dx = b.p[0] - t.x, dz = b.p[2] - t.z, hd = Math.hypot(dx, dz), y = b.p[1] - t.y;
    // the trunk is hard
    const tr = t.s * TREE.trunkR[t.kind] + .35;
    if (hd < tr && y > 0 && y < t.s * (t.kind ? .55 : TREE.trunkH[0])) {
      b.p[0] = t.x + dx / (hd || 1) * tr; b.p[2] = t.z + dz / (hd || 1) * tr;
      if (b.t - b.lastHit > .5) { b.s *= .45; b.lastHit = b.t; b.stamina = Math.max(0, b.stamina - .08); E.bump(b.p, 'trunk'); }
    }
    // leaves are soft: they slow you, and slow enough you settle on the nearest perch
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
      if (b.s < 6) { settleOn(b, nearestPerch(perchesOf(t), b.p), t, E); return; }
    }
    // a perch close by while slow: land on it
    if (b.s < FLY.landS && b.vy < 3) for (const p of perchesOf(t)) {
      if (Math.hypot(p.x - b.p[0], p.y + .25 - b.p[1], p.z - b.p[2]) < FLY.perchR + b.flare * .8) { settleOn(b, p, t, E); return; }
    }
  }
}
// towers, standing stones and cairns: hard sides, a perch on top
function solids(b, E) {
  for (const o of solidsNear(b.p[0], b.p[2], 10)) {
    const dx = b.p[0] - o.x, dz = b.p[2] - o.z, hd = Math.hypot(dx, dz);
    if (b.s < FLY.landS && b.vy < 3 && Math.hypot(o.perch.x - b.p[0], o.perch.y + .25 - b.p[1], o.perch.z - b.p[2]) < FLY.perchR + o.r * .5 + b.flare * .8) { settleOn(b, o.perch, null, E); return; }
    const tr = o.r + .35;
    if (hd >= tr || b.p[1] < o.y0 || b.p[1] > o.top + .3) continue;
    // over the top edge: hop up onto it; otherwise the side is hard
    if (b.p[1] > o.top - .6) { b.p[1] = o.top + .3; b.vy = Math.max(b.vy, .5); continue; }
    b.p[0] = o.x + dx / (hd || 1) * tr; b.p[2] = o.z + dz / (hd || 1) * tr;
    if (b.t - b.lastHit > .5) { b.s *= .45; b.lastHit = b.t; b.stamina = Math.max(0, b.stamina - .08); E.bump(b.p, 'stone'); }
  }
}
const nearestPerch = (ps, q) => ps.reduce((a, p) => (Math.hypot(p.x - q[0], p.y - q[1], p.z - q[2]) < Math.hypot(a.x - q[0], a.y - q[1], a.z - q[2]) ? p : a));
function settleOn(b, p, t, E) {
  b.state = 'perch'; b.perch = p; b.tree = t; b.settle = .45; b.s = 0; b.vy = 0;
  b.from = [b.p[0], b.p[1], b.p[2]];
  b.p = [p.x, p.y + .25, p.z];
  E.land('perch');
}

// the closest perch within reach, for the landing mark
export function perchAhead(b) {
  if (b.state !== 'fly' || b.s > 14) return null;
  const f = fwd(b); let best = null, bd = 1e9;
  for (const t of treesNear(b.p[0], b.p[2], 30)) for (const p of perchesOf(t)) {
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
    if (b.s < 9 && down < 6) { b.state = 'swim'; b.p[1] = WATER + .12; b.settle = .5; E.land('water'); }
    else { b.p[1] = floor; b.gamma = Math.max(b.gamma, .12); b.s *= .82; b.vy = Math.max(b.vy, 1); E.splash(b.p, b.s); }
    return;
  }
  b.p[1] = floor;
  if (b.s < FLY.landS && down < 6) { b.state = 'ground'; b.settle = .4; E.land('ground'); return; }
  if (b.t - b.lastHit > .4) { b.lastHit = b.t; b.stamina = Math.max(0, b.stamina - .1); E.bump(b.p, 'ground'); }
  b.gamma = Math.max(b.gamma, .25); b.s *= .6; b.vy = Math.max(b.vy, 1.5);
}
