// The wonders people built, standing empty now (wonders.js says where): low-poly, weathered,
// nothing lit. Each builder returns tris in local metres, +y up, the site's ground at y = 0;
// the long ones (the Great Wall, the Golden Gate) are built along their own path.
import { builder, blob, prism, tube, reseed, rnd } from '../shapes.js';
import { box } from './ruinshapes.js';

const DARK = [.11, .11, .12], IVY = [.3, .44, .26], IVY2 = [.36, .5, .28], MOSS = [.44, .5, .33];
const pick = a => a[Math.floor(rnd() * a.length)];
// a builder whose points pass through f first (a lean, a turn)
const bent = f => { const B0 = builder(); return { tri: (p, q, r, c, j) => B0.tri(f(p), f(q), f(r), c, j), out: B0.out }; };
const ivyAt = (B, x, y, z, h, n = 4) => { for (let i = 0; i < n; i++) blob(B, x + (rnd() - .5) * 2, y + rnd() * h, z + (rnd() - .5) * 2, .6 + rnd() * .7, IVY, IVY2, [1, 1.2, .6]); };

// ---- the Eiffel Tower: four rusted lattice legs joining above the second floor, 110 m ----------
export function eiffel() {
  reseed(801); const B = builder(), H = 110, I = [.42, .3, .24], I2 = [.36, .26, .21];
  const w = y => 22 * Math.pow(1 - y / H, 2.1) + .9;              // the outer corner, half width
  const leg = y => y < 42 ? 4.2 + 5 * (1 - y / 42) : 0;             // each leg's own width (they join at 42 m)
  const ys = [0, 6, 12, 18, 21, 27, 33, 39, 42, 50, 58, 66, 74, 82, 90, 97, 101];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i + 1 < ys.length; i++) {
      const a = ys[i], b = ys[i + 1], wa = w(a), wb = w(b), la = leg(a), lb = leg(b);
      // the corner edges: the outer one always; the inner three of each leg below the join
      const edges = [[wa, wa, wb, wb]];
      if (b <= 42) edges.push([wa - la, wa, wb - lb, wb], [wa, wa - la, wb, wb - lb], [wa - la, wa - la, wb - lb, wb - lb]);
      for (const [xa, za, xb, zb] of edges) tube(B, [sx * xa, a, sz * za], [sx * xb, b, sz * zb], .32, I);
      // the braces, a cross on each outer face
      const ia = b <= 42 ? wa - la : 0, ib = b <= 42 ? wb - lb : 0;
      tube(B, [sx * wa, a, sz * wa], [sx * ib, b, sz * wb], .14, I2); tube(B, [sx * ia, a, sz * wa], [sx * wb, b, sz * wb], .14, I2);
      tube(B, [sx * wa, a, sz * wa], [sx * wb, b, sz * ib], .14, I2); tube(B, [sx * wa, a, sz * ia], [sx * wb, b, sz * wb], .14, I2);
    }
  }
  // the great arches between the legs under the first floor
  for (let k = 0; k < 4; k++) {
    const r = (u, v) => k === 0 ? [u, v, -w(v) + .5] : k === 1 ? [u, v, w(v) - .5] : k === 2 ? [-w(v) + .5, v, u] : [w(v) - .5, v, u];
    let prev = null;
    for (let i = 0; i <= 10; i++) { const u = -14 + i * 2.8, v = 21 - 9 * (u / 14) ** 2, p = r(u, v); if (prev) tube(B, prev, p, .4, I); prev = p; }
  }
  // the floors and the top
  box(B, 0, 20, 0, 2 * w(21) + 1, 1.6, 2 * w(21) + 1, 0, I2, [.36, .32, .29]);
  box(B, 0, 41.5, 0, 2 * w(42) + 1, 1.3, 2 * w(42) + 1, 0, I2, [.36, .32, .29]);
  box(B, 0, 99, 0, 5, 2.8, 5, 0, I2, [.3, .27, .25]);
  tube(B, [0, 101.8, 0], [0, H + 6, 0], .22, I);
  ivyAt(B, -w(0) + 2, 0, -w(0) + 2, 6, 5); ivyAt(B, w(0) - 2, 0, w(0) - 2, 5, 4);
  return B.out();
}
// [u, w, r, y0, top, perch?] solids in local coordinates (wonders.js turns and places them)

// ---- the Statue of Liberty: green copper on her pedestal, the torch long out --------------------
export function liberty() {
  reseed(811); const B = builder(), CU = [.4, .6, .52], CU2 = [.34, .53, .46], ST = [.62, .58, .5], ST2 = [.56, .52, .46];
  prism(B, 0, 0, 30, 30, -2, 4, 22, ST2, .62);                  // the star fort
  prism(B, 0, 0, 12, 10.5, 4, 14, 4, ST);                       // the pedestal
  prism(B, 0, 0, 9.5, 8.5, 14, 30, 4, ST2);
  box(B, 0, 30, 0, 12.5, 1.2, 12.5, Math.PI / 4, ST);
  for (const a of [0, 1, 2, 3]) box(B, Math.cos(a * Math.PI / 2 + Math.PI / 4) * 6.5, 21, Math.sin(a * Math.PI / 2 + Math.PI / 4) * 6.5, .1, 4, 2.4, a * Math.PI / 2 + Math.PI / 4 + Math.PI / 2, DARK);
  const y0 = 31.2;
  prism(B, 0, 0, 4.2, 2.9, y0, y0 + 16, 9, CU, .9);             // the robe
  prism(B, 0, 0, 2.9, 2.3, y0 + 16, y0 + 22, 9, CU2);
  blob(B, 0, y0 + 24.6, 0, 2.2, CU, CU2, [.9, 1.1, .95], 2);    // the head
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4; tube(B, [Math.sin(a) * 1.8, y0 + 25.8, -Math.cos(a) * 1.8], [Math.sin(a) * 4.4, y0 + 27 + Math.cos(a) * .6, -Math.cos(a) * 4.4], .16, CU2); }
  tube(B, [2.2, y0 + 21, 0], [3.4, y0 + 33, -.4], .75, CU);     // the raised arm and the torch
  prism(B, 3.45, -.4, .7, 1.3, y0 + 33, y0 + 34.6, 8, CU2);
  prism(B, 3.45, -.4, 1.1, 0, y0 + 34.6, y0 + 37.4, 6, [.55, .5, .3]);
  tube(B, [-2.4, y0 + 20, 0], [-2.8, y0 + 14, -1.4], .65, CU);  // the tablet
  box(B, -3, y0 + 12, -2, 1, 6.2, 3.6, .3, CU2);
  return B.out();
}

// ---- the pyramids of Giza, the Sphinx before them ------------------------------------------------
export function giza() {
  reseed(821); const B = builder(), S = [.8, .7, .52], S2 = [.74, .64, .47];
  const pyr = (x, z, h) => {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, b = a + Math.PI / 2, r = h * 1.1;
      B.tri([x + Math.cos(a) * r, 0, z + Math.sin(a) * r], [x, h, z], [x + Math.cos(b) * r, 0, z + Math.sin(b) * r], i & 1 ? S : S2, (rnd() - .5) * .05);
    }
  };
  pyr(0, 0, 70); pyr(-95, 75, 66); pyr(-165, 150, 32);
  for (const [x, z] of [[-200, 165], [-212, 140], [-188, 190]]) pyr(x, z, 10);
  // the Sphinx: a lion's body, a head, worn soft
  const sx = 70, sz = 60;
  box(B, sx, 0, sz, 30, 9, 8, -.8, S2, S); box(B, sx - Math.cos(-.8) * 13, 0, sz - Math.sin(-.8) * 13, 7, 14, 7, -.8, S, S2);
  for (const k of [-2.6, 2.6]) box(B, sx - Math.cos(-.8) * 20 - Math.sin(-.8) * k, 0, sz - Math.sin(-.8) * 20 + Math.cos(-.8) * k, 10, 2.6, 2.4, -.8, S2);
  return B.out();
}

// ---- the Colosseum: three tiers of arches, the south side fallen to two -------------------------
export function colosseum() {
  reseed(831); const B = builder(), T = [[.78, .7, .58], [.72, .64, .52], [.82, .74, .62]], N = 48, A = 52, Bz = 43;
  for (let i = 0; i < N; i++) {
    const t0 = i / N * 6.283, t1 = (i + 1) / N * 6.283, tm = (t0 + t1) / 2;
    const P = (t, s) => [Math.cos(t) * A * s, Math.sin(t) * Bz * s];
    const broken = Math.sin(tm) > .35, tiers = broken ? 2 + (rnd() < .3 ? 1 : 0) : 4;
    for (const s of [1, .84]) {
      const [x0, z0] = P(t0, s), [x1, z1] = P(t1, s), x = (x0 + x1) / 2, z = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0) + .3, a = Math.atan2(z1 - z0, x1 - x0);
      const n = s === 1 ? tiers : Math.min(tiers, 3);
      for (let k = 0; k < n; k++) {
        const y = k * 10, h = k === 3 ? 7 : 10 - (broken && k === n - 1 ? rnd() * 4 : 0);
        box(B, x, y, z, L, h, 2.2, a, pick(T), rnd() < .2 ? MOSS : pick(T));
        if (k < 3 && s === 1) box(B, x + Math.sin(a) * 1.15, y + 1.2, z - Math.cos(a) * 1.15, L * .55, 6.4, .1, a, [.24, .2, .18]);
      }
    }
    // the stepped seating between, mostly gone
    const [xi, zi] = P(tm, .62), [xo, zo] = P(tm, .82);
    if (rnd() < .7) box(B, (xi + xo) / 2, 0, (zi + zo) / 2, 7, 6 + rnd() * 6, Math.hypot(xo - xi, zo - zi), tm + Math.PI / 2, pick(T));
  }
  box(B, 0, -.5, 0, 2 * A * .55, .9, 2 * Bz * .55, 0, [.62, .56, .44]);   // the arena floor, open to the vaults
  for (let i = 0; i < 9; i++) box(B, (rnd() - .5) * 50, .2, (rnd() - .5) * 40, 1.4, 3, 9, rnd() * 3, DARK);
  return B.out();
}

// ---- the Taj Mahal: white marble going grey, its dome, four minarets ----------------------------
export function taj() {
  reseed(841); const B = builder(), M = [.9, .88, .84], M2 = [.84, .82, .78], RS = [.62, .38, .3];
  box(B, 0, -1, 0, 66, 7, 66, 0, M2, M);
  box(B, 0, 6, 0, 32, 20, 32, 0, M, M2);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; box(B, Math.cos(a) * 16.05, 8, Math.sin(a) * 16.05, .2, 15, 10, a, DARK); box(B, Math.cos(a) * 16.2, 6, Math.sin(a) * 16.2, .4, 20, 14, a, M2); }
  prism(B, 0, 0, 9, 9, 26, 31, 12, M);
  blob(B, 0, 37, 0, 10.5, M, M2, [1, 1.05, 1], 2);
  prism(B, 0, 0, 2.6, 0, 45.5, 51, 8, M2);
  tube(B, [0, 50, 0], [0, 54, 0], .2, [.6, .55, .4]);
  for (const [x, z] of [[-11, -11], [11, -11], [11, 11], [-11, 11]]) { prism(B, x, z, 2.6, 2.6, 26, 29, 8, M2); blob(B, x, 31, z, 2.8, M, M2, [1, 1, 1]); }
  for (const [x, z] of [[-30, -30], [30, -30], [30, 30], [-30, 30]]) {
    prism(B, x, z, 2.2, 1.7, 6, 42, 8, M);
    for (const y of [16, 28, 39]) prism(B, x, z, 2.6, 2.6, y, y + .8, 8, M2);
    blob(B, x, 44, z, 2.2, M, M2, [1, 1, 1]);
  }
  for (const [x, z] of [[-60, 0], [60, 0]]) { box(B, x, -1, z, 20, 14, 46, 0, RS, [.55, .34, .28]); blob(B, x, 14, z, 6, M2, M, [1, .9, 1]); }   // the red mosques either side
  ivyAt(B, 15, 0, 15, 6, 3);
  return B.out();
}

// ---- the Sydney Opera House: white sails on a granite platform by the water ----------------------
export function opera() {
  reseed(851); const B = builder(), W = [.93, .92, .88], W2 = [.86, .85, .8], G = [.66, .55, .47];
  box(B, 0, -6, 0, 120, 10, 64, 0, G, [.7, .6, .52]);
  // a shell: a ridge rising from the back to a high front tip, its sides sweeping down to the
  // platform, the open mouth at the front dark glass
  const shell = (xb, z, len, h, wid, dir) => {
    const n = 7, R = u => [xb + dir * len * u, 4 + h * Math.pow(Math.sin(u * Math.PI / 2), 1.4), z], Sd = (u, k) => [xb + dir * len * u * .82, 4, z + k * wid * Math.sqrt(u)];
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      for (const k of [-1, 1]) {
        const c = k < 0 ? W : W2;
        B.tri(R(u0), R(u1), Sd(u1, k), c, (rnd() - .5) * .04); B.tri(R(u0), Sd(u1, k), Sd(u0, k), c, (rnd() - .5) * .04);
        B.tri(R(u1), R(u0), Sd(u1, k), c); B.tri(Sd(u1, k), R(u0), Sd(u0, k), c);
      }
    }
    const t = R(1), l = Sd(1, -1), r = Sd(1, 1), m = [(l[0] + t[0]) / 2 - dir * 1.5, 4, z];
    B.tri(t, l, m, [.36, .38, .4]); B.tri(t, m, r, [.36, .38, .4]); B.tri(t, m, l, [.36, .38, .4]); B.tri(t, r, m, [.36, .38, .4]);
  };
  for (const [z, s] of [[-12, 1], [16, .72]]) {
    shell(-46 * s, z, 30 * s, 42 * s, 13 * s, 1); shell(-24 * s, z, 26 * s, 36 * s, 12 * s, 1); shell(-4 * s, z, 20 * s, 26 * s, 10 * s, 1);
    shell(34 * s, z, 22 * s, 30 * s, 10 * s, -1);
  }
  return B.out();
}

// ---- Christ the Redeemer: arms open over the hills ---------------------------------------------
export function redeemer() {
  reseed(861); const B = builder(), S = [.82, .8, .75], S2 = [.74, .72, .68];
  box(B, 0, -2, 0, 9, 10, 9, 0, S2, S);
  prism(B, 0, 0, 3.4, 2.4, 8, 30, 10, S, .92);
  box(B, 0, 27, 0, 28, 2.6, 2.6, 0, S, S2);
  for (const k of [-1, 1]) box(B, k * 13.6, 26.4, 0, 1.4, 2, 2, 0, S2);
  blob(B, 0, 32.3, 0, 1.9, S, S2, [.9, 1.15, .95], 2);
  ivyAt(B, 3, 0, 3, 6, 3);
  return B.out();
}

// ---- Stonehenge: the ring of sarsens with their lintels, the great trilithons, some fallen --------
export function stonehenge() {
  reseed(871); const B = builder(), S = [[.6, .6, .56], [.55, .55, .52], [.65, .64, .6]];
  const R = 15, N = 30, up = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * 6.283, x = Math.cos(a) * R, z = Math.sin(a) * R, ok = rnd() < .62;
    up.push(ok);
    if (ok) box(B, x, -.3, z, 1.2, 4.4, 2.1, a, pick(S), MOSS);
    else if (rnd() < .6) box(B, x + Math.cos(a) * 2.4, -.3, z + Math.sin(a) * 2.4, 4.2, 1.1, 2, a, pick(S), MOSS);
  }
  for (let i = 0; i < N; i++) if (up[i] && up[(i + 1) % N]) { const a = (i + .5) / N * 6.283; box(B, Math.cos(a) * R, 4.1, Math.sin(a) * R, 3.3, .8, 1, a + Math.PI / 2, pick(S), MOSS); }
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * .75 + i / 4 * Math.PI * 1.5, r = 8, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 6 + (i === 2 ? 1.5 : 0);
    if (i === 3) { box(B, x, -.3, z, 6, 1.4, 2.4, a, pick(S)); continue; }
    for (const k of [-1.1, 1.1]) box(B, x - Math.sin(a) * k, -.3, z + Math.cos(a) * k, 1.4, h, 1.9, a, pick(S), MOSS);
    box(B, x, h - .3, z, 1.2, 1, 4, a, pick(S), MOSS);
  }
  return B.out();
}

// ---- the Leaning Tower of Pisa: eight rings of arches, leaning south --------------------------------
export function pisa() {
  reseed(881); const lean = Math.tan(4 * Math.PI / 180), B = bent(([x, y, z]) => [x, y, z + y * lean]), M = [.9, .88, .82], M2 = [.82, .8, .74];
  prism(B, 0, 0, 7.8, 7.8, -1, 0, 16, M2);
  prism(B, 0, 0, 7, 7, 0, 48, 16, M);
  for (let k = 0; k < 8; k++) {
    const y = 6 + k * 5.6;
    prism(B, 0, 0, 7.6, 7.6, y, y + .7, 16, M2);
    if (k < 7) for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * 6.283; box(B, Math.cos(a) * 7.05, y + 1.4, Math.sin(a) * 7.05, .08, 3.4, 1.4, a, [.3, .28, .26]); }
  }
  prism(B, 0, 0, 4.8, 4.8, 48, 55, 12, M);
  prism(B, 0, 0, 5.2, 5.2, 55, 55.6, 12, M2);
  ivyAt(B, 5, 0, 5, 8, 4);
  return B.out();
}

// ---- Machu Picchu: terraces down a saddle, the roofless stone houses above -----------------------
export function picchu() {
  reseed(891); const B = builder(), S = [[.6, .58, .52], [.55, .53, .48]], G = [.42, .55, .32], G2 = [.46, .58, .34];
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) box(B, 0, -12 - k * 2.6, s * (34 + k * 4.2), 90 - k * 3, 12, 4.4, 0, pick(S), rnd() < .5 ? G : G2);
  box(B, 0, -12, 0, 96, 12, 64, 0, pick(S), G);                 // the plaza
  for (let i = 0; i < 16; i++) {
    const x = -38 + (i % 8) * 11 + (rnd() - .5) * 2, z = (i < 8 ? -18 : 18) + (rnd() - .5) * 4, a = (rnd() - .5) * .2, L = 7, W = 5, h = 2.4 + rnd() * 1.2;
    for (const [u, w, l, t] of [[0, -W / 2, L, .6], [0, W / 2, L, .6], [-L / 2, 0, .6, W], [L / 2, 0, .6, W]]) box(B, x + Math.cos(a) * u - Math.sin(a) * w, 0, z + Math.sin(a) * u + Math.cos(a) * w, l, h, t, a, pick(S), MOSS);
    for (const k of [-1, 1]) prism(B, x + Math.cos(a) * k * L / 2, z + Math.sin(a) * k * L / 2, .01, 0, h, h + 1.6, 3, pick(S));   // the gable points
  }
  box(B, 30, 0, 0, 8, 4.8, 8, .3, [.66, .63, .56], G);          // the sun temple
  return B.out();
}

// ---- Angkor Wat: stepped galleries rising to five lotus towers, the forest coming in ---------------
export function angkor() {
  reseed(901); const B = builder(), S = [[.56, .5, .42], [.5, .45, .38], [.6, .54, .46]];
  const tower = (x, z, h, r) => {
    for (let k = 0; k < 8; k++) { const y0 = k / 8 * h, y1 = (k + 1) / 8 * h, f = t => r * (1 - Math.pow(t / h, 1.6) * .95); prism(B, x, z, f(y0) * 1.08, f(y1), y0, y1, 8, pick(S), .82); }
  };
  for (const [s, y, h] of [[96, 0, 6], [70, 6, 7], [46, 13, 9]]) {
    box(B, 0, y - 1, 0, s, h + 1, s, 0, pick(S), [.5, .48, .4]);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; for (let u = -s / 2 + 4; u < s / 2 - 3; u += 5) box(B, Math.cos(a) * s / 2 - Math.sin(a) * u, y + 1, Math.sin(a) * s / 2 + Math.cos(a) * u, .2, h - 2.5, 1.6, a, DARK); }
  }
  tower(0, 0, 42, 7.5); tower(-18, -18, 24, 5); tower(18, -18, 24, 5); tower(18, 18, 24, 5); tower(-18, 18, 24, 5);
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, r = 30 + rnd() * 18; blob(B, Math.cos(a) * r, 6 + rnd() * 8, Math.sin(a) * r, 3 + rnd() * 3, IVY, IVY2, [1, .8, 1]); }
  return B.out();
}

// ---- the Moai: stone heads in a row on their platform, backs to the sea, two fallen ---------------
export function moai() {
  reseed(911); const B = builder(), S = [.42, .4, .37], S2 = [.36, .34, .32];
  box(B, 0, -1, 0, 44, 2.6, 7, 0, [.48, .46, .42]);
  for (let i = 0; i < 9; i++) {
    const x = -18 + i * 4.5;
    if (i === 2 || i === 6) { box(B, x, 1.6, 4.5, 3, 1.8, 7, Math.PI / 2, S2); continue; }
    box(B, x, 1.6, 0, 2.6, 3.4, 2, 0, S2);
    box(B, x, 5, 0, 2.4, 4.4, 2.1, 0, S, S2);
    box(B, x, 7.8, -1.2, 2.5, .9, .5, 0, S2);                  // the brow
    box(B, x, 5.6, -1.25, .7, 2.2, .7, 0, S2);                 // the nose
    if (i % 3 === 0) box(B, x, 9.4, 0, 2, 1.5, 2, 0, [.6, .32, .26]);   // the red topknot
  }
  return B.out();
}

// ---- the Great Wall, along its path ({ x, y, z } every ~20 m, y its ground) ---------------------------
// a stone wall walked along the ridges, its parapet crenellated, a watchtower every tenth point;
// in places fallen to a ragged bank. World coordinates about the first point, y as is
export function greatWall(P) {
  reseed(921); const B = builder(), ox = P[0].x, oz = P[0].z, S = [[.62, .58, .52], [.56, .53, .48], [.66, .62, .55]];
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], yaw = Math.atan2(b.z - a.z, b.x - a.x), L = Math.hypot(b.x - a.x, b.z - a.z), c = Math.cos(yaw), s = Math.sin(yaw), n = Math.max(2, Math.round(L / 4));
    const fallen = a.fallen;
    for (let k = 0; k < n; k++) {
      const u = (k + .5) / n, x = a.x + (b.x - a.x) * u - ox, z = a.z + (b.z - a.z) * u - oz, y = a.y + (b.y - a.y) * u, h = fallen ? 1.5 + rnd() * 2.5 : 7;
      box(B, x, y - 4, z, L / n + .05, h + 4, 5.4, yaw, pick(S), [.55, .52, .46]);
      if (!fallen) for (const w of [-2.5, 2.5]) for (let m = 0; m < 2; m++) if (w < 0 || m === 0 || rnd() < .8) box(B, x + c * (m - .5) * L / n * .5 - s * w, y + h, z + s * (m - .5) * L / n * .5 + c * w, L / n * .3, 1.1, .5, yaw, pick(S));
    }
    if (i % 10 === 5) box(B, a.x - ox, a.y - 4, a.z - oz, 9, 16, 9, yaw, pick(S), [.5, .47, .42]);
  }
  return { tris: B.out(), at: [ox, oz] };
}

// ---- the Golden Gate, across a strait (span metres, along local x): two tall towers, the cables
// sagging between, the deck fallen out of its middle -------------------------------------------------
export function goldenGate(span) {
  reseed(931); const B = builder(), O = [.66, .32, .22], O2 = [.58, .28, .2], deck = 26, T = span * .32, top = 88;
  for (const sx of [-T, T]) {
    for (const k of [-6, 6]) box(B, sx, -6, k, 4, top + 6, 3, 0, O, O2);
    for (const y of [32, 52, 70, top - 3]) box(B, sx, y, 0, 3.4, 3, 12, 0, O2);
  }
  const cable = (x0, y0, x1, y1, sag, k) => { let prev = null; for (let i = 0; i <= 12; i++) { const u = i / 12, p = [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - sag * 4 * u * (1 - u), k]; if (prev) tube(B, prev, p, .5, O2); prev = p; } };
  for (const k of [-5.5, 5.5]) { cable(-T, top, T, top, top - deck - 4, k); cable(-span / 2, deck + 2, -T, top, 8, k); cable(T, top, span / 2, deck + 2, 8, k); }
  for (let x = -span / 2; x < span / 2; x += 12) {
    if (Math.abs(x) < span * .09) continue;   // the gap where the middle fell
    box(B, x + 6, deck - 2.5, 0, 12.1, 2.5, 13, 0, O2, [.36, .34, .32]);
    const sag = Math.abs(x) < T ? deck + 4 + (top - deck - 4) * (x / T) ** 2 : null;
    if (sag && rnd() < .8) for (const k of [-5.5, 5.5]) tube(B, [x, deck, k], [x, sag, k], .08, O2);
  }
  return B.out();
}
