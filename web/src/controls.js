// What the two joysticks do, state by state (the sticks themselves are in sticks.js).
//  flying:   both tapped = flap (ragged taps cost more), one tapped = a weak, costly half-beat,
//            a flick of one stick = turn. Held, the pair is read as a gesture:
//              both up: glide (in a thermal, ride it)     both down: settle down to land
//              one up, one down: pitch (hard over at speed: one loop or front flip)
//              both inward: perch nearby                  inward and down: go for prey
//              inward and up: seek the nearest thermal    both outward: hang in the air
//              outward and down: stoop (a tucked dive)    outward and up: the hawk's call
//              both leaning the same way: turn that way
//  perched or on the ground: one tapped = hop that way; both tapped = take off;
//            both pushed down = eat or drink, or on a branch drop down a level; the inward
//            gestures work from here too (they take off for the target)
import * as W from './world.js';
import { flap, nudge, turn, hopDown, hopSide } from './bird.js';
import { mousePos, fishPos } from './life.js';

const RANGE = { perch: 260, prey: 320, thermal: 2600 };
const ON = .45, OFF = .25;

export function createControls({ G, b, sticks, interact, call, once }) {
  const sideDir = s => s === 'L' ? -1 : 1;
  const C = { gesture: null, loopArmed: true, pitchHold: false, wasLoop: false };

  function onEvent(e) {
    const flying = b.state === 'fly';
    if (e.type === 'flap') {
      if (flying) { flap(b, G.flapPower, G, e.sync); return; }
      if (e.up < -.3) { if (b.state === 'perch') hopDown(b, G, b.face); else interact(); return; }
      b.target = null; flap(b, G.flapPower, G);
      return;
    }
    if (e.type === 'tap') {
      if (flying) { flap(b, G.flapPower * .7, G, .2); return; }
      if (b.state === 'swim') nudge(b, sideDir(e.side)); else hopSide(b, G, sideDir(e.side));
      return;
    }
    if (e.type === 'swipe' && flying && e.dir !== b.face) turn(b);
  }

  // Which gesture a pair of held sticks makes. Inward is toward the middle of the screen.
  function gestureOf(L, R) {
    if (!L || !R) return null;
    const upAvg = (L.y + R.y) / 2, inAvg = (L.x - R.x) / 2, tilt = (R.y - L.y) / 2;
    const was = C.gesture, keep = g => was === g;   // a gesture holds on down to a lower threshold
    const th = g => keep(g) ? OFF : ON;
    if (Math.sign(L.y) !== Math.sign(R.y) && Math.abs(tilt) > th('tilt')) return 'tilt';
    if (Math.abs(L.x) > th('lean') && Math.abs(R.x) > th('lean') && Math.sign(L.x) === Math.sign(R.x)) return 'lean';
    if (inAvg > th('in') || (was?.startsWith('in') && inAvg > OFF)) return upAvg < -.35 ? 'in-down' : upAvg > .35 ? 'in-up' : 'in';
    if (inAvg < -th('out') || (was?.startsWith('out') && inAvg < -OFF)) return upAvg < -.35 ? 'out-down' : upAvg > .35 ? 'out-up' : 'out';
    if (upAvg > th('up')) return 'up';
    if (upAvg < -th('down')) return 'down';
    return 'tilt';
  }

  // the best thing to focus on for a gesture: a branch nearby, prey ahead and below, or a thermal
  function findTarget(mode) {
    const f = b.face, r = RANGE[mode];
    let best = null, bs = Infinity;
    const consider = (kind, x, y, ref, sc) => { if (sc < bs) { bs = sc; best = { kind, ref }; } };
    if (mode === 'thermal') {
      for (const t of W.thermalsIn(b.x - 400, b.x + r)) {
        const d = Math.abs(t.c - b.x), ahead = (t.c - b.x) * f > -t.w;
        consider('thermal', t.c, b.y, t, d * (ahead ? 1 : 2.5));
      }
      return best;
    }
    const x0 = b.x - r, x1 = b.x + r;
    const near = (x, y, below) => {
      const dx = (x - b.x) * f, dy = y - b.y, d = Math.hypot(dx, dy);
      if (d > r || (below && (dx < -40 || dy < -30))) return Infinity;
      return d * (dx < 0 ? 1.6 : 1);   // ahead is better than behind
    };
    if (mode === 'prey') {
      for (const m of W.miceIn(x0, x1)) {
        if (G.eaten.has(m.id + ':' + G.day)) continue;
        const q = mousePos(m, G.t); if (q.show > .5) consider('mouse', q.x, q.y, m, near(q.x, q.y, true));
      }
      for (const p of W.pondsIn(x0, x1)) {
        if (W.frozen(p)) continue;
        for (const fi of p.fish) if (!G.eaten.has(fi.id + ':' + G.day)) { const q = fishPos(fi, p, G.t); consider('fish', q.x, q.y, { fi, p }, near(q.x, q.y, true)); }
      }
    } else for (const q of W.perchesIn(x0, x1)) if (!q.occupied && q !== b.perch) consider('perch', q.x, q.y, q, near(q.x, q.y, false));
    return best;
  }
  const posOf = t => t.kind === 'mouse' ? mousePos(t.ref, G.t) : t.kind === 'fish' ? fishPos(t.ref.fi, t.ref.p, G.t)
    : t.kind === 'thermal' ? { x: t.ref.c, y: Math.min(b.y, t.ref.y0 - 40) } : { x: t.ref.x, y: t.ref.y - 3 };
  const alive = t => t.kind === 'mouse' ? !G.eaten.has(t.ref.id + ':' + G.day) && mousePos(t.ref, G.t).show > .2
    : t.kind === 'fish' ? !G.eaten.has(t.ref.fi.id + ':' + G.day) : t.kind === 'thermal' ? true : !t.ref.occupied;

  // focus: hold the gesture and the hawk goes for the target; let go and it is free again
  function focus(mode) {
    let F = G.focus;
    if (!F || F.mode !== mode) {
      F = G.focus = { t: G.t, mode, target: null };
      once('focus', 'Focus: both sticks inward picks a branch nearby, inward and down picks prey, inward and up finds a thermal. Let go to break off.', 6);
    }
    // once it has flown to a branch and landed, the gesture is spent until the sticks let go
    if (b.state === 'fly') F.flew = true;
    else if (F.flew && mode === 'perch') { F.x = undefined; return null; }
    if (!F.target || !alive(F.target)) F.target = findTarget(mode);
    const t = F.target;
    if (!t) { F.x = b.x + b.face * 70; F.y = b.y + (mode === 'prey' ? 40 : mode === 'thermal' ? -20 : 10); F.kind = null; return null; }
    const q = posOf(t); F.x = q.x; F.y = q.y; F.kind = t.kind;
    if (t.kind === 'perch') {
      if (b.target !== t.ref) { b.target = t.ref; if (b.state !== 'fly') { flap(b, G.flapPower, G); b.target = t.ref; } }
      return null;
    }
    if (b.state !== 'fly') { if (b.state === 'perch' || b.state === 'ground') flap(b, G.flapPower, G); return null; }
    if (t.kind === 'thermal') {
      // inside the column it rides; on the way it holds its height and heads for the core
      if (Math.abs(b.x - t.ref.c) < t.ref.w * .4) return { yoke: { p: 0, mode: 'glide' } };
      return { steer: { wx: t.ref.c, wy: b.y - 6 } };
    }
    return { steer: { wx: q.x, wy: q.y + 4, dive: true } };
  }

  // per frame: handle the sticks' events; returns the yoke and any focus steering for the bird
  function update(st) {
    sticks.show(!G.photo && !G.roost && !G.paused);
    if (G.roost || G.photo) { G.focus = null; return { yoke: null, steer: null }; }
    for (const e of st.events) onEvent(e);
    const { L, R } = st.held, g = gestureOf(L, R), prev = C.gesture;
    C.gesture = g;
    if (!L && !R) { C.loopArmed = true; C.pitchHold = false; }

    // inward gestures focus on something; letting go breaks off
    if (g === 'in' || g === 'in-down' || g === 'in-up') {
      const r = focus(g === 'in' ? 'perch' : g === 'in-down' ? 'prey' : 'thermal');
      return { yoke: r?.yoke || null, steer: r?.steer || null };
    }
    if (G.focus) { if (G.focus.kind === 'perch' && b.target === G.focus.target?.ref && b.state === 'fly') b.target = null; G.focus = null; }

    // one-shot gestures fire once as they begin
    if (g !== prev) {
      if (g === 'out-up') call();
      if (g === 'lean' && b.state === 'fly') { const dir = Math.sign(L.x); if (dir !== b.face) turn(b); }
      if (g === 'down' && b.state !== 'fly') { if (b.state === 'perch') hopDown(b, G, b.face); else interact(); }
    }
    if (b.state !== 'fly' || (!L && !R)) return { yoke: null, steer: null };

    // one up and one down pitches the nose; hard over at speed it flies one loop, and then the
    // sticks have to come back toward the middle before they steer (or loop) again
    let p = L && R ? (R.y - L.y) / 2 : R ? R.y / 2 : -L.y / 2;
    if (g && g !== 'tilt') p = 0;
    if (b.loop && !C.wasLoop) { C.loopArmed = false; C.pitchHold = true; }
    C.wasLoop = !!b.loop;
    if (Math.abs(p) < .3) { C.loopArmed = true; C.pitchHold = false; }
    if (C.pitchHold && !b.loop) p = 0;
    const mode = g === 'up' ? 'glide' : g === 'down' ? 'land' : g === 'out' ? 'hang' : g === 'out-down' ? 'stoop' : null;
    if (mode === 'hang') once('hang', 'Both sticks outward: the hawk hangs on beating wings to look around. It tires the wings.', 5);
    if (mode === 'stoop') once('stoop', 'Outward and down: a stoop, wings tucked, the fastest way down.', 5);
    return { yoke: { p: p * b.face, mode, loopOk: C.loopArmed }, steer: null };
  }
  return { update };
}
