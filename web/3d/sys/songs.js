// Songs: songbirds sit in some trees and sing in their hours, songs written from the real
// birds' (whistles, chips, trills and buzzes at five pitches; see src/songs.js). Perch near one
// and copy its score on the song controls to learn it. To use a song you know, pick its bird
// from Songs and imitate it: sing it right from any perch and a bird of that kind answers, with
// its gift. Beside its own bird, a known song is a duet: it sings the first half and you answer
// with the rest; a clean, well-timed song makes the gift last longer.
// Every clear dawn but in winter the whole wood sings for a few minutes (the dawn chorus).
// Also the hawk's own call: hold Call to scream; mice freeze, far hawks answer, cliffs echo.
//
// Learned and heard songs and the song log keep their own keys (aloft.learned, aloft.heard,
// aloft.songlog), as in 2D, so a new journey keeps them. G.learned is a Set of species ids
// (the music and courtship read it). Gifts that other systems can make real (calm weather,
// berries, fish, a companion) are announced on the bus as G.emit('gift', ev): set ev.handled
// and this system skips its own stand-in. G.gifts holds each running gift's seconds left.
import { SPECIES, active, timeOfDay } from '../../src/songs.js';
import { MUSIC_MODES } from '../../src/music.js';
import { period, DAY } from '../sky.js';
import { height, WATER, treesNear, perchesOf, thermalsNear, landmarksNear } from '../world.js';
import { clamp, dist3 } from '../util.js';
import { registerSongbirds, pushBird, songTreesNear, habitat, land } from './songbirds.js';
import { createSingUI, NOTE_COLS, KINDS } from './singui.js';
import { journal } from '../journal.js';
import { BIRD } from '../hawk.js';
import { songbirdPic } from '../pics.js';

// lands with rock walls to sing against (songs echo there)
const ECHO_LANDS = new Set(['canyon', 'badlands', 'fjord', 'cliffs', 'coast', 'karst']);
export const SONG = {
  hearR: 90,        // a songbird is heard (and joins the left pools) within this
  nearR: 24,        // close enough to learn from, sitting or standing
  simR: 140,        // songbirds simulated around the hawk
  powerCD: 40,      // seconds before a song's gift works again (a companion's, four times that)
  chorus: 150,      // how long the dawn chorus lasts
  callCD: 6,        // seconds between screams
  visitStay: 22,    // how long a bird that flew in to answer stays
};
// what each gift does in 3D, where it differs from songs.js
const GIFT_TEXT = {
  worms: 'grubs stir in the bark, and you eat a few',
  companion: 'it shows you the way to rising air',
  night: 'the night grows bright (and once you know it, you see better at night)',
  warm: 'a warm glow: your wings recover faster',
  glint: 'it scolds toward a songbird whose song you do not know yet',
  ripen: 'it leads you to ripe berries, and you eat',
  fish: 'a fish rises and you snatch it',
  calm: 'the air goes calm and gentle for a while',
};
const FAR = { hawk: 'hawks', osprey: 'ospreys', owl: 'owls', raven: 'ravens' };
const PHRASE = { dawn: 'at dawn', day: 'in the daytime', dusk: 'at dusk', night: 'at night' };
const PLACE = { forest: 'the woods', ridge: 'the great ridge', coast: 'the coast', meadow: 'a meadow', marsh: 'the marsh', lakeland: 'the lakeland', cliffs: 'the high ground', mountains: 'the mountains' };
const hex01 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const NOTE01 = NOTE_COLS.map(hex01);
const compass = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((Math.atan2(dx, -dz) / (Math.PI / 4) + 8)) % 8];

export function songsSystem(G) {
  const b = G.b, A = G.audio, H = G.hud, store = G.store;
  registerSongbirds(G.R);
  G.learned = new Set(store.get('learned', []));
  G.heard = new Set(store.get('heard', []));
  G.species = SPECIES;
  G.gifts = {};
  const songLog = store.get('songlog', {});
  let placeK = 0, placeSent = 0, practiceT = 0;
  const sungAt = {};                 // landmark id -> the day a song opened it
  const taught = {};                 // young bird's spot id -> { from: species id, day } (a song you taught it)
  const mixHeard = {};               // spot ids whose mixed song you have heard
  let wonder = null, S3night = 0;                 // a place's answer under way: { kind, l, t }   // how much the rock walls echo, eased
  const birds = new Map();          // songbird tree id -> { next, singT }
  let near = [], refreshT = 0, sightT = 0, perchT = 0, voice = null, callT = 0, chorus = null, chorusDay = 0, picked = null;
  let visitor = null, flock = [], trailT = 0;
  const powerCD = {};                // species id -> G.clock when its gift works again
  // the song you are copying: `target` (a species), with its bird beside you (`bird`) or not
  const S = { target: null, bird: null, tries: [], errs: [], lastTry: -9, wrongT: 0, doneT: 0, duet: false };
  const lefty = () => store.get('lefty', false);

  // things that happen a moment later, on the game clock (so a pause holds them)
  const queue = [];
  const later = (s, fn) => queue.push({ t: G.t + s, fn });

  const ui = createSingUI(document.getElementById('ui3'), {
    audio: A, voice: () => SPECIES[voice ?? 1].voice,
    onSyll: (lane, kind) => { notePart(b.p, lane); G.music.echo(lane); singNote(lane, kind); },
    onPick: pick, onCall: call, onHear: hearIt,
  });

  // ---- songbirds singing --------------------------------------------------------------------
  const storm = () => G.storm || 0, winter = () => G.season.winter;
  const young = s => s.young && !winter();
  const isOut = s => active(s.sp, G.tod, storm(), winter()) || ((G.gifts.sing > 0 || chorus && !s.sp.look.owl) && storm() < .6);
  function notePart(p, lane, col = NOTE01[lane]) {
    G.part([p[0], p[1] + .35, p[2]], [(Math.random() - .5) * .8, 2.4 + lane * .2, (Math.random() - .5) * .8], 1.5, col, .13);
  }
  function hear(sp) { if (!G.heard.has(sp.id)) { G.heard.add(sp.id); store.set('heard', [...G.heard]); } }
  // a songbird (or a visitor) sings; in a duet it sings only the first half and leaves the rest to you
  function sing(o, duet = false) {
    const sp = o.sp, d = dist3([o.x, o.y, o.z], b.p), v = .16 * clamp(1 - d / SONG.hearR, 0, 1);
    // a bird you taught, days on, sings its own first half and then your phrase
    const t = taught[o.id], mix = t && G.day - t.day >= 2 && !duet && S.bird !== o ? SPECIES[t.from] : null;
    const half = Math.ceil(sp.notes.length / 2), tune = mix ? { notes: [...sp.notes.slice(0, half), ...mix.notes.slice(Math.floor(mix.notes.length / 2))], kinds: sp.kinds.slice(0, half) + mix.kinds.slice(Math.floor(mix.notes.length / 2)) } : sp;
    if (mix && v > .04 && !mixHeard[o.id]) {
      mixHeard[o.id] = 1;
      later(tune.notes.length * sp.gap, () => H.toast(`Listen: the ${sp.name.toLowerCase()} you taught sings its own song, then ends it with the ${mix.name}'s phrase.`, 5));
    }
    const count = duet ? half : tune.notes.length;
    o.singT = count * sp.gap + .2;
    if (duet) { S.tries = []; S.errs = []; S.wrongT = 0; S.doneT = 0; S.lastTry = G.t + count * sp.gap; }
    tune.notes.slice(0, count).forEach((n, i) => later(i * sp.gap, () => {
      if (v > .005) A.note(n, sp.voice, v * (o.young && !winter() ? .8 : 1), tune.kinds[i]);
      if (v > .04) hear(sp);
      notePart([o.x, o.y, o.z], n);
      if (S.bird === o) ui.glow(n);
    }));
  }

  // ---- your singing: copying a songbird, or imitating one you know ------------------------
  // a syllable on the strip (or the keys): right if both its pitch and its kind match the next
  // one in the score. Wrong ones only flash; a pause starts over.
  function singNote(lane, kind) {
    const sp = S.target; if (!sp) return;
    if (G.t - S.lastTry > 6 || S.doneT > 0) { S.tries = []; S.wrongT = 0; S.doneT = 0; S.errs = []; }
    const gap = Math.max(sp.gap * 2, .45), late = S.tries.length || S.duet ? clamp((Math.abs(G.t - S.lastTry - gap) - .15) / gap, 0, 1) : 0;
    S.lastTry = G.t; S.errs.push(.4 * late);
    const off = S.duet ? Math.ceil(sp.notes.length / 2) : 0, i = off + S.tries.length;
    S.tries.push(lane);
    const quality = () => 1 - S.errs.reduce((a, v) => a + v, 0) / Math.max(1, S.errs.length) * 2.5;
    if (sp.notes[i] !== lane || sp.kinds[i] !== kind) { S.wrongT = .5; S.tries.pop(); S.errs[S.errs.length - 1] = 1; }
    else if (i + 1 === sp.notes.length) {
      S.doneT = 2.5;
      if (!G.learned.has(sp.id)) learn(sp);
      else { respond(sp, S.bird || near.find(s => s.sp === sp && s.out && dist3([s.x, s.y, s.z], b.p) < SONG.hearR), quality()); teach(sp); opens(sp, quality()); }
    }
  }
  function learn(sp) {
    G.learned.add(sp.id); store.set('learned', [...G.learned]); A.learned();
    if (S.bird) S.duet = true;
    songLog[sp.id] = `Learned on day ${G.day} ${PHRASE[period(G.tod)]}, in ${PLACE[habitat(b.p[0], b.p[2])]}.`;
    store.set('songlog', songLog);
    H.toast(`You learned the ${sp.name}'s song. Sing it from any perch and a ${sp.name.toLowerCase()} answers with a gift.`, 5);
    ui.cheer(`Song learned: the ${sp.name}`);
    H.did('song');
    for (let k = 0; k < 14; k++) G.part([b.p[0], b.p[1] + .4, b.p[2]], [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], 1.4, [1, .85, .45], .1);
    G.emit('learn', sp);
  }
  // choose a bird from Songs: you sing in its voice and imitate it. It sings its song once, softly,
  // as you remember it (a bird you have only heard: its voice, but no song to copy yet).
  function pick(id) {
    picked = id === null ? null : SPECIES[id]; voice = id;
    S.tries = []; S.errs = []; S.doneT = 0;
    if (!picked) { ui.cheer('You sing as yourself'); return; }
    if (!G.learned.has(id)) { ui.cheer(`You sing in the ${picked.name}'s voice`); return; }
    ui.cheer(`Imitate the ${picked.name}`); H.did('imitate');
    picked.notes.forEach((n, i) => later(.5 + i * picked.gap, () => { A.note(n, picked.voice, .07, picked.kinds[i]); ui.glow(n); }));
  }
  // Hear it (the song card): the song you are copying, once, softly, its notes lit on the pad
  function hearIt() {
    const sp = S.target || (picked && G.learned.has(picked.id) ? picked : null);
    if (!sp) { ui.cheer(picked ? 'Listen for one nearby first' : 'Pick a bird to imitate'); return; }
    sp.notes.forEach((n, i) => later(.2 + i * sp.gap, () => { A.note(n, sp.voice, .08, sp.kinds[i]); ui.glow(n); }));
  }

  // ---- teaching a young bird (round six) -----------------------------------------------------
  // Sing a song you know beside a young bird of another kind: it listens, and some days later
  // it sings its own song ending in your phrase, there in its tree.
  function teach(sp) {
    const y = S.close;
    if (!y || !young(y) || y.sp === sp || taught[y.id]?.from === sp.id) return;
    taught[y.id] = { from: sp.id, day: G.day };
    H.toast(`The young ${y.sp.name.toLowerCase()} leans in and listens to your ${sp.name.toLowerCase()} song. Come back in a few days.`, 5);
    for (let k = 0; k < 8; k++) G.part([y.x, y.y + .3, y.z], [(Math.random() - .5) * 1.5, 1 + Math.random(), (Math.random() - .5) * 1.5], 1.2, [.7, .9, 1], .08);
  }

  // ---- songs that open places (round six) ----------------------------------------------------
  // A song you know, sung well at a landmark, wakes something there, once a day: a summit cairn
  // brings the northern lights (by day, a halo round the sun), an arch a hidden thermal under it,
  // a giant redwood a rare bird, a waterfall a rainbow in its spray. The world can answer
  // instead ('placeSong' ev.handled); this is the stand-in.
  const OPENS = { cairn: 'lights', arch: 'thermal', giant: 'rare', falls: 'bow' };
  function opens(sp, q) {
    if (q < .45) return;
    const l = landmarksNear(b.p[0], b.p[2], 120).find(l => OPENS[l.kind] && Math.hypot(l.x - b.p[0], l.z - b.p[2]) < 60 + (l.r || 0));
    if (!l || sungAt[l.id] === G.day) return;
    sungAt[l.id] = G.day;
    const kind = OPENS[l.kind], ev = { l, sp, q, kind, handled: false };
    G.emit('placeSong', ev);
    if (ev.handled) return;
    wonder = { kind, l, t: kind === 'rare' ? 0 : 90 };
    if (kind === 'lights') H.toast(S3night > .5 ? `Your song rings off ${l.name}, and the sky answers: the northern lights unroll overhead.` : `Your song rings off ${l.name}, and a pale halo opens round the sun.`, 6);
    if (kind === 'thermal') H.toast(`Your song rings under ${l.name}, and warm air begins to rise through it: a hidden thermal.`, 6);
    if (kind === 'bow') H.toast(`Your song carries over ${l.name}, and a rainbow stands in its spray.`, 6);
    if (kind === 'rare') {
      const rare = SPECIES.filter(q2 => !G.learned.has(q2.id) && q2 !== sp && !q2.spot);
      const r = rare[Math.floor(Math.random() * rare.length)] || SPECIES[Math.floor(Math.random() * 16)];
      later(2.5, () => { callVisitor(r); H.toast(`Something answers from far off: a ${r.name.toLowerCase()}, a bird of other lands, comes down into ${l.name}.`, 6); });
    }
  }

  // ---- answers and gifts ---------------------------------------------------------------------
  function respond(sp, bird, q = 1) {
    // some birds of the rock answer only a song that rings back off the walls
    if (sp.echo && !S.echoed) {
      ui.cheer(`The ${sp.name} listens, but does not answer`);
      H.toast(`The ${sp.name} answers only a song that echoes: sing it low between rock walls, in a canyon or by a waterfall.`, 4);
      G.emit('song', sp, q); return;
    }
    if (bird) later(.7, () => sing(bird)); else callVisitor(sp);
    const scale = .6 + .6 * clamp(q, 0, 1), how = q > .85 ? ' A perfect duet.' : q < .45 ? ' (A rough one: steadier notes make the gift last.)' : '';
    ui.cheer(q > .85 ? `A perfect song: the ${sp.name} answers` : `The ${sp.name} answers`);
    G.emit('song', sp, q);
    if (chorus) {
      const others = [...G.learned].map(id => SPECIES[id]).filter(s => s !== sp && (powerCD[s.id] ?? 0) <= G.clock);
      for (const s2 of others) { powerCD[s2.id] = G.clock + cd(s2); gift(s2, .5); }
      if (others.length) H.toast(`The whole chorus answers: ${others.map(s => s.name).join(', ')} too.`, 4);
    }
    if ((powerCD[sp.id] ?? 0) > G.clock) { H.toast(`The ${sp.name} answers your song.${how}`, 2.5); return; }
    powerCD[sp.id] = G.clock + cd(sp);
    const text = gift(sp, scale);
    H.toast(`The ${sp.name} answers: ${text}.${how}`, 4);
  }
  const cd = sp => sp.powerKey === 'companion' ? SONG.powerCD * 4 : SONG.powerCD;
  // a song's gift; k scales how long it lasts. Returns the words for the toast.
  function gift(sp, k = 1) {
    const key = sp.powerKey, ev = { key, k, sp, handled: false };
    G.emit('gift', ev);
    const run = s => { G.gifts[key] = Math.max(G.gifts[key] || 0, s * k); };
    const text = GIFT_TEXT[key] || sp.power;
    if (ev.handled) return sp.power;
    switch (key) {
      case 'worms': G.hunger = Math.min(1, (G.hunger ?? 1) + .2 * k); break;
      case 'ripen': G.hunger = Math.min(1, (G.hunger ?? 1) + .15 * k); break;
      case 'fish': G.hunger = Math.min(1, (G.hunger ?? 1) + .25 * k); break;
      case 'flock': run(60); makeFlock(sp); break;
      case 'calm': run(120); break;
      case 'companion': run(60); break;
      case 'tailwind': run(45); break;
      case 'night': run(90); break;
      case 'lark': b.stamina = 1; G.thirst = Math.min(1, (G.thirst ?? 1) + .15 * k); break;
      case 'warm': run(180); break;
      case 'mice': run(60); break;
      case 'dew': G.thirst = Math.min(1, (G.thirst ?? 1) + .3 * k); break;
      case 'glint': return glint() || text;
      case 'sing': run(120); break;
      case 'lift': run(90); break;
      case 'dusk': run(150); break;
      // round six: the newer lands' birds and the night singers
      case 'juice': G.thirst = Math.min(1, (G.thirst ?? 1) + .25 * k); break;
      case 'updraft': run(60); break;
      case 'hardy': run(240); break;
      case 'clear': G.hunger = Math.min(1, (G.hunger ?? 1) + .2 * k); G.thirst = Math.min(1, (G.thirst ?? 1) + .1 * k); break;
      case 'bells': return bells() || text;
      case 'fireflies': run(120); break;
      case 'moths': G.hunger = Math.min(1, (G.hunger ?? 1) + .15 * k); for (let i = 0; i < 14; i++) G.part([b.p[0] + (Math.random() - .5) * 6, b.p[1] + Math.random() * 3, b.p[2] + (Math.random() - .5) * 6], [(Math.random() - .5) * 2, 1 + Math.random(), (Math.random() - .5) * 2], 2, [.85, .82, .7], .1); break;
      case 'hush': run(25); for (const m of G.systems.food?.mice?.values() || []) { m.go = 0; m.flee = 0; m.wait = Math.max(m.wait, 25); } break;
    }
    return text;
  }
  // a blue jay's gift: it scolds toward the nearest songbird you have not learned
  let glintAt = null;
  function glint() {
    const all = songTreesNear(b.p[0], b.p[2], 700).filter(s => !G.learned.has(s.sp.id));
    const pick = all.filter(isOut).concat(all).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
    if (!pick) return 'it scolds, but every songbird near here is one you know';
    glintAt = [pick.x, pick.y, pick.z]; G.gifts.glint = 40;
    const d = Math.hypot(pick.x - b.p[0], pick.z - b.p[2]);
    return `it scolds toward a ${pick.sp.name.toLowerCase()}, ${d < 120 ? 'close by' : d < 350 ? 'a short flight' : 'a long glide'} to the ${compass(pick.x - b.p[0], pick.z - b.p[2])}`;
  }
  // a bellbird's gift: its bells ring toward the nearest landmark you have not found
  let bellAt = null;
  function bells() {
    const found = G.systems.journey?.save?.().found || {};
    const l = landmarksNear(b.p[0], b.p[2], 2500).filter(l => !found[l.id])
      .sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
    if (!l) return 'its bells ring, but every place near here is one you know';
    bellAt = [l.x, Math.max(height(l.x, l.z), WATER) + 25, l.z]; G.gifts.bells = 60;
    return `its bells ring toward ${l.name}, to the ${compass(l.x - b.p[0], l.z - b.p[2])}`;
  }
  // a songbird that flies in to answer from a tree near you, sings, and leaves after a while
  function callVisitor(sp) {
    let best = null, bd = Infinity;
    for (const t of treesNear(b.p[0], b.p[2], 40)) for (const p of perchesOf(t)) {
      const d = Math.hypot(p.x - b.p[0], p.z - b.p[2]);
      if (d < 6 || d > 40) continue;
      const score = Math.abs(d - 16) + Math.random() * 6; if (score < bd) { bd = score; best = p; }
    }
    const a = Math.random() * 6.28, from = [b.p[0] + Math.cos(a) * 70, b.p[1] + 25, b.p[2] + Math.sin(a) * 70];
    const to = best ? [best.x + .3, best.y + .02, best.z] : [b.p[0] + Math.cos(a) * 3, b.p[1] + 1.5, b.p[2] + Math.sin(a) * 3];
    visitor = { sp, x: from[0], y: from[1], z: from[2], from, to, t: 0, sang: false, leaving: false, perched: !!best, heading: 0 };
  }
  function updateVisitor(dt) {
    const v = visitor; if (!v) return;
    v.t += dt;
    const target = v.leaving ? [v.to[0] + (v.to[0] - v.from[0]) * 2, v.to[1] + 40, v.to[2] + (v.to[2] - v.from[2]) * 2] : v.to;
    const dx = target[0] - v.x, dy = target[1] - v.y, dz = target[2] - v.z, d = Math.hypot(dx, dy, dz);
    v.flying = d > .15;
    if (v.flying) { const s = Math.min(d, 10 * dt); v.x += dx / d * s; v.y += dy / d * s; v.z += dz / d * s; v.heading = Math.atan2(dx, -dz); }
    if (!v.flying && !v.sang) { v.sang = true; sing(v); if (!v.perched) v.leaving = true; v.until = v.t + SONG.visitStay; }
    if (v.sang && !v.leaving && v.t > v.until) v.leaving = true;
    if (v.leaving && d < 1) visitor = null;
    if (v.t > 90) visitor = null;
  }
  // a robin's gift: a little flock of songbirds flies with you
  function makeFlock(sp) {
    flock = Array.from({ length: 7 }, (_, i) => ({ sp, x: b.p[0] + (Math.random() - .5) * 30, y: b.p[1] + 10, z: b.p[2] + (Math.random() - .5) * 30, o: [Math.cos(i * 2.4) * (4 + i), 1.5 + (i % 3), Math.sin(i * 2.4) * (4 + i)], ph: Math.random() * 6, heading: 0 }));
  }
  function updateFlock(dt) {
    if (!flock.length) return;
    if (!(G.gifts.flock > 0)) { for (const f of flock) f.y += 6 * dt; if (flock[0].y > b.p[1] + 60) flock = []; return; }
    for (const f of flock) {
      // a little ahead of the hawk in flight, so they keep up
      const w = G.t * .7 + f.ph, lead = b.state === 'fly' ? b.s * .6 : 0;
      const tx = b.p[0] + f.o[0] + Math.sin(w) * 2 + Math.sin(b.yaw) * lead, ty = b.p[1] + f.o[1] + Math.sin(w * 1.7) * .8, tz = b.p[2] + f.o[2] + Math.cos(w) * 2 - Math.cos(b.yaw) * lead;
      const dx = tx - f.x, dz = tz - f.z, k = Math.min(1, dt * 1.8);
      f.x += dx * k; f.y += (ty - f.y) * k; f.z += dz * k;
      if (Math.hypot(dx, dz) > .05) f.heading = Math.atan2(dx, -dz);
    }
  }

  // ---- the hawk's call -------------------------------------------------------------------------
  // a cliff, a peak or a mountainside within reach sends the call back, later the further off
  function echo() {
    let d = Infinity;
    for (let a = 0; a < 6.28; a += .785) for (const r of [150, 350, 700]) {
      const x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r, h = height(x, z);
      if (h > b.p[1] - 20 && h > 50) d = Math.min(d, Math.hypot(r, h - b.p[1]));
    }
    return d < 1000 ? { delay: d / 343 * 1.6, vol: .5 * (1 - d / 1000) } : null;
  }
  function call(k = 1) {
    if (callT > 0) return;
    callT = SONG.callCD;
    const e = echo(); if (e) e.vol *= .4 + .6 * k;
    // in the voice of the bird you fly as, and off high ground it comes back a moment later
    A.call(BIRD, false, null, .3 + .7 * k);
    if (e) A.call(BIRD, false, e, .3 + .7 * k);
    if (Math.random() < .6) A.call(BIRD, true);   // one of your kind far off answers
    // mice freeze where they stand for a few seconds
    for (const m of G.systems.food?.mice?.values() || []) { m.go = 0; m.flee = 0; m.wait = Math.max(m.wait, 5); }
    H.did('call'); G.emit('call', k);
    if (!G.flags.call) { G.flags.call = 1; H.toast(`Your call carries over the valley. Mice freeze where they stand, and ${FAR[BIRD] || 'birds of your kind'} far off answer.`, 5); }
  }

  // ---- keys: 1 to 5 sing at each pitch, 6 to 9 choose whistle, chip, trill, buzz; C calls -------
  addEventListener('keydown', e => {
    if (G.paused || e.repeat) return;
    const n = '12345'.indexOf(e.key), k = '6789'.indexOf(e.key);
    if (n >= 0 && ui.ready && !ui.open) ui.sing(true);
    if (n >= 0 && ui.open) { A.note(n, SPECIES[voice ?? 1].voice, .18, ui.kind); ui.glow(n); notePart(b.p, n); G.music.echo(n); singNote(n, ui.kind); }
    if (k >= 0 && ui.open) ui.setKind(KINDS[k][0]);
    if (e.code === 'KeyC') call(.6);
  });

  // ---- tips and the Songs tab ---------------------------------------------------------------------
  H.tip('song', () => S.bird && !G.learned.has(S.bird.sp.id), 'A songbird! Tap Sing and copy its score on the note pad: the row is the pitch, the touch is the sound.');
  H.tip('imitate', () => b.state === 'perch' && G.learned.size && !picked && perchT > 3, 'Tap Sing, then open the song card (bottom left) and pick a bird to imitate. Sing its song right and it answers with a gift.');
  H.tip('call', () => b.state === 'fly' && G.clock > 240, 'Hold Call, top right, to scream: the longer you hold, the louder. Mice freeze and far hawks answer.');
  // (after the core's own tabs, which main.js adds once the systems are made)
  queueMicrotask(songsTab);
  function songsTab() {
    const pane = journal(G).page('songs');
    pane.insertAdjacentHTML('beforeend', '<div class="songbook3"></div>');
    const book = pane.querySelector('.songbook3');
    G.menu.onOpen(() => {
      // a card for each songbird: its picture, its name and what its song gives
      const card = sp => {
        const k = G.learned.has(sp.id) ? 'learned' : G.heard.has(sp.id) ? 'heard' : 'unknown';
        const pic = `<img alt="" src="${songbirdPic(sp, 128)}">`;
        if (k === 'unknown') return `<li class="unknown"><div class="pic">${pic}</div><div><b>Not yet heard</b><small>${sp.hint}</small></div></li>`;
        const gift = GIFT_TEXT[sp.powerKey] || sp.power, what = k === 'learned' ? `${gift[0].toUpperCase()}${gift.slice(1)}. ${songLog[sp.id] || 'Learned.'}` : `Heard, not yet learned. ${sp.hint}.`;
        return `<li class="${k} seen"><div class="pic">${pic}</div><div><b>${sp.name}</b><small>${what}</small></div></li>`;
      };
      book.innerHTML = `<p class="sub">${G.learned.size} of ${SPECIES.length} songs learned. Perch near a singing bird to learn its song.</p><ul class="guide3 songs3">${SPECIES.map(card).join('')}</ul>`;
    });
    G.menu.toggle('play', { label: 'Left-handed singing', sub: 'notes on the left, birds on the right', get: lefty, set: v => store.set('lefty', v) });
    const styleName = () => (MUSIC_MODES.find(m => m[0] === G.music.mode) || MUSIC_MODES[0])[1];
    G.menu.button('play', { label: 'Music style', sub: styleName(), group: 'sound', onClick: el => {
      const i = MUSIC_MODES.findIndex(m => m[0] === G.music.mode), next = MUSIC_MODES[(i + 1) % MUSIC_MODES.length][0];
      G.music.setMode(next); store.set('musicMode', next); el.querySelector('em').textContent = styleName();
    } });
    G.menu.button('play', { label: 'Bird song lab', sub: 'choose the songbirds’ voice', href: 'lab.html', group: 'sound' });
  }

  // ---- each frame --------------------------------------------------------------------------------
  return {
    id: 'songs', ui,   // (ui.lanePt for test scripts)
    update(dt) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].t <= G.t) { const q = queue[i]; queue.splice(i, 1); q.fn(); }
      for (const k in G.gifts) { G.gifts[k] -= dt; if (G.gifts[k] <= 0) delete G.gifts[k]; }
      callT = Math.max(0, callT - dt);
      perchT = b.state === 'perch' ? perchT + dt : 0;

      // the dawn chorus: every clear morning but in winter
      if (chorus) { if ((chorus.t -= dt) <= 0) chorus = null; }
      else if (chorusDay !== G.day && G.tod > .27 && G.tod < .31 && winter() < .5 && storm() < .4) {
        chorusDay = G.day; chorus = { t: SONG.chorus };
        H.toast('The dawn chorus: for a few minutes every bird nearby sings. Join in, and all the songs you know answer at once.', 6);
      }

      // songbirds near the hawk: each sings now and then in its hours
      if ((refreshT -= dt) <= 0) {
        refreshT = .5; near = songTreesNear(b.p[0], b.p[2], SONG.simR);
        // echo places: low between rock walls in the walled lands, or by a waterfall
        const walls = ECHO_LANDS.has(land(b.p[0], b.p[2])) && echo(), falls = landmarksNear(b.p[0], b.p[2], 90).some(l => l.kind === 'falls');
        S.echoed = !!(walls && walls.delay < 3) || falls;
        if (S.echoed && ui.open && !G.flags.echo) { G.flags.echo = 1; H.toast('Rock walls all round: your song rings back off them here. Some birds of the rock answer only a song that echoes.', 5); }
      }
      placeK += ((S.echoed ? 1 : 0) - placeK) * Math.min(1, dt * .8);
      if (Math.abs(placeK - placeSent) > .05) { placeSent = placeK; A.setPlace?.(placeK); }
      let close = null, cd = SONG.nearR; const nearby = new Set();   // kinds singing within earshot
      for (const s of near) {
        let st = birds.get(s.id);
        if (!st) { st = { next: 1 + Math.random() * 6, out: false }; birds.set(s.id, st); }
        s.out = isOut(s);
        if (!s.out) continue;
        s.singT = Math.max(0, (s.singT || 0) - dt);
        st.next -= dt;
        // in a duet the bird waits while you are still answering
        if (S.duet && S.bird === s && S.tries.length && G.t - S.lastTry < 4) st.next = Math.max(st.next, 1);
        // mornings are busy, so each bird sings half as often then (all but the one you duet with)
        if (st.next <= 0) {
          const duet = S.duet && S.bird === s, morning = !duet && (chorus || timeOfDay(G.tod) === 'dawn');
          st.next = (chorus ? 2.5 + Math.random() * 3 : 7 + Math.random() * 5) * (morning ? 2 : 1); sing(s, duet);
          // tawny owls call as a pair: the nearest other one answers
          if (s.sp.name === 'Tawny owl') for (const o of near) if (o !== s && o.sp === s.sp && o.out && birds.get(o.id)) {
            birds.get(o.id).next = s.sp.notes.length * s.sp.gap + .8 + Math.random(); break;
          }
        }
        const d = dist3([s.x, s.y, s.z], b.p);
        if (d < SONG.hearR) nearby.add(s.sp.id);
        if (d < cd && b.state !== 'fly') { cd = d; close = s; }
      }
      if (birds.size > 800) for (const id of [...birds.keys()].slice(0, 200)) birds.delete(id);
      updateVisitor(dt); updateFlock(dt);

      // the field guide: a songbird seen up close
      if ((sightT -= dt) <= 0 && G.sight) {
        sightT = .5;
        for (const s of near) if (s.out && dist3([s.x, s.y, s.z], b.p) < 30) G.sight('sp' + s.sp.id, s.x, s.y, s.z, .3);
      }

      // the song you are copying: the bird you chose to imitate (once learned), else a songbird
      // close by. Beside its own bird, a song you know is a duet.
      S.close = close;
      const target = picked && G.learned.has(picked.id) ? picked : close ? close.sp : null, bird = close && close.sp === target ? close : null;
      if (target !== S.target || bird !== S.bird) {
        Object.assign(S, { target, bird, tries: [], errs: [], wrongT: 0, doneT: 0, duet: !!bird && G.learned.has(target.id) });
        if (S.duet && !G.flags.duet) { G.flags.duet = 1; H.toast(`A duet with the ${target.name}: it sings the first half, you answer.`, 4); }
      }
      S.wrongT = Math.max(0, S.wrongT - dt); S.doneT = Math.max(0, S.doneT - dt);

      const available = b.state !== 'fly' && (b.state === 'perch' || !!close) && !G.menu.open;
      const known = SPECIES.filter(q => G.heard.has(q.id) || G.learned.has(q.id));
      let sc = null;
      if (target) {
        const off = S.duet ? Math.ceil(target.notes.length / 2) : 0;
        const title = !G.learned.has(target.id) ? `Learn the ${target.name}` : S.duet ? `Duet with the ${target.name}` : target.name;
        const words = target.words.split(':')[0];
        const listening = close && young(close) && close.sp !== target && G.learned.has(target.id) ? `a young ${close.sp.name.toLowerCase()} is listening` : '';
        sc = { sp: target, title, words: listening || words, done: off + S.tries.length, bird: off, state: S.wrongT > 0 ? 'wrong' : S.doneT > 0 ? 'done' : '' };
      } else if (picked) sc = { sp: picked, hidden: true, title: picked.name, note: 'Listen for one nearby to learn its song' };
      ui.update({ available, known, learned: G.learned, picked, sc, nearby, lefty: lefty(), resting: callT > 0 });
      // slow practice: the phrase at half speed, over and over, softly; the next note lit
      const prac = ui.practice && ui.open && target && sc && !sc.hidden;
      ui.hint(prac ? target.notes[sc.done] ?? -1 : -1, prac ? target.kinds[sc.done] : '');
      if (prac && (practiceT -= dt) <= 0) {
        practiceT = target.notes.length * target.gap * 2 + 2;
        target.notes.forEach((n, i) => later(i * target.gap * 2, () => { if (ui.practice) { A.note(n, target.voice, .06, target.kinds[i]); ui.glow(n); } }));
      } else if (!prac) practiceT = 0;

      // gifts that run for a while
      const g = G.gifts;
      if (g.tailwind > 0 && b.state === 'fly' && b.s < 20) b.s += .9 * dt;
      if (g.lift > 0 && b.state === 'fly' && b.lift > .5) b.p[1] += b.lift * .5 * dt;
      if (g.warm > 0) b.recover = (b.recover ?? 1) * 1.5;
      if (g.dusk > 0 && period(G.tod) === 'dusk') G.tod -= dt / DAY * .6;   // the evening lingers
      if (g.updraft > 0 && b.state === 'fly') b.p[1] += .9 * dt;   // air off the warm rock
      // a place's answer: the hidden thermal under an arch lifts a hawk flying through it
      if (wonder && (wonder.t -= dt) <= 0 && wonder.kind !== 'rare') wonder = null;
      if (wonder?.kind === 'thermal' && b.state === 'fly' && Math.hypot(b.p[0] - wonder.l.x, b.p[2] - wonder.l.z) < 45 && b.p[1] < height(wonder.l.x, wonder.l.z) + 260) b.p[1] += 3.2 * dt;
      if (wonder?.kind === 'rare') wonder = null;
      if (g.hardy > 0) { G.hunger = Math.min(1, (G.hunger ?? 1) + .0004 * dt); G.thirst = Math.min(1, (G.thirst ?? 1) + .0004 * dt); }
      if ((trailT -= dt) <= 0) {
        trailT = .35;
        // a trail of motes: toward rising air (thrush), toward an unknown songbird (jay)
        const to = g.companion > 0 ? (thermalsNear(b.p[0], b.p[2], 500).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]) : null;
        const aim = to ? [to.x, Math.max(height(to.x, to.z), WATER) + 20, to.z] : g.glint > 0 ? glintAt : g.bells > 0 ? bellAt : null;
        if (aim) {
          const dx = aim[0] - b.p[0], dy = aim[1] - b.p[1], dz = aim[2] - b.p[2], d = Math.hypot(dx, dy, dz) || 1;
          for (const r of [6, 12, 18]) if (r < d) G.part([b.p[0] + dx / d * r, b.p[1] + dy / d * r + .5, b.p[2] + dz / d * r], [dx / d * 2, 1.2, dz / d * 2], .9, g.companion > 0 ? [1, .9, .6] : g.glint > 0 ? [.45, .6, .9] : [1, .95, .7], .12);
        }
        // a meadowlark's gift: golden flecks over every mouse near you
        if (g.mice > 0) for (const m of G.systems.food?.mice?.values() || []) G.part([m.x, m.y + .5, m.z], [0, 2.5, 0], 1, [1, .8, .3], .16);
      }
    },
    scene(S3) {
      for (const s of near) if (s.out) {
        const sing = (s.singT || 0) > 0, bob = sing ? Math.abs(Math.sin(G.t * 14)) * .015 : 0;
        const look = s.heading + Math.sin(G.t * .3 + s.ph) * .9 * (Math.sin(G.t * .07 + s.ph) > 0 ? 1 : 0);
        pushBird(S3, s.sp, s.x, s.y + bob, s.z, look, false, 0, young(s) ? 1.15 : 1.7);
      }
      if (visitor) pushBird(S3, visitor.sp, visitor.x, visitor.y, visitor.z, visitor.heading, visitor.flying, G.t * 30);
      for (const f of flock) pushBird(S3, f.sp, f.x, f.y, f.z, f.heading, true, G.t * 28 + f.ph);
      // night sight: knowing the owl's song lifts the dark a little; its gift, a lot
      const night = S3.night || 0, k = night * Math.min(.75, (G.learned.has(6) ? .3 : 0) + (G.gifts.night > 0 ? .55 : 0) + (G.gifts.fireflies > 0 ? .2 : 0));
      S3night = night;
      if (wonder) {
        const l = wonder.l, fade = Math.min(1, wonder.t / 8, (90 - wonder.t) / 4), gy = Math.max(height(l.x, l.z), WATER);
        if (wonder.kind === 'thermal') for (let i = 0; i < 50; i++) {
          const h = (i * 37 + G.t * 9) % 220, a = i * 2.4 + G.t * .4, r = 6 + (i % 5) * 4;
          S3.motes.push(l.x + Math.cos(a) * r, gy + h, l.z + Math.sin(a) * r, 1, .9, .7, .7 * fade);
        }
        if (wonder.kind === 'lights') for (let i = 0; i < 240; i++) {
          // curtains of green and violet all round the sky over the cairn, rippling
          const u = i / 240, a = u * 6.283, r = 300 + Math.sin(u * 17 + G.t * .25) * 50, top = Math.sin(u * 41 + G.t * .6) * .5 + .5;
          for (let k = 0; k < 4; k++) S3.motes.push(l.x + Math.cos(a) * r, gy + 45 + k * 22 + top * 25, l.z + Math.sin(a) * r, k > 1 ? .6 : .3, k > 1 ? .45 : 1, k > 1 ? .95 : .6, (night > .5 ? 14 : 6) * fade * (1 - k * .15));
        }
        if (wonder.kind === 'bow') for (let i = 0; i <= 40; i++) {
          const a = Math.PI * i / 40, cols = [[1, .4, .4], [1, .8, .3], [.5, .9, .4], [.4, .6, 1], [.7, .4, .9]];
          cols.forEach((c, k) => S3.motes.push(l.x + Math.cos(a) * (40 + k * 1.6), gy + 4 + Math.sin(a) * (40 + k * 1.6), l.z, ...c, 1.6 * fade));
        }
      }
      // a nightingale's gift: fireflies drifting and blinking round the hawk
      if (G.gifts.fireflies > 0) for (let i = 0; i < 40; i++) {
        const a = i * 2.39 + G.t * .05 * (1 + i % 3), r = 3 + (i * 7 % 13), on = Math.sin(G.t * (1.3 + i % 4 * .4) + i * 1.7);
        if (on > .2) S3.motes.push(b.p[0] + Math.cos(a) * r, b.p[1] - 2 + (i * 5 % 7) + Math.sin(G.t * .7 + i) * .8, b.p[2] + Math.sin(a) * r, 1, .95, .45, .8 * on);
      }
      if (k > 0) {
        const up = (c, to) => c.map((v, i) => v + (to[i] - v) * k);
        S3.skyAmb = up(S3.skyAmb, [.36, .4, .5]); S3.gndAmb = up(S3.gndAmb, [.24, .24, .24]); S3.sunCol = up(S3.sunCol, [.42, .46, .56]);
      }
    },
    save: () => ({ chorusDay, sungAt, taught, mixHeard, gifts: G.gifts, cd: Object.fromEntries(Object.entries(powerCD).map(([id, t]) => [id, t - G.clock])) }),
    load(o) {
      chorusDay = o.chorusDay || 0; Object.assign(G.gifts, o.gifts || {}); Object.assign(sungAt, o.sungAt || {}); Object.assign(taught, o.taught || {}); Object.assign(mixHeard, o.mixHeard || {});
      for (const id in o.cd || {}) powerCD[id] = G.clock + o.cd[id];
    },
  };
}
