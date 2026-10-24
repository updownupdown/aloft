// Lessons, the tutorial (James's picks, 2026-10-23: A1 B3 C1 D1 E2 F3 G1 H1 I1). A new journey
// begins with the first flight: the bird on a branch, most of the HUD hidden, one move at a time
// shown by the coach (coach.js: a card with the thumbs, and ghost thumbs on the screen), each step
// waiting until it is done; hunger, thirst, tiredness and the clock hold still meanwhile, and Skip
// leaves it. Then the lessons: a chain of small tasks in chapters (food, water and rest, rising air,
// finding your way, songs, a home, flying well, the wide world), each opening as soon as the last
// is done, listed under Today. The whole HUD is back after the first flight, and one card, once,
// says what the lessons are, which comes first and where to see them all (James, 2026-10-23: loud
// once, quiet after); each lesson then opens with a small line and a glint to read it by, the
// companion hawk flies to the thing (sys/fauna.js), and a task with a new move shows its thumbs a
// few seconds. Until eating, drinking and sleeping are learned, hunger and thirst
// run at half speed and health holds (G.ease, read by food.js and story.js). A tip stays quiet
// until its lesson is done (hud.js asks G.lessons.quiet). The menu's Tutorial section (James,
// 2026-10-24) has it all: the Overview lists the chapters in order (the first flight is Flying),
// each with its progress and Replay; each chapter's own page (howto.js) shows its lessons ticked,
// with Practise, above the cards that explain it. The payoff: a feather for the first flight and
// for each chapter finished, once (G.feather, sys/aims.js: each makes the wings last longer).
// Old saves (no lessons in them) are counted as done.
import * as W from '../world.js';
import { period } from '../sky.js';
import { createCoach } from '../coach.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';
import { PAGES } from './howto.js';

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
// a chapter: title, its page in the Tutorial (howto.js PAGES), icon, its tasks. A task: id, text, say (when it
// opens), on: an event that does it (ok: a test of the event's argument), or poll(dt, c); move: the
// thumbs it teaches [left, right, name, line] (the coach shows them until done once); go: where the companion
// flies (a function of the bird, below), dusk: only toward night
const CHAPTERS = [
  { title: 'Food', page: 'food', icon: 'prey', tasks: [
    { id: 'mouse', text: 'Catch a mouse', say: 'Your companion skims low over the grass, hunting. Watch for a mouse, then fold your wings and dive at it: thumbs in and down.', on: 'catch', move: ['in down', 'in down', 'Stoop', 'Thumbs in and down: wings folded, a steep fast dive.'], go: low },
    { id: 'eat', text: 'Eat your catch', say: 'Land with it in your feet and tap Eat. On a branch it is a calmer meal.', on: 'ate' },
  ] },
  { title: 'Water and rest', page: 'water', icon: 'thirst', tasks: [
    { id: 'drink', text: 'Drink', say: 'Your companion heads for water. Land at its edge, or on it, and tap the water to drink.', on: 'drink', go: water },
    { id: 'perch', text: 'Land on a branch', say: 'Your companion drops to a tree. Slow down and brake onto a branch where a green ring shows: thumbs out and down.', on: 'land', ok: k => k === 'perch', move: ['out down', 'out down', 'Brake and land', 'Thumbs out and down: wings spread, you sink gently onto it.'], go: tree },
    { id: 'hop', text: 'Hop to another branch', say: 'Perched, tap another green ring to hop across to it.', poll: hopped },
    { id: 'sleep', text: 'Sleep through a night', say: 'When night comes, perch on a branch and tap Sleep. You wake at first light with your wings rested.', on: 'sleep', go: tree, dusk: true },
  ] },
  { title: 'Rising air', page: 'air', icon: 'thermal', tasks: [
    { id: 'ride', text: 'Ride rising air 60 m up', say: 'Your companion circles where the air rises: leaves spiral there. Fly in, spread your wings wide and circle with it.', poll: rode, move: ['out', 'out', 'Soar', 'Thumbs out: wings wide. Tip one a little lower to circle.'], go: thermal },
    { id: 'rings', text: 'Fly through three rings', say: 'Your companion flies through a ring of mist. Follow it: each ring gives you a burst of speed.', on: 'ring', n: 3, go: rings },
  ] },
  { title: 'Finding your way', page: 'way', icon: 'south', tasks: [
    { id: 'map', text: 'Open the Map', say: 'Open the menu, top left, and look at the Map: it shows where you have been.', on: 'menuTab', ok: id => id === 'map' },
    { id: 'pin', text: 'Pin a place on the Map', say: 'On the Map, tap a place you liked and pin it. Pins show on your compass.', on: 'pin' },
    { id: 'far', text: 'Fly two kilometres to new country', say: 'Your companion sets off to see new country. Follow it a while: two kilometres from where you were at dawn.', on: 'far', go: far },
  ] },
  { title: 'Songs', page: 'songs', icon: 'songs', tasks: [
    { id: 'learn', text: 'Learn a songbird’s song', say: 'Songbirds sing from the trees. Perch near one and tap the notes button, bottom left: copy each note it sings.', on: 'learn', go: tree },
    { id: 'sing', text: 'Sing a song back to its bird', say: 'Perched near a songbird you have learned, sing its song: it answers, and some bring gifts.', on: 'song' },
    { id: 'call', text: 'Call out', say: 'Hold Call, top right, to call out: the longer you hold, the louder.', on: 'call' },
  ] },
  { title: 'A home', page: 'home', icon: 'nest', tasks: [
    { id: 'twig', text: 'Pick up a twig', say: 'Twigs lie under some broadleaf trees. Land beside one to pick it up.', poll: () => G0.carry === 'twig' || !!G0.nest },
    { id: 'nest', text: 'Start a nest', say: 'With a twig in your beak, perch on a branch: your nest begins there.', poll: () => !!G0.nest },
    { id: 'keepsake', text: 'Find a keepsake', say: 'Now and then something glints in the grass. Land beside it to keep it for your nest.', on: 'keepsake' },
  ] },
  { title: 'Flying well', page: 'well', icon: 'agility', tasks: [
    { id: 'zoom', text: 'Zoom up out of a dive', say: 'Dive to pick up speed, then thumbs in and up: a swept climb that keeps its speed.', poll: zoomed, move: ['in up', 'in up', 'Zoom', 'Fast, then thumbs in and up: a climb that keeps its speed.'] },
    { id: 'hover', text: 'Hover', say: 'Slow right down, then thumbs out and up: you hang on beating wings. It tires them fast.', poll: hovered, move: ['out up', 'out up', 'Hover', 'Slow, then thumbs out and up: hang on beating wings.'] },
    { id: 'barrel', text: 'A barrel roll', say: 'Left thumb down and right up, then turn both a full circle anticlockwise together: a roll.', on: 'trick', ok: k => k === 'barrel', move: ['ccw', 'ccw', 'Barrel roll', 'Left down, right up, then both round a full circle anticlockwise.'] },
  ] },
  { title: 'The wide world', page: 'world', icon: 'south', tasks: [
    { id: 'guide', text: 'Add a page to the field guide', say: 'Fly close by an animal you have not seen before: it gets a page in the Guide.', on: 'sighted' },
    { id: 'land', text: 'Fly over a new land', say: 'The Earth has many lands: forest, steppe, tundra, desert. Fly until you cross into a new one.', on: 'newLand' },
    { id: 'photo', text: 'Take a picture', say: 'Open the menu: Today has Photo mode. Frame a picture and take it.', on: 'photo' },
  ] },
];
const TASKS = CHAPTERS.flatMap((ch, i) => ch.tasks.map(t => ({ ...t, ch: i })));
const SURVIVE = ['mouse', 'eat', 'drink', 'sleep'];   // till these are done: G.ease
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
  // paid: the feathers given (flight, and chapters by index); replay: a chapter played again
  const S = { stage: G.fresh ? 'flight' : 'done', step: 0, done: {}, practice: null, replay: null, after: 'learn', intro: 0, paid: {} };
  let hold = null, prog = 0, flaps = 0, okT = 0, stepT = 0, cur = null, openT = 0, goT = 0, sent = false, coachT = 0, count = 0, introT = 0;

  // ---- the HUD: hidden in the first flight, all of it after ----------------------------------
  function classes() {
    ui.classList.toggle('learn3', S.stage === 'flight');
    coach.skipBar(S.stage === 'flight');
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
    if (S.stage === 'learn') { cur = null; openT = 1e9; if (!S.intro) introT = skipped ? .5 : 3.5; else openT = 2; }
    classes();
    if (!skipped) H.say('You can fly. The rest you learn by living.', { kind: 'tutorial', secs: 5, icon: 'check' });
    if (!skipped) pay('flight', 'First flight');
  }
  coach.onSkip = which => {
    if (which === 'flight') endFlight(true);
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

  // ---- the lessons card: once, after the first flight -----------------------------------------
  ui.insertAdjacentHTML('beforeend', `<div class="lveil3 hidden"><div class="lintro3" role="dialog" aria-label="Lessons"></div></div>`);
  const veil = ui.querySelector('.lveil3'), card = veil.firstChild;
  function intro() {
    const t = first(); if (!t) return;
    S.intro = 1; G.paused = true;
    card.innerHTML = `<h2>${icon('how')}Lessons</h2>
      <p>You can fly${S.paid.flight ? ', and that earned your first feather: each feather makes your wings last longer' : ''}. Now a few small lessons teach the rest, one at a time: eating, drinking and rest first, then rising air, finding your way, songs, a nest and more. Finish a chapter for another feather.</p>
      <div class="lfirst3">${icon(CHAPTERS[t.ch].icon)}<span><small>First</small><b>${esc(t.text)}</b><span>${esc(t.say)}</span></span></div>
      <p>Each new lesson shows as a short line at the top of the screen. All of them, ticked as you go, are in the menu: under <b>Today</b>, and in the <b>Tutorial</b>. Nothing is required: fly as you like.</p>
      <div class="lbtns3"><button data-i="go" class="main3">Start</button><button data-i="all">See all lessons</button><button data-i="skip">No lessons, thanks</button></div>`;
    veil.classList.remove('hidden');
  }
  veil.addEventListener('click', e => {
    const i = e.target.closest('[data-i]')?.dataset.i; if (!i) return;
    veil.classList.add('hidden'); G.paused = false; openT = .5;
    if (i === 'all') G.menu.set(true, 'how', 'lessons');
    if (i === 'skip') skipAll();
  });
  for (const ev of ['touchstart', 'pointerdown']) veil.addEventListener(ev, e => e.stopPropagation());

  // ---- the lessons ----------------------------------------------------------------------------
  const first = () => TASKS.find(t => !S.done[t.id]) || null;
  function open(t) {
    cur = t; count = 0; sent = false; goT = 6; for (const k in P) delete P[k];
    // quietly: a few words, and a glint to tap for the whole of it
    const ch = CHAPTERS[t.ch];
    H.tally(`Lesson: ${t.text}`, ch.icon);
    H.glint(`Lesson: ${t.text}`, t.say, ch.icon, true);   // the tutorial is not held back by the pace (hud.js)
    coachT = t.move ? 8 : 0;
  }
  function complete(t, quiet) {
    S.done[t.id] = 1;
    if (cur === t) {
      if (!quiet) { H.tally(`Done: ${t.text}`, 'check'); G.audio.ring?.(); }
      cur = null; coach.hide(); S.practice = null; openT = 3;
    }
    if (CHAPTERS[t.ch].tasks.every(q => S.done[q.id])) {
      pay(t.ch, CHAPTERS[t.ch].title);
      if (S.replay === t.ch) S.replay = null;
    }
    if (S.stage === 'learn' && !first()) finish();
  }
  // the payoff: a feather for each chapter (and the first flight), only the first time
  function pay(k, title) {
    if (S.paid[k]) return;
    S.paid[k] = 1;
    G.feather?.(title);
  }
  function finish() {
    S.stage = 'done'; cur = null; coach.hide(); classes();
    H.say('That is every lesson. From now on each day offers one aim under Today, each worth a feather.', { kind: 'tutorial', secs: 7, icon: 'check' });
  }
  function skipAll() {
    S.stage = 'done'; hold = null; cur = null; S.practice = null; S.replay = null; S.done.flight = 1; coach.hide(); classes();
    H.say('Lessons skipped. The Tutorial, in the menu, has them all whenever you want them.', { kind: 'tutorial', secs: 5 });
  }
  // an event can tick any task not yet done (doing things ahead counts), the open one aloud
  for (const ev of new Set(TASKS.filter(t => t.on).map(t => t.on))) G.on(ev, (...a) => {
    if (S.stage === 'flight' || (S.stage === 'done' && !cur && S.replay == null)) return;
    for (const t of TASKS) if (t.on === ev && (!S.done[t.id] || t === cur) && (!t.ok || t.ok(a[0]))) {
      if (t === cur && t.n && ++count < t.n) continue;
      if (t !== cur && t.n) continue;   // a count only for the open task
      complete(t, t !== cur);
    }
  });

  function learn(dt, c) {
    if (!cur) {
      if ((openT -= dt) > 0) return;
      const t = S.practice ? TASKS.find(q => q.id === S.practice) : S.replay != null ? TASKS.find(q => q.ch === S.replay && !S.done[q.id]) : S.stage === 'learn' ? first() : null;
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
  // ---- the Tutorial: the Overview, then a page for each chapter (howto.js adds the cards) -------
  const over = G.menu.page('how', 'lessons', 'Overview', 5);
  const pg = Object.fromEntries(PAGES.map(([id, title, order]) => [id, G.menu.page('how', id, title, order)]));
  const box = {};
  for (const id in pg) { box[id] = document.createElement('div'); box[id].className = 'lchap3'; pg[id].prepend(box[id]); }
  G.menu.button('play', { label: 'Tutorial', sub: 'learn to fly again, or replay any lesson', group: 'journey', onClick: () => G.menu.set(true, 'how', 'lessons') });
  const mark = on => `<i class="${on ? 'on' : ''}">${on ? icon('check') : ''}</i>`;
  const tick = t => mark(S.done[t.id]);
  const left = ch => ch.tasks.filter(q => !S.done[q.id]).length;
  const feather = k => S.paid[k] ? `<span class="lfeather3" title="Feather earned">${icon('feather')}</span>` : '';
  const live = () => S.stage === 'learn' || !!S.practice || S.replay != null;
  function paint() {
    const on = live();
    today.el.classList.toggle('hidden', !on);
    if (on) {
      const t = cur || (S.replay != null ? TASKS.find(q => q.ch === S.replay && !S.done[q.id]) : null) || first(), ch = CHAPTERS[t ? t.ch : 0];
      const n = CHAPTERS.indexOf(ch) + 2;
      today.body.innerHTML = `<p class="lch3">${icon(ch.icon)}<b>${esc(ch.title)}</b><small>${n} of ${CHAPTERS.length + 1}</small></p>
        <ul class="lessons3">${ch.tasks.map(q => `<li class="${S.done[q.id] ? 'done' : q === t || q.id === t?.id ? 'now' : 'later'}">${tick(q)}<span>${esc(q.text)}</span></li>`).join('')}</ul>
        <p class="lnote3">${S.paid[CHAPTERS.indexOf(ch)] ? 'Played again: no new feather.' : 'Finish the chapter for a feather.'} <button data-l="page">Tutorial</button></p>`;
    }
    // the Overview: the payoff, then every chapter in order with its progress and Replay
    const done = TASKS.filter(t => S.done[t.id]).length + (S.done.flight ? 1 : 0), all = TASKS.length + 1;
    const nf = G.feathers?.() || 0;
    const row = (i, id, title, d, of, k) => `<li class="${d === of ? 'done' : ''}"><button class="lopen3" data-p="${id}">${mark(d === of)}<b>${i}. ${esc(title)}</b><small>${d === of ? 'Done' : `${d} of ${of}`}</small>${feather(k)}</button><button data-r="${k}">${d === of ? 'Replay' : k === 'flight' ? 'Fly it' : 'Start'}</button></li>`;
    over.innerHTML = `<div class="lpay3">${icon('feather')}<span><b>Learn Aloft one chapter at a time.</b> The first flight and each chapter you finish earns a feather; so does each day’s aim, under Today. Every feather makes your wings last longer.
        <small>${nf ? `${nf} feather${nf > 1 ? 's' : ''}: wings +${G.wingBonus?.() || 0}%` : 'No feathers yet'} · ${done} of ${all} lessons done</small></span></div>
      <ul class="lover3">${row(1, 'controls', 'Flying', S.done.flight ? 1 : 0, 1, 'flight')}${CHAPTERS.map((ch, i) => row(i + 2, ch.page, ch.title, ch.tasks.length - left(ch), ch.tasks.length, i)).join('')}</ul>
      <div class="lbtns3">${S.stage === 'learn' ? '<button data-l="skip">Skip the lessons</button>' : ''}<button data-l="over">Start all the lessons over</button></div>
      <p class="lnote3">Replay clears a chapter’s ticks and plays its lessons again. Feathers come only the first time.</p>`;
    // each chapter's page: its lessons, ticked, with Practise
    box.controls.innerHTML = `<section class="lgrp3"><h3>${icon('flap')}1. The first flight${feather('flight')}<small>${S.done.flight ? 'Done' : 'Not yet'}</small></h3>
      <ul class="lessons3">${STEPS.map(st => `<li class="${S.done.flight ? 'done' : ''}">${mark(S.done.flight)}<span>${esc(st[1])}</span></li>`).join('')}</ul>
      <p class="lnote3">Ten moves, one at a time, with the thumbs shown on screen. <button data-l="flight">Fly the first flight ${S.done.flight ? 'again' : ''}</button></p></section>`;
    CHAPTERS.forEach((ch, i) => {
      box[ch.page].innerHTML = `<section class="lgrp3"><h3>${icon(ch.icon)}${i + 2}. ${esc(ch.title)}${feather(i)}<small>${ch.tasks.length - left(ch)} of ${ch.tasks.length}</small></h3>
        <ul class="lessons3">${ch.tasks.map(q => `<li class="${S.done[q.id] ? 'done' : ''}">${tick(q)}<span>${esc(q.text)}</span><button data-t="${q.id}">Practise</button></li>`).join('')}</ul>
        <p class="lnote3">${S.paid[i] ? 'Feather earned.' : 'Finish the chapter for a feather.'} <button data-r="${i}">${left(ch) === ch.tasks.length ? 'Start the chapter' : 'Replay the chapter'}</button></p></section>`;
    });
  }
  G.menu.onOpen(paint);
  G.on('menuPage', tab => { if (tab === 'how') paint(); });
  // replay a chapter: its ticks cleared, its lessons open one by one (the first flight flies again)
  function replay(k) {
    if (k === 'flight') return G.lessons.replay();
    const i = +k; if (!CHAPTERS[i]) return;
    for (const q of CHAPTERS[i].tasks) delete S.done[q.id];
    S.replay = i; S.practice = null; cur = null; coach.hide(); openT = .5; G.menu.set(false);
  }
  const act = e => {
    const el = e.target.closest('[data-l], [data-t], [data-r], [data-p]'); if (!el) return;
    const l = el.dataset.l, t = TASKS.find(q => q.id === el.dataset.t);
    if (el.dataset.p) return G.menu.set(true, 'how', el.dataset.p);
    if (el.dataset.r != null) return replay(el.dataset.r);
    if (l === 'page') return G.menu.set(true, 'how', 'lessons');
    if (l === 'flight') return G.lessons.replay();
    if (l === 'skip') { skipAll(); return paint(); }
    if (l === 'over') { S.done = { flight: 1 }; S.practice = null; S.replay = null; cur = null; if (S.stage === 'done') S.stage = 'learn'; openT = 2; classes(); G.menu.set(false); return; }
    if (t) { S.practice = t.id; cur = null; openT = .5; G.menu.set(false); }
  };
  for (const el of [over, today.body, ...Object.values(box)]) el.addEventListener('click', act);

  G.dev?.add({ id: 'lessons', area: 'Menu and story', round: 'Tutorial 10-23', title: 'Lessons: the first flight (HUD hidden, ghost thumbs, Skip), then a chain of lessons under Today; HUD pieces appear as they matter',
    how: 'Reset all game data (Settings > Journey), or Tutorial > Flying > Fly the first flight again. Replay any chapter from the Overview; practise any lesson on its page.', go: () => G.lessons.replay() });

  classes();
  return {
    id: 'lessons',
    update(dt, c) {
      G.ease = ease();
      if (introT > 0 && (introT -= dt) <= 0 && !G.menu.open) intro();
      if (S.stage === 'flight') flight(dt, c);
      else if (S.stage === 'learn' || S.practice || S.replay != null) learn(dt, c);
    },
    save: () => ({ stage: S.stage === 'flight' ? S.after === 'done' ? 'done' : 'flight' : S.stage, step: 0, done: S.done, after: S.after, intro: S.intro, paid: S.paid, replay: S.replay }),
    load(o) {
      Object.assign(S, { paid: {}, replay: null }, o, { practice: null });
      if (S.stage === 'learn' && !S.intro) { introT = 2; openT = 1e9; }   // left before the lessons card: it shows first
      if (S.stage === 'flight') { S.step = b.state === 'fly' ? 1 : 0; hold = { h: G.hunger, t: G.thirst, tod: G.tod }; }
      classes();
    },
  };
}
