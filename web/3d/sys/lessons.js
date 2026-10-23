// Lessons, the tutorial (James's picks, 2026-10-23: A1 B3 C1 D1 E2 F3 G1 H1 I1). A new journey
// begins with the first flight: the bird on a branch, most of the HUD hidden, one move at a time
// shown by the coach (coach.js: a card with the thumbs, and ghost thumbs on the screen), each step
// waiting until it is done; hunger, thirst, tiredness and the clock hold still meanwhile, and Skip
// leaves it. Then the lessons: a chain of small tasks in chapters (food, water and rest, rising air,
// finding your way, songs, a home, flying well, the wide world), each opening as soon as the last
// is done, listed under Today. The companion hawk flies to the thing (sys/fauna.js), a task with a
// new move shows its thumbs once, and each piece of the HUD appears the first time it matters
// (#ui3 no-* classes, 3d.css). Until eating, drinking and sleeping are learned, hunger and thirst
// run at half speed and health holds (G.ease, read by food.js and story.js). A tip stays quiet
// until its lesson is done (hud.js asks G.lessons.quiet). How to play > Lessons lists it all: fly
// the first flight again, practise any task, start over, skip. Old saves (no lessons in them) are
// counted as done.
import * as W from '../world.js';
import { period } from '../sky.js';
import { createCoach } from '../coach.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';

// ---- the first flight: [id, title, line, keys, left thumb, right thumb, how it is done] -------
// how: 'fly' (in the air), 'land' (down anywhere), ['hold', s, test(c)] (held that long in
// all), ['flaps', n] (full flaps)
const CUSHION = 22;   // m: below this the air lifts the bird gently, every step but Land
const STEPS = [
  ['off', 'Take off', 'Tap Take off, bottom right, to leave the branch.', 'click Take off', '', '', 'fly'],
  ['glide', 'Glide', 'Let go of both thumbs. Your wings hold you up.', 'let go of every key', '', '', ['hold', 2.5, c => !c.held]],
  ['flap', 'Flap', 'Tap both thumbs at the same moment.', 'Space', 'tap', 'tap', ['flaps', 3]],
  ['climb', 'Climb', 'Push both thumbs up.', 'W or Up', 'up', 'up', ['hold', 1.6, c => c.pitch > .45]],
  ['dive', 'Dive', 'Now both thumbs down.', 'S or Down', 'down', 'down', ['hold', 1.6, c => c.pitch < -.45]],
  ['left', 'Turn left', 'Left thumb down, right thumb up: you turn toward the lower wing.', 'A or Left', 'down', 'up', ['hold', 2, c => c.roll < -.4]],
  ['right', 'Turn right', 'Right thumb down, left thumb up.', 'D or Right', 'up', 'down', ['hold', 2, c => c.roll > .4]],
  ['soar', 'Soar', 'Slide both thumbs out to the edges: wings wide, slow and floating.', 'E', 'out', 'out', ['hold', 2.5, c => c.spread > .45]],
  ['fast', 'Fast glide', 'Slide both thumbs in toward the middle: wings folded, faster.', 'Shift or Q', 'in', 'in', ['hold', 2, c => c.spread < -.45]],
  ['land', 'Land', 'Thumbs out and down: wings spread to brake, and you settle on the ground or a branch.', 'E and S together', 'out down', 'out down', 'land'],
];

// ---- the lessons --------------------------------------------------------------------------
// a chapter: title, icon, the HUD pieces it brings in, its tasks. A task: id, text, say (when it
// opens), on: an event that does it (ok: a test of the event's argument), or poll(dt, c); move: the
// thumbs it teaches [left, right, name, line] (the coach shows them until done once); go: where the companion
// flies (a function of the bird, below), dusk: only toward night
const CHAPTERS = [
  { title: 'Food', icon: 'prey', reveal: ['food', 'wings'], tasks: [
    { id: 'mouse', text: 'Catch a mouse', say: 'Your companion skims low over the grass, hunting. Watch for a mouse, then fold your wings and dive at it: thumbs in and down.', on: 'catch', move: ['in down', 'in down', 'Stoop', 'Thumbs in and down: wings folded, a steep fast dive.'], go: low },
    { id: 'eat', text: 'Eat your catch', say: 'Land with it in your feet and tap Eat. On a branch it is a calmer meal.', on: 'ate' },
  ] },
  { title: 'Water and rest', icon: 'thirst', reveal: ['water', 'dial'], tasks: [
    { id: 'drink', text: 'Drink', say: 'Your companion heads for water. Land at its edge, or on it, and tap the water to drink.', on: 'drink', go: water },
    { id: 'perch', text: 'Land on a branch', say: 'Your companion drops to a tree. Slow down and brake onto a branch where a green ring shows: thumbs out and down.', on: 'land', ok: k => k === 'perch', move: ['out down', 'out down', 'Brake and land', 'Thumbs out and down: wings spread, you sink gently onto it.'], go: tree },
    { id: 'hop', text: 'Hop to another branch', say: 'Perched, tap another green ring to hop across to it.', poll: hopped },
    { id: 'sleep', text: 'Sleep through a night', say: 'When night comes, perch on a branch and tap Sleep. You wake at first light with your wings rested.', on: 'sleep', go: tree, dusk: true },
  ] },
  { title: 'Rising air', icon: 'thermal', reveal: [], tasks: [
    { id: 'ride', text: 'Ride rising air 60 m up', say: 'Your companion circles where the air rises: leaves spiral there. Fly in, spread your wings wide and circle with it.', poll: rode, move: ['out', 'out', 'Soar', 'Thumbs out: wings wide. Tip one a little lower to circle.'], go: thermal },
    { id: 'rings', text: 'Fly through three rings', say: 'Your companion flies through a ring of mist. Follow it: each ring gives you a burst of speed.', on: 'ring', n: 3, go: rings },
  ] },
  { title: 'Finding your way', icon: 'south', reveal: ['compass'], tasks: [
    { id: 'map', text: 'Open the Map', say: 'Open the menu, top left, and look at the Map: it shows where you have been.', on: 'menuTab', ok: id => id === 'map' },
    { id: 'pin', text: 'Pin a place on the Map', say: 'On the Map, tap a place you liked and pin it. Pins show on your compass.', on: 'pin' },
    { id: 'far', text: 'Fly two kilometres to new country', say: 'Your companion sets off to see new country. Follow it a while: two kilometres from where you were at dawn.', on: 'far', go: far },
  ] },
  { title: 'Songs', icon: 'songs', reveal: ['call'], tasks: [
    { id: 'learn', text: 'Learn a songbird’s song', say: 'Songbirds sing from the trees. Perch near one and tap the notes button, bottom left: copy each note it sings.', on: 'learn', go: tree },
    { id: 'sing', text: 'Sing a song back to its bird', say: 'Perched near a songbird you have learned, sing its song: it answers, and some bring gifts.', on: 'song' },
    { id: 'call', text: 'Call out', say: 'Hold Call, top right, to call out: the longer you hold, the louder.', on: 'call' },
  ] },
  { title: 'A home', icon: 'nest', reveal: [], tasks: [
    { id: 'twig', text: 'Pick up a twig', say: 'Twigs lie under some broadleaf trees. Land beside one to pick it up.', poll: () => G0.carry === 'twig' || !!G0.nest },
    { id: 'nest', text: 'Start a nest', say: 'With a twig in your beak, perch on a branch: your nest begins there.', poll: () => !!G0.nest },
    { id: 'keepsake', text: 'Find a keepsake', say: 'Now and then something glints in the grass. Land beside it to keep it for your nest.', on: 'keepsake' },
  ] },
  { title: 'Flying well', icon: 'agility', reveal: [], tasks: [
    { id: 'zoom', text: 'Zoom up out of a dive', say: 'Dive to pick up speed, then thumbs in and up: a swept climb that keeps its speed.', poll: zoomed, move: ['in up', 'in up', 'Zoom', 'Fast, then thumbs in and up: a climb that keeps its speed.'] },
    { id: 'hover', text: 'Hover', say: 'Slow right down, then thumbs out and up: you hang on beating wings. It tires them fast.', poll: hovered, move: ['out up', 'out up', 'Hover', 'Slow, then thumbs out and up: hang on beating wings.'] },
    { id: 'barrel', text: 'A barrel roll', say: 'Left thumb down and right up, then turn both a full circle anticlockwise together: a roll.', on: 'trick', ok: k => k === 'barrel', move: ['ccw', 'ccw', 'Barrel roll', 'Left down, right up, then both round a full circle anticlockwise.'] },
  ] },
  { title: 'The wide world', icon: 'south', reveal: [], tasks: [
    { id: 'guide', text: 'Add a page to the field guide', say: 'Fly close by an animal you have not seen before: it gets a page in the Guide.', on: 'sighted' },
    { id: 'land', text: 'Fly over a new land', say: 'The Earth has many lands: forest, steppe, tundra, desert. Fly until you cross into a new one.', on: 'newLand' },
    { id: 'photo', text: 'Take a picture', say: 'Open the menu: Today has Photo mode. Frame a picture and take it.', on: 'photo' },
  ] },
];
const TASKS = CHAPTERS.flatMap((ch, i) => ch.tasks.map(t => ({ ...t, ch: i })));
const SURVIVE = ['mouse', 'eat', 'drink', 'sleep'];   // till these are done: G.ease
// each HUD piece, and the line that brings it in
const PIECES = {
  food: 'Top left, the orange bar is your food. It empties slowly; catch something to fill it.',
  wings: 'The yellow bar is your wings: flapping tires them, gliding rests them.',
  water: 'The blue bar is water. It empties slowly too: drink to fill it.',
  dial: 'Top right, the day dial: the sun goes round it, then the night.',
  compass: 'Along the top, the compass: north, your nest, and the places you have found.',
  call: 'Top right, Call: hold it to call out.',
};
// tips that wait for a lesson ('flight': the first flight)
const TIP_LESSON = { flap: 'flight', bank: 'flight', climb: 'flight', flare: 'flight', tuck: 'mouse', aim: 'mouse', hunt: 'mouse', carry: 'eat',
  drink: 'drink', hop: 'hop', sleep: 'sleep', ride: 'ride', ring: 'rings', wander: 'far', song: 'learn', imitate: 'sing', call: 'call',
  twig: 'twig', nestbranch: 'nest', keepsake: 'keepsake' };

// where the companion flies for a task: [x, y, z] points from where the bird is
function thermal(b) {
  const t = W.thermalsNear(b.p[0], b.p[2], 500).sort((a, c) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(c.x - b.p[0], c.z - b.p[2]))[0];
  if (!t) return null;
  const pts = [];
  for (let i = 0; i < 16; i++) { const y = b.p[1] + i * 6, [cx, cz] = W.thermalCentre(t, y), a = i * .8; pts.push([cx + Math.cos(a) * t.r * .5, y, cz + Math.sin(a) * t.r * .5]); }
  return pts;
}
function tree(b) {
  const t = W.treesNear(b.p[0], b.p[2], 260).filter(t => Math.hypot(t.x - b.p[0], t.z - b.p[2]) > 50).sort((a, c) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(c.x - b.p[0], c.z - b.p[2]))[0];
  if (!t) return null;
  const p = W.perchesOf(t)[0];
  return [[(b.p[0] + p.x) / 2, Math.max(b.p[1], p.y + 15), (b.p[2] + p.z) / 2], [p.x, p.y + 1.5, p.z]];
}
function low(b) {
  const pts = [];   // ahead, low over the ground
  for (let i = 1; i <= 6; i++) { const x = b.p[0] + Math.sin(b.yaw) * i * 40, z = b.p[2] - Math.cos(b.yaw) * i * 40; pts.push([x, Math.max(W.height(x, z), W.WATER) + 9, z]); }
  return pts;
}
function water(b) {
  let best = null;
  for (let r = 60; r <= 900 && !best; r += 60) for (let a = 0; a < 6.283; a += .4) {
    const x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r;
    if (W.height(x, z) < W.WATER - .5) { best = [x, z]; break; }
  }
  if (!best) return null;
  return [[(b.p[0] + best[0]) / 2, b.p[1], (b.p[2] + best[1]) / 2], [best[0], W.WATER + 3, best[1]]];
}
function rings(b) {
  const first = W.ringsNear(b.p[0], b.p[2], 700).filter(r => r.k === 0).sort((a, c) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(c.x - b.p[0], c.z - b.p[2]))[0];
  if (!first) return null;
  return W.ringsNear(first.x, first.z, 900).filter(r => r.circuit === first.circuit).sort((a, c) => a.k - c.k).map(r => [r.x, r.y, r.z]);
}
function far(b) { const d = [Math.sin(b.yaw), -Math.cos(b.yaw)]; return [[b.p[0] + d[0] * 250, b.p[1] + 10, b.p[2] + d[1] * 250], [b.p[0] + d[0] * 600, b.p[1] + 20, b.p[2] + d[1] * 600]]; }

// tasks done by watching the bird (G0, P: the game and the polls' own memory, set by the system)
let G0 = null;
const P = {};
function hopped() {   // perched, then perched on another branch without flying in between
  const b = G0.b;
  if (b.state !== 'perch' && !(b.settle > 0 && b.hop > 0)) { P.perch = null; return false; }
  if (b.state === 'perch' && b.perch) { if (P.perch && P.perch !== b.perch) return true; P.perch = b.perch; }
  return false;
}
function rode(dt) {   // climbed 60 m in rising air (a dip out of it under 8 s keeps the count)
  const b = G0.b;
  if (b.state === 'fly' && b.lift > .5) { if (P.y0 == null || P.out > 8) P.y0 = b.p[1]; P.out = 0; return b.p[1] - P.y0 > 60; }
  P.out = (P.out || 0) + dt; return false;
}
function zoomed(dt, c) { const b = G0.b; P.z = b.state === 'fly' && b.s > 18 && c.spread < -.35 && c.pitch > .35 ? (P.z || 0) + dt : 0; return P.z > .7; }
function hovered(dt) { const b = G0.b; P.h = b.state === 'fly' && b.hover > .6 ? (P.h || 0) + dt : 0; return P.h > 1.5; }

// the thumbs of a move, read from the sticks: done when every part holds
function moveDone(c, l) {
  if (l === 'ccw') return !!c.barrel;
  return l.split(' ').every(m => m === 'up' ? c.pitch > .35 : m === 'down' ? c.pitch < -.35 : m === 'in' ? c.spread < -.35 : m === 'out' ? c.spread > .35 : true);
}

export function lessonsSystem(G) {
  G0 = G;
  const b = G.b, H = G.hud, ui = document.getElementById('ui3'), coach = createCoach(ui);
  // stage: 'flight' (the first flight), 'learn' (the lessons), 'done'; after: the stage to go
  // back to when a first flight flown again ends
  const S = { stage: G.fresh ? 'flight' : 'done', step: 0, done: {}, shown: {}, practice: null, after: 'learn' };
  let hold = null, prog = 0, flaps = 0, okT = 0, stepT = 0, cur = null, openT = 0, goT = 0, sent = false, coachT = 0, sayT = 0, count = 0;

  // ---- the HUD: hidden in the first flight, piece by piece in the lessons --------------------
  function classes() {
    ui.classList.toggle('learn3', S.stage === 'flight');
    for (const p in PIECES) ui.classList.toggle('no-' + p, S.stage !== 'done' && !S.shown[p]);
    coach.skipBar(S.stage === 'flight');
  }
  function reveal(list) {
    let i = 0;
    for (const p of list) if (!S.shown[p]) { S.shown[p] = 1; const line = PIECES[p]; setTimeout(() => H.say(line, { kind: 'tutorial', secs: 6, icon: 'how' }), 600 + i++ * 6500); }
    classes();
  }

  // ---- the first flight ---------------------------------------------------------------------
  function startFlight() {
    S.after = S.stage === 'done' ? 'done' : 'learn';
    S.stage = 'flight'; S.step = b.state === 'fly' ? 1 : 0; prog = 0; flaps = 0; okT = 0; stepT = 0;
    if (period(G.tod) !== 'day') G.tod = .36;   // a calm mid-morning
    hold = { h: G.hunger, t: G.thirst, tod: G.tod };
    classes();
  }
  function endFlight(skipped) {
    S.stage = S.after; hold = null; coach.hide(); S.done.flight = 1;
    if (S.stage === 'learn') { reveal([]); cur = null; openT = skipped ? 1 : 5; }
    classes();
    if (!skipped) H.say('You can fly. The rest you learn by living.', { kind: 'tutorial', secs: 5, icon: 'done' });
  }
  coach.onSkip = which => {
    if (which === 'flight') { endFlight(true); H.say('Your lessons wait under Today, in the menu.', { kind: 'tutorial', secs: 5 }); }
    else skipAll();
  };
  coach.onSkipOne = () => { if (S.stage === 'flight') next(); else if (cur) complete(cur, true); };
  function next() { S.step++; prog = 0; flaps = 0; okT = 0; stepT = 0; if (S.step >= STEPS.length) endFlight(false); }
  G.on('flap', (q, side) => { if (S.stage === 'flight' && STEPS[S.step]?.[0] === 'flap' && !side) flaps++; });

  function flight(dt, c) {
    // the world holds still: no hunger, thirst or tiredness, the same hour
    if (hold) { G.hunger = hold.h; G.thirst = hold.t; G.tod = hold.tod; }
    b.stamina = Math.max(b.stamina, b.maxStamina ?? 1);
    const [id, title, line, keys, l, r, how] = STEPS[S.step];
    stepT += dt;
    if (okT > 0) {   // the tick, a moment, then the next move
      if ((okT -= dt) <= 0) next();
      coach.show({ n: S.step + 1, of: STEPS.length, title, line, keys, l, r, progress: 1, done: true, big: true });
      coach.ghosts(false); return;
    }
    // down on the ground mid-lesson: take off again first
    if (b.state !== 'fly' && id !== 'off' && id !== 'land') {
      coach.show({ small: 'First', title: 'Take off again', line: 'Tap Take off, bottom right.', keys: 'click Take off', l: '', r: '', progress: null, big: true });
      coach.ghosts(false); return;
    }
    // a soft cushion of air under the bird till the last step, so nobody keeps landing mid-lesson
    const above = b.p[1] - Math.max(W.height(b.p[0], b.p[2]), W.WATER);
    if (b.state === 'fly' && id !== 'land' && above < CUSHION) b.vy = (b.vy || 0) + (CUSHION - above) * .9 * dt;
    if (b.state === 'fly' && id !== 'land') b.noPerch = Math.max(b.noPerch || 0, 1.5);   // and no settling in a tree
    let p = 0, show = { l, r, line };
    if (how === 'fly') p = b.state === 'fly' ? 1 : 0;
    else if (how === 'land') {
      if (above > 40 && b.state === 'fly') show = { l: 'down', r: 'down', line: 'First come down lower: both thumbs down.' };
      p = b.state !== 'fly' ? 1 : 0;
    } else if (how[0] === 'flaps') p = flaps / how[1];
    else if (how[0] === 'hold') { if (how[2](c)) prog += dt; p = prog / how[1]; }
    if (p >= 1) { okT = .9; G.audio.ring?.(); H.did(id === 'climb' || id === 'dive' ? 'climb' : id === 'left' || id === 'right' ? 'bank' : id); }
    const bar = how === 'fly' || how === 'land' ? null : Math.min(1, p);
    coach.show({ n: S.step + 1, of: STEPS.length, title, line: show.line, keys, l: show.l, r: show.r, progress: bar, done: p >= 1, skipOne: stepT > 40 && id !== 'off', big: true });
    coach.ghosts(true, G.input);
  }

  // ---- the lessons ----------------------------------------------------------------------------
  const first = () => TASKS.find(t => !S.done[t.id]) || null;
  function open(t) {
    cur = t; count = 0; sent = false; goT = 6; sayT = 0; for (const k in P) delete P[k];
    reveal(CHAPTERS[t.ch].reveal);
    const ch = CHAPTERS[t.ch], firstOf = ch.tasks[0].id === t.id && !S.practice;
    setTimeout(() => { if (cur === t) H.say(t.say, { kind: 'tutorial', secs: 8, icon: ch.icon }); }, firstOf ? 400 : 0);
    if (firstOf) H.name(`Lessons: ${ch.title}`, ch.icon);
    coachT = t.move ? 14 : 0;
  }
  function complete(t, quiet) {
    S.done[t.id] = 1;
    if (cur === t) {
      if (!quiet) { H.tally(`Done: ${t.text}`, 'done'); G.audio.ring?.(); }
      cur = null; coach.hide(); S.practice = null; openT = 3;
    }
    if (S.stage === 'learn' && !first()) finish();
  }
  function finish() {
    S.stage = 'done'; cur = null; coach.hide(); classes();
    H.say('That is every lesson. From now on each day offers one aim under Today, if you like.', { kind: 'tutorial', secs: 7, icon: 'done' });
  }
  function skipAll() {
    S.stage = 'done'; hold = null; cur = null; S.practice = null; S.done.flight = 1; coach.hide(); classes();
    H.say('Lessons skipped. How to play, in the menu, has them all whenever you want them.', { kind: 'tutorial', secs: 5 });
  }
  // an event can tick any task not yet done (doing things ahead counts), the open one aloud
  for (const ev of new Set(TASKS.filter(t => t.on).map(t => t.on))) G.on(ev, (...a) => {
    if (S.stage === 'flight' || (S.stage === 'done' && !cur)) return;
    for (const t of TASKS) if (t.on === ev && (!S.done[t.id] || t === cur) && (!t.ok || t.ok(a[0]))) {
      if (t === cur && t.n && ++count < t.n) continue;
      if (t !== cur && t.n) continue;   // a count only for the open task
      complete(t, t !== cur);
    }
  });

  function learn(dt, c) {
    if (!cur) {
      if ((openT -= dt) > 0) return;
      const t = S.practice ? TASKS.find(q => q.id === S.practice) : S.stage === 'learn' ? first() : null;
      if (!t) return;
      open(t);
    }
    const t = cur;
    if (t.poll?.(dt, c)) return complete(t);
    // its new move: the thumbs on a small card until done once, or a while
    if (coachT > 0) {
      coachT -= dt;
      if (b.state === 'fly' && moveDone(c, t.move[0])) coachT = Math.min(coachT, .8);
      if (coachT > 0) { coach.show({ small: 'New move', title: t.move[2], line: t.move[3], l: t.move[0], r: t.move[1], progress: null }); coach.ghosts(false); }
      else coach.hide();
    }
    // the companion goes to show it: flying, in daylight (dusk for sleep)
    if (t.go && !sent && (goT -= dt) <= 0) {
      goT = 15;
      const dusk = G.tod > .68 && G.tod < .78;
      if (b.state === 'fly' && !G.companion?.busy && (t.dusk ? dusk : period(G.tod) === 'day')) {
        const pts = t.go(b);
        if (pts) { sent = true; G.companion?.fly(pts, 13, () => {}); }
      }
    }
    // the line again now and then, while it waits
    if ((sayT += dt) > 240 && b.state === 'fly') { sayT = 0; H.say(t.say, { kind: 'tutorial', secs: 7, icon: CHAPTERS[t.ch].icon }); }
  }

  // ---- G.lessons: for the HUD, aims, food and story -------------------------------------------
  G.lessons = {
    get learning() { return S.stage !== 'done'; },
    get flying() { return S.stage === 'flight'; },
    quiet: id => S.stage === 'flight' || (S.stage === 'learn' && TIP_LESSON[id] && !S.done[TIP_LESSON[id]]),
    replay: () => { G.menu.set(false); startFlight(); },
  };
  const ease = () => S.stage === 'flight' || (S.stage === 'learn' && !SURVIVE.every(k => S.done[k])) ? .5 : 1;

  // ---- Today: the open chapter, its tasks ticked ----------------------------------------------
  const today = journal(G).section(3, 'Lessons');
  // ---- How to play > Lessons -------------------------------------------------------------------
  const page = G.menu.page('how', 'lessons', 'Lessons', 5);
  G.menu.button('play', { label: 'Lessons', sub: 'learn to fly again, or practise any lesson', group: 'journey', onClick: () => G.menu.set(true, 'how', 'lessons') });
  const tick = t => `<i class="${S.done[t.id] ? 'on' : ''}">${S.done[t.id] ? icon('done') : ''}</i>`;
  function paint() {
    const on = S.stage === 'learn' || !!S.practice;
    today.el.classList.toggle('hidden', !on);
    if (on) {
      const t = cur || first(), ch = CHAPTERS[t ? t.ch : 0];
      const n = CHAPTERS.indexOf(ch) + 1;
      today.body.innerHTML = `<p class="lch3">${icon(ch.icon)}<b>${esc(ch.title)}</b><small>${n} of ${CHAPTERS.length}</small></p>
        <ul class="lessons3">${ch.tasks.map(q => `<li class="${S.done[q.id] ? 'done' : q === t || q.id === t?.id ? 'now' : 'later'}">${tick(q)}<span>${esc(q.text)}</span></li>`).join('')}</ul>
        <p class="lnote3">Each lesson opens when the last is done. Nothing is required. <button data-l="page">All lessons</button></p>`;
    }
    const done = TASKS.filter(t => S.done[t.id]).length;
    page.innerHTML = `<p><b>Learn one thing at a time.</b> ${S.stage === 'done' ? 'You have been through the lessons; fly any again.' : `${done} of ${TASKS.length} lessons done. Each opens when the last is done.`}</p>
      <div class="lbtns3"><button data-l="flight" class="main3">Fly the first flight again</button>${S.stage !== 'done' ? '<button data-l="skip">Skip the lessons</button>' : ''}<button data-l="over">Start the lessons over</button></div>
      ${CHAPTERS.map((ch, i) => `<section class="lgrp3"><h3>${icon(ch.icon)}${i + 1}. ${esc(ch.title)}</h3><ul class="lessons3">${ch.tasks.map(q => `<li class="${S.done[q.id] ? 'done' : ''}">${tick(q)}<span>${esc(q.text)}</span><button data-t="${q.id}">Practise</button></li>`).join('')}</ul></section>`).join('')}`;
  }
  G.menu.onOpen(paint);
  G.on('menuPage', (tab, id) => { if (tab === 'how' && id === 'lessons') paint(); });
  const act = e => {
    const el = e.target.closest('[data-l], [data-t]'); if (!el) return;
    const l = el.dataset.l, t = TASKS.find(q => q.id === el.dataset.t);
    if (l === 'page') return G.menu.set(true, 'how', 'lessons');
    if (l === 'flight') return G.lessons.replay();
    if (l === 'skip') { skipAll(); return paint(); }
    if (l === 'over') { S.done = { flight: 1 }; S.practice = null; cur = null; if (S.stage === 'done') S.stage = 'learn'; openT = 2; classes(); G.menu.set(false); return; }
    if (t) { S.practice = t.id; cur = null; openT = .5; G.menu.set(false); }
  };
  page.addEventListener('click', act); today.body.addEventListener('click', act);

  G.dev?.add({ id: 'lessons', area: 'Menu and story', round: 'Tutorial 10-23', title: 'Lessons: the first flight (HUD hidden, ghost thumbs, Skip), then a chain of lessons under Today; HUD pieces appear as they matter',
    how: 'Start a new journey (Settings > Journey), or How to play > Lessons > Fly the first flight again. Practise any lesson from that page.', go: () => G.lessons.replay() });

  classes();
  return {
    id: 'lessons',
    update(dt, c) {
      G.ease = ease();
      if (S.stage === 'flight') flight(dt, c);
      else if (S.stage === 'learn' || S.practice) learn(dt, c);
    },
    save: () => ({ stage: S.stage === 'flight' ? S.after === 'done' ? 'done' : 'flight' : S.stage, step: 0, done: S.done, shown: S.shown, after: S.after }),
    load(o) {
      Object.assign(S, o, { practice: null });
      if (S.stage === 'flight') { S.step = b.state === 'fly' ? 1 : 0; hold = { h: G.hunger, t: G.thirst, tod: G.tod }; }
      classes();
    },
  };
}
