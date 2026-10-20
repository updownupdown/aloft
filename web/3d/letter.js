// The menu's look, in low poly like the world: the sheet is a flat card with its corners cut,
// broken into faint triangular facets lit from the upper left, with a crisp berry margin rule
// beside the page, a faceted ribbon of pigment behind the open section and a cut-gem wax seal by
// Resume. Painted onto a canvas behind the card when the menu opens or changes section (the game
// is paused then, so it costs nothing while flying). The look lives here and in the .letter3
// rules of 3d.css.
import { PIG, C, shade, poly, facets, chamfer, hardShadow } from './facet.js';
import { drawSeal } from './seal.js';

// each section's pigment, for its ribbon (other tabs get rock)
export const TABPIG = { play: PIG.water, journal: PIG.ring, songs: PIG.berry, how: PIG.meadow, gfx: PIG.rock };
const M = 24;   // the canvas reaches this far past the card on every side, for the shadow

export function letter(card) {
  const bg = document.createElement('canvas');
  bg.className = 'sheet3'; card.classList.add('letter3'); card.prepend(bg);
  let raf = 0;
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => requestAnimationFrame(paint)); };
  addEventListener('resize', soon);
  document.fonts?.ready.then(soon);

  function paint() {
    if (card.closest('.hidden')) return;
    const r = card.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round((r.width + M * 2) * dpr), ch = Math.round((r.height + M * 2) * dpr);
    if (bg.width !== cw || bg.height !== ch) { bg.width = cw; bg.height = ch; }
    const x = bg.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const at = el => { const b = el.getBoundingClientRect(); return { x: b.left - r.left + M, y: b.top - r.top + M, w: b.width, h: b.height }; };
    const w = r.width, h = r.height;

    // the sheet: a hard shadow, then the card in faint facets, a little warmer toward the lower right
    const sheet = chamfer(M, M, w, h, 14);
    hardShadow(x, sheet, 6, 8, .28);
    x.save(); poly(x, sheet); x.clip();
    facets(x, M, M, w, h, 64, cx => { const t = (cx - M) / w; return [PIG.paper[0] - t * 6, PIG.paper[1] - t * 9, PIG.paper[2] - t * 16]; }, { seed: 21, relief: .35 });
    x.restore();
    // a crisp margin rule in berry (only when the sections sit beside the page)
    const panes = at(card.querySelector('.panes3'));
    if (panes.x > M + 60) { x.fillStyle = C(PIG.berry, .55); x.fillRect(panes.x - 17, M + 14, 1.5, h - 28); }
    // the open section: a ribbon of its pigment behind the word, folded into two facets
    const on = card.querySelector('.tabs3 .on');
    if (on) {
      const o = at(on), rg = document.createRange(); rg.selectNodeContents(on);
      const t = rg.getBoundingClientRect(), tw = Math.min(t.width, o.w), cy = t.top - r.top + M + t.height * .55, hh = Math.min(15, t.height * .5);
      const x0 = o.x - 12, x1 = x0 + tw + 30, col = TABPIG[on.dataset.tab] || PIG.rock;
      const A = [x0 + 6, cy - hh], B = [x1, cy - hh + 3], Cc = [x1 - 8, cy + hh], D = [x0, cy + hh - 2], mid = [x0 + (x1 - x0) * .55, cy - hh + 1.6], mid2 = [x0 + (x1 - x0) * .5, cy + hh - .6];
      poly(x, [A, mid, mid2, D], C(col, .42));
      poly(x, [mid, B, Cc, mid2], C(shade(col, .85), .42));
    }
    // Aloft's wax seal beside the Resume label
    const f = at(card.querySelector('.resume3'));
    drawSeal(x, f.x + 28, f.y + f.h / 2, 23);
  }
  return soon;
}
