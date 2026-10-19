// The pause menu as a letter: a deckled sheet of handmade paper folded in thirds, a berry margin
// rule, an ink underline under the open section and a wax seal to resume. Painted with the game's
// own wash() onto a canvas behind the card each time the menu opens or changes section; the game
// is paused then, so none of this costs anything while flying.
import { wash, jit, pathPts, circP, handmadeTex } from './paint.js';
import { C, TAU } from './util.js';

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
    // folded in thirds
    crease(x, M + 4, M + h / 3, M + w - 4, M + h / 3 + 1); crease(x, M + 4, M + h * 2 / 3, M + w - 4, M + h * 2 / 3 - 1);
    // a margin rule in berry, as on writing paper (only when the sections sit beside the page)
    const panes = at(menu.querySelector('.panes'));
    if (panes.x > M + 60) inkLine(x, wobbly(panes.x - 16, M + 8, panes.x - 16, M + h - 8, 24, .4), .38, .9, BERRY);
    // the open section: an ink underline under its word and a dot of its pigment
    const on = menu.querySelector('.tabs .on');
    if (on) {
      const o = at(on), rg = document.createRange(); rg.selectNodeContents(on);
      const tw = Math.min(rg.getBoundingClientRect().width, o.w);
      inkLine(x, wobbly(o.x, o.y + o.h - 6, o.x + tw + 4, o.y + o.h - 7, 14, .9), .7, 1.4);
      wash(x, circP(o.x - 12, o.y + o.h / 2, 4.5, 10), TABPIG[on.dataset.tab] || INK, .9, { amp: .7, seed: 3, rim: .5 });
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
// a fold: a faint shadow line with the paper's lit edge just beside it
function crease(x, x0, y0, x1, y1) {
  x.save(); x.lineWidth = 1;
  x.strokeStyle = 'rgba(60,40,20,.10)'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
  x.strokeStyle = 'rgba(255,253,246,.55)'; x.beginPath(); x.moveTo(x0, y0 + 1.2); x.lineTo(x1, y1 + 1.2); x.stroke();
  x.restore();
}
// a wax seal beside the Resume label, with a feather pressed into it
function seal(x, f) {
  const cx = f.x + 28, cy = f.y + f.h / 2, r = 22, blob = [];
  seedR(9); for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, k = r * (1 + (rnd() < .2 ? .14 : .04) * rnd()); blob.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
  x.save(); x.shadowColor = 'rgba(60,20,10,.35)'; x.shadowBlur = 4; x.shadowOffsetY = 2; x.fillStyle = 'rgb(176,70,52)'; pathPts(x, blob); x.fill(); x.restore();
  wash(x, blob, [150, 45, 35], .75, { amp: 1, seed: 2, rim: .8 });
  x.save(); x.strokeStyle = 'rgba(255,190,170,.35)'; x.lineWidth = 1.4; x.beginPath(); x.arc(cx - .6, cy - .6, r * .66, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(90,20,14,.45)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx + .6, cy + .6, r * .66, 0, TAU); x.stroke();
  // the feather: a quill and barbs, lit on one side and shadowed on the other
  for (const [col, o] of [['rgba(255,200,180,.45)', -.6], ['rgba(80,18,12,.55)', .6]]) {
    x.strokeStyle = col; x.lineWidth = 1.1; x.beginPath(); x.moveTo(cx - 8 + o, cy + 9 + o); x.quadraticCurveTo(cx + o, cy + o, cx + 7 + o, cy - 10 + o); x.stroke();
    x.lineWidth = .8; x.beginPath();
    for (let i = 1; i < 6; i++) { const t = i / 6, px = cx - 8 + 15 * t + o, py = cy + 9 - 19 * t + o; x.moveTo(px, py); x.lineTo(px - 5, py - 2.5); x.moveTo(px, py); x.lineTo(px + 3.5, py + 3.5); }
    x.stroke();
  }
  x.restore();
}
