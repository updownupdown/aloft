// Two thumbs are the two wings. Each half of the screen is a floating stick that starts where
// the thumb lands, and each stick is where its wing goes: up, down, out (spread wide) or in
// (folded against the body). Read together (How to play shows the same):
//   no thumbs                    glide: the hawk trims to its best glide
//   both up / both down          climb / dive (pitch)
//   both out and up              float: a slow glide in to land; slow enough, hover on beating wings
//   both out                     soar: wings wide, slow and buoyant, turning tight; ride thermals so
//   both out and down            brake: dump lift and come down gently where you are (land, perch)
//   both in                      tuck halfway: a fast glide between thermals
//   both in and down             stoop: wings closed, a steep fast dive (slide both left/right to steer)
//   both in and up               zoom: a swept climb that keeps its speed longer
//   one up, the other down       bank toward the lower wing
//   both slide left / right      yaw: the tail swings the bird round without much bank
//   both turned a full circle    barrel roll: left stick down and right up, then both round
//                                counter-clockwise rolls left; left up and right down, clockwise, right
//   tap both at once             a full flap; one thumb alone flaps one wing (a weak flap and a nudge);
//                                the closer together the two taps, the less the flap tires you (sync)
// A single held thumb works as a small stick on its own (up/down pitch, left/right bank).
// Keyboard for desktop: W/S or Up/Down pitch, A/D or Left/Right bank, Shift fold, Q spread (both held
// alongside WASD with the little finger),
// Space flap, Z / X barrel roll left / right (T take off, E and Up/Down for the action button: action.js;
// P and M the menu and the Map: menu.js).
// Perched or standing, a drag sideways turns the bird (read as dragX), perched a drag up or down
// tips the view (dragY: down looks up, as if pulling the sky into view), on the ground two fingers
// pinch the view in or out (pinch), and a tap may be taken by
// onTap (a perch ring to hop to) before it counts as a flap. Two fingers dragging together, or
// turning the phone (gyro, while I.gyroOn), look round instead (read as look: [x, y]).

const TAP_TIME = .3, TAP_MOVE = .06, PAIR = .2;
// a stick's full move, as a share of the screen's short side (James, 10-25: between the study's
// Normal .13 and Long .17); a dead zone on a thumb flying alone, so a resting thumb doesn't drift the heading
const REACH = .15, DEAD1 = .08;
// the barrel roll: a stick counts as turning past ROLL_ON of its reach (and stops below ROLL_OFF);
// both must turn ROLL_TURN of a circle the same way within ROLL_TIME seconds, from the start
// poses give or take ROLL_START radians
const ROLL_ON = .55, ROLL_OFF = .3, ROLL_TURN = .85, ROLL_TIME = 2.5, ROLL_START = 1.2;

export function createInput(el) {
  const I = { L: pad(), R: pad(), keys: new Set(), taps: [], invert: false, onAny: null, onTap: null, radius: 70, drag: 0, dragY: 0, pinch: 1, lk: [0, 0], gyroOn: false };
  function pad() { return { id: null, x0: 0, y0: 0, x: 0, y: 0, t0: 0, moved: 0, dx: 0, dy: 0, rx: 0, a: null, a0: 0, turn: 0, tt: 0 }; }
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
  // a touch the system took away (touchcancel: the notification shade, a palm) is not a tap
  const end = cancel => e => {
    I.onAny?.();   // touchend is what lets a page start sound
    for (const t of e.changedTouches) for (const [side, P] of [[-1, I.L], [1, I.R]]) if (P.id === t.identifier) {
      const now = performance.now() / 1000;
      if (!cancel && now - P.t0 < TAP_TIME && P.moved < TAP_MOVE * size() && !I.onTap?.(P.x0, P.y0)) I.taps.push({ side, t: P.t0, y: P.y0 / innerHeight });
      P.id = null; P.dx = P.dy = P.rx = 0; P.a = null; P.turn = 0;
    }
  };
  el.addEventListener('touchend', end(false)); el.addEventListener('touchcancel', end(true));
  // a mouse; a touch's own click is left out (a button that hides as it is pressed, Sleep or Take
  // off, would otherwise pass its click through to the ground under it)
  let touched = -1;
  addEventListener('touchend', () => { touched = performance.now(); }, true);
  el.addEventListener('click', e => { if (e.pointerType === 'touch' || performance.now() - touched < 800) return; I.onTap?.(e.clientX, e.clientY); });
  addEventListener('keydown', e => {
    I.onAny?.();
    if (e.code === 'Space' && !e.repeat) I.taps.push({ side: 0, t: performance.now() / 1000 - 1 });
    if ((e.code === 'KeyZ' || e.code === 'KeyX') && !e.repeat) I.keyBarrel = e.code === 'KeyZ' ? 1 : -1;
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
    // a dead zone: the small shakes of holding the phone (or tapping it) never turn the view
    const dz = v => Math.abs(v) < 6 ? 0 : v - Math.sign(v) * 6;
    const ang = screen.orientation?.angle ?? 0, sg = ang === 270 ? -1 : 1, d2r = Math.PI / 180;
    if (ang === 90 || ang === 270) { I.gyro[0] += -sg * dz(r.beta) * d2r * dt; I.gyro[1] += sg * dz(r.gamma) * d2r * dt; }
    else { I.gyro[0] += -dz(r.gamma) * d2r * dt; I.gyro[1] += dz(r.beta) * d2r * dt; }
  });
  I.gyro = [0, 0];

  // what the wings are asking for this frame: { pitch, roll, spread, flap, held }
  I.read = () => {
    const r = I.radius = size() * REACH;
    for (const P of [I.L, I.R]) if (P.id !== null) {
      // rx: the sideways shift unclamped (to twice the reach), for steering with the thumbs pulled in
      P.rx = Math.max(-2, Math.min(2, (P.x - P.x0) / r));
      P.dx = clampU(P.rx); P.dy = clampU((P.y - P.y0) / r);
    }
    const L = I.L, R = I.R, l = L.id !== null, rr = R.id !== null;
    const barrel = l && rr ? circles(L, R) : I.keyBarrel || 0; I.keyBarrel = 0;
    let pitch = 0, roll = 0, spread = 0, keyRoll = 0, yaw = 0;
    const k = I.invert ? -1 : 1;
    if (l && rr) {
      // Thumbs pulled together never move exactly alike, and they wander up and down as they
      // slide in. So a tuck must not read as a turn: sideways steering (yaw, and the tuck's bank)
      // takes the shift both thumbs share (their mean: a tuck pulls them in by equal and opposite
      // amounts, which cancel), past a dead zone, and up/down is dead-zoned too, more so the
      // tighter the tuck. (It once took only a shift with both thumbs the same side of where they
      // landed, which a tuck almost never is: no steering in a stoop.) The mean takes the shifts
      // unclamped: thumbs pulled in past the stick's reach were clamped at it, so their slide
      // together counted only on the thumb coming back out, at half strength, and a deep tuck
      // couldn't steer at all.
      spread = (R.dx - L.dx) / 2;
      const tk = Math.max(0, -spread), dz = .08 + tk * .14;
      const side = dead(clampU((L.rx + R.rx) / 2), .12);
      pitch = -dead((L.dy + R.dy) / 2, dz) * k;
      roll = clampU(dead((R.dy - L.dy) / 2, dz) + side * tk * 1.6);
      yaw = clampU(side);
    } else if (l || rr) {
      const P = l ? L : R, dz = DEAD1; pitch = -dead(P.dy, dz) * k; roll = dead(P.dx, dz);
    }
    const K = I.keys, key = (...c) => c.some(x => K.has(x));
    if (key('KeyW', 'ArrowUp')) pitch = 1 * k; if (key('KeyS', 'ArrowDown')) pitch = -1 * k;
    if (key('KeyA', 'ArrowLeft')) roll = keyRoll = -1; if (key('KeyD', 'ArrowRight')) roll = keyRoll = 1;
    if (key('ShiftLeft', 'ShiftRight')) spread = -1; if (key('KeyQ')) spread = 1;
    // taps: two thumbs within PAIR of each other are one full flap. A tap on its own is a weak
    // flap with that wing, read as soon as no partner can come: the other side idle past the
    // pair window, or the other thumb down as a stick (held too long, or slid, to be a tap): then it
    // is a full flap, so you can steer with one thumb and beat with the other. It once waited the
    // whole PAIR + TAP_TIME, half a second after the thumb went down
    let flap = null; const now = performance.now() / 1000;
    I.taps.sort((a, b) => a.t - b.t);
    while (I.taps.length) {
      const a = I.taps[0];
      if (a.side === 0) { I.taps.shift(); flap = { q: 1, side: 0, sync: .8 }; break; }
      const b = I.taps.find(t => t !== a && t.side !== a.side && Math.abs(t.t - a.t) < PAIR);
      if (b) { I.taps.splice(I.taps.indexOf(b), 1); I.taps.shift(); flap = { q: 1, side: 0, sync: 1 - Math.abs(b.t - a.t) / PAIR }; break; }
      const o = a.side < 0 ? R : L, held = o.id !== null && (Math.abs(o.t0 - a.t) >= PAIR || now - o.t0 > TAP_TIME || o.moved >= TAP_MOVE * size());
      if (now - a.t > PAIR + TAP_TIME || (o.id === null && now - a.t > PAIR) || held) {
        I.taps.shift(); flap = held ? { q: 1, side: 0, sync: .8 } : { q: .55, side: a.side }; break;
      }
      break;
    }
    const dragX = I.drag / size(), dragY = I.dragY / size(), pinch = I.pinch; I.drag = I.dragY = 0; I.pinch = 1;
    const look = [-I.lk[0] / size() * 3 + I.gyro[0], I.lk[1] / size() * 2 + I.gyro[1]];   // drag grabs the view; the gyro turns it
    I.lk = [0, 0]; I.gyro = [0, 0];   // used up each frame (left running, a flight's two-thumb moves piled up and the view stuck looking up)
    let out = { pitch: clampU(pitch), roll: clampU(roll), yaw, keyRoll, dragX, dragY, pinch, look, spread: clampU(spread), flap, held: l || rr || K.size > 0, both: l && rr, barrel };
    // while both sticks are going round together the wings hold what they had: the circle passes
    // through tuck, bank and flare, and the hawk shouldn't lurch through each on the way
    const going = l && rr && Math.abs(L.turn) > .5 && Math.abs(R.turn) > .5 && Math.sign(L.turn) === Math.sign(R.turn);
    if (going && I.hold) out = { ...out, pitch: I.hold.pitch, roll: I.hold.roll, yaw: I.hold.yaw, spread: I.hold.spread };
    else if (Math.abs(L.turn) < .3 || Math.abs(R.turn) < .3) I.hold = out;   // the pose from before the circle began
    return out;
  };
  // each stick's angle round its centre, unwrapped: a full circle is 2π. Returns 1 when both have
  // gone round counter-clockwise from left down / right up, -1 clockwise from left up / right down
  function circles(L, R) {
    const now = performance.now() / 1000;
    for (const P of [L, R]) {
      const m = Math.hypot(P.dx, P.dy), a = Math.atan2(-P.dy, P.dx);
      if (m < ROLL_OFF) { P.a = null; P.turn = 0; continue; }
      if (P.a == null) { if (m > ROLL_ON) { P.a = P.a0 = a; P.turn = 0; P.tt = now; } continue; }
      let d = a - P.a; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      P.turn += d; P.a = a;
      if (now - P.tt > ROLL_TIME && Math.abs(P.turn) < 2 * Math.PI * ROLL_TURN) { P.a0 = a; P.turn = 0; P.tt = now; }   // too slow: start again from here
    }
    const full = 2 * Math.PI * ROLL_TURN;
    if (Math.abs(L.turn) < full || Math.abs(R.turn) < full || Math.sign(L.turn) !== Math.sign(R.turn)) return 0;
    const dir = Math.sign(L.turn), near = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < ROLL_START;
    const ok = dir > 0 ? near(L.a0, -Math.PI / 2) && near(R.a0, Math.PI / 2) : near(L.a0, Math.PI / 2) && near(R.a0, -Math.PI / 2);
    for (const P of [L, R]) { P.turn = 0; P.a0 = P.a; P.tt = now; }
    return ok ? dir : 0;
  }
  return I;
}
const dead = (v, d) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
const clampU = v => (v < -1 ? -1 : v > 1 ? 1 : v);
