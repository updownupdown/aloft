// Postcards: arriving at a landmark puts a postcard in the album, the view of that moment
// framed with a white border on a card of handmade paper, with a handwritten greeting and the
// date. Made once from the finished frame, so it costs nothing while flying.
import { handmadeTex } from './paint.js';

const W = 400, H = 250;
let tex = null;

// at: where the landmark is on the canvas, in canvas pixels, to frame the picture around it
export function postcard(canvas, name, date, at) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W, H);
  // the photo, a little tilted, in a white border with a soft shadow
  // a 2:1 slice of the frame with the landmark in it, whatever shape the screen is
  const pw = 300, ph = 150, py = 18, cw = canvas.width, ch = canvas.height;
  const sw = Math.min(cw, ch * 2), sh = sw / 2;
  const sx = Math.max(0, Math.min(cw - sw, at[0] - sw / 2)), sy = Math.max(0, Math.min(ch - sh, at[1] - sh * .6));
  x.save(); x.translate(W / 2, py + ph / 2 + 6); x.rotate(-.025);
  x.shadowColor = 'rgba(40,25,12,.35)'; x.shadowBlur = 8; x.shadowOffsetY = 3;
  x.fillStyle = '#fbf8f0'; x.fillRect(-pw / 2 - 8, -ph / 2 - 8, pw + 16, ph + 16);
  x.shadowColor = 'transparent';
  x.drawImage(canvas, sx, sy, sw, sh, -pw / 2, -ph / 2, pw, ph);
  x.restore();
  // the paper's grain over everything, so the picture sits in the card rather than on it
  tex ||= handmadeTex(W, H, .6);
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .55; x.drawImage(tex, 0, 0); x.restore();
  // the greeting, in ink, and the date
  const ty = py + ph + 44;
  x.fillStyle = '#2b1a10'; x.textAlign = 'center';
  x.font = 'italic 600 26px "Cormorant Garamond", Georgia, serif';
  x.fillText(`Greetings from ${name}`, W / 2, ty, W - 30);
  x.fillStyle = '#5a3a26'; x.font = 'italic 14px Spectral, Georgia, serif';
  x.fillText(date, W / 2, ty + 22, W - 30);
  return c.toDataURL('image/jpeg', .72);
}
