// The night sky: a simplified map of the real stars. The bright ones by name, in their
// constellations (right ascension in hours, declination in degrees, magnitude, colour from -1
// blue-white to 1 orange), with the lines that join them; a few thousand faint ones seeded and
// thicker along the Milky Way. render.js draws them as steady points; sys/nightsea.js lights a
// constellation you look at.
//
// The sky turns about uPole (as high as your latitude, sys/nightsea.js) by S.starA, the local
// sidereal angle (sys/sleep.js). skyDir() is the same sum as render.js STAR_VS.

export const CONSTELLATIONS = [
  { id: 'uma', name: 'The Plough', stars: [[11.062, 61.75, 1.8, .3], [11.031, 56.38, 2.4], [11.897, 53.69, 2.4], [12.257, 57.03, 3.3], [12.900, 55.96, 1.8], [13.399, 54.93, 2.2], [13.792, 49.31, 1.9]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  { id: 'umi', name: 'The Little Bear', stars: [[2.530, 89.26, 2.0, .2], [17.537, 86.59, 4.4], [16.766, 82.04, 4.2], [15.734, 77.79, 4.3], [14.845, 74.16, 2.1, .7], [15.345, 71.83, 3.0], [16.292, 75.76, 5.0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { id: 'cas', name: 'Cassiopeia', stars: [[0.153, 59.15, 2.3], [0.675, 56.54, 2.2, .6], [0.945, 60.72, 2.5, -.5], [1.430, 60.24, 2.7], [1.906, 63.67, 3.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'ori', name: 'Orion', stars: [[5.919, 7.41, .5, 1], [5.419, 6.35, 1.6, -.6], [5.533, -.30, 2.2, -.6], [5.604, -1.20, 1.7, -.7], [5.679, -1.94, 1.8, -.6], [5.796, -9.67, 2.1, -.6], [5.242, -8.20, .1, -.8], [5.585, 9.93, 3.4, -.5]],
    lines: [[0, 7], [7, 1], [0, 1], [0, 4], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6]] },
  { id: 'tau', name: 'Taurus', stars: [[4.599, 16.51, .9, .9], [5.438, 28.61, 1.7, -.5], [5.627, 21.14, 3.0], [4.477, 19.18, 3.5, .6], [4.330, 15.63, 3.6, .6]],
    lines: [[4, 0], [0, 2], [4, 3], [3, 1]] },
  { id: 'ple', name: 'The Pleiades', stars: [[3.791, 24.11, 2.9, -.7], [3.819, 24.05, 3.6, -.7], [3.747, 24.11, 3.7, -.7], [3.763, 24.37, 3.9, -.7], [3.772, 23.95, 4.2, -.7], [3.754, 24.47, 4.3, -.7]],
    lines: [] },
  { id: 'gem', name: 'Gemini', stars: [[7.577, 31.89, 1.6], [7.755, 28.03, 1.1, .7], [6.629, 16.40, 1.9], [6.732, 25.13, 3.0, .6], [7.335, 21.98, 3.5], [6.383, 22.51, 2.9, .8]],
    lines: [[0, 1], [0, 3], [3, 5], [1, 4], [4, 2]] },
  { id: 'aur', name: 'Auriga', stars: [[5.278, 46.00, .1, .4], [5.992, 44.95, 1.9], [5.995, 37.21, 2.6], [4.950, 33.17, 2.7, .8], [5.033, 43.82, 3.0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
  { id: 'cma', name: 'The Great Dog', stars: [[6.752, -16.72, -1.46, -.4], [6.378, -17.96, 2.0, -.6], [7.140, -26.39, 1.8, .2], [6.977, -28.97, 1.5, -.6], [7.402, -29.30, 2.4, -.5]],
    lines: [[0, 1], [0, 2], [2, 3], [2, 4]] },
  { id: 'cmi', name: 'The Little Dog', stars: [[7.655, 5.22, .4, .1], [7.453, 8.29, 2.9, -.4]], lines: [[0, 1]] },
  { id: 'leo', name: 'Leo', stars: [[10.140, 11.97, 1.4, -.5], [10.122, 16.76, 3.5], [10.333, 19.84, 2.0, .8], [11.235, 20.52, 2.6], [11.818, 14.57, 2.1], [11.237, 15.43, 3.3], [10.278, 23.42, 3.4], [9.879, 26.01, 3.9, .7], [9.764, 23.77, 3.0, .6]],
    lines: [[0, 1], [1, 2], [2, 6], [6, 7], [7, 8], [2, 3], [3, 4], [4, 5], [5, 0]] },
  { id: 'boo', name: 'Boötes', stars: [[14.261, 19.18, -.05, .9], [14.750, 27.07, 2.4, .7], [13.911, 18.40, 2.7], [14.535, 38.31, 3.0], [15.032, 40.39, 3.5, .5], [15.258, 33.31, 3.5, .5]],
    lines: [[0, 1], [1, 5], [5, 4], [4, 3], [3, 0], [0, 2]] },
  { id: 'lyr', name: 'Lyra', stars: [[18.616, 38.78, .03, -.5], [18.835, 33.36, 3.5], [18.982, 32.69, 3.3, -.4], [18.746, 37.61, 4.3], [18.908, 36.90, 4.3, .8]],
    lines: [[0, 3], [3, 1], [1, 2], [2, 4], [4, 3]] },
  { id: 'cyg', name: 'The Swan', stars: [[20.690, 45.28, 1.3, -.2], [20.370, 40.26, 2.2, .2], [19.512, 27.96, 3.1, .8], [20.770, 33.97, 2.5, .6], [19.750, 45.13, 2.9, -.4], [19.938, 35.08, 3.9, .6]],
    lines: [[0, 1], [1, 5], [5, 2], [1, 3], [1, 4]] },
  { id: 'aql', name: 'The Eagle', stars: [[19.846, 8.87, .8, -.1], [19.771, 10.61, 2.7, .9], [19.922, 6.41, 3.7, .5], [19.090, 13.86, 3.0], [19.425, 3.11, 3.4], [19.104, -4.88, 3.4, -.4], [20.188, -.82, 3.2, -.4]],
    lines: [[3, 1], [1, 0], [0, 2], [2, 6], [0, 4], [4, 5]] },
  { id: 'peg', name: 'The Square of Pegasus', stars: [[23.079, 15.21, 2.5, -.3], [23.063, 28.08, 2.4, .9], [0.220, 15.18, 2.8, -.6], [0.140, 29.09, 2.1, -.4], [22.691, 10.83, 3.4], [21.736, 9.88, 2.4, .8]],
    lines: [[0, 1], [1, 3], [3, 2], [2, 0], [0, 4], [4, 5]] },
  { id: 'sco', name: 'The Scorpion', stars: [[16.490, -26.43, 1.0, 1], [16.091, -19.81, 2.6, -.5], [16.006, -22.62, 2.3, -.6], [15.981, -26.11, 2.9, -.6], [16.353, -25.59, 2.9, -.6], [16.598, -28.22, 2.8, -.7], [16.836, -34.29, 2.3, .7], [16.864, -38.05, 3.0, -.6], [16.910, -42.36, 3.6, .6], [17.203, -43.24, 3.3], [17.622, -43.00, 1.9], [17.793, -40.13, 3.0], [17.708, -39.03, 2.4, -.6], [17.560, -37.10, 1.6, -.7], [17.513, -37.30, 2.7, -.6]],
    lines: [[1, 2], [2, 3], [2, 4], [4, 0], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14]] },
  { id: 'sgr', name: 'The Teapot', stars: [[18.403, -34.38, 1.8, -.3], [18.350, -29.83, 2.7, .7], [18.466, -25.42, 2.8, .6], [18.921, -26.30, 2.0, -.6], [19.044, -29.88, 2.6], [18.097, -30.42, 3.0, .7], [18.761, -26.99, 3.2, -.5], [19.116, -27.67, 3.3, .7]],
    lines: [[0, 5], [5, 1], [1, 0], [1, 2], [2, 6], [1, 6], [6, 3], [3, 7], [7, 4], [4, 6], [4, 0]] },
  { id: 'cru', name: 'The Southern Cross', stars: [[12.443, -63.10, .8, -.7], [12.795, -59.69, 1.3, -.7], [12.519, -57.11, 1.6, 1], [12.252, -58.75, 2.8, -.6], [12.356, -60.40, 3.6, .6]],
    lines: [[0, 2], [1, 3]] },
  { id: 'cen', name: 'The Centaur', stars: [[14.660, -60.83, -.27, .4], [14.064, -60.37, .6, -.6], [14.111, -36.37, 2.1, .7], [13.665, -53.47, 2.3, -.6], [13.926, -47.29, 2.6, -.6], [12.692, -48.96, 2.2], [12.139, -50.72, 2.6, -.5], [14.592, -42.16, 2.3, -.6]],
    lines: [[0, 1], [1, 3], [3, 5], [5, 6], [3, 4], [4, 7], [4, 2]] },
];

// bright stars on their own
export const LONE = [
  [6.399, -52.70, -.74, .1], [1.629, -57.24, .46, -.6], [22.961, -29.62, 1.16], [13.420, -11.16, .98, -.7],
  [9.460, -8.66, 2.0, .9], [2.120, 23.46, 2.0, .8], [0.727, -17.99, 2.0, .7], [3.405, 49.86, 1.8, .3],
  [3.136, 40.96, 2.1, -.5], [17.582, 12.56, 2.1], [15.578, 26.71, 2.2], [20.427, -56.74, 1.9, -.6],
  [22.137, -46.96, 1.7, -.6], [9.220, -69.72, 1.7], [8.375, -59.51, 1.9, .8], [9.133, -43.43, 2.2, .9],
  [8.060, -40.00, 2.2, -.8], [16.811, -69.03, 1.9, .9], [21.310, 62.59, 2.5], [17.943, 51.49, 2.2, .9],
  [10.716, -64.39, 2.8, -.6], [7.946, -52.98, 3.5, -.6], [2.065, 42.33, 2.1, .9], [1.162, 35.62, 2.1, 1],
];

const R = Math.PI / 180;
// the Milky Way's north pole (RA 12h51m, Dec +27.1)
export const GAL = (() => { const a = 192.86 * R, d = 27.13 * R; return [Math.cos(d) * Math.cos(a), Math.sin(d), Math.cos(d) * Math.sin(a)]; })();
// a star's place on the sky's own sphere: y to the celestial pole
const eq = (ra, dec) => { const a = ra * 15 * R, d = dec * R; return [Math.cos(d) * Math.cos(a), Math.sin(d), Math.cos(d) * Math.sin(a)]; };

// The sky's own sphere to the world: H = A - ra (the hour angle), the celestial equator's highest
// point U, west W. As render.js STAR_VS.
export function skyDir(e, pole, A) {
  const ca = Math.cos(A), sa = Math.sin(A);
  // turn the sphere by A about its pole (y) the other way round: hour angle = A - ra
  const x = e[0] * ca + e[2] * sa, z = e[0] * sa - e[2] * ca;   // cos(dec) cos H, cos(dec) sin H
  const U = [0, -pole[2], pole[1]];
  return [-z, x * U[1] + e[1] * pole[1], x * U[2] + e[1] * pole[2]];
}

// Points for the renderer, 9 floats each: e (x y z on the sky's sphere), r g b, size in pixels at
// 1000 px tall, the constellation (index, or -1) and whether it gently glows
function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
const tint = c => c > 0 ? [1, 1 - c * .2, 1 - c * .42] : [1 + c * .25, 1 + c * .1, 1];
function star(out, e, mag, col, con, glow) {
  const lum = Math.pow(10, -.4 * mag), k = Math.min(1.3, Math.sqrt(lum) * 1.05 + .17), t = tint(col || 0);
  out.push(...e, t[0] * k, t[1] * k, t[2] * k, 1.9 + 1.5 * Math.sqrt(Math.min(lum, 3)), con, glow);
}
export function starPoints() {
  const out = [];
  CONSTELLATIONS.forEach((c, ci) => c.stars.forEach(([ra, dec, mag, col], i) => star(out, eq(ra, dec), mag, col, ci, mag < 1.6 && hash(ci * 31 + i) < .45 ? 1 : 0)));
  LONE.forEach(([ra, dec, mag, col], i) => star(out, eq(ra, dec), mag, col, -1, mag < 1.2 ? 1 : 0));
  // the faint ones: even over the sky, and as many again near the Milky Way
  for (let i = 0, n = 0; n < 2600 && i < 20000; i++) {
    const u = hash(i * 3 + 1) * 2 - 1, a = hash(i * 3 + 2) * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const e = [s * Math.cos(a), u, s * Math.sin(a)], g = Math.abs(e[0] * GAL[0] + e[1] * GAL[1] + e[2] * GAL[2]);
    if (hash(i * 3 + 3) > .35 + .65 * Math.exp(-g * g * 30)) continue;
    const m = hash(i * 7 + 5), mag = 3.6 + 2.6 * Math.sqrt(m);
    star(out, e, mag, (hash(i * 5 + 9) - .5) * 1.4, -1, 0); n++;
  }
  return new Float32Array(out);
}

// The constellation lines: pairs of points on the sky's sphere (then 0, the constellation, 0),
// each line kept short of its stars
export function starLines() {
  const out = [];
  CONSTELLATIONS.forEach((c, ci) => {
    for (const [i, j] of c.lines) {
      const a = eq(c.stars[i][0], c.stars[i][1]), b = eq(c.stars[j][0], c.stars[j][1]);
      const ang = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), gap = Math.min(.3, .55 * R / (ang || 1));
      const at = t => { const p = a.map((q, k) => q + (b[k] - q) * t), l = Math.hypot(...p); return p.map(q => q / l); };
      out.push(...at(gap), 0, ci, 0, ...at(1 - gap), 0, ci, 0);
    }
  });
  return new Float32Array(out);
}

// each constellation's middle, on the sky's sphere (where you look to light it)
export const CENTRES = CONSTELLATIONS.map(c => {
  const p = [0, 0, 0]; for (const s of c.stars) { const e = eq(s[0], s[1]); p[0] += e[0]; p[1] += e[1]; p[2] += e[2]; }
  const l = Math.hypot(...p); return p.map(q => q / l);
});
// how wide each one is (radians from its middle), so a big one lights from further off
export const SPANS = CONSTELLATIONS.map((c, i) => Math.max(...c.stars.map(s => { const e = eq(s[0], s[1]), m = CENTRES[i]; return Math.acos(Math.min(1, e[0] * m[0] + e[1] * m[1] + e[2] * m[2])); })));
