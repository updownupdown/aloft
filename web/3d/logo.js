// Aloft's mark (C, James's pick 2026-10-24): a low-poly pine shaped like an A, with a red-tail soaring
// across it as the crossbar, over a strip of faceted hills under a faceted sky. Drawn on a 2D canvas
// at any size: the app icons (tools/icon.html), the splash and the logo by the menu's title.
// Each facet is [colour, x0, y0, x1, y1, ...] in a 100x100 box.
const SKY = [
  ['#8db6d8', 0, 0, 100, 0, 0, 60], ['#a6c8e1', 100, 0, 100, 80, 0, 60], ['#c6dae5', 0, 60, 100, 80, 0, 82],
];
// hills in a 100x40 box, drawn 120 wide from (-10, 79)
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
// the hawk from below in a 100x60 box
const HAWK = [
  ['#4a3628', 50, 8, 45, 16, 55, 16], ['#5b4433', 45, 16, 30, 14, 6, 20], ['#3e2c20', 45, 16, 6, 20, 14, 27],
  ['#30221a', 45, 16, 14, 27, 43, 28], ['#4a3628', 55, 16, 70, 14, 94, 20], ['#33251b', 55, 16, 94, 20, 86, 27],
  ['#271b14', 55, 16, 86, 27, 57, 28], ['#3a2a20', 45, 16, 55, 16, 50, 34], ['#2e2118', 45, 16, 43, 28, 50, 34],
  ['#251a13', 55, 16, 57, 28, 50, 34], ['#b8552f', 47, 31, 53, 31, 56, 44], ['#963f22', 47, 31, 56, 44, 44, 44],
];
// the pine as an A: three tiers, lit side left, shade right; COUNTER is the A's opening at its foot
const PINE = [];
{
  const sh = (hex, k) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');
  const AX = 50, AY = 6, BASE = 91, HALF = 40, LIT = '#6f9152', SHADE = '#4e6e3a';
  for (let i = 2; i >= 0; i--) {
    const top = AY + (BASE - AY) * i / 3 * .72, bot = AY + (BASE - AY) * (i + 1) / 3, w = HALF * (i + 1) / 3;
    const lip = bot - 5, cw = w * .8, k = 1 + i * .05;
    PINE.push([sh(LIT, k), AX, top, AX, lip, AX - cw, lip], [sh(LIT, k * .9), AX - cw, lip, AX, lip, AX - w, bot],
      [sh(SHADE, k), AX, top, AX + cw, lip, AX, lip], [sh(SHADE, k * .88), AX, lip, AX + cw, lip, AX + w, bot]);
  }
}
const COUNTER = [50, 59, 32, 92, 68, 92];

function facets(x, list, ox, oy, sx, sy) {
  for (const [col, ...p] of list) {
    x.beginPath();
    for (let i = 0; i < p.length; i += 2) x.lineTo(ox + p[i] * sx, oy + p[i + 1] * sy);
    x.closePath(); x.fillStyle = x.strokeStyle = col; x.fill(); x.lineWidth = .25; x.stroke(); // stroke hides seams
  }
}
function back(x) {
  x.fillStyle = SKY[2][0]; x.fillRect(0, 0, 100, 100);
  facets(x, SKY, 0, 0, 1, 1);
  x.fillStyle = '#86a564'; x.fillRect(0, 94, 100, 6); // under the hills' far edges
  facets(x, HILLS, -10, 79, 1.2, 1.2);
}

// draw the mark into a square of side s at (x0, y0); round: corner radius as a fraction of s;
// safe: shrink the tree and hawk into the middle 80% so Android's maskable crop keeps the wingtips
export function drawLogo(x, s, { x0 = 0, y0 = 0, round = 0, safe = false } = {}) {
  x.save(); x.translate(x0, y0); x.scale(s / 100, s / 100);
  x.beginPath(); round ? x.roundRect(0, 0, 100, 100, round * 100) : x.rect(0, 0, 100, 100); x.clip();
  back(x);
  const k = safe ? .8 : 1, o = 50 * (1 - k);
  x.translate(o, o + (safe ? 4 : 0)); x.scale(k, k);
  facets(x, PINE, 0, 0, 1, 1);
  x.save(); x.beginPath(); for (let i = 0; i < COUNTER.length; i += 2) x.lineTo(COUNTER[i], COUNTER[i + 1]); x.closePath(); x.clip();
  x.setTransform(1, 0, 0, 1, 0, 0); x.translate(x0, y0); x.scale(s / 100, s / 100); back(x); // the sky and hills show through the opening
  x.restore();
  facets(x, HAWK, 50 - 46 * .925, 37, .925, .775); // the crossbar, a quarter larger than the first sketch
  x.restore();
}
