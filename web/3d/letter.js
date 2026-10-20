// The menu's frame: a sheet of frosted glass over the paused world (the look is the .glass3 rules
// in 3d.css), with Aloft's mark beside the title. The menu calls the function this returns
// whenever its layout changes; glass needs no painting.
import { drawLogo } from './logo.js';

export function letter(card) {
  card.classList.add('glass3');
  const h1 = card.querySelector('h1'), cv = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.className = 'logo3'; cv.width = cv.height = Math.round(30 * dpr); cv.setAttribute('aria-hidden', 'true');
  drawLogo(cv.getContext('2d'), cv.width, { round: .24 });
  h1?.prepend(cv);
  return () => {};
}
