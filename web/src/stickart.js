// How the joysticks look: painted once per size into two canvases (the pool and the knob).
// ACTIONS says which gesture each direction of a stick belongs to, for marks round its rim:
// angles in degrees on screen (0 right, 90 up). Inward (toward the middle) is right for the left
// stick and left for the right one; the gestures themselves are read in controls.js.
import { wash, circP, ellP } from './paint.js';

export const ACTIONS = {
  L: { 90: 'glide', 270: 'land', 0: 'perch', 180: 'hang', 45: 'thermal', 315: 'prey', 225: 'stoop', 135: 'call' },
  R: { 90: 'glide', 270: 'land', 180: 'perch', 0: 'hang', 135: 'thermal', 225: 'prey', 315: 'stoop', 45: 'call' },
};

const POOL = [104, 132, 168], RIM = [74, 92, 122], KNOB = [58, 76, 112], INK = [58, 36, 24];

export function paintStick(base, knob, px, side = 'L') {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  for (const [cv, d] of [[base, px], [knob, Math.round(px * .46)]]) { cv.width = cv.height = Math.round(d * dpr); cv.style.width = cv.style.height = d + 'px'; }
  let x = base.getContext('2d'), r = px / 2;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, px, px);
  // a pale pool, darker where the pigment dried at its edge, and four faint ticks for the ways it leans
  wash(x, circP(r, r, r * .9, 22), POOL, .16, { passes: 3, amp: r * .035, seed: 3, rim: .7, rimW: 1.4 });
  wash(x, circP(r, r, r * .5, 16), POOL, .07, { passes: 2, amp: r * .03, seed: 8, rim: .3 });
  x.strokeStyle = `rgba(${INK},.28)`; x.lineWidth = 1; x.lineCap = 'round'; x.beginPath();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); x.moveTo(r + c * r * .66, r + s * r * .66); x.lineTo(r + c * r * .78, r + s * r * .78); }
  x.stroke();
  const k = Math.round(px * .46); r = k / 2;
  x = knob.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, k, k);
  wash(x, circP(r, r, r * .86, 16), KNOB, .42, { passes: 3, amp: r * .05, seed: 21, rim: .6, rimW: 1.2 });
  wash(x, ellP(r - r * .22, r - r * .26, r * .3, r * .2, -.6, 10), RIM, .25, { passes: 1, amp: r * .03, seed: 5, rim: 0 });
}

