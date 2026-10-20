// Aloft's mark: a wax seal, cut as a low-poly gem. A many-sided pool of berry-red wax, each facet
// lit by the way it leans; a pressed recess inside it; ALOFT round the top and a ring of leaf
// facets round the bottom; and a red-tail soaring in the middle, seen from below, its slotted
// wingtips as sharp points. Lit from the upper left. Small seals leave out the lettering and
// leaves so the hawk stays readable. Drawn on demand (menu, icons), never per frame.
import { PIG, C, shade, poly, gem, ngon, seedR, rnd } from './facet.js';

// a red-tail from below, in a 200-unit box centred on (100, 61)
const HAWK = [[100, 22], [106, 31], [152, 27], [186, 37], [196, 40], [186, 43], [197, 47], [185, 49], [194, 54], [182, 54], [188, 59], [174, 58], [118, 66],
  [124, 88], [100, 97], [76, 88], [82, 66], [26, 58], [12, 59], [18, 54], [6, 54], [15, 49], [3, 47], [14, 43], [4, 40], [14, 37], [48, 27], [94, 31]];

export function drawSeal(x, cx, cy, r, { seed = 9, shadow = true } = {}) {
  const fine = r >= 40, wax = PIG.wax, k = Math.max(.7, r / 50);
  seedR(seed);
  // the poured wax: an irregular polygon, a little lumpy where it ran
  const n = fine ? 18 : 12, rim = ngon(cx, cy, r, n, -.2).map(([px, py]) => { const s = 1 + (rnd() - .5) * .07; return [cx + (px - cx) * s, cy + (py - cy) * s]; });
  if (shadow) poly(x, rim.map(([px, py]) => [px + r * .05, py + r * .08]), 'rgba(50,14,8,.32)');
  for (let i = 0; i < n; i++) {
    const p = rim[i], q = rim[(i + 1) % n], mid = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx);
    const f = -(Math.cos(mid) * -.6 + Math.sin(mid) * -.8);
    const pin = [cx + (p[0] - cx) * .84, cy + (p[1] - cy) * .84], qin = [cx + (q[0] - cx) * .84, cy + (q[1] - cy) * .84];
    poly(x, [p, q, qin, pin], C(shade(wax, 1 + f * .22)));
  }
  // the pressed recess: its facets lean the other way, so the light falls on its far wall
  gem(x, cx, cy, r * .84, n, shade(wax, .86), { rot: -.2, depth: -.5, inner: .9 });
  poly(x, ngon(cx, cy, r * .84 * .9, n, -.2), C(shade(wax, .9)));

  // a cut into the wax: a light edge below-right, a dark one above-left, then the floor
  const cut = (draw, d) => {
    x.save(); x.translate(d, d); x.fillStyle = 'rgba(255,196,170,.55)'; draw(); x.restore();
    x.save(); x.translate(-d * .7, -d * .7); x.fillStyle = 'rgba(48,8,4,.8)'; draw(); x.restore();
    x.fillStyle = C(shade(wax, .66)); draw();
  };
  const R = r * .84;
  if (fine) {
    // ALOFT round the top, in upright capitals
    const size = r * .24, rad = R * .66;
    x.save(); x.font = `${size}px Spectral, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const word = 'ALOFT', gap = size * .2, ws = [...word].map(c => x.measureText(c).width);
    const tot = (ws.reduce((s, w) => s + w, 0) + gap * (word.length - 1)) / rad;
    let a = -Math.PI / 2 - tot / 2;
    [...word].forEach((c, i) => {
      const am = a + ws[i] / 2 / rad;
      cut(() => { x.save(); x.translate(cx + Math.cos(am) * rad, cy + Math.sin(am) * rad); x.rotate(am + Math.PI / 2); x.fillText(c, 0, 0); x.restore(); }, k * .8);
      a += (ws[i] + gap) / rad;
    });
    x.restore();
    // leaves: little diamonds round the bottom, meeting at a berry
    for (let j = 0; j < 9; j++) for (const s of [1, -1]) {
      const a = Math.PI / 2 + s * (.2 + j * .1), px = cx + Math.cos(a) * R * .7, py = cy + Math.sin(a) * R * .7, l = r * .05 * (1 - j * .05), d = a + s * (j % 2 ? .9 : -.9);
      cut(() => poly(x, [[px - Math.cos(d) * l, py - Math.sin(d) * l], [px - Math.sin(d) * l * .35, py + Math.cos(d) * l * .35], [px + Math.cos(d) * l, py + Math.sin(d) * l], [px + Math.sin(d) * l * .35, py - Math.cos(d) * l * .35]]), k * .5);
    }
    cut(() => poly(x, ngon(cx, cy + R * .7, r * .035, 6)), k * .5);
  }
  // the hawk, as large as the recess allows
  const span = fine ? R * 1.2 : R * 1.7, sc = span / 194, oy = fine ? -R * .03 : 0;
  const pts = HAWK.map(([px, py]) => [cx + (px - 100) * sc, cy + (py - 61) * sc + oy]);
  cut(() => poly(x, pts), k * 1.1);
  // facets on the bird: each wing and the tail shaded apart, as the world's hawk is
  const hc = shade(wax, .66);
  poly(x, [pts[0], pts[1], pts[12], pts[16], pts[27]], C(shade(hc, 1.08)));
  poly(x, [pts[1], pts[2], pts[3], pts[11], pts[12]], C(shade(hc, 1.14)));
  poly(x, [pts[27], pts[26], pts[25], pts[17], pts[16]], C(shade(hc, .9)));
  poly(x, [pts[12], pts[13], pts[14], pts[15], pts[16]], C(shade(hc, .98)));
}
