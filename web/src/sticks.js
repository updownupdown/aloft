// Two-thumb controls: a watercolour joystick in each lower corner, one for each thumb.
//  - tap both sticks together to flap; the closer together the taps, the cleaner the beat
//  - a tap on one stick alone is a weak half-beat in the air, a hop on a branch or the ground
//  - a quick sideways flick of one stick turns that way
//  - held sticks report where they point (x right, y up, each -1 to 1); controls.js reads the
//    pair as combinations: both up, both down, both inward, one up and one down, and so on
// A stick measures from where the thumb came down, so a thumb never has to find the centre.
// The art is painted once into canvases (paintStick in stickart.js), so the sticks cost nothing per frame.
import { paintStick } from './stickart.js';

const PAIR = .2, TAP = .26, MOVED = 10, FLICK = .55;

export function createSticks() {
  const root = document.getElementById('ui');
  const mk = side => {
    const el = document.createElement('div'); el.className = `stick stick-${side}`;
    const base = document.createElement('canvas'), knob = document.createElement('canvas');
    base.className = 'base'; knob.className = 'knob'; el.append(base, knob); root.append(el);
    return { el, base, knob, px: 0 };
  };
  const els = { L: mk('l'), R: mk('r') };
  const S = { L: null, R: null, pend: null, events: [] };
  const now = () => performance.now() / 1000;
  const geo = side => { const r = els[side].el.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: r.width / 2 }; };
  const vec = (f, R) => {
    let x = (f.x - f.x0) / (R * .7), y = (f.y0 - f.y) / (R * .7);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return { x, y };
  };

  // which stick (if any) a touch at screen point x, y belongs to: anywhere near its pool
  function zoneAt(x, y) {
    for (const side of ['L', 'R']) {
      const g = geo(side);
      if (g.R && Math.hypot(x - g.cx, y - g.cy) < g.R * 1.9) return side;
    }
    return null;
  }
  function down(id, x, y) {
    const side = zoneAt(x, y);
    if (!side || S[side]) return null;
    const g = geo(side);
    S[side] = { id, x0: x, y0: y, x, y, t0: now(), moved: false, up: Math.max(-1, Math.min(1, (g.cy - y) / g.R)) };
    return side;
  }
  const sideOf = id => S.L?.id === id ? 'L' : S.R?.id === id ? 'R' : null;
  function move(id, x, y) {
    const side = sideOf(id); if (!side) return;
    const f = S[side]; f.x = x; f.y = y;
    if (Math.hypot(x - f.x0, y - f.y0) > MOVED) f.moved = true;
  }
  function up(id) {
    const side = sideOf(id); if (!side) return;
    const f = S[side]; S[side] = null;
    const t = now(), v = vec(f, geo(side).R);
    if (!f.moved && t - f.t0 < TAP) { tap(side, f.t0, f.up); return; }
    // a quick sideways flick of one stick on its own turns
    const other = S[side === 'L' ? 'R' : 'L'];
    if (!other && t - f.t0 < .35 && Math.abs(v.x) > FLICK && Math.abs(v.x) > Math.abs(v.y) * 1.5) S.events.push({ type: 'swipe', side, dir: Math.sign(v.x) });
  }
  // a tap waits a moment for its partner on the other stick; pressed close together they are one beat
  function tap(side, t, u) {
    const p = S.pend;
    if (p && p.side !== side && Math.abs(t - p.t) < PAIR) {
      const gap = Math.abs(t - p.t);
      S.pend = null;
      S.events.push({ type: 'flap', sync: 1 - Math.max(0, Math.min(1, (gap - .05) / (PAIR - .05))), gap, first: t < p.t ? side : p.side, up: (u + p.up) / 2 });
      flash(gap < .06 ? 'sync' : 'ragged');
      return;
    }
    if (p) S.events.push({ type: 'tap', side: p.side, up: p.up });
    S.pend = { side, t, up: u };
  }
  function flash(kind) {
    for (const s of ['L', 'R']) { const e = els[s].el; e.classList.remove('sync', 'ragged'); void e.offsetWidth; e.classList.add(kind); }
  }

  // per frame: the events since last time, and where any held sticks point
  function frame() {
    const t = now(), p = S.pend;
    if (p) {
      const o = S[p.side === 'L' ? 'R' : 'L'];
      const partnerComing = o && !o.moved && Math.abs(o.t0 - p.t) < PAIR && t - o.t0 < TAP;
      if (t - p.t > PAIR && !partnerComing) { S.events.push({ type: 'tap', side: p.side, up: p.up }); S.pend = null; }
    }
    const held = {};
    for (const side of ['L', 'R']) {
      const f = S[side], E = els[side], g = geo(side);
      // repaint only when the stick's size changes (rotation, resize)
      if (Math.round(g.R * 2) !== E.px && g.R) { E.px = Math.round(g.R * 2); paintStick(E.base, E.knob, E.px, side); }
      // a thumb counts as held once it has stayed down a moment or moved (a tap never steers)
      const v = f ? vec(f, g.R) : null;
      held[side] = f && (t - f.t0 > .16 || f.moved) ? v : null;
      E.knob.style.transform = v ? `translate(-50%, -50%) translate(${v.x * g.R * .55}px, ${-v.y * g.R * .55}px)` : '';
      E.el.classList.toggle('touch', !!f);
    }
    const ev = S.events; S.events = [];
    return { held, events: ev };
  }
  function show(on) { for (const s of ['L', 'R']) els[s].el.classList.toggle('faded', !on); }
  return { zoneAt, down, move, up, frame, show, el: side => els[side].el, owns: id => !!sideOf(id) };
}
