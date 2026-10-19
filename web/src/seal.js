// Aloft's mark: a wax seal. A pool of berry-red wax with a pressed disc in it: a beaded border,
// ALOFT round the top, two sprigs of leaves round the bottom and a red-tail soaring in the middle,
// seen from below. Every impression is cut into the wax and lit from the upper left, so its
// lower-right wall catches the light and its upper-left wall sits in shadow. Small seals leave
// out the finer marks so the hawk stays readable. Drawn on demand (menu, icons), never per frame.
import { wash } from './paint.js';

const TAU = Math.PI * 2;
// a red-tail from below, in a 200-unit box centred on (100, 61): broad wings with slotted
// primaries, a short wide fan of a tail
const HAWK = new Path2D('M100 22 C104 22 106 26 106 31 C118 30 134 26 152 27 C166 28 178 32 186 37 L196 40 L186 43 L197 47 L185 49 L194 54 L182 54 L188 59 L174 58 ' +
  'C160 64 140 70 118 66 L124 88 Q100 102 76 88 L82 66 C60 70 40 64 26 58 L12 59 L18 54 L6 54 L15 49 L3 47 L14 43 L4 40 L14 37 ' +
  'C22 32 34 28 48 27 C66 26 82 30 94 31 C94 26 96 22 100 22 Z');
const WAX = [168, 64, 46], DEEP = [126, 38, 26];

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

// cx, cy, r in the context's units; the wax spreads a little past r
export function drawSeal(x, cx, cy, r, { seed = 9, shadow = true } = {}) {
  const fine = r >= 40, k = Math.max(.6, r / 60);   // k: depth of the impressions
  rs = seed * 7919 + 13;
  // the poured wax: round, with a few lobes where it ran before it set
  const blob = [], lobes = [0, 1, 2].map(() => [rnd() * TAU, .03 + rnd() * .05]), p3 = rnd() * TAU, p5 = rnd() * TAU;
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU;
    let d = 1 + .018 * Math.sin(3 * a + p3) + .012 * Math.sin(5 * a + p5) + (rnd() - .5) * .008;
    for (const [la, lh] of lobes) d += lh * Math.max(0, Math.cos(a - la)) ** 6;
    blob.push([cx + Math.cos(a) * r * d, cy + Math.sin(a) * r * d]);
  }
  const path = () => { x.beginPath(); blob.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); };
  x.save();
  if (shadow) { x.shadowColor = 'rgba(50,14,8,.4)'; x.shadowBlur = r * .14; x.shadowOffsetY = r * .06; }
  const g = x.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r * 1.15);
  g.addColorStop(0, 'rgb(200,98,74)'); g.addColorStop(.45, `rgb(${WAX})`); g.addColorStop(1, `rgb(${DEEP})`);
  x.fillStyle = g; path(); x.fill();
  x.restore();
  // pigment mottling and a darker rim where the wax thinned and set first
  wash(x, blob, [150, 46, 34], .3, { passes: 2, amp: r * .03, seed, rim: .9, rimW: Math.max(1, r * .03) });

  // the pressed disc: a shallow recess with a raised lip
  const R = r * .84;
  x.save(); x.lineWidth = Math.max(1, r * .035);
  ring(x, cx, cy, R, k * 1.4);
  x.fillStyle = 'rgba(96,22,14,.16)'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
  x.restore();

  // a beaded border inside the lip
  if (fine) {
    const n = 44, br = R * .9;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, px = cx + Math.cos(a) * br, py = cy + Math.sin(a) * br;
      raised(x, () => { x.beginPath(); x.arc(px, py, r * .022, 0, TAU); x.fill(); }, k * .7);
    }
    x.save(); x.lineWidth = Math.max(.8, r * .012);
    ring(x, cx, cy, R * .8, k * .6);
    x.restore();
  }

  // ALOFT round the top, in upright serif capitals
  if (fine) {
    const size = r * .25, rad = R * .64;
    x.save(); x.font = `${size}px Spectral, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const word = 'ALOFT', gap = size * .2, ws = [...word].map(c => x.measureText(c).width);
    const tot = (ws.reduce((s, w) => s + w, 0) + gap * (word.length - 1)) / rad;
    let a = -Math.PI / 2 - tot / 2;
    [...word].forEach((c, i) => {
      const am = a + ws[i] / 2 / rad;
      cut(x, () => { x.save(); x.translate(cx + Math.cos(am) * rad, cy + Math.sin(am) * rad); x.rotate(am + Math.PI / 2); x.fillText(c, 0, 0); x.restore(); }, k);
      a += (ws[i] + gap) / rad;
    });
    x.restore();
    // two sprigs of leaves round the bottom, meeting at a berry
    const sr = R * .66;
    for (const s of [1, -1]) {
      const a0 = Math.PI / 2 + s * .14, a1 = Math.PI / 2 + s * 1.0;
      cut(x, () => {
        x.save(); x.lineWidth = r * .018; x.lineCap = 'round'; x.strokeStyle = x.fillStyle;
        x.beginPath(); x.arc(cx, cy, sr, Math.min(a0, a1), Math.max(a0, a1)); x.stroke(); x.restore();
        for (let j = 0; j < 7; j++) {
          const a = a0 + (a1 - a0) * (j + .4) / 7, out = j % 2 ? 1 : -1, len = r * .055 * (1 - j * .06);
          const dir = a + s * Math.PI / 2 - s * out * .65, sx = cx + Math.cos(a) * sr, sy = cy + Math.sin(a) * sr;
          x.beginPath(); x.ellipse(sx + Math.cos(dir) * len, sy + Math.sin(dir) * len, len, len * .38, dir, 0, TAU); x.fill();
        }
      }, k * .8);
    }
    cut(x, () => { x.beginPath(); x.arc(cx, cy + sr, r * .03, 0, TAU); x.fill(); }, k * .8);
  }

  // the hawk, as large as the inner ring allows
  const span = fine ? R * 1.18 : R * 1.75, sc = span / 194, sy = sc;
  const hawk = p => () => { x.save(); x.translate(cx - 100 * sc, cy - 61 * sy + (fine ? -R * .03 : 0)); x.scale(sc, sy); x.fill(p); x.restore(); };
  cut(x, hawk(HAWK), k * 1.2);
}

// a ring cut into the wax: shadow above-left, light below-right
function ring(x, cx, cy, R, d) {
  x.strokeStyle = 'rgba(70,14,8,.55)'; x.beginPath(); x.arc(cx - d * .5, cy - d * .5, R, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(255,196,176,.45)'; x.beginPath(); x.arc(cx + d * .5, cy + d * .5, R, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(110,28,18,.5)'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
}
// an impression pressed into the wax (draw fills the shape with the current fillStyle)
function cut(x, draw, d) {
  x.save(); x.translate(d, d); x.fillStyle = 'rgba(255,200,180,.6)'; draw(); x.restore();
  x.save(); x.translate(-d * .7, -d * .7); x.fillStyle = 'rgba(48,8,4,.85)'; draw(); x.restore();
  x.save(); x.fillStyle = 'rgb(108,28,18)'; draw(); x.restore();
}
// a bead standing proud of the wax: lit above-left, shadowed below-right
function raised(x, draw, d) {
  x.save(); x.translate(d, d); x.fillStyle = 'rgba(70,14,8,.6)'; draw(); x.restore();
  x.save(); x.translate(-d * .6, -d * .6); x.fillStyle = 'rgba(255,200,180,.6)'; draw(); x.restore();
  x.save(); x.fillStyle = `rgb(${WAX})`; draw(); x.restore();
}
