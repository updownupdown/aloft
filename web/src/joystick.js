// One watercolour joystick in a bottom corner, only while flying, for small changes to the
// line the hawk flies: up noses up toward a hover, forward flattens into a long glide, down
// dives (far down stoops), back slows on back-beats without turning. Everything else is drawn
// or tapped on the screen (gestures.js). The stick measures from where the thumb lands, so it
// never has to find the centre. The art is painted once into canvases, two bases (one for each
// way the hawk faces, since forward and back swap), so the stick costs nothing per frame.
import { wash, circP, ellP } from './paint.js';

const POOL = [104, 132, 168], KNOB = [58, 76, 112], RIM = [74, 92, 122], INK = [58, 36, 24];
const DEAD = .12;

function paintBase(cv, px, face) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(px * dpr); cv.style.width = cv.style.height = px + 'px';
  const x = cv.getContext('2d'), r = px / 2, s = r * .17, ring = r * .7;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, px, px);
  wash(x, circP(r, r, r * .94, 24), POOL, .2, { passes: 3, amp: r * .035, seed: 3, rim: .8, rimW: 1.5 });
  wash(x, circP(r, r, r * .5, 16), POOL, .07, { passes: 2, amp: r * .03, seed: 8, rim: .3 });
  const ink = (w, a = .75) => { x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = `rgba(${INK},${a})`; x.lineWidth = w; x.stroke(); };
  const at = (ang, f) => { const a = ang * Math.PI / 180; x.save(); x.translate(r + Math.cos(a) * ring, r - Math.sin(a) * ring); f(); x.restore(); };
  // up: hover, wings raised over a held body
  at(90, () => { x.beginPath(); x.moveTo(-s * 1.05, -s * .5); x.quadraticCurveTo(-s * .5, s * .2, 0, s * .2); x.quadraticCurveTo(s * .5, s * .2, s * 1.05, -s * .5); x.moveTo(0, s * .35); x.lineTo(0, s * .9); ink(1.5); });
  // down: dive, a tucked shape with speed lines
  at(-90, () => { x.beginPath(); x.moveTo(-s * .5, -s * .8); x.lineTo(s * .1, s * .7); x.lineTo(s * .55, -s * .3); ink(1.5); x.beginPath(); x.moveTo(-s * .95, -s * .2); x.lineTo(-s * .6, s * .45); ink(1, .45); });
  // forward: a long flat glide arrow; back: two soft back-beats
  at(face > 0 ? 0 : 180, () => { x.scale(face, 1); x.beginPath(); x.moveTo(-s * .9, 0); x.lineTo(s * .9, 0); x.moveTo(s * .4, -s * .45); x.lineTo(s * .9, 0); x.lineTo(s * .4, s * .45); ink(1.5); });
  at(face > 0 ? 180 : 0, () => { x.scale(face, 1); x.beginPath(); x.moveTo(s * .1, -s * .7); x.quadraticCurveTo(-s * .5, 0, s * .1, s * .7); x.moveTo(s * .6, -s * .7); x.quadraticCurveTo(0, 0, s * .6, s * .7); ink(1.4); });
}
function paintKnob(cv, k) {
  const dpr = Math.min(devicePixelRatio || 1, 2), r = k / 2;
  cv.width = cv.height = Math.round(k * dpr); cv.style.width = cv.style.height = k + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  wash(x, circP(r, r, r * .86, 16), KNOB, .55, { passes: 3, amp: r * .05, seed: 21, rim: .7, rimW: 1.3 });
  wash(x, ellP(r - r * .22, r - r * .26, r * .3, r * .2, -.6, 10), RIM, .2, { passes: 1, amp: r * .03, seed: 5, rim: 0 });
}

export function createJoystick() {
  const el = document.createElement('div'); el.className = 'joy hidden';
  const bases = [document.createElement('canvas'), document.createElement('canvas')], knob = document.createElement('canvas');
  bases.forEach(c => c.className = 'base'); knob.className = 'knob';
  el.append(...bases, knob); document.getElementById('ui').append(el);
  const J = { px: 0, side: 'L', face: 1, shown: false, f: null, v: null };

  function place() {
    const d = Math.round(Math.max(104, Math.min(148, Math.min(innerWidth, innerHeight) * .29)));
    if (d !== J.px) { J.px = d; paintBase(bases[0], d, 1); paintBase(bases[1], d, -1); paintKnob(knob, Math.round(d * .42)); }
    el.style.width = el.style.height = d + 'px'; knob.style.left = knob.style.top = `${(d - Math.round(d * .42)) / 2}px`;
    el.style.left = J.side === 'L' ? '6px' : `${innerWidth - 6 - d}px`; el.style.top = `${innerHeight - 30 - d}px`;
    bases[0].hidden = J.face < 0; bases[1].hidden = J.face > 0;
  }
  const knobAt = (x, y) => { const m = J.px * .29; knob.style.transform = `translate(${x * m}px, ${y * m}px)`; };
  function release() { J.f = null; J.v = null; knobAt(0, 0); }

  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); el.setPointerCapture?.(e.pointerId);
    J.f = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
  });
  el.addEventListener('pointermove', e => {
    const f = J.f; if (f?.id !== e.pointerId) return;
    let x = (e.clientX - f.x0) / (J.px * .35), y = (e.clientY - f.y0) / (J.px * .35);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    J.v = m < DEAD ? null : { x, y }; knobAt(x, y);
  });
  const up = e => { if (J.f?.id === e.pointerId) release(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', () => J.shown && place());

  return {
    // per frame: shown or not, which corner, which way the hawk faces; returns the aim
    // (x right, y down, each -1 to 1) while a thumb pushes it, else null
    update(shown, side, face) {
      if (shown !== J.shown) { J.shown = shown; el.classList.toggle('hidden', !shown); if (!shown) release(); }
      if (!shown) return null;
      if (side !== J.side || face !== J.face || !J.px) { J.side = side; J.face = face; place(); }
      return J.v;
    },
    get held() { return !!J.f; },
    // the stick's centre on screen (for test scripts)
    centre() { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
