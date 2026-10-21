// The air's feel: what flying low, through woods and in company does, seen and felt.
// - Ground effect (flight.js sets b.skim): ripples behind you over water, grass bits over a field.
//   G.skim = { x, z, k } while skimming, for the grass to bend (flora.js).
// - Gusts you can see coming: a front rolls downwind across the land toward you, wind lines in the
//   air along it, the trees tossing as it passes. Meet it nose-up and it lifts you; side-on it
//   rocks you; from behind it pushes. G.gust = { x, z, dx, dz, w, k } while one travels (grass waves).
// - Under the canopy (flight.js sets b.under): leaves drift past, small birds flush ahead.
// - Slipstream: fly up behind the wild companion hawk and it leads; tuck in just behind and
//   beside its wingtip and your wings rest. G.slipLead = { p, ang } steers it (fauna.js).
import { height, WATER, WIND } from '../world.js';
import { fwd } from '../flight.js';
import { clamp, smooth } from '../util.js';

export const FEEL = {
  gustEvery: [25, 60], gustSpeed: 9, gustWidth: 150, gustFar: 170, gustLift: 9,
  slipBehind: [-9, -2.5], slipSide: [.6, 4.5], slipRest: .12, leadTime: 45,
};
const WL = Math.hypot(WIND[0], WIND[2]), WX = WIND[0] / WL, WZ = WIND[2] / WL;

// a short wind line: a thin ribbon along the wind, facing the camera, tapered at both ends
function streak(S, x, y, z, len, w, a) {
  const R = S.ribbon ||= [], c = S.cam, n = 5;
  const tx = c[0] - x, ty = c[1] - y, tz = c[2] - z;
  let sx = WZ * ty, sy = WX * tz - WZ * tx, sz = -WX * ty;   // across the line, facing the camera
  const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, along = (t - .5) * len, ww = w * Math.sin(t * Math.PI), aa = a * Math.sin(t * Math.PI);
    const px = x + WX * along, py = y + Math.sin(t * 3 + x) * .3, pz = z + WZ * along;
    const L = [px - sx * ww, py - sy * ww, pz - sz * ww, .96, .97, .95, aa], Rr = [px + sx * ww, py + sy * ww, pz + sz * ww, .96, .97, .95, aa];
    if (prev) R.push(...prev[0], ...prev[1], ...Rr, ...prev[0], ...Rr, ...L);
    prev = [L, Rr];
  }
}

export function feelSystem(G) {
  const b = G.b, H = G.hud;
  const ripples = [];
  let wakeT = 0, gust = null, gustT = 20, leafT = 0, flushT = 3, lead = null, slipSaid = false;
  G.gust = null; G.skim = null; G.slipLead = null; G.gustWind = 0;
  H.tip('skim', () => b.state === 'fly' && b.skim > .5, 'Skimming low over water or a flat field, the air cushions your wings and carries you farther.');
  H.tip('gust', () => !!gust && Math.abs(gustAlong()) < 60, 'A gust is coming: see the wind lines and the grass? Meet it nose up for a free lift.');
  H.tip('canopy', () => b.state === 'fly' && b.under > .7, 'Under the trees now: thread the trunks. Clip a crown and you lose speed.');
  H.tip('slip', () => !!lead, 'The wild hawk leads. Tuck in just behind and beside its wingtip: its wake rests your wings.');

  const gustAlong = () => gust ? (b.p[0] - gust.x) * WX + (b.p[2] - gust.z) * WZ : 1e9;

  function newGust() {
    const lat = (Math.random() - .5) * 40;
    gust = { x: b.p[0] - WX * FEEL.gustFar - WZ * lat, z: b.p[2] - WZ * FEEL.gustFar + WX * lat, dx: WX, dz: WZ, w: FEEL.gustWidth, k: .55 + Math.random() * .45, hit: false };
  }

  return {
    id: 'feel',
    gust: () => newGust(),   // debug: __aloft3d.G.systems.feel.gust(), then .near(m) to bring its front m metres upwind
    near(m) { if (gust) { const a = gustAlong() - m; gust.x += WX * a; gust.z += WZ * a; } },
    update(dt) {
      const flying = b.state === 'fly', f = fwd(b);
      // ground effect wake
      G.skim = flying && b.skim > .15 ? { x: b.p[0], z: b.p[2], k: b.skim } : null;
      if (G.skim && (wakeT -= dt) < 0) {
        wakeT = .12;
        if (b.skimWet) ripples.push({ x: b.p[0], z: b.p[2], t: 0 });
        else for (let i = 0; i < 2; i++) G.part([b.p[0] - f[0] * .6, height(b.p[0], b.p[2]) + .1, b.p[2] - f[2] * .6], [(Math.random() - .5) * 1.5, .8 + Math.random(), (Math.random() - .5) * 1.5], .6, [.5, .62, .3], .045);
      }
      for (const r of ripples) r.t += dt;
      while (ripples.length && ripples[0].t > 1.4) ripples.shift();

      // gusts
      if (!gust && flying && (gustT -= dt) < 0) {
        gustT = FEEL.gustEvery[0] + Math.random() * (FEEL.gustEvery[1] - FEEL.gustEvery[0]);
        if (b.p[1] - height(b.p[0], b.p[2]) < 250 && !(G.storm > .5)) newGust();
      }
      G.gustWind = 0;
      if (gust) {
        gust.x += WX * FEEL.gustSpeed * dt; gust.z += WZ * FEEL.gustSpeed * dt;
        const along = gustAlong(), lat = -(b.p[0] - gust.x) * WZ + (b.p[2] - gust.z) * WX;
        G.gust = { x: gust.x, z: gust.z, dx: WX, dz: WZ, w: gust.w, k: gust.k };
        // trees toss as the front comes by (the wind sway is global, so only while it is close)
        G.gustWind = gust.k * .7 * (1 - smooth(10, 70, Math.abs(along)));
        if (flying && Math.abs(along) < 7 && Math.abs(lat) < gust.w / 2) {
          const head = -(f[0] * WX + f[2] * WZ), side = f[0] * WZ - f[2] * WX, k = gust.k;
          if (head > .3 && b.gamma > -.15) { b.vy += FEEL.gustLift * k * head * dt; b.s += 1.2 * k * dt; }
          else if (head < -.3) b.s += 2 * k * dt;
          b.roll += side * 1.3 * k * (1 - Math.abs(head)) * dt;
          if (!gust.hit) { gust.hit = true; G.emit('gust', k, head); if (head > .3 && b.gamma > -.15) H.did('gust'); }
        }
        if (along < -120) { gust = null; G.gust = null; }
      }

      // under the canopy: leaves drift by, small birds flush ahead
      if (flying && b.under > .5) {
        if ((leafT -= dt) < 0) {
          leafT = .1;
          const a = Math.random() * 6.28, r = 2 + Math.random() * 5;
          const col = G.season?.autumn ? [.75, .45, .18] : [.36, .52, .24];
          G.part([b.p[0] + f[0] * 6 + Math.cos(a) * r, b.p[1] + 1 + Math.random() * 3, b.p[2] + f[2] * 6 + Math.sin(a) * r], [(Math.random() - .5) * .6, -.2, (Math.random() - .5) * .6], 2.5, col, .05);
        }
        if (b.s > 6 && (flushT -= dt) < 0) {
          flushT = 2 + Math.random() * 3;
          const q = [b.p[0] + f[0] * 9, b.p[1] - .5 + Math.random() * 2, b.p[2] + f[2] * 9];
          for (let i = 0; i < 4; i++) G.part([q[0] + (Math.random() - .5) * 2, q[1], q[2] + (Math.random() - .5) * 2], [f[0] * 3 + (Math.random() - .5) * 4, 2.5 + Math.random() * 1.5, f[2] * 3 + (Math.random() - .5) * 4], 1.6, [.32, .26, .2], .09);
          G.audio?.rustle?.(.25);
          G.emit('flush', q);
        }
      }

      // slipstream: the companion leads while you follow
      const C = G.companion;
      if (!lead && flying && C?.here && !C.busy) {
        const dx = C.x - b.p[0], dy = C.y - b.p[1], dz = C.z - b.p[2], d = Math.hypot(dx, dy, dz);
        if (d < 30 && d > 4 && (dx * f[0] + dy * f[1] + dz * f[2]) / d > .6) {
          lead = { p: [C.x, C.y, C.z], yaw: b.yaw, v: Math.max(10, b.s), t: FEEL.leadTime, slip: 0 };
          slipSaid = false;
        }
      }
      b.slip = 0;
      if (lead) {
        lead.t -= dt;
        lead.yaw += Math.sin(G.t * .21) * .12 * dt;
        lead.v += (clamp(b.s, 9, 16) - lead.v) * Math.min(1, dt * .3);
        const lf = [Math.sin(lead.yaw), -Math.cos(lead.yaw)], p = lead.p;
        p[0] += lf[0] * lead.v * dt; p[2] += lf[1] * lead.v * dt;
        p[1] += (Math.max(b.p[1], height(p[0], p[2]) + 12) - p[1]) * Math.min(1, dt * .4);
        const rx = b.p[0] - p[0], rz = b.p[2] - p[2], along = rx * lf[0] + rz * lf[1], side = Math.abs(rx * -lf[1] + rz * lf[0]), dy = b.p[1] - p[1];
        const inWake = along > FEEL.slipBehind[0] && along < FEEL.slipBehind[1] && side > FEEL.slipSide[0] && side < FEEL.slipSide[1] && Math.abs(dy) < 3;
        lead.slip += ((inWake ? 1 : 0) - lead.slip) * Math.min(1, dt * 3);
        b.slip = lead.slip;
        if (b.slip > .5) {
          b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + FEEL.slipRest * dt);
          if (!slipSaid) { slipSaid = true; H.toast('In the wild hawk\'s wake: your wings rest.', 2.5); H.did('slip'); }
        }
        G.slipLead = { p: [...p], ang: Math.atan2(lf[1], lf[0]) };
        if (lead.t <= 0 || !flying || !C?.here || C.busy || Math.hypot(rx, dy, rz) > 45) { lead = null; G.slipLead = null; b.slip = 0; }
      }
    },
    scene(S) {
      for (const r of ripples) {
        const k = r.t / 1.4, rr = .4 + r.t * 2.6;
        ring(S, r.x, WATER + .04, r.z, rr, .1 + k * .08, (1 - k) * .6);
      }
      if (gust) {
        // wind lines along the front, near you
        const lat0 = -(b.p[0] - gust.x) * WZ + (b.p[2] - gust.z) * WX;
        for (let i = 0; i < 16; i++) {
          const h = Math.sin(i * 12.9898) * 43758.5, u = h - Math.floor(h), lat = lat0 + (u - .5) * 120;
          if (Math.abs(lat) > gust.w / 2) continue;
          const x = gust.x - WZ * lat + WX * (Math.sin(i * 7.3) * 4), z = gust.z + WX * lat + WZ * (Math.sin(i * 7.3) * 4);
          const gy = Math.max(height(x, z), WATER), y = gy + 2 + ((i * .37) % 1) * Math.max(6, Math.min(30, b.p[1] - gy + 10));
          const d = Math.hypot(x - S.cam[0], y - S.cam[1], z - S.cam[2]);
          if (d > 130) continue;
          streak(S, x, y, z, 12 + (i % 3) * 5, .09 + d * .004, .6 * gust.k * (1 - d / 130) * (1 - Math.abs(lat) / (gust.w / 2)));
        }
      }
    },
  };
}

// a flat ring on the water (a ripple), into the ribbon
function ring(S, x, y, z, r, w, a, N = 22) {
  const R = S.ribbon ||= [], col = [.9, .95, 1];
  const at = (rr, i) => { const t = i / N * 6.283; return [x + Math.cos(t) * rr, y, z + Math.sin(t) * rr, ...col, a]; };
  for (let i = 0; i < N; i++) {
    const o0 = at(r + w / 2, i), o1 = at(r + w / 2, i + 1), i0 = at(r - w / 2, i), i1 = at(r - w / 2, i + 1);
    R.push(...o0, ...o1, ...i1, ...o0, ...i1, ...i0);
  }
}
