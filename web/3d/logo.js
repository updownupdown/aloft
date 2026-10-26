// The game's mark (James's pick 2026-10-24, "banking over the hills" made level): a red-tail seen from
// above, wings level and spread, its brown back and red tail over hazy faceted hills under a faceted sky.
// The bird is sized so the gap between each wingtip and the tile's edge is the width of its head.
// Drawn on a 2D canvas at any size: the app icons (tools/icon.html), the splash and the logo in the menu.
// Each facet is [colour, x0, y0, x1, y1, ...]; the tile is a 100x100 box.
const sh = (hex, k) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => { const u = parseInt(a.slice(i, i + 2), 16), v = parseInt(b.slice(i, i + 2), 16); return Math.round(u + (v - u) * t).toString(16).padStart(2, '0'); }).join('');
const mirror = p => p.map((v, i) => i % 2 ? v : 100 - v);

const HAZE = '#c6dae5';
const SKY = [['#8db6d8', 0, 0, 100, 0, 0, 60], ['#a6c8e1', 100, 0, 100, 80, 0, 60], [HAZE, 0, 60, 100, 80, 0, 82]];
// hills in a 100x40 box, each facet's ridge row (0 far, 3 near) sets how much haze it takes
const HILLS = [
  ['#c3d3a3', 0, 10, 18, 2, 22, 14], ['#adc28a', 18, 2, 34, 8, 22, 14], ['#c3d3a3', 34, 8, 52, 0, 44, 14],
  ['#adc28a', 52, 0, 70, 6, 60, 14], ['#c3d3a3', 70, 6, 86, 0, 80, 14], ['#adc28a', 86, 0, 100, 4, 100, 14],
  ['#a4bb82', 0, 10, 22, 14, 0, 18], ['#b6c99a', 22, 14, 44, 14, 34, 8], ['#b0c493', 44, 14, 60, 14, 52, 0],
  ['#b6c99a', 60, 14, 80, 14, 70, 6], ['#a8bd8a', 80, 14, 100, 14, 86, 0],
  ['#8fae6c', 0, 18, 22, 12, 40, 19, 0, 26], ['#9cb878', 22, 12, 62, 10, 40, 19], ['#86a564', 62, 10, 82, 18, 40, 19],
  ['#94b272', 62, 10, 100, 13, 82, 18], ['#7f9e5e', 82, 18, 100, 13, 100, 24], ['#8aa968', 40, 19, 82, 18, 60, 26],
  ['#6f9152', 0, 26, 26, 24, 50, 30, 0, 40], ['#7a9a5b', 26, 24, 74, 23, 50, 30], ['#668a4a', 74, 23, 100, 29, 50, 30],
  ['#5f8344', 50, 30, 100, 29, 100, 40, 0, 40],
];
const ROW = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3];
const FOG = [.5, .36, .22, .08];

// the red-tail from above in a 100x60 box (left half; the right is mirrored and a shade darker): broad
// arm, a hand with four fingered primaries, round head, body, and the fanned red tail with its dark band
const W = {
  arm1: [45, 16, 28, 12, 31, 21], arm2: [45, 16, 31, 21, 34, 29, 44, 29], arm3: [28, 12, 20, 27, 34, 29, 31, 21],
  hand1: [28, 12, 12, 9, 14, 18], hand2: [28, 12, 14, 18, 20, 27], hand3: [12, 9, 8, 23, 20, 27, 14, 18],
  fing: [[12, 9, 11, 12.5, 6.5, 7.5], [11, 12.5, 10, 16, 4, 12.5], [10, 16, 9, 19.5, 3, 18], [9, 19.5, 8, 23, 4, 23.5]],
  head: [50, 4.5, 50, 16.5, 46.5, 13, 46.5, 7.5], bodyU: [50, 13, 46.5, 13, 45, 16, 44, 29, 50, 30], bodyL: [50, 30, 44, 29, 46, 36, 50, 36],
  tail: [46, 36, 50, 36, 50, 52, 45, 51, 40, 49],
  tband: [41.4, 46, 58.6, 46, 59.6, 48.5, 40.4, 48.5], ttip: [40.3, 48.5, 59.7, 48.5, 60, 49, 55, 51, 50, 52, 45, 51, 40, 49],
};
const C = { arm1: '#7b5434', arm2: '#6e4a2f', arm3: '#5e3f27', hand1: '#6b4a2e', hand2: '#5e3f27', hand3: '#4a3322', fing: ['#2a1d14', '#3a2a1f', '#2a1d14', '#3a2a1f'],
  head: '#4b3322', bodyU: '#6e4a2f', bodyL: '#7b5434', tail: '#c25f30', tband: '#3a2418', ttip: '#eadbc2' };
// wingtip to wingtip is 94 box units (x 3 to 97) and the head 7 wide (46.5 to 53.5): a head's width each
// side means 94k + 2 * 7k = 100, so the box is drawn at k = 100 / 108, the height squashed a little more
// (the bird is seen at a slant from above)
const K = 100 / 108, KY = K * .84, CY = 44;

function hawk(detail) {
  const L = [], side = (list, k) => list.forEach(([c, ...p]) => L.push([sh(c, k), ...(k === 1 ? p : mirror(p))]));
  const wing = [['arm1'], ['arm2'], ['arm3'], ['hand1'], ['hand2'], ['hand3']].map(([n]) => [C[n], ...W[n]]).concat(W.fing.map((f, i) => [C.fing[i], ...f]));
  side(wing, 1); side(wing, .86);
  const body = [[C.bodyU, ...W.bodyU], [C.bodyL, ...W.bodyL]]; side(body, 1); side(body, .86);
  side([[C.tail, ...W.tail]], 1); side([[C.tail, ...W.tail]], .84);
  if (detail) L.push([C.tband, ...W.tband], [C.ttip, ...W.ttip]);
  side([[C.head, ...W.head]], 1); side([[C.head, ...W.head]], .8);
  return L;
}

function facets(x, list, ox, oy, sx, sy) {
  for (const [col, ...p] of list) {
    x.beginPath();
    for (let i = 0; i < p.length; i += 2) x.lineTo(ox + p[i] * sx, oy + p[i + 1] * sy);
    x.closePath(); x.fillStyle = x.strokeStyle = col; x.fill(); x.lineWidth = .25; x.stroke(); // stroke hides seams
  }
}
function back(x) {
  x.fillStyle = HAZE; x.fillRect(0, 0, 100, 100);
  facets(x, SKY, 0, 0, 1, 1);
  x.fillStyle = mix('#86a564', HAZE, FOG[3]); x.fillRect(0, 80, 100, 20); // under the hills' far edges
  facets(x, HILLS.map(([c, ...p], i) => [mix(c, HAZE, FOG[ROW[i]]), ...p]), -25, 62, 1.5, 1.5);
}

// draw the mark into a square of side s at (x0, y0); round: corner radius as a fraction of s;
// safe: shrink the bird into the middle 80% so Android's maskable crop keeps the wingtips
export function drawLogo(x, s, { x0 = 0, y0 = 0, round = 0, safe = false } = {}) {
  x.save(); x.translate(x0, y0); x.scale(s / 100, s / 100);
  x.beginPath(); round ? x.roundRect(0, 0, 100, 100, round * 100) : x.rect(0, 0, 100, 100); x.clip();
  back(x);
  if (safe) { x.translate(50, CY); x.scale(.8, .8); x.translate(-50, -CY); }
  facets(x, hawk(s >= 40), 50 - 50 * K, CY - 25 * KY, K, KY);
  x.restore();
}
