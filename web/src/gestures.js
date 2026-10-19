// Touch controls drawn on the screen itself. Each touch is read as one of:
//  - a tap, counted with the quick taps before it (a double tap, three fast taps);
//  - a stroke, read when the finger lifts: a line (which way, and where it ends), a hook (out
//    one way and back), or a circle (which way round).
// (Trimming the line of flight is the joystick's, joystick.js.) controls.js decides what each
// one does. This file also draws the quiet feedback: the faint ink of a stroke as it is drawn,
// tinted once it is understood, and a small sign by the hawk for whatever it is now doing.
// Every point the screen reports is kept (coalesced events too), and the shape is read from
// an evenly spaced, lightly smoothed copy, so a shaky finger still reads true.
import { TAU, C, clamp } from './util.js';
import { MARK } from './palette.js';

const TAP_S = .45, TAP_MOVE = 12, QUICK = .32, QUICK_R = 60, MIN_STROKE = 30, STEP = 6;
const INK = MARK.ink;
export const TINT = { prey: MARK.mouse, perch: MARK.perch, thermal: MARK.thermal, turn: [26, 20, 16], ink: INK, none: INK };

export function createGestures(canvas) {
  const tracks = new Map(), now = () => performance.now() / 1000;
  const S = { events: [], lastTap: null, trails: [], sign: null, mode: null };
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function down(id, e) {
    const [x, y] = pos(e);
    tracks.set(id, { x0: x, y0: y, x, y, t0: now(), pts: [[x, y]], moved: false });
  }
  function move(id, e) {
    const k = tracks.get(id); if (!k) return;
    for (const c of e.getCoalescedEvents?.() || [e]) {
      const [x, y] = pos(c), last = k.pts[k.pts.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) > 1.5) k.pts.push([x, y]);
      k.x = x; k.y = y;
    }
    if (!k.moved && Math.hypot(k.x - k.x0, k.y - k.y0) > TAP_MOVE) k.moved = true;
  }
  function up(id) {
    const k = tracks.get(id); if (!k) return;
    tracks.delete(id);
    const t = now();
    if (!k.moved) {
      if (t - k.t0 > TAP_S) return;   // a long still press is nothing
      // quick taps close together count up: a double tap, three fast taps
      const L = S.lastTap, n = L && t - L.t < QUICK && Math.hypot(k.x0 - L.x, k.y0 - L.y) < QUICK_R ? L.n + 1 : 1;
      S.lastTap = { t, x: k.x0, y: k.y0, n };
      S.events.push({ type: 'tap', x: k.x0, y: k.y0, n });
      return;
    }
    const g = classify(k.pts);
    const trail = { pts: k.pts, t, tint: 'none' };
    S.trails.push(trail); if (S.trails.length > 6) S.trails.shift();
    if (g) S.events.push({ type: 'stroke', ...g, trail });
  }
  const cancel = id => tracks.delete(id);

  // per frame: hand over the events
  function frame() { const ev = S.events; S.events = []; return { events: ev }; }

  // a sign by the hawk: flashed when a gesture is understood, then held faintly while the
  // hawk keeps doing it (mode), so you can always see what it is doing
  function sign(kind, mode = null) { S.sign = { kind, t: now() }; S.mode = mode; }
  function setMode(mode) { S.mode = mode; }

  // the feedback, in screen pixels; hawk is the hawk's place on screen, face its heading
  function draw(ctx, hawk, face) {
    const t = now();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // (through the midpoints, so the ink runs smooth rather than in straight bits)
    const line = (pts, col, a, w) => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      const z = pts[pts.length - 1]; ctx.lineTo(z[0], z[1]);
      ctx.strokeStyle = C(col, a); ctx.lineWidth = w; ctx.stroke();
    };
    // strokes being drawn: faint ink under the finger
    for (const k of tracks.values()) if (k.moved && k.pts.length > 1) line(k.pts, INK, .22, 2);
    // finished strokes fade, tinted by what they meant
    S.trails = S.trails.filter(r => t - r.t < .7);
    for (const r of S.trails) { const f = 1 - (t - r.t) / .7; line(r.pts, TINT[r.tint] || INK, (r.tint === 'none' ? .18 : .45) * f, r.tint === 'none' ? 1.6 : 2.4); }
    // the sign by the hawk
    const sg = S.sign, fresh = sg ? clamp(1 - (t - sg.t) / .9, 0, 1) : 0;
    const kind = fresh > 0 ? sg.kind : S.mode;
    if (kind && hawk) {
      const a = fresh > 0 ? .3 + .5 * fresh : .28;
      ctx.translate(hawk[0] + face * 4, hawk[1] - 34); drawSign(ctx, kind, face, a, t);
    }
    ctx.restore();
  }

  function attach() {
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); down(e.pointerId, e); });
    canvas.addEventListener('pointermove', e => move(e.pointerId, e));
    canvas.addEventListener('pointerup', e => up(e.pointerId));
    canvas.addEventListener('pointercancel', e => cancel(e.pointerId));
    addEventListener('blur', () => { for (const id of [...tracks.keys()]) cancel(id); });
  }
  return { attach, frame, draw, sign, setMode };
}

// What shape a stroke is. Screen coordinates, y down.
export function classify(raw) {
  if (raw.length < 2) return null;
  const [x0, y0] = raw[0], [x1, y1] = raw[raw.length - 1], chord = Math.hypot(x1 - x0, y1 - y0);
  const pts = even(raw);
  let len = 0, turn = 0, minX = x0, maxX = x0, minY = y0, maxY = y0, prevA = null;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    len += Math.hypot(dx, dy); minX = Math.min(minX, pts[i][0]); maxX = Math.max(maxX, pts[i][0]); minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]);
    const a = Math.atan2(dy, dx);
    if (prevA !== null) { let da = a - prevA; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; turn += da; }
    prevA = a;
  }
  const size = Math.max(maxX - minX, maxY - minY), round = Math.min(maxX - minX, maxY - minY) / Math.max(1, size);
  // a circle: turns most of the way round, roughly as tall as wide, and comes back near where
  // it began (or overshoots into a second turn)
  if (size > 36 && round > .4 && (Math.abs(turn) > TAU * .9 || (Math.abs(turn) > TAU * .72 && chord < size * .6))) return { kind: 'circle', cw: turn > 0 };
  // a hook: out to one side, then back at least a good part of the way, mostly flat
  const far = maxX - x0 >= x0 - minX ? maxX : minX, out = far - x0, back = far - x1;
  if (Math.abs(out) > 34 && Math.sign(back) === Math.sign(out) && Math.abs(back) > Math.max(26, Math.abs(out) * .4) && Math.abs(out) > (maxY - minY) * .8) return { kind: 'hook', dir: Math.sign(out) };
  if (chord < MIN_STROKE) return null;
  // a line: its way is the main direction of the whole stroke, not just its two ends, so a
  // flick that curls at the finish still reads the way it was meant
  const n = pts.length, a = pts[Math.floor(n * .1)], z = pts[Math.min(n - 1, Math.ceil(n * .9))];
  let dx = z[0] - a[0], dy = z[1] - a[1];
  if (Math.hypot(dx, dy) < chord * .5) { dx = x1 - x0; dy = y1 - y0; }
  const k = chord / Math.hypot(dx, dy);
  return { kind: 'line', x0, y0, x1, y1, dx: dx * k, dy: dy * k, straight: len / chord };
}
// a stroke's points spaced STEP apart along it, then smoothed over three, so the jitter of a
// finger neither adds false turns nor bends a line
function even(pts) {
  const out = [pts[0]];
  let [px, py] = pts[0], carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]; let d = Math.hypot(x - px, y - py);
    while (carry + d >= STEP) {
      const f = (STEP - carry) / d; px += (x - px) * f; py += (y - py) * f; out.push([px, py]);
      d = Math.hypot(x - px, y - py); carry = 0;
    }
    carry += d; px = x; py = y;
  }
  out.push(pts[pts.length - 1]);
  if (out.length < 4) return out;
  return out.map((p, i) => i === 0 || i === out.length - 1 ? p : [(out[i - 1][0] + p[0] * 2 + out[i + 1][0]) / 4, (out[i - 1][1] + p[1] * 2 + out[i + 1][1]) / 4]);
}

// Small signs drawn about the origin, about 20 px across, in ink (turning in near-black,
// thermals in ochre). face mirrors the ones that point the way the hawk flies.
function drawSign(ctx, kind, face, a, t) {
  const col = kind === 'turn' ? TINT.turn : kind === 'ride' ? TINT.thermal : kind === 'perch' ? TINT.perch : kind === 'prey' ? TINT.prey : INK;
  ctx.strokeStyle = C(col, a); ctx.fillStyle = C(col, a); ctx.lineWidth = 1.8; ctx.beginPath();
  const chev = (cx, cy, s, dir) => { ctx.moveTo(cx - s, cy - s * dir * .7); ctx.lineTo(cx, cy); ctx.lineTo(cx + s, cy - s * dir * .7); };
  switch (kind) {
    case 'turn':   // a black double arrow
      ctx.moveTo(-10, -3); ctx.lineTo(10, -3); ctx.moveTo(6, -7); ctx.lineTo(10, -3); ctx.lineTo(6, 1);
      ctx.moveTo(10, 4); ctx.lineTo(-10, 4); ctx.moveTo(-6, 0); ctx.lineTo(-10, 4); ctx.lineTo(-6, 8); break;
    case 'land': chev(0, 2, 6, 1); ctx.moveTo(-8, 7); ctx.lineTo(8, 7); break;
    case 'hover': ctx.moveTo(-10, 2); ctx.quadraticCurveTo(-5, -7, 0, 0); ctx.quadraticCurveTo(5, -7, 10, 2); ctx.moveTo(0, 3); ctx.lineTo(0, 8); break;
    case 'takeoff': chev(0, -4, 6, -1); chev(0, 3, 6, -1); break;
    case 'glide': ctx.moveTo(-10 * face, 1); ctx.lineTo(10 * face, -1); ctx.moveTo(6 * face, -5); ctx.lineTo(10 * face, -1); ctx.lineTo(6 * face, 3); break;
    case 'ride': { const ph = t * 8 % 7; chev(0, 4 - ph, 6, -1); chev(0, 11 - ph, 6, -1); break; }
    case 'dive': ctx.moveTo(-6 * face, -8); ctx.lineTo(6 * face, 6); ctx.moveTo(6 * face, 0); ctx.lineTo(6 * face, 6); ctx.lineTo(0, 6); break;
    case 'brake': ctx.moveTo(-3 * face, -7); ctx.quadraticCurveTo(-9 * face, 0, -3 * face, 7); ctx.moveTo(3 * face, -7); ctx.quadraticCurveTo(-3 * face, 0, 3 * face, 7); break;
    case 'flip': ctx.arc(0, 0, 7, -2.4, 2.2); ctx.moveTo(-1.5, 6.5); ctx.lineTo(-5.5, 5.5); ctx.lineTo(-4, 9.5); break;
    case 'perch': ctx.moveTo(-8, 4); ctx.quadraticCurveTo(0, 1, 8, 4); chev(0, -1, 5, 1); break;
    case 'prey': ctx.arc(0, 0, 6, 0, TAU); ctx.moveTo(1.6, 0); ctx.arc(0, 0, 1.6, 0, TAU); break;
    case 'hop': ctx.moveTo(-8 * face, 4); ctx.quadraticCurveTo(0, -8, 8 * face, 4); break;
    case 'eat': ctx.arc(0, 2, 3, 0, TAU); ctx.moveTo(6, 2); ctx.arc(4, 2, 2.5, 0, TAU); break;
  }
  ctx.stroke();
}
