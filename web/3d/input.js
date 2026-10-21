// Two thumbs are the two wings. Each half of the screen is a floating stick that starts where
// the thumb lands. Read together:
//   both up / both down          climb / dive (pitch)
//   one up, the other down       bank toward the lower wing
//   thumbs slide together        tuck the wings: a fast stoop (then slide both left/right to steer it)
//   thumbs slide apart           spread and flare: slow, hover, land
//   both slide left / right      yaw: the tail swings the bird round without much bank
//   tap both at once             a full flap; one thumb alone flaps one wing (a weak flap and a nudge);
//                                the closer together the two taps, the less the flap tires you (sync)
// A single held thumb works as a small stick on its own (up/down pitch, left/right bank).
// Keyboard for desktop: W/S or Up/Down pitch, A/D or Left/Right bank, Shift or Q tuck,
// E flare, Space flap.
// Perched or standing, a drag sideways turns the bird (read as dragX), perched a drag up or down
// tips the view (dragY: down looks up, as if pulling the sky into view), on the ground two fingers
// pinch the view in or out (pinch), and a tap may be taken by
// onTap (a perch ring to hop to) before it counts as a flap. Two fingers dragging together, or
// turning the phone (gyro, while I.gyroOn), look round instead (read as look: [x, y]).

const TAP_TIME = .3, TAP_MOVE = .06, PAIR = .2;

export function createInput(el) {
  const I = { L: pad(), R: pad(), keys: new Set(), taps: [], invert: false, onAny: null, onTap: null, radius: 70, drag: 0, dragY: 0, pinch: 1, lk: [0, 0], gyroOn: false };
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
    const two = I.L.id !== null && I.R.id !== null, gap = () => Math.hypot(I.L.x - I.R.x, I.L.y - I.R.y), g0 = two ? gap() : 0;
    for (const t of e.changedTouches) for (const P of [I.L, I.R]) if (P.id === t.identifier) {
      if (two) { I.lk[0] += (t.clientX - P.x) / 2; I.lk[1] += (t.clientY - P.y) / 2; } else { I.drag += t.clientX - P.x; I.dragY += t.clientY - P.y; }
      P.x = t.clientX; P.y = t.clientY;
      P.moved = Math.max(P.moved, Math.hypot(P.x - P.x0, P.y - P.y0));
    }
    if (two && g0 > 20) I.pinch *= gap() / g0;   // how much the two fingers spread (>1) or closed
  }, { passive: false });
  const end = e => {
    I.onAny?.();   // touchend is what lets a page start sound
    for (const t of e.changedTouches) for (const [side, P] of [[-1, I.L], [1, I.R]]) if (P.id === t.identifier) {
      const now = performance.now() / 1000;
      if (now - P.t0 < TAP_TIME && P.moved < TAP_MOVE * size() && !I.onTap?.(P.x0, P.y0)) I.taps.push({ side, t: P.t0, y: P.y0 / innerHeight });
      P.id = null; P.dx = P.dy = 0;
    }
  };
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  el.addEventListener('click', e => I.onTap?.(e.clientX, e.clientY));   // a mouse (touch clicks are prevented)
  addEventListener('keydown', e => {
    I.onAny?.();
    if (e.code === 'Space' && !e.repeat) I.taps.push({ side: 0, t: performance.now() / 1000 - 1 });
    I.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => I.keys.delete(e.code));
  addEventListener('blur', () => I.keys.clear());
  // the gyro: in landscape, turning the phone left/right spins it about its own x axis, tilting it
  // up/down about its y axis; the sign flips with which way round it is held
  addEventListener('devicemotion', e => {
    const r = e.rotationRate, dt = (e.interval || 16) / (e.interval > 1 ? 1000 : 1);
    if (!I.gyroOn || !r || r.alpha == null) return;
    const ang = screen.orientation?.angle ?? 0, sg = ang === 270 ? -1 : 1, d2r = Math.PI / 180;
    if (ang === 90 || ang === 270) { I.gyro[0] += -sg * r.beta * d2r * dt; I.gyro[1] += sg * r.gamma * d2r * dt; }
    else { I.gyro[0] += -r.gamma * d2r * dt; I.gyro[1] += r.beta * d2r * dt; }
  });
  I.gyro = [0, 0];

  // what the wings are asking for this frame: { pitch, roll, spread, flap, held }
  I.read = () => {
    const r = I.radius = size() * .13;
    for (const P of [I.L, I.R]) if (P.id !== null) {
      P.dx = clampU((P.x - P.x0) / r); P.dy = clampU((P.y - P.y0) / r);
    }
    const L = I.L, R = I.R, l = L.id !== null, rr = R.id !== null;
    let pitch = 0, roll = 0, spread = 0, keyRoll = 0, yaw = 0;
    const k = I.invert ? -1 : 1;
    if (l && rr) {
      // Thumbs pulled together never move exactly alike, and they wander up and down as they
      // slide in. So a tuck must not read as a turn: sideways steering (yaw, and the tuck's bank)
      // takes only the part both thumbs share (same way, the smaller of the two), past a small
      // dead zone, and up/down is dead-zoned too, more so the tighter the tuck.
      spread = (R.dx - L.dx) / 2;
      const tk = Math.max(0, -spread), dz = .08 + tk * .14;
      const common = Math.sign(L.dx) === Math.sign(R.dx) ? Math.sign(L.dx) * Math.min(Math.abs(L.dx), Math.abs(R.dx)) : 0;
      const side = dead(common, .1);
      pitch = -dead((L.dy + R.dy) / 2, dz) * k;
      roll = clampU(dead((R.dy - L.dy) / 2, dz) + side * tk * 1.6);
      yaw = clampU(side);
    } else if (l || rr) {
      const P = l ? L : R; pitch = -P.dy * k; roll = P.dx;
    }
    const K = I.keys, key = (...c) => c.some(x => K.has(x));
    if (key('KeyW', 'ArrowUp')) pitch = 1 * k; if (key('KeyS', 'ArrowDown')) pitch = -1 * k;
    if (key('KeyA', 'ArrowLeft')) roll = keyRoll = -1; if (key('KeyD', 'ArrowRight')) roll = keyRoll = 1;
    if (key('ShiftLeft', 'ShiftRight', 'KeyQ')) spread = -1; if (key('KeyE')) spread = 1;
    // taps: two thumbs within PAIR of each other are one full flap
    let flap = null; const now = performance.now() / 1000;
    I.taps.sort((a, b) => a.t - b.t);
    while (I.taps.length) {
      const a = I.taps[0];
      if (a.side === 0) { I.taps.shift(); flap = { q: 1, side: 0, sync: .8 }; break; }
      const b = I.taps.find(t => t !== a && t.side !== a.side && Math.abs(t.t - a.t) < PAIR);
      if (b) { I.taps.splice(I.taps.indexOf(b), 1); I.taps.shift(); flap = { q: 1, side: 0, sync: 1 - Math.abs(b.t - a.t) / PAIR }; break; }
      if (now - a.t > PAIR + TAP_TIME) { I.taps.shift(); flap = { q: .55, side: a.side }; break; }
      break;
    }
    const dragX = I.drag / size(), dragY = I.dragY / size(), pinch = I.pinch; I.drag = I.dragY = 0; I.pinch = 1;
    const look = [-I.lk[0] / size() * 3 + I.gyro[0], I.lk[1] / size() * 2 + I.gyro[1]];   // drag grabs the view; the gyro turns it I.lk = [0, 0]; I.gyro = [0, 0];
    return { pitch: clampU(pitch), roll: clampU(roll), yaw, keyRoll, dragX, dragY, pinch, look, spread: clampU(spread), flap, held: l || rr || K.size > 0, both: l && rr };
  };
  return I;
}
const dead = (v, d) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
const clampU = v => (v < -1 ? -1 : v > 1 ? 1 : v);
