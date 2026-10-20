// What taps, strokes and holds do, state by state (gestures.js reads them off the screen).
//  flying:  tap anywhere = flap. Double tap a branch = fly to it and perch; double tap berries
//           (or a worm, a twig) = fly down to them and eat (or pick it up).
//           a line drawn to a mouse or fish = stoop on it.
//           swipe back (against the way you fly) = turn round; swipe forward = long glide;
//           forward-then-back hook = ride a thermal (or head for the nearest and ride it);
//           a circle = a loop or front flip, drawn the way the nose goes; drawn through a ring
//           close by, the loop carries the hawk through it.
//           hold (keep the finger down a moment, moved or not), then lean it:
//             up = hover; up and forward = glide up (trading speed for height); forward = the
//             longest glide; down and forward = glide down (gaining speed); down, or down and
//             back = settle down to land; back = slow on back-beats, then hover once slowed.
//           Within each the lean is graded: a little up glides up gently, more climbs steeply.
//           Holding back never turns; only a clean swipe does.
//           Only a ride (the hook) circles in a thermal; otherwise the hawk flies straight on.
//  perched: tap either side = hop that way; swipe down = drop to the branch below; swipe up
//           or three quick taps = take off; double tap another branch = fly to it.
//  ground:  tap = hop toward it (tap food or water to walk there and eat or drink); swipe
//           down = eat or drink here; swipe up or three quick taps = take off.
//  water:   tap = paddle that way (tap the water by the hawk to drink); swipe up or three
//           quick taps = take off.
// A new gesture replaces whatever the hawk was doing; a flap leaves a glide, a ride, or a
// flight to a branch, food or prey alone.
import * as W from './world.js';
import { flap, nudge, turn, hopDown, hopSide } from './bird.js';
import { mousePos, fishPos } from './life.js';

const RANGE = { prey: 340, thermal: 2600 };
const AXIS = Math.PI / 4;   // a swipe within 45 degrees of an axis counts as that way

export function createControls({ G, b, gestures, toWorld, tapThing, interact, nearestPerch, foodAt, once }) {
  const RING_REACH = 260;   // world units: how far off a ring a drawn loop can carry the hawk
  // the latched mode: what the hawk keeps doing until something else replaces it
  const C = { mode: null, holding: false, hold: null, braked: false };
  const set = (kind, extra = {}) => { C.mode = kind ? { kind, t: G.t, ...extra } : null; gestures.setMode(kind && signOf(kind)); if (!kind) G.focus = null; };
  const signOf = k => ({ glide: 'glide', ride: 'ride', prey: 'prey', perch: 'perch', food: 'food' })[k] || null;
  const flying = () => b.state === 'fly';
  const takeOff = () => { b.target = null; flap(b, G.flapPower, G); gestures.sign('takeoff'); };

  /* ---------- taps ---------- */
  function onTap(e) {
    const w = toWorld(e), z = G.view.z;
    const pr = e.n >= 2 ? nearestPerch(w.x, w.y, 16 * z) : null;
    if (flying()) {
      if (pr && pr !== b.perch) { goPerch(pr); return; }
      const f = e.n >= 2 && !pr ? foodAt(w.x, w.y, 16 * z) : null;
      if (f) { goFood(f); return; }
      flap(b, G.flapPower, G, .9);
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

  function goFood(f) {
    set('food', { food: f }); b.target = null; gestures.sign('food', 'food');
    once('tapfood', 'Heading for those: a double tap on berries, a worm or a twig flies the hawk down to them.');
  }

  /* ---------- strokes ---------- */
  function onStroke(e) {
    if (e.kind === 'circle') {
      if (!flying()) { set(null); takeOff(); return; }
      // drawn the way the nose goes: over the top (anticlockwise heading right) is a loop
      const dir = (e.cw ? 1 : -1) === b.face ? -1 : 1;
      set(null); b.s = Math.max(b.s, 92); b.stall = false; b.hover = 0;
      b.loop = { dir, a: 0 }; G.emit('loop'); gestures.sign('flip');
      const r = ringThrough(e);
      if (r) b.ringAim = { r, t: G.t };
      return;
    }
    if (e.kind === 'hook') {
      if (e.dir !== b.face && flying()) { turn(b); gestures.sign('turn'); return; }
      if (!flying()) takeOff();
      set('ride'); gestures.sign('ride', 'ride');
      once('ride', 'Riding the thermal: the hawk floats up as high as the air goes, turning back softly at the edges. With none here, it heads for the nearest.', 6);
      return;
    }
    // a line: first, does it end on (or point straight at) a mouse or a fish?
    const prey = preyAlong(e);
    if (prey) {
      if (!flying()) takeOff();
      set('prey', { target: prey }); gestures.sign('prey', 'prey');
      return;
    }
    const fwd = e.dx * b.face, up = -e.dy, a = Math.atan2(up, fwd);
    const way = Math.abs(a) < AXIS ? 'forward' : Math.abs(a) > Math.PI - AXIS ? 'back' : a > 0 ? 'up' : 'down';
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
    // (straight up or down does nothing in the air: hovering and landing are holds)
    once('updown', 'To hover or land, hold a finger down a moment, then lean it up to hover or down to land.', 5);
  }
  // a ring the drawn loop passes through (or close round), near enough and placed so the hawk
  // could reach it from here at about this speed: ahead or just above or below, not far behind
  function ringThrough(e) {
    const s = G.view.s, pts = e.pts;
    let best = null, bd = Infinity;
    for (const r of G.visibleRings) {
      if (r.gone) continue;
      const dx = r.x - b.x, dy = r.y - b.y;
      if (Math.hypot(dx, dy) > RING_REACH || dx * b.face < -120 || Math.abs(dy) > 170) continue;
      const sx = (r.x - G.cam.x) * s, sy = (r.y - G.cam.y) * s, near = r.r * s + 22;
      let d = Infinity;
      for (const p of pts) d = Math.min(d, Math.hypot(p[0] - sx, p[1] - sy));
      if (d < near && d < bd) { bd = d; best = r; }
    }
    return best;
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
    if (M.kind === 'food') {
      const f = M.food;
      if (b.state === 'ground') { set(null); tapThing(f); return null; }
      if (!flying()) { set(null); return null; }
      const gy = W.groundY(f.x), dx = f.x - b.x;
      if (Math.abs(dx) > 420 || G.t - M.t > 12) { set(null); return null; }
      // over it, settle straight down; until then, glide toward a point just above it
      if (Math.abs(dx) < 26) return { yoke: { p: 0, mode: 'land' } };
      return { steer: { wx: f.x - Math.sign(dx) * 8, wy: Math.min(gy - 6, b.y + Math.abs(dx) * .9) } };
    }
    if (!flying()) { if (G.t - M.t > .6) set(null); return null; }
    if (M.kind === 'glide') return { yoke: { p: 0, mode: 'glide' } };
    if (M.kind === 'ride') {
      if (!M.th || Math.abs(M.th.c - b.x) > M.th.w * 1.6) M.th = W.thermalAt(b.x) || nearestThermal();
      const t = M.th; if (!t) return { yoke: { p: 0, mode: 'glide' } };
      if (Math.abs(b.x - t.c) < t.w * .45) { G.focus = null; return { yoke: { p: 0, mode: 'ride' } }; }
      G.focus = { mode: 'thermal', kind: 'thermal', x: t.c, y: Math.min(b.y, t.y0 - 40), target: { ref: t } };
      return { steer: { wx: t.c, wy: b.y - 6 } };
    }
    return null;
  }

  /* ---------- a hold, leaned ---------- */
  // eight ways round, graded within each so a small change of lean is a small change of line
  const DEG = Math.PI / 180;
  function holdYoke(v) {
    const fwd = v.x * b.face, up = -v.y, m = Math.min(1, Math.hypot(fwd, up));
    if (m < .25) { C.hold = null; gestures.setMode(null); return null; }
    const a = Math.atan2(up, fwd), A = Math.abs(a) / DEG;
    let way, Y;
    if (A <= 22.5) { way = 'glide'; Y = { p: 0, mode: 'glide' }; }
    else if (a > 0 && A <= 67.5) {
      // glide up: the steeper the lean (and the further), the steeper the climb
      const t = (A - 22.5) / 45;
      way = 'glideup'; Y = { p: 0, aimG: (.1 + .55 * t) * (.55 + .45 * m), kite: true };
    } else if (a > 0 && A <= 157.5) { way = 'hover'; Y = { p: 0, mode: 'hang' }; }
    else if (A > 157.5) {
      // back: back-beats until the hawk has all but stopped, then it hangs there
      if (C.hold === 'brake' && b.s < 46) C.braked = true;
      way = C.braked ? 'hover' : 'brake'; Y = C.braked ? { p: 0, mode: 'hang' } : { p: 0, mode: 'brake' };
    } else if (A <= 67.5) {
      const t = (A - 22.5) / 45;
      way = 'glidedown'; Y = { p: 0, aimG: -(.18 + .75 * t) * (.55 + .45 * m) };
    } else { way = 'land'; Y = { p: 0, mode: 'land' }; }
    if (way !== 'brake' && way !== 'hover') C.braked = false;
    if (way === 'hover' && b.stamina < .05) { way = 'glide'; Y = { p: 0, mode: 'glide' }; }
    C.hold = way; gestures.setMode(way);
    return { ...Y, loopOk: false };
  }

  // per frame: handle the gestures; returns the yoke and any steering for the bird
  function update(g) {
    if (G.roost || G.photo) { set(null); return { yoke: null, steer: null }; }
    for (const e of g.events) {
      if (e.type === 'tap') onTap(e);
      else if (e.type === 'stroke') onStroke(e);
      else if (e.type === 'holdStart') { C.holding = true; C.hold = null; C.braked = false; if (flying()) { set(null); once('hold', 'Holding: lean up to hover, forward for the longest glide, a little up or down to glide up or down, down to land, back to slow down.', 7); } }
      else if (e.type === 'holdEnd') { C.holding = false; C.hold = null; C.braked = false; gestures.setMode(C.mode && signOf(C.mode.kind)); }
    }
    if (C.holding && g.aim && flying()) return { yoke: holdYoke(g.aim), steer: null };
    const r = runMode();
    return { yoke: r?.yoke || null, steer: r?.steer || null };
  }
  return { update, get mode() { return C.mode?.kind || null; }, clear: () => set(null) };
}
