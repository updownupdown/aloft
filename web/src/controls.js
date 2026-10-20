// What taps, holds and strokes do, state by state (gestures.js reads them off the screen).
// In the air, where you touch is where the hawk goes:
//  hold:    the hawk flies toward the finger, and follows it as it slides. Above the hawk it
//           hovers; above and a little behind it slows on back-beats (then hovers once slowed);
//           well behind it turns round and comes back toward the finger. Held inside a thermal,
//           the hawk circles up it on its own.
//  tap:     a flap, and the line it sets: a tap ahead and higher climbs that way, ahead and
//           lower dives that way; above hovers, above-behind slows, well behind turns round.
//           A tap on a ring heads through it, if the hawk can reach it on the speed it has.
//  double tap: a target: a branch (perch on it), berries, a worm or a twig (land and take it),
//           a mouse or a fish (stoop on it), a thermal (ride it), or anywhere else (fly there).
//  strokes: a circle loops or flips (and carries the hawk through a ring it is drawn through);
//           a line drawn to a mouse or fish stoops on it; a quick swipe back turns round; out
//           and back (a hook) rides the nearest thermal.
// The hawk never flaps by itself: climbing is the player's taps.
//  perched: tap either side = hop that way; tap well above = take off toward it; swipe down =
//           drop to the branch below; three quick taps = take off; double tap a branch = fly to it.
//  ground:  tap = hop toward it (tap food or water to walk there and eat or drink); hold = walk
//           toward the finger; tap or hold well above = take off; three quick taps = take off.
//  water:   tap = paddle that way (tap the water by the hawk to drink); tap well above or three
//           quick taps = take off.
import * as W from './world.js';
import { flap, nudge, turn, hopDown, hopSide } from './bird.js';
import { TUNE as T } from './tune.js';
import { mousePos, fishPos } from './life.js';

const RANGE = { prey: 340, thermal: 2600 };
const AXIS = Math.PI / 4;   // a swipe within 45 degrees of an axis counts as that way
const DEG = Math.PI / 180;
// where a touch sits from the hawk on screen (degrees from straight ahead, up positive):
// straight up hovers, up and behind slows, far behind turns
const HOVER = [62, 118], SLOW = 160, BEHIND = 70, NEAR = 18;

export function createControls({ G, b, gestures, toWorld, tapThing, interact, nearestPerch, foodAt, once }) {
  const RING_REACH = 260;   // world units: how far off a ring a drawn loop can carry the hawk
  // the latched mode: what the hawk keeps doing until something else replaces it
  const C = { mode: null, holding: false, braked: false, turned: false };
  const set = (kind, extra = {}) => { C.mode = kind ? { kind, t: G.t, ...extra } : null; gestures.setMode(kind && signOf(kind, C.mode)); if (!kind) { G.focus = null; b.target = null; } };
  const signOf = (k, M) => ({ glide: 'glide', ride: 'ride', prey: 'prey', perch: 'perch', food: 'food', point: 'glide', ring: 'glide', hover: 'hover', slow: 'brake', heading: M?.sign })[k] || null;
  const flying = () => b.state === 'fly';
  const takeOff = () => { b.target = null; flap(b, G.flapPower, G); gestures.sign('takeoff'); };
  const hawkScreen = () => [(b.x - G.cam.x) * G.view.s, (b.y - G.cam.y) * G.view.s];

  // where a screen point sits from the hawk
  function zone(p) {
    const [hx, hy] = hawkScreen(), fwd = (p.x - hx) * b.face, up = hy - p.y, d = Math.hypot(fwd, up), a = Math.atan2(up, fwd) / DEG;
    const kind = d < NEAR ? 'near' : a >= HOVER[0] && a <= HOVER[1] ? 'hover' : a > HOVER[1] && a <= SLOW ? 'slow' : fwd < -BEHIND ? 'back' : 'go';
    return { kind, fwd, up, a, d };
  }
  const lineSign = a => a > 12 ? 'glideup' : a < -12 ? 'glidedown' : 'glide';

  // can the hawk reach a point on the speed it has, gliding, without a flap? Speed buys height
  // (s^2 / 2g, less what drag takes), and a glide sinks a little over the distance.
  function reachable(x, y) {
    const dx = Math.abs(x - b.x), climb = b.y - y, behind = (x - b.x) * b.face < 0;
    const budget = (b.s * b.s - 45 * 45) / (2 * T.gravity) * .8 * (behind ? .8 : 1) - dx * .06 + b.air * dx / Math.max(b.s, 30);
    return climb <= budget;
  }

  /* ---------- taps ---------- */
  function onTap(e) {
    const w = toWorld(e), z = G.view.z;
    if (flying()) {
      if (e.n >= 2) { if (target(e, w)) return; }
      // a ring: head through it, but only if the hawk can get there on the speed it has
      const r = ringAt(e);
      if (r && reachable(r.x, r.y)) { set('ring', { r }); b.ringAim = { r, t: G.t }; gestures.sign('glide', 'glide'); return; }
      const Z = zone(e);
      if (Z.kind === 'hover') { set('hover'); gestures.sign('hover', 'hover'); once('hang', 'Hovering: a touch right above the hawk holds it there on beating wings. It tires the wings.', 5); return; }
      if (Z.kind === 'slow') { set('slow'); C.braked = false; gestures.sign('brake', 'brake'); return; }
      if (Z.kind === 'back') { set(null); turn(b); flap(b, G.flapPower, G, .9); gestures.sign('turn'); return; }
      flap(b, G.flapPower, G, .9);
      if (Z.kind === 'near' || Math.abs(Z.a) < 8) { if (C.mode?.kind === 'heading' || C.mode?.kind === 'hover' || C.mode?.kind === 'slow') set(null); return; }
      // a flap and a new line: toward the tap, held a while
      const aimG = Math.max(-1, Math.min(.7, Math.atan2(Z.up, Math.max(Z.fwd, 20))));
      set('heading', { aimG, sign: lineSign(Z.a) }); gestures.sign(lineSign(Z.a), lineSign(Z.a));
      return;
    }
    if (e.n >= 3) { set(null); takeOff(); return; }
    if (e.n >= 2) { const pr = nearestPerch(w.x, w.y, 16 * z); if (pr && pr !== b.perch) { goPerch(pr); return; } }
    if (tapThing(w)) { gestures.sign('eat'); return; }
    const Z = zone(e);
    if (Z.up > 80 && Z.a > 40 && Z.a < 140) { set(null); takeOff(); return; }
    const dir = Math.abs(w.x - b.x) > 6 ? Math.sign(w.x - b.x) : b.face;
    if (b.state === 'swim') nudge(b, dir);
    else if (hopSide(b, G, dir)) gestures.sign('hop');
  }
  // a double tap in the air: whatever is under it becomes the hawk's target
  function target(e, w) {
    const z = G.view.z;
    const pr = nearestPerch(w.x, w.y, 16 * z);
    if (pr && pr !== b.perch) { goPerch(pr); return true; }
    const f = foodAt(w.x, w.y, 16 * z);
    if (f) { set('food', { food: f }); gestures.sign('food', 'food'); once('tapfood', 'Heading for those: a double tap on berries, a worm or a twig flies the hawk down to them.'); return true; }
    const q = preyNear(e.x, e.y, 34);
    if (q) { set('prey', { target: q }); gestures.sign('prey', 'prey'); return true; }
    const th = w.y < W.groundY(w.x) - 20 && W.thermalAt(w.x);
    if (th) { set('ride', { th, th0: th }); gestures.sign('ride', 'ride'); return true; }
    set('point', { wx: w.x, wy: Math.min(w.y, W.groundY(w.x) - 4) }); gestures.sign('glide', 'glide');
    once('tappoint', 'A double tap sets a place to fly to: a branch, food, prey, a thermal, or just a spot in the sky.', 6);
    return true;
  }
  function goPerch(pr) {
    set('perch', { perch: pr }); b.target = pr; gestures.sign('perch', 'perch');
    if (!flying()) { flap(b, G.flapPower, G); b.target = pr; }
    once('tapperch', 'Heading for that branch: a double tap on a branch flies the hawk there to perch. If it is above, flap to climb to it.');
  }
  function ringAt(p) {
    const s = G.view.s;
    for (const r of G.visibleRings) if (!r.gone && Math.hypot((r.x - G.cam.x) * s - p.x, (r.y - G.cam.y) * s - p.y) < r.r * s + 14) return r;
    return null;
  }
  function preyNear(sx, sy, rad) {
    const s = G.view.s, w = toWorld({ x: sx, y: sy });
    let best = null, bd = rad;
    const consider = (kind, ref, q) => { const d = Math.hypot((q.x - G.cam.x) * s - sx, (q.y - G.cam.y) * s - sy); if (d < bd) { bd = d; best = { kind, ref }; } };
    for (const m of W.miceIn(w.x - 80, w.x + 80)) { if (G.eaten.has(m.id + ':' + G.day)) continue; const q = mousePos(m, G.t); if (q.show > .3) consider('mouse', m, q); }
    for (const p of W.pondsIn(w.x - 80, w.x + 80)) { if (W.frozen(p)) continue; for (const fi of p.fish) if (!G.eaten.has(fi.id + ':' + G.day)) consider('fish', { fi, p }, fishPos(fi, p, G.t)); }
    return best;
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
      if (e.dir !== b.face && flying()) { set(null); turn(b); gestures.sign('turn'); return; }
      if (!flying()) takeOff();
      set('ride'); gestures.sign('ride', 'ride');
      return;
    }
    const prey = preyAlong(e);
    if (prey) { if (!flying()) takeOff(); set('prey', { target: prey }); gestures.sign('prey', 'prey'); return; }
    const fwd = e.dx * b.face, up = -e.dy, a = Math.atan2(up, fwd);
    const way = Math.abs(a) < AXIS ? 'forward' : Math.abs(a) > Math.PI - AXIS ? 'back' : a > 0 ? 'up' : 'down';
    if (!flying()) {
      if (way === 'up') { set(null); takeOff(); }
      else if (way === 'down') { if (b.state === 'perch') { hopDown(b, G, b.face); gestures.sign('land'); } else { interact(); gestures.sign('eat'); } }
      else if (b.state === 'swim') nudge(b, Math.sign(e.dx));
      else if (hopSide(b, G, Math.sign(e.dx))) gestures.sign('hop');
      return;
    }
    if (way === 'back') { const keep = C.mode?.kind === 'ride' ? C.mode : null; set(null); if (keep) { C.mode = keep; gestures.setMode('ride'); } turn(b); gestures.sign('turn', keep ? 'ride' : null); return; }
    if (way === 'forward') { set('glide'); gestures.sign('glide', 'glide'); }
  }
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
  // riding a thermal: into its core, then circling up it (the hawk turns at the edges itself)
  function ride(t) {
    if (!t) return { yoke: { p: 0, mode: 'glide' } };
    if (Math.abs(b.x - t.c) < t.w * .45) { G.focus = null; return { yoke: { p: 0, mode: 'ride' } }; }
    G.focus = { mode: 'thermal', kind: 'thermal', x: t.c, y: Math.min(b.y, t.y0 - 40), target: { ref: t } };
    return { steer: { wx: t.c, wy: b.y - 6 } };
  }
  // back-beats until the hawk has all but stopped, then a hover
  function slow() {
    if (b.s < 46) C.braked = true;
    gestures.setMode(C.braked ? 'hover' : 'brake');
    return { yoke: { p: 0, mode: C.braked || b.stamina < .05 ? 'hang' : 'brake', loopOk: false } };
  }
  function runMode() {
    const M = C.mode; if (!M) return null;
    if (M.kind === 'perch') {
      if (b.state === 'perch' || b.state === 'ground' || b.state === 'swim' || (flying() && b.target !== M.perch && G.t - M.t > .5)) { C.mode = null; gestures.setMode(null); return null; }
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
      if (Math.abs(dx) < 26) return { yoke: { p: 0, mode: 'land' } };
      return { steer: { wx: f.x - Math.sign(dx) * 8, wy: Math.min(gy - 6, b.y + Math.abs(dx) * .9) } };
    }
    if (!flying()) { if (G.t - M.t > .6) set(null); return null; }
    if (M.kind === 'glide') return { yoke: { p: 0, mode: 'glide' } };
    if (M.kind === 'hover') { if (b.stamina < .05) { set(null); return null; } return { yoke: { p: 0, mode: 'hang', loopOk: false } }; }
    if (M.kind === 'slow') return slow();
    if (M.kind === 'heading') { if (G.t - M.t > 2.5) { set(null); return null; } return { yoke: { p: 0, aimG: M.aimG, loopOk: false } }; }
    if (M.kind === 'point') {
      if (Math.hypot(M.wx - b.x, M.wy - b.y) < 14 || G.t - M.t > 15) { set(null); return null; }
      return { steer: { wx: M.wx, wy: M.wy } };
    }
    if (M.kind === 'ring') {
      if (M.r.gone || (M.r.x - b.x) * b.face < -10 || G.t - M.t > 8) { set(null); return null; }
      return { steer: { wx: M.r.x, wy: M.r.y } };
    }
    if (M.kind === 'ride') {
      if (!M.th || Math.abs(M.th.c - b.x) > M.th.w * 1.6 + (M.th === M.th0 ? 3000 : 0)) M.th = W.thermalAt(b.x) || nearestThermal();
      return ride(M.th);
    }
    return null;
  }

  /* ---------- a hold: the hawk goes where the finger is ---------- */
  function holdFly(p) {
    const w = toWorld(p);
    // inside a thermal (the finger, in its column above the ground): circle up it
    const Z = zone(p);
    // (slowing and turning round keep their meaning even over a thermal)
    const th = Z.kind !== 'slow' && Z.kind !== 'back' && w.y < W.groundY(w.x) - 20 && W.thermalAt(w.x);
    if (th) { gestures.setMode('ride'); return ride(th); }
    if (Z.kind !== 'slow' && Z.kind !== 'hover') C.braked = false;
    if (Z.kind === 'back' && !C.turned) { C.turned = true; turn(b); gestures.sign('turn'); }
    if (Z.kind !== 'back') C.turned = false;
    if (Z.kind === 'near') { gestures.setMode(null); return null; }
    if (Z.kind === 'hover') { if (b.stamina < .05) return null; gestures.setMode('hover'); return { yoke: { p: 0, mode: 'hang', loopOk: false } }; }
    if (Z.kind === 'slow') return slow();
    // toward the finger (just behind and below is taken as ahead, so it never swings round there)
    const ahead = Math.max(Z.fwd, 24) * b.face;
    gestures.setMode(lineSign(Z.a));
    return { steer: { wx: b.x + ahead / G.view.s, wy: w.y } };
  }
  function holdStill(p) {
    const Z = zone(p), w = toWorld(p);
    if (Z.up > 60 && Z.a > 30 && Z.a < 150) { takeOff(); return null; }
    if (b.state === 'ground' && Math.abs(w.x - b.x) > 8) return { steer: { wx: w.x, wy: b.y } };
    return null;
  }

  // per frame: handle the gestures; returns the yoke and any steering for the bird
  function update(g) {
    if (G.roost || G.photo) { set(null); return { yoke: null, steer: null }; }
    for (const e of g.events) {
      if (e.type === 'tap') onTap(e);
      else if (e.type === 'stroke') onStroke(e);
      else if (e.type === 'holdStart') { C.holding = true; C.braked = false; C.turned = false; if (flying()) { set(null); once('hold', 'Hold a finger where you want the hawk to go: it follows. Right above it hovers, above and behind it slows, well behind it turns round.', 7); } }
      else if (e.type === 'holdEnd') { C.holding = false; gestures.setMode(C.mode && signOf(C.mode.kind, C.mode)); }
    }
    if (C.holding && g.aim) {
      const r = flying() ? holdFly(g.aim) : holdStill(g.aim);
      if (r || flying()) return { yoke: r?.yoke || null, steer: r?.steer || null };
    }
    const r = runMode();
    return { yoke: r?.yoke || null, steer: r?.steer || null };
  }
  return { update, get mode() { return C.mode?.kind || null; }, clear: () => set(null) };
}
