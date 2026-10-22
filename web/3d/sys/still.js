// Stillness: what happens when you leave the phone alone on a perch (round eight, D1 to D5, and
// the sunning half of C3).
//   D2 left alone a few seconds, the hawk rouses its feathers, preens, stretches its wings and
//      looks about (b.acting: a pose camera.js blends in; the head turns on the neck, hawk.js)
//   D4 in rain it hunches, fluffed up, and the rain patters on what it sits on (leaves, needles,
//      a roof, a fence post, stone or the open ground)
//   C3 wet (wingcraft.js b.wet) and in the sun, it spreads its wings to dry them (b.sunning)
//   D1 the quiet hour: a minute untouched on a perch and the world comes closer: a deer steps out,
//      a songbird lands on the next branch, a fox trots by below. A touch sends them off.
//   D3 perched, tap an animal to watch it: the head and the view follow it, and after a while the
//      field guide gains a line about how it lives
//   D5 come back to a perch often and it becomes yours: marked on the map, worn pale, and you
//      land facing the way you last looked from it
// Animals to watch come from G.sight, which every system calls for what it draws (guide.js).
import { height, WATER, forest, perchesOf, ih } from '../world.js';
import { buildingsNear } from '../settle.js';
import { fencesNear } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { angleTo, clamp } from '../util.js';
import { PIG } from '../facet.js';

export const STILL = {
  idle: 7, actGap: [5, 12],          // seconds untouched before small acts, and between them
  quiet: 60, visitGap: [10, 22],      // seconds untouched on a perch before the quiet hour; between visitors
  watchFor: 6, watchMax: 30,          // seconds of watching that earn the guide line; the longest watch
  favVisits: 3, favSecs: 150,         // visits and seconds perched that make a perch yours
};

// how each animal lives, learned by watching it (D3)
const WATCH = {
  mouse: 'Watched: it stops every few steps to listen, then dashes along its runway.',
  deer: 'Watched: one always has its head up while the others graze, and they take turns.',
  heron: 'Watched: it can stand a quarter of an hour without moving a feather, then strike in a blink.',
  fish: 'Watched: it rises where the insects fall, along the shade of the bank.',
  fox: 'Watched: it stops dead, tilts its head to listen, then jumps high and pounces nose first.',
  squirrel: 'Watched: it buries a nut, pats the earth flat, then looks round to see who saw.',
  crow: 'Watched: one sits up high as a lookout while the others feed below.',
  starling: 'Watched: each bird keeps to the seven nearest it, and the whole cloud turns as one.',
  kettlehawk: 'Watched: they circle tight in the strongest lift, then glide off south together.',
  redtail: 'Watched: it soars without a beat for minutes, reading the air as you do.',
};
const WATCH_ANY = 'Watched: you know its ways a little better for sitting still with it.';

// a red fox, trotting: low and long, a brush of a tail, faces +x (as the deer)
function foxShape() {
  reseed(71); const B = builder(), red = [.78, .42, .2], dark = [.55, .28, .14], pale = [.95, .9, .82], black = [.15, .12, .1];
  blob(B, 0, .32, 0, .16, red, pale, [1.9, .85, .75]);
  blob(B, .34, .4, 0, .09, red, pale, [1.3, .85, .8]);
  blob(B, .47, .37, 0, .04, red, pale, [1.6, .7, .7]);
  for (const s of [.045, -.045]) B.tri([.33, .46, s], [.36, .47, s * 1.7], [.3, .58, s * 1.4], dark);
  blob(B, -.38, .3, 0, .09, red, red, [2, .8, .8]); blob(B, -.56, .27, 0, .05, pale, pale, [1.2, .9, .9]);
  for (const [x, z] of [[.18, .06], [.18, -.06], [-.16, .06], [-.16, -.06]]) { B.tri([x - .02, .26, z], [x + .02, .26, z], [x, 0, z], black); B.tri([x, .26, z - .02], [x, .26, z + .02], [x, 0, z], black); }
  return B.out();
}
// a songbird sitting on a twig: round, with a tail tipped down, faces +x
function perchedBird() {
  reseed(73); const B = builder(), back = [.55, .42, .3], breast = [.92, .62, .42];
  blob(B, 0, .07, 0, .05, back, breast, [1.2, 1, .9]);
  blob(B, .05, .11, 0, .032, back, breast);
  B.tri([.075, .115, -.008], [.075, .115, .008], [.1, .105, 0], [.25, .2, .15]);
  B.tri([-.04, .07, -.02], [-.04, .07, .02], [-.11, .02, 0], back);
  return B.out();
}
// the pale rubbed bark of a favourite perch
function wornShape() { reseed(79); const B = builder(), c = [.78, .7, .58]; blob(B, 0, .0, 0, .09, c, c, [1.6, .25, .9]); return B.out(); }

export function stillSystem(G) {
  const b = G.b, A = G.audio, H = G.hud;
  G.R.shape('fox', foxShape()); G.R.shape('perchbird', perchedBird()); G.R.shape('worn', wornShape());
  G.guide?.page('fox', 'Red fox', 'Hunts voles by ear in the long grass, leaping high to pounce on them.');
  const idle = () => (performance.now() - (G.touchedAt || 0)) / 1000;
  const settled = () => (b.state === 'perch' || b.state === 'ground') && !(b.settle > 0) && !(b.eating > 0) && !b.asleep;

  // ---- what can be seen: every G.sight call this frame and the last -------------------------
  let seen = [], seeing = [];
  const sight0 = G.sight;
  G.sight = (key, x, y, z, r = .5) => { seeing.push({ key, x, y, z, r }); sight0?.(key, x, y, z, r); };

  // ---- D2, D4, C3: the pose -----------------------------------------------------------------
  let act = null, actT = 0, nextAct = 8, side = 1, look = null;
  b.acting = { p: {}, k: 0 };
  const env = t => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) ** .6;
  const ACTS = {
    rouse: { dur: 1.6, pose: t => ({ fluff: env(t), flapL: .05 + (t > .35 && t < .8 ? .07 * Math.sin(t * 90) : 0), flapR: .05 + (t > .35 && t < .8 ? .07 * Math.sin(t * 90 + 1) : 0), tail: .05 + .4 * env(t) }), sound: () => A.rustle?.(.7) },
    preen: { dur: 3.8, pose: t => { const e = env(t); return { headYaw: side * 2.0 * e, headPitch: .55 * e + .12 * Math.sin(t * 24) * e, flapL: side > 0 ? .05 + .12 * e : .05, flapR: side < 0 ? .05 + .12 * e : .05, fluff: .25 * e }; }, sound: () => A.rustle?.(.3) },
    stretch: { dur: 1.8, pose: t => { const e = env(t); return { flapL: .05 + .85 * e, flapR: .05 + .85 * e, handL: -.35 * e, handR: -.35 * e, fold: 1 - .85 * e, flare: .25 * e, tail: .05 + .7 * e }; } },
    look: { dur: 2.6, pose: t => ({ headYaw: (look ?? side * .9) * env(t), headPitch: -.1 * env(t) }) },
  };
  const hunch = { fluff: .85, headPitch: .25, tail: .02, tailPitch: .35 };
  const sunPose = { flapL: .18, flapR: .18, handL: -.15, handR: -.15, fold: 0, flare: .65, tail: .85, fluff: .3, headPitch: -.1 };
  function pose(dt) {
    let want = null, k = 0;
    const rainy = (G.rain || 0) > .25, sunny = !rainy && (G.light?.night ?? 0) < .3 && (G.light?.sun?.[1] ?? 1) > .12 && !(G.overcast > .6);
    b.sunning = settled() && (b.wet || 0) > .12 && sunny;
    if (b.eating > 0 && b.eatPose) want = b.eatPose;   // food.js: bent to the feet, tearing
    else if (watch) want = watchPose();
    else if (b.sunning) want = sunPose;
    else if (settled() && rainy) want = hunch;
    if (want) { act = null; k = 1; }
    else if (settled() && idle() > STILL.idle && !G.singing) {
      if (!act && (nextAct -= dt) <= 0) {
        const pick = ['rouse', 'preen', 'preen', 'stretch', 'look', 'look'][(Math.random() * 6) | 0];
        act = ACTS[pick]; actT = 0; side = Math.random() < .5 ? 1 : -1;
        // a look goes toward something moving near by, when there is one
        const near = seen.filter(s => Math.hypot(s.x - b.p[0], s.z - b.p[2]) < 60).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
        look = pick === 'look' && near ? clamp(angleTo(b.yaw, Math.atan2(near.x - b.p[0], -(near.z - b.p[2]))), -2, 2) : null;
        act.sound?.();
        nextAct = STILL.actGap[0] + Math.random() * (STILL.actGap[1] - STILL.actGap[0]);
      }
      if (act) { actT += dt / act.dur; want = act.pose(actT); k = 1; if (actT >= 1) act = null; }
    } else { act = null; nextAct = Math.max(nextAct, 3); }
    b.acting.k += (k - b.acting.k) * Math.min(1, dt * (want ? 6 : 3));
    if (want) b.acting.p = want;
  }

  // ---- D4: rain on what you sit on ----------------------------------------------------------
  let patT = 0, surf = 'open', surfAt = null;
  function surface() {
    if (b.state === 'ground') return 'open';
    if (b.tree) { const L = b.tree.look ?? b.tree.kind; return L === 1 || L === 3 ? 'needles' : L === 5 || L === 6 ? 'open' : 'leaves'; }
    if (buildingsNear(b.p[0], b.p[2], 8).length) return 'roof';
    if (fencesNear(b.p[0], b.p[2], 1.5).length) return 'post';
    return 'stone';
  }
  const PATTER = {
    leaves: () => A.burst?.({ f: 2600 + Math.random() * 1800, q: 3, dur: .035, vol: .045 }),
    needles: () => A.burst?.({ f: 5200 + Math.random() * 1500, q: 2, dur: .02, vol: .025 }),
    roof: () => { A.tone?.({ f: 1900 + Math.random() * 900, dur: .025, vol: .035 }); A.burst?.({ f: 6000, q: 2, dur: .015, vol: .02 }); },
    post: () => A.tone?.({ f: 520 + Math.random() * 300, f2: 420, dur: .04, vol: .05, type: 'triangle' }),
    stone: () => A.tone?.({ f: 2300 + Math.random() * 600, dur: .02, vol: .03 }),
    open: () => A.burst?.({ f: 1100 + Math.random() * 400, q: 1, dur: .05, vol: .025 }),
  };
  function patter(dt) {
    const rain = G.rain || 0;
    if (!settled() || rain < .15 || !G.settings?.sound) return;
    if (!surfAt || Math.hypot(surfAt[0] - b.p[0], surfAt[2] - b.p[2]) > .5) { surf = surface(); surfAt = [...b.p]; }
    patT -= dt;
    while (patT <= 0) { patT += .02 + Math.random() / (2 + rain * 14); PATTER[surf](); }
  }

  // ---- D1: the quiet hour ---------------------------------------------------------------------
  const visitors = []; let visitT = 0, quietSaid = false;
  function viewYaw() { const f = G.R.viewInfo?.f; return f ? Math.atan2(f[0], -f[2]) : b.yaw; }
  function spawn() {
    const vy = viewYaw(), kinds = [];
    const night = (G.light?.night ?? 0) > .5;
    if (!night) kinds.push('bird');
    if (b.p[1] - height(b.p[0], b.p[2]) < 25) kinds.push('fox', 'fox');
    if (forest(b.p[0], b.p[2]) > .05 && !night) kinds.push('deer', 'deer');
    const kind = kinds[(Math.random() * kinds.length) | 0]; if (!kind) return;
    if (kind === 'bird') {
      const ps = b.tree ? perchesOf(b.tree).filter(p => !p.top && Math.hypot(p.x - b.p[0], p.y - b.p[1], p.z - b.p[2]) > 1.2) : [];
      const p = ps[(Math.random() * ps.length) | 0]; if (!p) return;
      const from = [p.x + Math.sin(vy + 1) * 25, p.y + 8, p.z - Math.cos(vy + 1) * 25];
      const sp = G.species?.[(Math.random() * Math.min(8, G.species.length)) | 0];
      visitors.push({ kind, sp: sp ? 'sp' + sp.id : 'visitor', p: from, to: [p.x, p.y + .02, p.z], t: 0, stay: 18 + Math.random() * 14, yaw: 0, state: 'in' });
      return;
    }
    // on the ground in front of the view, out of the wood or across the field
    for (let tries = 0; tries < 8; tries++) {
      const a = vy + (Math.random() - .5) * 1.4, r = kind === 'deer' ? 28 + Math.random() * 18 : 14 + Math.random() * 14;
      const x = b.p[0] + Math.sin(a) * r, z = b.p[2] - Math.cos(a) * r, y = height(x, z);
      if (y < WATER + .3) continue;
      const across = a + (Math.random() < .5 ? 1 : -1) * Math.PI / 2, len = kind === 'deer' ? 9 : 30;
      const sx = x - Math.sin(across) * len / 2, sz = z + Math.cos(across) * len / 2, ex = x + Math.sin(across) * len / 2, ez = z - Math.cos(across) * len / 2;
      if (height(ex, ez) < WATER + .3 || height(sx, sz) < WATER + .3) continue;
      visitors.push({ kind, p: [sx, height(sx, sz), sz], to: [ex, height(ex, ez), ez], t: 0, stay: kind === 'deer' ? 40 : 20, pause: 0, state: 'in', yaw: 0 });
      return;
    }
  }
  function startle() {
    for (const v of visitors) if (v.state !== 'off') {
      v.state = 'off'; v.t = 0;
      if (v.kind === 'deer') A.snort?.();
      if (v.kind === 'bird') A.chatter?.();
    }
  }
  G.on('gesture', () => { if (visitors.some(v => v.state !== 'off')) startle(); });
  function visit(dt) {
    const still = b.state === 'perch' && !(b.settle > 0) && idle() > STILL.quiet;
    if (still) {
      if (!quietSaid && !G.flags.quietHour) { quietSaid = true; G.flags.quietHour = 1; H.toast('The quiet hour: sit still a while, and the world comes closer.', 5); }
      if ((visitT -= dt) <= 0 && visitors.length < 2) { spawn(); visitT = STILL.visitGap[0] + Math.random() * (STILL.visitGap[1] - STILL.visitGap[0]); }
    } else if (b.state !== 'perch') startle();
    else visitT = Math.max(visitT, 4);
    for (let i = visitors.length - 1; i >= 0; i--) {
      const v = visitors[i]; v.t += dt;
      const dx = v.to[0] - v.p[0], dz = v.to[2] - v.p[2], d = Math.hypot(dx, dz);
      if (v.kind === 'bird') {
        if (v.state === 'in') { const k = Math.min(1, dt * 1.6); for (let j = 0; j < 3; j++) v.p[j] += (v.to[j] - v.p[j]) * k; v.yaw = Math.atan2(dz, dx); if (d < .05) { v.state = 'sit'; v.t = 0; if (Math.random() < .7) A.peep?.(); } }
        else if (v.state === 'sit') { if (v.t > v.stay) { v.state = 'off'; v.t = 0; } }
        else { v.p[0] += Math.cos(v.yaw) * 9 * dt; v.p[2] += Math.sin(v.yaw) * 9 * dt; v.p[1] += 3 * dt; if (v.t > 4) visitors.splice(i, 1); }
        continue;
      }
      const sp = v.state === 'off' ? (v.kind === 'deer' ? 7 : 6) : v.kind === 'deer' ? .45 : 1.6;
      if (v.state === 'off') { const away = Math.atan2(v.p[2] - b.p[2], v.p[0] - b.p[0]); v.yaw += angleTo(v.yaw, away) * Math.min(1, dt * 5); if (v.t > 6) visitors.splice(i, 1); }
      else {
        // the fox stops halfway to listen, and pounces; the deer grazes as it drifts
        if (v.kind === 'fox' && !v.paused && d < 16) { v.paused = 1; v.pause = 3; }
        if (v.pause > 0) { v.pause -= dt; if (v.pause < .5 && v.pause > .2) v.hop = 1; }
        v.yaw = Math.atan2(dz, dx);
        if (d < .5 || v.t > v.stay) { v.state = 'off'; v.t = 0; continue; }
      }
      if (!(v.pause > 0)) { v.p[0] += Math.cos(v.yaw) * sp * dt; v.p[2] += Math.sin(v.yaw) * sp * dt; }
      v.p[1] = height(v.p[0], v.p[2]);
    }
  }

  // ---- D3: watching ---------------------------------------------------------------------------
  let watch = null;
  const watched = G.store.get('watched3d', {});
  const screen = (x, y, z) => {
    const m = G.R.vp; if (!m) return null;
    const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return w < .3 ? null : [(X / w * .5 + .5) * innerWidth, (.5 - Y / w * .5) * innerHeight];
  };
  const tap0 = G.input.onTap;
  G.input.onTap = (x, y) => {
    if (b.state === 'perch' && !(b.settle > 0) && !G.menu?.open) {
      let best = null, bd = Math.min(innerWidth, innerHeight) * .07;
      for (const s of seen) {
        if (Math.hypot(s.x - b.p[0], s.y - b.p[1], s.z - b.p[2]) > 120) continue;
        const q = screen(s.x, s.y, s.z); if (!q) continue;
        const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = s; }
      }
      if (best) { watch = { key: best.key, p: [best.x, best.y, best.z], t: 0, lost: 0, at: performance.now() }; return true; }
    }
    if (watch) watch = null;
    return tap0?.(x, y) ?? false;
  };
  function watchPose() {
    const dx = watch.p[0] - b.p[0], dy = watch.p[1] - b.p[1], dz = watch.p[2] - b.p[2];
    return { headYaw: clamp(angleTo(b.yaw, Math.atan2(dx, -dz)), -2.2, 2.2), headPitch: clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.5, .9) };
  }
  function watching(dt) {
    if (!watch) return;
    if (b.state !== 'perch' || (G.touchedAt || 0) > watch.at + 400 || watch.t > STILL.watchMax) { watch = null; return; }
    // follow it: the same kind nearest to where it was
    let best = null, bd = 8;
    for (const s of seen) if (s.key === watch.key) { const d = Math.hypot(s.x - watch.p[0], s.z - watch.p[2]); if (d < bd) { bd = d; best = s; } }
    if (best) { watch.p = [best.x, best.y, best.z]; watch.lost = 0; } else if ((watch.lost += dt) > 2) { watch = null; return; }
    watch.t += dt;
    // the view turns with it (camera.js: the view's yaw is its own plus b.lookYaw)
    const f = G.R.viewInfo?.f, dx = watch.p[0] - b.p[0], dz = watch.p[2] - b.p[2];
    if (f) {
      const base = Math.atan2(f[0], -f[2]) - (b.lookYaw || 0), want = angleTo(base, Math.atan2(dx, -dz));
      b.lookYaw = (b.lookYaw || 0) + angleTo(b.lookYaw || 0, want) * Math.min(1, dt * 2.5);
      const pitch = clamp(Math.atan2(watch.p[1] - b.p[1], Math.hypot(dx, dz)) * 1.2, -.7, 1.2);
      b.lookPitch = (b.lookPitch || 0) + (pitch - (b.lookPitch || 0)) * Math.min(1, dt * 2);
      b.lookT = 2;
    }
    if (watch.t > STILL.watchFor && !watched[watch.key]) {
      watched[watch.key] = 1; G.store.set('watched3d', watched);
      const line = WATCH[watch.key] || WATCH_ANY, note = G.guide?.note?.(watch.key) || '';
      if (!note.includes('Watched:')) G.guide?.page(watch.key, null, `${note} ${line}`.trim());
      H.toast(`You watch the ${(G.guide?.name?.(watch.key) || watch.key).toLowerCase()} a while. A new line in your field guide.`, 4);
      G.emit('watched', watch.key);
    }
  }

  // ---- D5: a favourite perch ------------------------------------------------------------------
  const favs = G.store.get('favPerch3d', []);   // { x, y, z, n: visits, s: seconds, yaw, fav }
  let here = null, wasState = b.state;
  const near = p => favs.find(f => Math.hypot(f.x - p.x, f.y - p.y, f.z - p.z) < .6);
  function favourite(dt) {
    if (b.state === 'perch' && wasState !== 'perch' && b.perch) {
      here = near(b.perch);
      if (!here) { here = { x: +b.perch.x.toFixed(2), y: +b.perch.y.toFixed(2), z: +b.perch.z.toFixed(2), n: 0, s: 0, yaw: b.yaw }; favs.push(here); }
      here.n++;
      if (here.fav) b.yaw = here.yaw;   // you land facing the way you like to look from it
      if (favs.length > 60) { favs.sort((p, q) => q.s - p.s); favs.length = 50; }
    }
    if (b.state === 'perch' && here) {
      here.s += dt; if (!(b.settle > 0)) here.yaw = b.yaw;
      if (!here.fav && here.n >= STILL.favVisits && here.s >= STILL.favSecs) {
        here.fav = true; G.store.set('favPerch3d', favs);
        H.toast('This perch is becoming yours: it is on your map now, and you will land facing your favourite view.', 5);
        G.emit('favPerch', here);
      }
    }
    if (b.state !== 'perch' && wasState === 'perch') { here = null; G.store.set('favPerch3d', favs); }
    wasState = b.state;
  }
  G.mapPlaces = (prev => () => [...(prev?.() || []), ...favs.filter(f => f.fav).map(f => ({ x: f.x, z: f.z, name: 'Your favourite perch', note: `${f.n} visits, ${Math.round(f.s / 60)} minutes sat here.`, col: PIG.wax }))])(G.mapPlaces);

  G.dev?.add({ id: 'r8-preen', area: 'Ground and perch', round: 'R8 D2', title: 'Preening and small life on a perch: rouse, preen, stretch, look round (the head turns)', how: 'Perch and leave the phone 10 s: watch the hawk rouse, preen, stretch and turn its head.' });
  G.dev?.add({ id: 'r8-rain', area: 'Ground and perch', round: 'R8 D4', title: 'Sit out the rain: hunched and fluffed; rain patters differently on leaves, needles, roofs, posts, stone', how: 'Perch in rain on a broadleaf, a pine, a roof and a fence post, and listen.' });
  G.dev?.add({ id: 'r8-sun', area: 'Ground and perch', round: 'R8 C3', title: 'Sunning: wet, in the sun, the hawk spreads its wings to dry', how: 'After rain, perch in sunshine: wings open until dry (dries 6x faster).', go: () => { b.wet = .8; G.rain = 0; } });
  G.dev?.add({ id: 'r8-quiet', area: 'Wildlife', round: 'R8 D1', title: 'The quiet hour: a minute untouched on a perch brings a deer, a songbird or a fox close', how: 'Perch and leave the phone a minute; any touch sends them off.' });
  G.dev?.add({ id: 'r8-watch', area: 'Wildlife', round: 'R8 D3', title: 'Watch an animal: tap it from a perch; the head and view follow it; a field guide line', how: 'Perched, tap a deer, heron, mouse or bird and wait 6 s; Journal > Field guide.' });
  G.dev?.add({ id: 'r8-fav', area: 'Ground and perch', round: 'R8 D5', title: 'A favourite perch: on the map, worn pale, and you land facing your view', how: 'Perch on the same branch 3 times for 2.5 minutes in all; Map shows it.' });

  return {
    id: 'still',
    visitors, get watch() { return watch; }, get seen() { return seen; },   // for debugging
    update(dt) {
      seen = seeing; seeing = [];
      watching(dt);
      pose(dt);
      patter(dt);
      visit(dt);
      favourite(dt);
    },
    scene(S) {
      for (const v of visitors) {
        if (v.kind === 'bird') { (S.props.perchbird ||= []).push(v.p[0], v.p[1], v.p[2], 1.3, v.yaw, .5, 0, 0); G.sight(v.sp, v.p[0], v.p[1], v.p[2], .2); continue; }
        const hop = v.hop ? Math.max(0, Math.sin(Math.min(1, (v.hopT = (v.hopT || 0) + 1 / 60) / .4) * Math.PI)) * .5 : 0;
        if (v.hopT > .4) { v.hop = 0; v.hopT = 0; }
        if (v.kind === 'deer') (S.props[v.state === 'off' ? 'deer' : 'deerG'] ||= []).push(v.p[0], v.p[1], v.p[2], 1, v.yaw, .5, 0, 0);
        else (S.props.fox ||= []).push(v.p[0], v.p[1] + hop, v.p[2], 1.2, v.yaw, .5, 0, 0);
        G.sight(v.kind, v.p[0], v.p[1] + .5, v.p[2], v.kind === 'deer' ? 1.2 : .5);
      }
      for (const f of favs) if (f.fav && Math.hypot(f.x - S.cam[0], f.z - S.cam[2]) < 80) (S.props.worn ||= []).push(f.x, f.y + .01, f.z, 1, ih(f.x | 0, f.z | 0, 3) * 6, .5, 0, 0);
    },
  };
}
