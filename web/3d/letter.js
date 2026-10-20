// The menu's look: the sheet is a letter on handmade paper, with a torn edge, a berry margin rule
// beside the page, a wide stroke of watercolour behind the open section and a wax seal by Resume.
// Painted onto a canvas behind the card when the menu opens or changes section (the game is
// paused then, so it costs nothing while flying). All the look lives here and in the .letter3
// rules of 3d.css, so a different art style can swap this one file.
import { handmadeTex, pathPts, deckle, wobbly, inkLine, brush } from './paper.js';
import { drawSeal } from './seal.js';

const BERRY = [168, 72, 58];
// each section's pigment, for its brush stroke (other tabs get stone)
export const TABPIG = { play: [79, 127, 166], journal: [184, 134, 47], songs: [168, 72, 58], how: [111, 138, 74], gfx: [138, 122, 106] };
const M = 24;   // the canvas reaches this far past the card on every side, for the shadow and the torn edge

export function letter(card) {
  const bg = document.createElement('canvas');
  bg.className = 'sheet3'; card.classList.add('letter3'); card.prepend(bg);
  let raf = 0, texKey = '', tex = null;
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => requestAnimationFrame(paint)); };
  addEventListener('resize', soon);
  document.fonts?.ready.then(soon);

  function paint() {
    if (card.closest('.hidden')) return;
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
    // two faint blots of pigment soaked into opposite corners
    x.save(); pathPts(x, sheet); x.clip(); x.globalCompositeOperation = 'multiply';
    for (const [bx, by, rx, ry, col] of [[M + w * .1, M, w * .6, h * .3, '156,192,219'], [M + w, M + h, w * .45, h * .25, '201,151,60']]) {
      const g = x.createRadialGradient(bx, by, 0, bx, by, rx); g.addColorStop(0, `rgba(${col},.32)`); g.addColorStop(1, `rgba(${col},0)`);
      x.save(); x.translate(bx, by); x.scale(1, ry / rx); x.translate(-bx, -by); x.fillStyle = g; x.fillRect(bx - rx, by - rx, rx * 2, rx * 2); x.restore();
    }
    x.restore();
    // a margin rule in berry, as on writing paper (only when the sections sit beside the page)
    const panes = at(card.querySelector('.panes3'));
    if (panes.x > M + 60) inkLine(x, wobbly(panes.x - 16, M + 8, panes.x - 16, M + h - 8, 24, .4), .38, .9, BERRY);
    // the open section: one wide stroke of its pigment laid behind the word
    const on = card.querySelector('.tabs3 .on');
    if (on) {
      const o = at(on), rg = document.createRange(); rg.selectNodeContents(on);
      const t = rg.getBoundingClientRect(), tw = Math.min(t.width, o.w);
      brush(x, o.x - 12, t.top - r.top + M + t.height * .56, tw + 30, Math.min(34, t.height * 1.1), TABPIG[on.dataset.tab] || [138, 122, 106], on.dataset.tab.length);
    }
    // Aloft's wax seal beside the Resume label
    const f = at(card.querySelector('.resume3'));
    drawSeal(x, f.x + 28, f.y + f.h / 2, 23);
  }
  return soon;
}
