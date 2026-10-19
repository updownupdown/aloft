// Two-thumb controls: a watercolour joystick in each lower corner, one for each thumb.
//  - tap both sticks together to flap; the closer together the taps, the cleaner the beat
//  - a tap on one stick alone is a weak half-beat in the air, a hop on a branch or the ground
//  - a quick sideways flick of one stick turns that way
//  - held sticks report where they point (x right, y up, each -1 to 1); controls.js reads the
//    pair as combinations: both up, both down, both inward, one up and one down, and so on
// A stick measures from where the thumb came down, so a thumb never has to find the centre.
// The art is painted once into canvases (paintStick), so the sticks cost nothing per frame.
import { wash, circP, ellP } from './paint.js';
import { MARK } from './palette.js';

const PAIR = .2, TAP = .26, MOVED = 10, FLICK = .55;
const POOL = [104, 132, 168], RIM = [74, 92, 122], KNOB = [58, 76, 112], INK = [58, 36, 24];
const MARKS = Object.fromEntries(Object.entries(MARK).map(([k, v]) => [k, v.join()]));

// The base: a washed pool with a small painted sign for each way it can lean (the same signs on
// both sticks, mirrored, since the gestures are made by pushing both together): up glide, down
// land; inward perch, inward and up thermal, inward and down prey; outward hang, outward and up
// call, outward and down stoop. Perch, thermal and prey wear the colours of their focus marks.
export function paintStick(base, knob, px, side = 'L') {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  for (const [cv, d] of [[base, px], [knob, Math.round(px * .46)]]) { cv.width = cv.height = Math.round(d * dpr); cv.style.width = cv.style.height = d + 'px'; }
  let x = base.getContext('2d'), r = px / 2;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, px, px);
  wash(x, circP(r, r, r * .94, 24), POOL, .24, { passes: 3, amp: r * .035, seed: 3, rim: .8, rimW: 1.5 });
  wash(x, circP(r, r, r * .52, 16), POOL, .08, { passes: 2, amp: r * .03, seed: 8, rim: .3 });
  const inward = side === 'L' ? 1 : -1, s = r * .17, ring = r * .73;
  for (const [ang, sign] of SIGNS) {
    const a = ang * Math.PI / 180, cx = r + Math.cos(a) * ring * inward, cy = r - Math.sin(a) * ring;
    x.save(); x.translate(cx, cy); x.scale(inward, 1); sign(x, s); x.restore();
  }
  const k = Math.round(px * .46); r = k / 2;
  x = knob.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, k, k);
  wash(x, circP(r, r, r * .86, 16), KNOB, .62, { passes: 3, amp: r * .05, seed: 21, rim: .7, rimW: 1.3 });
  wash(x, ellP(r - r * .22, r - r * .26, r * .3, r * .2, -.6, 10), RIM, .2, { passes: 1, amp: r * .03, seed: 5, rim: 0 });
}

// each sign is drawn about the origin, s is about half its size, +x points toward the middle of the screen
const ink = (x, col, w, a = .8) => { x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = `rgba(${col},${a})`; x.lineWidth = w; x.stroke(); };
const fill = (x, col, a = .85) => { x.fillStyle = `rgba(${col},${a})`; x.fill(); };
const SIGNS = [
  // up: glide, wings spread flat
  [90, (x, s) => { x.beginPath(); x.moveTo(-s * 1.2, s * .2); x.quadraticCurveTo(-s * .55, -s * .5, 0, s * .1); x.quadraticCurveTo(s * .55, -s * .5, s * 1.2, s * .2); ink(x, INK, 1.6); }],
  // down: land, a chevron settling onto the ground
  [-90, (x, s) => { x.beginPath(); x.moveTo(-s * .6, -s * .6); x.lineTo(0, 0); x.lineTo(s * .6, -s * .6); x.moveTo(-s * .9, s * .55); x.lineTo(s * .9, s * .55); ink(x, INK, 1.6); }],
  // inward: perch, a branch with a leaf
  [0, (x, s) => { x.beginPath(); x.moveTo(-s, s * .3); x.quadraticCurveTo(0, s * .05, s, s * .35); ink(x, MARKS.perch, 1.8); x.beginPath(); x.ellipse(s * .1, -s * .25, s * .45, s * .22, -.6, 0, Math.PI * 2); fill(x, MARKS.perch, .8); }],
  // inward and up: thermal, chevrons rising
  [45, (x, s) => { x.beginPath(); for (const dy of [s * .55, -s * .25]) { x.moveTo(-s * .65, dy + s * .3); x.lineTo(0, dy - s * .25); x.lineTo(s * .65, dy + s * .3); } ink(x, MARKS.thermal, 1.7, .9); }],
  // inward and down: prey, a mouse
  [-45, (x, s) => { x.beginPath(); x.ellipse(-s * .1, s * .1, s * .62, s * .38, 0, 0, Math.PI * 2); fill(x, MARKS.mouse, .8); x.beginPath(); x.arc(s * .38, -s * .22, s * .2, 0, Math.PI * 2); fill(x, MARKS.mouse, .8); x.beginPath(); x.moveTo(-s * .7, s * .2); x.quadraticCurveTo(-s * 1.1, s * .55, -s * 1.25, s * .05); ink(x, MARKS.mouse, 1.1); }],
  // outward: hang, a hawk held in place on raised wings
  [180, (x, s) => { x.beginPath(); x.moveTo(-s * 1.05, -s * .7); x.quadraticCurveTo(-s * .5, s * .05, 0, s * .05); x.quadraticCurveTo(s * .5, s * .05, s * 1.05, -s * .7); ink(x, INK, 1.5); x.beginPath(); x.ellipse(0, s * .25, s * .2, s * .38, 0, 0, Math.PI * 2); fill(x, INK, .8); x.beginPath(); x.moveTo(-s * .5, s * .95); x.lineTo(s * .5, s * .95); ink(x, INK, 1, .5); }],
  // outward and up: the hawk's call, sound spreading
  [135, (x, s) => { x.beginPath(); for (const rr of [.35, .75, 1.15]) { x.moveTo(Math.cos(-.7) * rr * s - s * .5, Math.sin(-.7) * rr * s + s * .3); x.arc(-s * .5, s * .3, rr * s, -.7, .7); } ink(x, INK, 1.4, .75); }],
  // outward and down: stoop, a tucked dive with speed lines
  [-135, (x, s) => { x.beginPath(); x.moveTo(-s * .55, s * .7); x.lineTo(s * .2, -s * .25); x.lineTo(s * .45, s * .1); x.closePath(); fill(x, INK, .75); x.beginPath(); x.moveTo(s * .2, -s * .6); x.lineTo(s * .75, -s * 1.05); x.moveTo(s * .6, -s * .3); x.lineTo(s * 1.05, -s * .65); ink(x, INK, 1, .55); }],
];

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
