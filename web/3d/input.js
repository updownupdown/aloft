// Two thumbs are the two wings. Each half of the screen is a floating stick that starts where
// the thumb lands. Read together:
//   both up / both down          climb / dive (pitch)
//   one up, the other down       bank toward the lower wing
//   thumbs slide together        tuck the wings: a fast stoop
//   thumbs slide apart           spread and flare: slow, hover, land
//   tap both at once             a full flap; one thumb alone flaps one wing (a weak flap and a nudge)
// A single held thumb works as a small stick on its own (up/down pitch, left/right bank).
// Keyboard for desktop: W/S or Up/Down pitch, A/D or Left/Right bank, Shift or Q tuck,
// E flare, Space flap.

const TAP_TIME = .3, TAP_MOVE = .06, PAIR = .2;

export function createInput(el) {
  const I = { L: pad(), R: pad(), keys: new Set(), taps: [], invert: false, onAny: null, radius: 70 };
  function pad() { return { id: null, x0: 0, y0: 0, x: 0, y: 0, t0: 0, moved: 0, dx: 0, dy: 0 }; }
  const size = () => Math.min(innerWidth, innerHeight);
  el.addEventListener('touchstart', e => {
    e.preventDefault(); I.onAny?.();
    for (const t of e.changedTouches) {
      const P = t.clientX < innerWidth / 2 ? I.L : I.R;
      if (P.id !== null) continue;
      Object.assign(P, { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() / 1000, moved: 0, dx: 0, dy: 0 });
    }
  }, { passive: false });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) for (const P of [I.L, I.R]) if (P.id === t.identifier) {
      P.x = t.clientX; P.y = t.clientY;
      P.moved = Math.max(P.moved, Math.hypot(P.x - P.x0, P.y - P.y0));
    }
  }, { passive: false });
  const end = e => {
    I.onAny?.();   // touchend is what lets a page start sound
    for (const t of e.changedTouches) for (const [side, P] of [[-1, I.L], [1, I.R]]) if (P.id === t.identifier) {
      const now = performance.now() / 1000;
      if (now - P.t0 < TAP_TIME && P.moved < TAP_MOVE * size()) I.taps.push({ side, t: P.t0, y: P.y0 / innerHeight });
      P.id = null; P.dx = P.dy = 0;
    }
  };
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  addEventListener('keydown', e => {
    I.onAny?.();
    if (e.code === 'Space' && !e.repeat) I.taps.push({ side: 0, t: performance.now() / 1000 - 1 });
    I.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => I.keys.delete(e.code));
  addEventListener('blur', () => I.keys.clear());

  // what the wings are asking for this frame: { pitch, roll, spread, flap, held }
  I.read = () => {
    const r = I.radius = size() * .13;
    for (const P of [I.L, I.R]) if (P.id !== null) {
      P.dx = clampU((P.x - P.x0) / r); P.dy = clampU((P.y - P.y0) / r);
    }
    const L = I.L, R = I.R, l = L.id !== null, rr = R.id !== null;
    let pitch = 0, roll = 0, spread = 0;
    const k = I.invert ? -1 : 1;
    if (l && rr) {
      pitch = -(L.dy + R.dy) / 2 * k;
      roll = (R.dy - L.dy) / 2;
      spread = (R.dx - L.dx) / 2;
    } else if (l || rr) {
      const P = l ? L : R; pitch = -P.dy * k; roll = P.dx;
    }
    const K = I.keys, key = (...c) => c.some(x => K.has(x));
    if (key('KeyW', 'ArrowUp')) pitch = 1 * k; if (key('KeyS', 'ArrowDown')) pitch = -1 * k;
    if (key('KeyA', 'ArrowLeft')) roll = -1; if (key('KeyD', 'ArrowRight')) roll = 1;
    if (key('ShiftLeft', 'ShiftRight', 'KeyQ')) spread = -1; if (key('KeyE')) spread = 1;
    // taps: two thumbs within PAIR of each other are one full flap
    let flap = null; const now = performance.now() / 1000;
    I.taps.sort((a, b) => a.t - b.t);
    while (I.taps.length) {
      const a = I.taps[0];
      if (a.side === 0) { I.taps.shift(); flap = { q: 1, side: 0 }; break; }
      const b = I.taps.find(t => t !== a && t.side !== a.side && Math.abs(t.t - a.t) < PAIR);
      if (b) { I.taps.splice(I.taps.indexOf(b), 1); I.taps.shift(); flap = { q: 1, side: 0 }; break; }
      if (now - a.t > PAIR + TAP_TIME) { I.taps.shift(); flap = { q: .55, side: a.side }; break; }
      break;
    }
    return { pitch: clampU(pitch), roll: clampU(roll), spread: clampU(spread), flap, held: l || rr || K.size > 0, both: l && rr };
  };
  return I;
}
const clampU = v => (v < -1 ? -1 : v > 1 ? 1 : v);
