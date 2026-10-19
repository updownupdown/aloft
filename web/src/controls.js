// What the two thumb strips do, state by state (the strips themselves are in strips.js).
//  flying:   both tap = flap (ragged taps swing the heading), one tap = a weak half-beat that
//            swings it, swipe = turn, thumbs held = the yoke, thumbs slid inward = focus
//  perched, on the ground or swimming: one tap = turn or step that way; both tapped high =
//            take off; both tapped low = eat or drink, or on a branch drop down a level
//  singing:  the right strip is the string; the left strip takes off (high) or stops (low)
import * as W from './world.js';
import { flap, nudge, turn, hopDown } from './bird.js';
import { mousePos, fishPos } from './life.js';

const FOCUS_RANGE = 300;

export function createControls({ G, b, strips, singer, interact, once }) {
  const sideDir = s => s === 'L' ? -1 : 1;
  // a ragged beat swings the heading toward the viewer or away, depending which thumb led
  const swingOf = (first, sync) => (1 - sync) * .6 * (first === 'L' ? 1 : -1) * b.face;

  function onEvent(e) {
    const flying = b.state === 'fly';
    if (e.type === 'flap') {
      G.lastBeat = { t: G.t, sync: e.sync };
      if (flying) { flap(b, G.flapPower, G, e.sync, swingOf(e.first, e.sync)); return; }
      if (e.up > 0) { b.target = null; flap(b, G.flapPower, G); return; }
      if (b.state === 'perch') hopDown(b, G, b.face); else interact();
      return;
    }
    if (e.type === 'tap') {
      if (singer.open && b.state !== 'fly') {
        if (e.up > 0) { singer.setOpen(false); flap(b, G.flapPower, G); } else singer.setOpen(false);
        return;
      }
      if (flying) { G.lastBeat = { t: G.t, sync: 0 }; flap(b, G.flapPower * .7, G, .2, .45 * (e.side === 'L' ? 1 : -1) * b.face); return; }
      nudge(b, sideDir(e.side));
      return;
    }
    if (e.type === 'swipe') { if (e.dir !== b.face) turn(b); return; }
    if (e.type === 'focus') {
      G.focus = e.on ? { t: G.t, target: null } : null;
      if (e.on) once('focus', 'Focus: the hawk picks out something ahead. A solid ring means it has a target; dashed, nothing in reach.');
    }
  }

  // the best thing ahead and below to focus on: prey first, then a branch
  function findTarget() {
    const f = b.face, x0 = Math.min(b.x, b.x + f * FOCUS_RANGE), x1 = Math.max(b.x, b.x + f * FOCUS_RANGE);
    let best = null, bs = Infinity;
    const consider = (kind, x, y, ref) => {
      const dx = (x - b.x) * f, dy = y - b.y;
      if (dx < -10 || dy < -40) return;
      const sc = Math.hypot(dx, dy) * (kind === 'perch' ? 1.4 : 1);
      if (sc < bs && Math.hypot(dx, dy) < FOCUS_RANGE) { bs = sc; best = { kind, ref }; }
    };
    for (const m of W.miceIn(x0, x1)) {
      if (G.eaten.has(m.id + ':' + G.day)) continue;
      const q = mousePos(m, G.t); if (q.show > .5) consider('mouse', q.x, q.y, m);
    }
    for (const p of W.pondsIn(x0, x1)) {
      if (W.frozen(p)) continue;
      for (const fi of p.fish) if (!G.eaten.has(fi.id + ':' + G.day)) { const q = fishPos(fi, p, G.t); consider('fish', q.x, q.y, { fi, p }); }
    }
    for (const q of W.perchesIn(x0, x1)) if (!q.occupied && q !== b.perch) consider('perch', q.x, q.y, q);
    return best;
  }
  const posOf = t => t.kind === 'mouse' ? mousePos(t.ref, G.t) : t.kind === 'fish' ? fishPos(t.ref.fi, t.ref.p, G.t) : { x: t.ref.x, y: t.ref.y - 3 };
  const alive = t => t.kind === 'mouse' ? !G.eaten.has(t.ref.id + ':' + G.day) && mousePos(t.ref, G.t).show > .2
    : t.kind === 'fish' ? !G.eaten.has(t.ref.fi.id + ':' + G.day) : !t.ref.occupied;

  // per frame: handle the strips' events; returns the yoke and any focus steering for the bird
  function update(st) {
    // the singing string covers the right strip (the left one, left-handed)
    const songSide = G.settings.lefty ? 'L' : 'R';
    strips.disable(songSide, singer.open);
    strips.disable(songSide === 'L' ? 'R' : 'L', false);
    strips.show(!G.photo && !G.roost && !G.paused);
    if (G.roost || G.photo) return { yoke: null, steer: null };
    for (const e of st.events) onEvent(e);
    const F = G.focus;
    if (F) {
      if (!F.target || !alive(F.target)) F.target = findTarget();
      const t = F.target;
      if (t) {
        const q = posOf(t); F.x = q.x; F.y = q.y; F.kind = t.kind;
        if (t.kind === 'perch') {
          if (b.target !== t.ref) { b.target = t.ref; if (b.state !== 'fly') flap(b, G.flapPower, G); b.target = t.ref; }
          return { yoke: null, steer: null };
        }
        if (b.state !== 'fly') { if (b.state === 'perch' || b.state === 'ground') flap(b, G.flapPower, G); return { yoke: null, steer: null }; }
        return { yoke: null, steer: { wx: q.x, wy: q.y + 4, dive: true } };
      }
      F.x = b.x + b.face * 70; F.y = b.y + 30; F.kind = null;
      return { yoke: null, steer: null };
    }
    const { L, R } = st.held;
    if (b.state !== 'fly' || (L === null && R === null)) return { yoke: null, steer: null };
    const both = L !== null && R !== null;
    return { yoke: { p: ((R ?? 0) - (L ?? 0)) / 2 * b.face, avg: both ? (L + R) / 2 : 0 }, steer: null };
  }
  return { update };
}
