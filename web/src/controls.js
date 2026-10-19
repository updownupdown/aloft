// What taps, strokes and holds do, state by state (gestures.js reads them off the screen).
//  flying:  tap anywhere = flap. Double tap a branch = fly to it and perch.
//           a line drawn to a mouse or fish = stoop on it.
//           swipe back (against the way you fly) = turn round; swipe forward = long glide;
//           swipe down = settle and land; swipe up = hover; forward-then-back hook = ride a
//           thermal (or head for the nearest and ride it); a circle = a loop or front flip,
//           drawn the way the nose goes.
//           tap, hold, then aim: up noses up toward a hover (kiting into the wind), forward
//           flattens into a long glide, down dives (far down stoops), back slows with
//           back-beats. Aiming back never turns; only a clean swipe does.
//  perched: tap either side = hop that way; swipe down = drop to the branch below; swipe up
//           or three quick taps = take off; double tap another branch = fly to it.
//  ground:  tap = hop toward it (tap food or water to walk there and eat or drink); swipe
//           down = eat or drink here; swipe up or three quick taps = take off.
//  water:   tap = paddle that way (tap the water by the hawk to drink); swipe up or three
//           quick taps = take off.
// A new gesture replaces whatever the hawk was doing; a flap leaves a glide, a ride, or a
// flight to a branch or prey alone, but ends a hover or a landing.
import * as W from './world.js';
import { flap, nudge, turn, hopDown, hopSide } from './bird.js';
import { mousePos, fishPos } from './life.js';

const RANGE = { prey: 340, thermal: 2600 };
const AXIS = Math.PI / 4;   // a swipe within 45 degrees of an axis counts as that way

export function createControls({ G, b, gestures, toWorld, tapThing, interact, nearestPerch, once }) {
  // the latched mode: what the hawk keeps doing until something else replaces it
  const C = { mode: null, holdMode: null };
  const set = (kind, extra = {}) => { C.mode = kind ? { kind, t: G.t, ...extra } : null; gestures.setMode(kind && signOf(kind)); if (!kind) G.focus = null; };
  const signOf = k => ({ land: 'land', hover: 'hover', glide: 'glide', ride: 'ride', prey: 'prey', perch: 'perch' })[k] || null;
  const flying = () => b.state === 'fly';
  const takeOff = () => { b.target = null; flap(b, G.flapPower, G); gestures.sign('takeoff'); };

  /* ---------- taps ---------- */
  function onTap(e) {
    const w = toWorld(e), z = G.view.z;
    const pr = e.n >= 2 ? nearestPerch(w.x, w.y, 16 * z) : null;
    if (flying()) {
      if (pr && pr !== b.perch) { goPerch(pr); return; }
      flap(b, G.flapPower, G, .9);
      if (C.mode && (C.mode.kind === 'land' || C.mode.kind === 'hover')) set(null);
      return;
    }
    if (e.n >= 3) { set(null); takeOff(); return; }
    if (pr && pr !== b.perch) { goPerch(pr); return; }
    if (tapThing(w)) { gestures.sign('eat'); return; }
    const dir = Math.abs(w.x - b.x) > 6 ? Math.sign(w.x - b.x) : b.face;
    if (b.state === 'swim') nudge(b, dir);
    else if (hopSide(b, G, dir)) gestures.sign('hop');
  }
  function goPerch(pr) {
    set('perch', { perch: pr }); b.target = pr; gestures.sign('perch', 'perch');
    if (!flying()) { flap(b, G.flapPower, G); b.target = pr; }
    once('tapperch', 'Heading for that branch: a double tap on a branch flies the hawk there to perch.');
  }

  /* ---------- strokes ---------- */
  function onStroke(e) {
    if (e.kind === 'circle') {
      e.trail.tint = 'ink';
      if (!flying()) { set(null); takeOff(); return; }
      // drawn the way the nose goes: over the top (anticlockwise heading right) is a loop
      const dir = (e.cw ? 1 : -1) === b.face ? -1 : 1;
      set(null); b.s = Math.max(b.s, 92); b.stall = false; b.hover = 0;
      b.loop = { dir, a: 0 }; G.emit('loop'); gestures.sign('flip');
      return;
    }
    if (e.kind === 'hook') {
      e.trail.tint = 'thermal';
      if (e.dir !== b.face && flying()) { turn(b); gestures.sign('turn'); e.trail.tint = 'turn'; return; }
      if (!flying()) takeOff();
      set('ride'); gestures.sign('ride', 'ride');
      once('ride', 'Riding the thermal: the hawk floats up as high as the air goes, turning back softly at the edges. With none here, it heads for the nearest.', 6);
      return;
    }
    // a line: first, does it end on (or point straight at) a mouse or a fish?
    const prey = preyAlong(e);
    if (prey) {
      e.trail.tint = 'prey';
      if (!flying()) takeOff();
      set('prey', { target: prey }); gestures.sign('prey', 'prey');
      return;
    }
    const fwd = e.dx * b.face, up = -e.dy, a = Math.atan2(up, fwd);
    const way = Math.abs(a) < AXIS ? 'forward' : Math.abs(a) > Math.PI - AXIS ? 'back' : a > 0 ? 'up' : 'down';
    e.trail.tint = way === 'back' && flying() ? 'turn' : 'ink';
    if (!flying()) {
      if (way === 'up') { set(null); takeOff(); }
      else if (way === 'down') { if (b.state === 'perch') { hopDown(b, G, b.face); gestures.sign('land'); } else { interact(); gestures.sign('eat'); } }
      else if (b.state === 'swim') nudge(b, Math.sign(e.dx));
      else if (hopSide(b, G, Math.sign(e.dx))) gestures.sign('hop');
      return;
    }
    if (way === 'back') {
      // a turn keeps a glide or a ride going; anything else it ends
      const keep = C.mode?.kind === 'glide' || C.mode?.kind === 'ride';
      if (!keep) set(null);
      turn(b); gestures.sign('turn', keep ? signOf(C.mode.kind) : null); return;
    }
    if (way === 'forward') { set('glide'); gestures.sign('glide', 'glide'); return; }
    if (way === 'down') { set('land'); gestures.sign('land', 'land'); once('settle', 'Settling down: the hawk slows and lets itself down to land where it is.'); return; }
    set('hover'); gestures.sign('hover', 'hover');
    once('hang', 'Hovering: the hawk hangs on beating wings to look around. It tires the wings.', 5);
  }
  // the mouse or fish a line was drawn to: one close to where it ends, or one it points at
  function preyAlong(e) {
    const s = G.view.s, w1 = toWorld({ x: e.x1, y: e.y1 });
    let best = null, bd = Infinity;
    const ux = e.dx / Math.hypot(e.dx, e.dy), uy = e.dy / Math.hypot(e.dx, e.dy);
    const consider = (kind, ref, q) => {
      if (Math.hypot(q.x - b.x, q.y - b.y) > RANGE.prey) return;
      const sx = (q.x - G.cam.x) * s, sy = (q.y - G.cam.y) * s;
      const end = Math.hypot(sx - e.x1, sy - e.y1);
      // along the line, beyond its start: how far the prey sits off it
      const along = (sx - e.x0) * ux + (sy - e.y0) * uy, off = Math.abs((sx - e.x0) * uy - (sy - e.y0) * ux);
      const d = end < 46 ? end : along > 0 && off < 26 && e.straight < 1.25 ? 40 + off + along * .05 : Infinity;
      if (d < bd) { bd = d; best = { kind, ref }; }
    };
    for (const m of W.miceIn(w1.x - RANGE.prey, w1.x + RANGE.prey)) {
      if (G.eaten.has(m.id + ':' + G.day)) continue;
      const q = mousePos(m, G.t); if (q.show > .3) consider('mouse', m, q);
    }
    for (const p of W.pondsIn(w1.x - RANGE.prey, w1.x + RANGE.prey)) {
      if (W.frozen(p)) continue;
      for (const fi of p.fish) if (!G.eaten.has(fi.id + ':' + G.day)) consider('fish', { fi, p }, fishPos(fi, p, G.t));
    }
    return best;
  }

  /* ---------- the latched mode, every frame ---------- */
  const posOf = t => t.kind === 'mouse' ? mousePos(t.ref, G.t) : t.kind === 'fish' ? fishPos(t.ref.fi, t.ref.p, G.t) : { x: t.ref.c, y: Math.min(b.y, t.ref.y0 - 40) };
  const alive = t => t.kind === 'mouse' ? !G.eaten.has(t.ref.id + ':' + G.day) && mousePos(t.ref, G.t).show > .2 : !G.eaten.has(t.ref.fi.id + ':' + G.day);
  function nearestThermal() {
    let best = null, bs = Infinity;
    for (const t of W.thermalsIn(b.x - 400, b.x + RANGE.thermal)) {
      const d = Math.abs(t.c - b.x), ahead = (t.c - b.x) * b.face > -t.w;
      if (d * (ahead ? 1 : 2.5) < bs) { bs = d * (ahead ? 1 : 2.5); best = t; }
    }
    return best;
  }
  function runMode() {
    const M = C.mode; if (!M) return null;
    if (M.kind === 'perch') {
      if (b.state === 'perch' || b.state === 'ground' || b.state === 'swim' || (flying() && b.target !== M.perch && G.t - M.t > .5)) { set(null); return null; }
      return null;
    }
    if (M.kind === 'prey') {
      if (!alive(M.target) || (b.state !== 'fly' && G.t - M.t > .6)) { set(null); return null; }
      const q = posOf(M.target);
      G.focus = { mode: 'prey', kind: M.target.kind, x: q.x, y: q.y };
      if (!flying()) return null;
      return { steer: { wx: q.x, wy: q.y + 4, dive: true } };
    }
    if (!flying()) { if (G.t - M.t > .6) set(null); return null; }
    if (M.kind === 'land') return { yoke: { p: 0, mode: 'land' } };
    if (M.kind === 'hover') { if (b.stamina < .05) { set(null); return null; } return { yoke: { p: 0, mode: 'hang' } }; }
    if (M.kind === 'glide') return { yoke: { p: 0, mode: 'glide' } };
    if (M.kind === 'ride') {
      if (!M.th || Math.abs(M.th.c - b.x) > M.th.w * 1.6) M.th = W.thermalAt(b.x) || nearestThermal();
      const t = M.th; if (!t) return { yoke: { p: 0, mode: 'glide' } };
      if (Math.abs(b.x - t.c) < t.w * .45) { G.focus = null; return { yoke: { p: 0, mode: 'glide' } }; }
      G.focus = { mode: 'thermal', kind: 'thermal', x: t.c, y: Math.min(b.y, t.y0 - 40), target: { ref: t } };
      return { steer: { wx: t.c, wy: b.y - 6 } };
    }
    return null;
  }

  /* ---------- a hold that aims ---------- */
  function aimYoke(v) {
    const fwd = v.x * b.face, up = -v.y, m = Math.hypot(fwd, up);
    if (m < .22) { C.holdMode = null; gestures.setMode(null); return { p: 0, mode: null, loopOk: false }; }
    const a = Math.atan2(up, fwd);
    const way = Math.abs(a) < AXIS ? 'forward' : Math.abs(a) > Math.PI - AXIS ? 'back' : a > 0 ? 'up' : 'down';
    C.holdMode = way; gestures.setMode({ forward: 'glide', back: 'brake', up: 'hover', down: 'dive' }[way]);
    if (way === 'forward') return { p: 0, mode: 'glide', loopOk: false };
    if (way === 'back') return { p: 0, mode: 'brake', loopOk: false };
    // up and down hold a path angle: a little up noses up (into a wind, the hawk kites), far up hangs
    // (nosed up until it slows right down, the hawk settles into a hover rather than stall)
    if (way === 'up') return up > .75 || (b.s < 50 && b.kiteT < .3) ? { p: 0, mode: 'hang', loopOk: false } : { p: 0, aimG: .1 + up * .45, mode: null, kite: true, loopOk: false };
    return -up > .8 ? { p: 0, mode: 'stoop', loopOk: false } : { p: 0, aimG: -(.25 + -up * .8), mode: null, loopOk: false };
  }

  // per frame: handle the gestures; returns the yoke and any steering for the bird
  function update(g) {
    if (G.roost || G.photo) { set(null); return { yoke: null, steer: null }; }
    for (const e of g.events) {
      if (e.type === 'tap') onTap(e);
      else if (e.type === 'stroke') onStroke(e);
      else if (e.type === 'holdStart') { set(null); if (flying()) once('aim', 'Holding: drag up to nose up and hang, forward for a long glide, down to dive, back to slow down. Let go to fly on.', 6); }
      else if (e.type === 'holdEnd') { C.holdMode = null; gestures.setMode(C.mode && signOf(C.mode.kind)); }
    }
    if (g.aim && flying()) return { yoke: aimYoke(g.aim), steer: null };
    const r = runMode();
    return { yoke: r?.yoke || null, steer: r?.steer || null };
  }
  return { update, get mode() { return C.mode?.kind || null; }, clear: () => set(null) };
}
