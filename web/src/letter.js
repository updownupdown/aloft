// The pause menu as a letter: a deckled sheet of handmade paper, a berry margin rule, a wide
// stroke of watercolour behind the open section and a wax seal to resume. Painted with the game's
// own wash() onto a canvas behind the card each time the menu opens or changes section; the game
// is paused then, so none of this costs anything while flying.
import { wash, jit, pathPts, handmadeTex } from './paint.js';
import { C } from './util.js';
import { drawSeal } from './seal.js';

const INK = [58, 36, 24], BERRY = [168, 72, 58];
const TABPIG = { play: [79, 127, 166], journal: [184, 134, 47], songs: [168, 72, 58], help: [111, 138, 74], gfx: [138, 122, 106] };
const M = 24;   // the canvas reaches this far past the card on every side, for the shadow and the torn edge

let rs = 1;
const seedR = s => { rs = s * 7919 + 13; };
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

export function letter(menu) {
  const card = menu.querySelector('.card'), bg = document.createElement('canvas');
  bg.className = 'card-bg'; card.classList.add('letter'); card.prepend(bg);
  let raf = 0, texKey = '', tex = null;
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => requestAnimationFrame(paint)); };
  new MutationObserver(soon).observe(menu, { attributes: true, attributeFilter: ['class'] });
  menu.addEventListener('click', e => { if (e.target.closest('[data-tab]')) soon(); });
  addEventListener('resize', soon);
  document.fonts?.ready.then(soon);

  function paint() {
    if (menu.classList.contains('hidden')) return;
    const r = card.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round((r.width + M * 2) * dpr), ch = Math.round((r.height + M * 2) * dpr);
    if (bg.width !== cw || bg.height !== ch) { bg.width = cw; bg.height = ch; }
    if (texKey !== cw + 'x' + ch) { tex = handmadeTex(cw, ch, dpr); texKey = cw + 'x' + ch; }
    const x = bg.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const at = el => { const b = el.getBoundingClientRect(); return { x: b.left - r.left + M, y: b.top - r.top + M, w: b.width, h: b.height }; };
    const w = r.width, h = r.height;

    // the sheet, its shadow and the paper's texture
    const sheet = deckle(M, M, w, h, 1.8, 21, -.004);
    x.save(); x.shadowColor = 'rgba(30,18,10,.38)'; x.shadowBlur = 22; x.shadowOffsetY = 7;
    x.fillStyle = 'rgb(245,237,220)'; pathPts(x, sheet); x.fill(); x.restore();
    x.save(); pathPts(x, sheet); x.clip(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .95;
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(tex, 0, 0); x.restore();
    // a margin rule in berry, as on writing paper (only when the sections sit beside the page)
    const panes = at(menu.querySelector('.panes'));
    if (panes.x > M + 60) inkLine(x, wobbly(panes.x - 16, M + 8, panes.x - 16, M + h - 8, 24, .4), .38, .9, BERRY);
    // the open section: one wide stroke of its pigment laid behind the word
    const on = menu.querySelector('.tabs .on');
    if (on) {
      const o = at(on), rg = document.createRange(); rg.selectNodeContents(on);
      const t = rg.getBoundingClientRect(), tw = Math.min(t.width, o.w);
      brush(x, o.x - 12, t.top - r.top + M + t.height * .56, tw + 30, Math.min(34, t.height * 1.1), TABPIG[on.dataset.tab] || INK, on.dataset.tab.length);
    }
    seal(x, at(menu.querySelector('.card-foot .primary')));
  }
}

// a rectangle's outline with a torn, fibrous edge (amp) that wanders slowly
function deckle(x0, y0, w, h, amp, seed, rot = 0) {
  seedR(seed); const pts = [], step = 3;
  let d = 0;
  const edge = (ax, ay, bx, by, nx, ny) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
    for (let i = 0; i < n; i++) {
      const t = i / n; d += (rnd() - .5) * amp * .5; d *= .92;
      const j = d + (rnd() - .5) * amp;
      pts.push([ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j]);
    }
  };
  edge(x0, y0, x0 + w, y0, 0, -1); edge(x0 + w, y0, x0 + w, y0 + h, 1, 0); edge(x0 + w, y0 + h, x0, y0 + h, 0, 1); edge(x0, y0 + h, x0, y0, -1, 0);
  const cx = x0 + w / 2, cy = y0 + h / 2, c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([px, py]) => [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c]);
}
function wobbly(x0, y0, x1, y1, n, amp) { seedR(x0 + y0); const p = []; for (let i = 0; i <= n; i++) p.push([x0 + (x1 - x0) * i / n + (rnd() - .5) * amp, y0 + (y1 - y0) * i / n + (rnd() - .5) * amp]); return p; }
function inkLine(x, pts, a, w, col = INK) {
  x.save(); x.globalCompositeOperation = 'multiply'; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let k = 0; k < 2; k++) { x.strokeStyle = C(col, a * (k ? .5 : .85)); x.lineWidth = w * (k ? .6 : 1); pathPts(x, jit(pts, w * .5, 3 + k, k), false); x.stroke(); }
  x.restore();
}
// a flat brush pulled once from left to right: square where it lands, full through the middle,
// breaking into bristle marks where it lifts off; washed in a few passes with a soft dried rim and
// dry streaks where the bristles ran out of paint
function brush(x, x0, cy, len, hgt, col, seed) {
  seedR(seed + 40); const top = [], bot = [], n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = x0 + len * t;
    const body = Math.min(1, t * 9, (1 - t) * 3.2) ** .45 * (1 - t * .15);
    const sag = (t - .5) * hgt * .1;   // the stroke drifts a little uphill, as a hand does
    const fray = t > .72 ? (rnd() - .3) * hgt * .22 * (t - .72) / .28 : 0;   // bristles parting at the end
    top.push([px + (rnd() - .5) * 2, cy - sag - hgt / 2 * body + (rnd() - .5) * hgt * .07 + fray]);
    bot.push([px + (rnd() - .5) * 2, cy - sag + hgt / 2 * body + (rnd() - .5) * hgt * .07 - fray]);
  }
  const band = [...top, ...bot.reverse()];
  wash(x, band, col, .3, { passes: 3, amp: hgt * .05, seed, rim: .22, rimW: 1.2 });
  // a second, thinner load of paint through the middle of the stroke
  const core = band.map(([px, py]) => [px, cy - (px - x0 - len / 2) / len * hgt * .1 + (py - cy) * .55]);
  wash(x, core, col, .14, { passes: 2, amp: hgt * .06, seed: seed + 1, rim: 0 });
  x.save(); x.globalCompositeOperation = 'multiply'; x.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const off = (rnd() - .5) * hgt * .75, s0 = x0 + len * (.15 + rnd() * .45), e0 = x0 + len * (.82 + rnd() * .2);
    const y = t => cy + off - ((t - x0) / len - .5) * hgt * .1;
    x.strokeStyle = C(col, .13 + rnd() * .08); x.lineWidth = .7 + rnd() * 1.3;
    x.beginPath(); x.moveTo(s0, y(s0)); x.lineTo(e0, y(e0)); x.stroke();
  }
  x.restore();
}
// Aloft's wax seal beside the Resume label
function seal(x, f) { drawSeal(x, f.x + 28, f.y + f.h / 2, 23); }
