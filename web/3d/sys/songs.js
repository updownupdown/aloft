// Songs: songbirds sit in some trees and sing in their hours, songs written from the real
// birds' (notes sliding up or down, steady whistles, trills and chips at five pitches; see
// src/songs.js). Perch near one and copy its song on the note pad to learn it: its score shows as
// question marks that fill in as you find each note. To use a song you know, pick its bird on the
// song card and imitate it: sing it right from any perch and a bird of that kind answers, with its
// gift. Each try sings the whole song from its first note, each note marked good, fair, rough or
// wrong; a clean, well-timed song makes the gift last longer.
// Every clear dawn but in winter the whole wood sings for a few minutes (the dawn chorus); call
// from a perch just before first light and it starts from your tree, spreading out bird by bird.
// Each land sings its own dialect of a species' song (src/songs.js dialect()), each one a song to
// learn. Starlings (and mockingbirds down south) sing pieces of other birds' songs; an unknown
// song's opening heard from one fills in on its card. Songbirds give a thin alarm call when a
// hawk passes over not far above them, and it runs on through the trees ahead; mice near them
// freeze. Fly in low to stay unseen.
// Also the hawk's own call: hold Call to scream; mice freeze, far hawks answer, cliffs echo.
//
// Learned and heard songs and the song log keep their own keys (aloft.learned, aloft.heard,
// aloft.songlog), as in 2D, so a new journey keeps them. G.learned is a Set of species ids
// (the music and courtship read it). Gifts that other systems can make real (calm weather,
// berries, fish, a companion) are announced on the bus as G.emit('gift', ev): set ev.handled
// and this system skips its own stand-in. G.gifts holds each running gift's seconds left.
import { SPECIES, active, timeOfDay, dialect, homeLand } from '../../src/songs.js';
import { BIOMES } from '../biomes.js';
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
  chorusSpread: 5,  // m/s: how fast a chorus you started spreads from your tree
  alarmAbove: [12, 70], // a hawk this high over a songbird (m) is seen; lower slips by
  alarmR: 30,       // ... and this close across
  alarmRun: 110,    // how far ahead the alarm runs through the trees
  alarmFreeze: 30,  // mice this near an alarm freeze
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
const compass = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((Math.atan2(dx, -dz) / (Math.PI / 4) + 8)) % 8];

export function songsSystem(G) {
  const b = G.b, A = G.audio, H = G.hud, store = G.store;
  // song news and how-to go on the message line at the bottom middle, marked as song messages;
  // a place waking or a bird of other lands is an event
  const say = (msg, secs = 3) => H.toast(msg, secs, 'song'), news = (msg, secs = 5) => H.toast(msg, secs, 'event');
  registerSongbirds(G.R);
  G.learned = new Set(store.get('learned', []));
  // the dialects learned ('species id:land'); a save from before them knows each learned song's
  // home version
  G.dialects = new Set(store.get('dialects', [...G.learned].map(id => id + ':' + homeLand(SPECIES[id]))));
  G.heard = new Set(store.get('heard', []));
  G.species = SPECIES;
  G.gifts = {};
  const songLog = store.get('songlog', {});
  let placeK = 0, placeSent = 0;
  const sungAt = {};                 // landmark id -> the day a song opened it
  const taught = {};                 // young bird's spot id -> { from: species id, day } (a song you taught it)
  const mixHeard = {};               // spot ids whose mixed song you have heard
  let wonder = null, S3night = 0;                 // a place's answer under way: { kind, l, t }   // how much the rock walls echo, eased
  const birds = new Map();          // songbird tree id -> { next, singT }
  let near = [], refreshT = 0, sightT = 0, perchT = 0, voice = null, callT = 0, chorus = null, chorusDay = 0, picked = null;
  let visitor = null, flock = [], trailT = 0;
  const powerCD = {};                // species id -> G.clock when its gift works again
  // the song you are copying: `target` (a species), with its bird beside you (`bird`) or not
  const S = { target: null, bird: null, res: [], over: false, lastTry: -9, hintAt: -9, listening: null, told: null, otherT: 0, otherSp: null, hearT: 0 };
  // how far into each song you have not learned you have found its notes (by species id)
  const found = store.get('songFound', {});
  const lefty = () => store.get('lefty', false);
  // a song (a species' song, or a land's version of it) and what you know of it
  const songOf = s => s.song ||= dialect(s.sp, land(s.x, s.z));
  const knows = t => t.dkey ? G.dialects.has(t.dkey) : G.learned.has(t.id);
  const fkey = t => t.dkey || t.id;
  const landWord = l => (BIOMES[l]?.label || l).replace(/^the /, '');
  const learnable = SPECIES.filter(q => !q.mimic);
  // the dialects you know (the versions sung away from a species' home land)
  const dialectCount = () => { const n = [...G.dialects].filter(k => { const [id, l] = k.split(':'); return l !== homeLand(SPECIES[id]); }).length; return `${n} dialect${n === 1 ? '' : 's'}`; };
  // round eight, in Settings > Dev tools > Feature list
  const PR = 182;
  for (const f of [
    { id: 'valley-felt', title: 'Valley again: a felted piano, richer chords, a drone', how: 'Music on; listen a few minutes. Settings > Dev tools > Music lab shapes it.' },
    { id: 'alarm-calls', title: 'Alarm calls run ahead of you', how: 'Fly 15-70 m over trees with songbirds: thin seet calls run on ahead and mice freeze. Skim low and they stay quiet.' },
    { id: 'dialects', title: 'Song dialects: each land sings its own version', how: 'Learn a robin in the meadows, then perch by one in the marsh or the savanna: the card says Robin (marsh); Journal > Songs lists dialects.' },
    { id: 'mimic', title: 'Mimics: the starling (and the mockingbird down south)', how: 'Perch near a starling in meadows or by lakes: it sings snatches of other songs; an unknown song\'s opening fills in on its card.' },
    { id: 'dawn-start', title: 'Start the dawn chorus with your call', how: 'Perch before first light and hold Call: the chorus spreads out from your tree. Try it sets the clock to just before dawn.', go: () => { G.tod = .16; } },
  ]) G.dev?.add({ area: 'Songs and music', round: 8, pr: PR, ...f });

  // things that happen a moment later, on the game clock (so a pause holds them)
  const queue = [];
  const later = (s, fn) => queue.push({ t: G.t + s, fn });

  const ui = createSingUI(document.getElementById('ui3'), {
    audio: A, voice: () => SPECIES[voice ?? 1].voice,
    onSyll: (lane, kind) => { notePart(b.p, lane, kind, true); G.music.echo(lane); singNote(lane, kind); },
    onPick: pick, onCall: call,
  });

  // ---- songbirds singing --------------------------------------------------------------------
  const storm = () => G.storm || 0, winter = () => G.season.winter;
  const young = s => s.young && !winter();
  // a chorus you started reaches a bird once it has spread that far from your tree
  const reached = s => !chorus.o || Math.hypot(s.x - chorus.o[0], s.z - chorus.o[1]) < (G.t - chorus.at) * SONG.chorusSpread;
  const isOut = s => active(s.sp, G.tod, storm(), winter()) || ((G.gifts.sing > 0 || chorus && !s.sp.look.owl && reached(s)) && storm() < .6);
  // a syllable rising from a beak: a songbird's (at its perch), or the hawk's (a little ahead of
  // where it sits)
  let lastS = null;
  // a note rising from a beak: the hawk's own clear, a songbird's fainter (and only its pitch, as a
  // question mark, until you have learned its song)
  function notePart(p, lane, kind, hawk = false, sp = null) {
    const at = hawk ? [p[0] + Math.sin(b.yaw) * .2, p[1] + .32, p[2] - Math.cos(b.yaw) * .2] : [p[0], p[1] + .15, p[2]];
    ui.rise(lastS, at, lane, hawk || (sp && knows(sp)) ? kind : 'q', !hawk);
  }
  function hear(sp) { if (!G.heard.has(sp.id)) { G.heard.add(sp.id); store.set('heard', [...G.heard]); } }
  // a songbird (or a visitor) sings
  function sing(o) {
    if (o.sp.mimic) return medley(o);
    const sp = o.sp, song = songOf(o), d = dist3([o.x, o.y, o.z], b.p), v = .16 * clamp(1 - d / SONG.hearR, 0, 1);
    // a bird you taught, days on, sings its own first half and then your phrase
    const t = taught[o.id], mix = t && G.day - t.day >= 2 && S.bird !== o ? SPECIES[t.from] : null;
    const half = Math.ceil(song.notes.length / 2), tune = mix ? { notes: [...song.notes.slice(0, half), ...mix.notes.slice(Math.floor(mix.notes.length / 2))], kinds: song.kinds.slice(0, half) + mix.kinds.slice(Math.floor(mix.notes.length / 2)) } : song;
    if (mix && v > .04 && !mixHeard[o.id]) {
      mixHeard[o.id] = 1;
      later(tune.notes.length * sp.gap, () => say(`Listen: the ${sp.name.toLowerCase()} you taught sings its own song, then ends it with the ${mix.name}'s phrase.`, 5));
    }
    o.singT = tune.notes.length * sp.gap + .2;
    // the card shows who is singing within earshot: the bird you copy, or another one
    if (v > .02) { if (song === S.target || sp === S.target) S.hearT = o.singT; else { S.otherT = o.singT + 1; S.otherSp = sp; } }
    tune.notes.forEach((n, i) => later(i * sp.gap, () => {
      if (v > .005) A.note(n, sp.voice, v * (o.young && !winter() ? .8 : 1), tune.kinds[i]);
      if (v > .04) hear(sp);
      if (v > .02) notePart([o.x, o.y, o.z], n, tune.kinds[i], false, song);
      if (S.bird === o) ui.glow(n);
    }));
  }
  // a mimic's medley: three snatches of other birds' songs, each in that bird's own voice; often
  // a bird you know, one you do not (always from the top of its song), and your own last song.
  // Hearing an unknown song's opening this way fills those notes in on its card.
  const borrowed = {}; let borrowSaid = -99;
  function medley(o) {
    const d = dist3([o.x, o.y, o.z], b.p), v = .15 * clamp(1 - d / SONG.hearR, 0, 1), pool = learnable.filter(q => !q.look.owl && !q.spot);
    const unknown = pool.filter(q => !G.learned.has(q.id)), known = pool.filter(q => G.learned.has(q.id));
    const any = a => a[(Math.random() * a.length) | 0];
    const picks = [known.length && Math.random() < .7 ? any(known) : any(pool), unknown.length ? any(unknown) : any(pool), S.target?.base || S.target || picked || any(pool)];
    let at = 0; o.singT = 0;
    hear(o.sp);
    if (v > .04 && !G.flags.mimic) { G.flags.mimic = 1; say(`A ${o.sp.name.toLowerCase()}: it has no song of its own, only pieces of the songs around it, yours included.`, 5); }
    for (const [k, q] of picks.entries()) {
      const len = 2 + (Math.random() < .5 ? 1 : 0), from = G.learned.has(q.id) && k !== 1 ? Math.floor(Math.random() * Math.max(1, q.notes.length - len)) : 0;
      const notes = q.notes.slice(from, from + len), kinds = q.kinds.slice(from, from + len);
      notes.forEach((n, i) => later(at + i * q.gap, () => {
        if (v > .005) A.note(n, q.voice, v, kinds[i]);
        if (v > .02) notePart([o.x, o.y, o.z], n, kinds[i], false, q);
      }));
      // the opening of a song you do not know, heard close enough: its first notes show on its card
      if (!G.learned.has(q.id) && from === 0 && v > .04) later(at + notes.length * q.gap, () => {
        if ((found[q.id] || 0) < notes.length) { found[q.id] = notes.length; store.set('songFound', found); hear(q); }
        // (said once a species, and not more than once a minute)
        if (!borrowed[q.id] && G.t - borrowSaid > 60) { borrowed[q.id] = 1; borrowSaid = G.t; say(`The ${o.sp.name.toLowerCase()} borrowed the opening of the ${q.name}'s song: its first notes show on the card now. Find a ${q.name.toLowerCase()} for the rest.`, 5); }
      });
      at += notes.length * q.gap + .45;
    }
    o.singT = at;
  }

  // ---- alarm calls (round eight) ---------------------------------------------------------------
  // A songbird that sees a hawk pass over gives a thin 'seet', and the birds ahead in the wood take
  // it up one after another; mice near each one freeze. A hawk low over the trees is not seen.
  function alarm(o, quiet = 1) {
    const st = birds.get(o.id); if (!st || G.t - (st.alarm ?? -99) < 20) return;
    st.alarm = G.t; st.next = Math.max(st.next, 8 + Math.random() * 6);
    const d = dist3([o.x, o.y, o.z], b.p); A.seet?.(quiet * clamp(1.4 - d / SONG.hearR, .1, 1));
    for (const m of G.systems.food?.mice?.values() || []) if (Math.hypot(m.x - o.x, m.z - o.z) < SONG.alarmFreeze) { m.go = 0; m.flee = 0; m.wait = Math.max(m.wait, 6); }
  }
  function alarms() {
    if (b.state !== 'fly') return;
    const [lo, hi] = SONG.alarmAbove, fx = Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    const first = near.find(s => s.out && !s.sp.look.owl && Math.hypot(s.x - b.p[0], s.z - b.p[2]) < SONG.alarmR && b.p[1] - s.y > lo && b.p[1] - s.y < hi && G.t - (birds.get(s.id)?.alarm ?? -99) > 20);
    if (!first) return;
    alarm(first);
    // it runs on through the trees ahead of you, a bird at a time
    for (const s of near) {
      const dx = s.x - first.x, dz = s.z - first.z, dd = Math.hypot(dx, dz);
      if (s === first || !s.out || s.sp.look.owl || dd > SONG.alarmRun || dx * fx + dz * fz < dd * .3) continue;
      later(.25 + dd / 28 + Math.random() * .3, () => alarm(s, .8));
    }
    if (!G.flags.alarm) { G.flags.alarm = 1; later(1.5, () => say('Thin seet calls run on ahead of you: the songbirds have seen you, and mice near them freeze. Come in low over the trees to stay unseen.', 6)); }
  }

  // ---- your singing: copying a songbird, or imitating one you know ------------------------
  // a syllable on the pad (or the keys) against the next note of the score: right if both its
  // pitch and its kind match, and then good, fair or rough by its timing. A wrong note or a long
  // pause ends the try; the next note starts the song again from the top.
  const HOW = { u: 'swipe up', d: 'swipe down', l: 'swipe left', r: 'swipe right', c: 'tap' };
  const GRADE = { good: 1, ok: .7, meh: .35 };
  function singNote(lane, kind) {
    const sp = S.target; if (!sp) return;
    const gap = Math.max(sp.gap * 2, .45);
    if (S.over || G.t - S.lastTry > Math.max(3, gap * 3)) { S.res = []; S.over = false; }
    const i = S.res.length, late = i ? clamp((Math.abs(G.t - S.lastTry - gap) - .15) / gap, 0, 1) : 0;
    S.lastTry = G.t;
    if (sp.notes[i] !== lane || sp.kinds[i] !== kind) {
      S.res.push('wrong'); S.over = true;
      // what was off, on the message line now and then (only for a note you can see)
      if (G.t - S.hintAt > 4 && i < seen(sp)) { S.hintAt = G.t; say(sp.notes[i] !== lane ? (sp.kinds[i] === kind ? 'Right sound, wrong row: match the colour' : 'Wrong row: the colour is the row') : `Right row: now ${HOW[sp.kinds[i]]}`, 2); }
      return;
    }
    S.res.push(late < .25 ? 'good' : late < .55 ? 'ok' : 'meh');
    if (!knows(sp) && (found[fkey(sp)] || 0) <= i) { found[fkey(sp)] = i + 1; store.set('songFound', found); }
    if (i + 1 < sp.notes.length) return;
    S.over = true;
    const q = S.res.reduce((a, r) => a + GRADE[r], 0) / S.res.length;
    if (!knows(sp)) learn(sp);
    else { respond(sp, S.bird || near.find(s => s.sp === (sp.base || sp) && s.out && dist3([s.x, s.y, s.z], b.p) < SONG.hearR), q); teach(sp); opens(sp, q); }
  }
  // how many notes of a song you can see on the card: all of a learned song, else those found
  // (an opening a mimic sang you counts for every version that starts the same way)
  const seen = sp => knows(sp) ? sp.notes.length : Math.max(found[fkey(sp)] || 0, alike(sp, found[sp.id] || 0));
  const alike = (t, n) => { const s = t.base || t; let i = 0; while (i < n && t.notes[i] === s.notes[i] && t.kinds[i] === s.kinds[i]) i++; return i; };
  // learning a song: a land's version of it (and the species, the first time)
  function learn(t) {
    const sp = t.base || t, first = !G.learned.has(sp.id);
    if (t.dkey) { G.dialects.add(t.dkey); store.set('dialects', [...G.dialects]); }
    A.learned();
    if (first) {
      G.learned.add(sp.id); store.set('learned', [...G.learned]);
      songLog[sp.id] = `Learned on day ${G.day} ${PHRASE[period(G.tod)]}, in ${PLACE[habitat(b.p[0], b.p[2])]}.`;
      store.set('songlog', songLog);
      say(`Song learned: the ${sp.name}${t.how ? `, as ${BIOMES[t.land]?.label || 'this land'} sings it` : ''}. Sing it from any perch and a ${sp.name.toLowerCase()} answers with a gift.`, 5);
    } else say(`A new dialect: the ${sp.name} of ${BIOMES[t.land]?.label || 'this land'} sings ${t.how || 'its song as it is sung at home'}. ${dialectCount()} learned.`, 5);
    H.did('song');
    for (let k = 0; k < 14; k++) G.part([b.p[0], b.p[1] + .4, b.p[2]], [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], 1.4, [1, .85, .45], .1);
    if (first) G.emit('learn', sp); else G.emit('dialect', t);
  }
  // choose a bird from Songs: you sing in its voice and imitate it. It sings its song once, softly,
  // as you remember it (a bird you have only heard: its voice, but no song to copy yet).
  function pick(id) {
    picked = id === null ? null : SPECIES[id]; voice = id;
    S.res = []; S.over = false;
    if (!picked) { say('You sing as yourself'); return; }
    if (!G.learned.has(id)) { say(`You sing in the ${picked.name}'s voice`); return; }
    say(`Imitate the ${picked.name}: sing its score back`); H.did('imitate');
    picked.notes.forEach((n, i) => later(.5 + i * picked.gap, () => { A.note(n, picked.voice, .07, picked.kinds[i]); ui.glow(n); }));
  }

  // ---- teaching a young bird (round six) -----------------------------------------------------
  // Sing a song you know beside a young bird of another kind: it listens, and some days later
  // it sings its own song ending in your phrase, there in its tree.
  function teach(sp) {
    sp = sp.base || sp;
    const y = S.close;
    if (!y || !young(y) || y.sp === sp || taught[y.id]?.from === sp.id) return;
    taught[y.id] = { from: sp.id, day: G.day };
    say(`The young ${y.sp.name.toLowerCase()} leans in and listens to your ${sp.name.toLowerCase()} song. Come back in a few days.`, 5);
    for (let k = 0; k < 8; k++) G.part([y.x, y.y + .3, y.z], [(Math.random() - .5) * 1.5, 1 + Math.random(), (Math.random() - .5) * 1.5], 1.2, [.7, .9, 1], .08);
  }

  // ---- songs that open places (round six) ----------------------------------------------------
  // A song you know, sung well at a landmark, wakes something there, once a day: a summit cairn
  // brings the northern lights (by day, a halo round the sun), an arch a hidden thermal under it,
  // a giant redwood a rare bird, a waterfall a rainbow in its spray. The world can answer
  // instead ('placeSong' ev.handled); this is the stand-in.
  const OPENS = { cairn: 'lights', arch: 'thermal', giant: 'rare', falls: 'bow' };
  function opens(sp, q) {
    sp = sp.base || sp;
    if (q < .45) return;
    const l = landmarksNear(b.p[0], b.p[2], 120).find(l => OPENS[l.kind] && Math.hypot(l.x - b.p[0], l.z - b.p[2]) < 60 + (l.r || 0));
    if (!l || sungAt[l.id] === G.day) return;
    sungAt[l.id] = G.day;
    const kind = OPENS[l.kind], ev = { l, sp, q, kind, handled: false };
    G.emit('placeSong', ev);
    if (ev.handled) return;
    wonder = { kind, l, t: kind === 'rare' ? 0 : 90 };
    if (kind === 'lights') news(S3night > .5 ? `Your song rings off ${l.name}, and the sky answers: the northern lights unroll overhead.` : `Your song rings off ${l.name}, and a pale halo opens round the sun.`, 6);
    if (kind === 'thermal') news(`Your song rings under ${l.name}, and warm air begins to rise through it: a hidden thermal.`, 6);
    if (kind === 'bow') news(`Your song carries over ${l.name}, and a rainbow stands in its spray.`, 6);
    if (kind === 'rare') {
      const rare = SPECIES.filter(q2 => !G.learned.has(q2.id) && q2 !== sp && !q2.spot);
      const r = rare[Math.floor(Math.random() * rare.length)] || SPECIES[Math.floor(Math.random() * 16)];
      later(2.5, () => { callVisitor(r); news(`Something answers from far off: a ${r.name.toLowerCase()}, a bird of other lands, comes down into ${l.name}.`, 6); });
    }
  }

  // ---- answers and gifts ---------------------------------------------------------------------
  function respond(sp, bird, q = 1) {
    sp = sp.base || sp;
    // some birds of the rock answer only a song that rings back off the walls
    if (sp.echo && !S.echoed) {
      say(`The ${sp.name} listens, but answers only a song that echoes: sing it low between rock walls, in a canyon or by a waterfall.`, 4);
      G.emit('song', sp, q); return;
    }
    if (bird) later(.7, () => sing(bird)); else callVisitor(sp);
    const scale = .6 + .6 * clamp(q, 0, 1), how = q > .85 ? ' A perfect song.' : q < .45 ? ' (A rough one: steadier notes make the gift last.)' : '';
    G.emit('song', sp, q);
    if (chorus) {
      const others = [...G.learned].map(id => SPECIES[id]).filter(s => s !== sp && (powerCD[s.id] ?? 0) <= G.clock);
      for (const s2 of others) { powerCD[s2.id] = G.clock + cd(s2); gift(s2, .5); }
      if (others.length) say(`The whole chorus answers: ${others.map(s => s.name).join(', ')} too.`, 4);
    }
    if ((powerCD[sp.id] ?? 0) > G.clock) { say(`The ${sp.name} answers your song.${how}`, 2.5); return; }
    powerCD[sp.id] = G.clock + cd(sp);
    const text = gift(sp, scale);
    say(`The ${sp.name} answers: ${text}.${how}`, 4);
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
    // just before first light, from a perch: the dawn chorus starts from your tree
    if (b.state === 'perch' && G.tod > .12 && G.tod < .2 && chorusDay !== G.day && winter() < .5 && storm() < .4) {
      chorusDay = G.day; chorus = { t: SONG.chorus + 60, o: [b.p[0], b.p[2]], at: G.t + 1.5 };
      later(1.6, () => { news('A bird answers your call from the dark, then another: the dawn chorus starts from your tree and spreads out across the valley.', 6); G.music.moment?.('the dawn chorus', 1); });
    }
    if (!G.flags.call) { G.flags.call = 1; H.toast(`Your call carries over the valley. Mice freeze where they stand, and ${FAR[BIRD] || 'birds of your kind'} far off answer.`, 5); }
  }

  // ---- keys: 1 to 5 sing at each pitch, 6 to 0 choose up, down, left, right, tap; C calls -------
  addEventListener('keydown', e => {
    if (G.paused || e.repeat) return;
    const n = '12345'.indexOf(e.key), k = '67890'.indexOf(e.key);
    if (n >= 0 && ui.ready && !ui.open) ui.sing(true);
    if (n >= 0 && ui.open) { A.note(n, SPECIES[voice ?? 1].voice, .18, ui.kind); ui.glow(n); notePart(b.p, n, ui.kind, true); G.music.echo(n); singNote(n, ui.kind); }
    if (k >= 0 && ui.open) ui.setKind(KINDS[k][0]);
    if (e.code === 'KeyC') call(.6);
  });

  // ---- tips and the Songs tab ---------------------------------------------------------------------
  H.tip('song', () => S.bird && !G.learned.has(S.bird.sp.id) && !S.bird.sp.mimic, 'A songbird! Tap Sing and copy its score on the note pad: the row is the pitch, the touch is the sound.');
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
        if (sp.mimic) return `<li class="heard seen"><div class="pic">${pic}</div><div><b>${sp.name}</b><small>A mimic: no song of its own, only pieces of the songs around it. Listen to one for the openings of songs you do not know. ${sp.hint}.</small></div></li>`;
        const gift = GIFT_TEXT[sp.powerKey] || sp.power, what = k === 'learned' ? `${gift[0].toUpperCase()}${gift.slice(1)}. ${songLog[sp.id] || 'Learned.'}` : `Heard, not yet learned. ${sp.hint}.`;
        const dia = [...G.dialects].filter(key => key.startsWith(sp.id + ':') && key !== sp.id + ':' + homeLand(sp)).map(key => landWord(key.split(':')[1]));
        return `<li class="${k} seen"><div class="pic">${pic}</div><div><b>${sp.name}</b><small>${what}${dia.length ? ` Dialects: ${dia.join(', ')}.` : ''}</small></div></li>`;
      };
      book.innerHTML = `<p class="sub">${G.learned.size} of ${learnable.length} songs learned, and ${dialectCount()}. Perch near a singing bird to learn its song; in other lands the same bird sings it a little differently.</p><ul class="guide3 songs3">${SPECIES.map(card).join('')}</ul>`;
    });
    G.menu.toggle('play', { label: 'Left-handed', sub: 'note pad and Take off on the left, Sing on the right', get: lefty, set: v => store.set('lefty', v) });
  }

  // ---- each frame --------------------------------------------------------------------------------
  return {
    id: 'songs', ui, near: () => near, chorus: () => chorus, sing: o => sing(o),   // (for test scripts)
    update(dt) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].t <= G.t) { const q = queue[i]; queue.splice(i, 1); q.fn(); }
      for (const k in G.gifts) { G.gifts[k] -= dt; if (G.gifts[k] <= 0) delete G.gifts[k]; }
      callT = Math.max(0, callT - dt);
      perchT = b.state === 'perch' ? perchT + dt : 0;

      // the dawn chorus: every clear morning but in winter
      if (chorus) { if ((chorus.t -= dt) <= 0) chorus = null; }
      else if (chorusDay !== G.day && G.tod > .27 && G.tod < .31 && winter() < .5 && storm() < .4) {
        chorusDay = G.day; chorus = { t: SONG.chorus };
        news('The dawn chorus: for a few minutes every bird nearby sings. Join in, and all the songs you know answer at once.', 6);
      }

      // songbirds near the hawk: each sings now and then in its hours
      if ((refreshT -= dt) <= 0) {
        refreshT = .5; near = songTreesNear(b.p[0], b.p[2], SONG.simR);
        alarms();
        // echo places: low between rock walls in the walled lands, or by a waterfall
        const walls = ECHO_LANDS.has(land(b.p[0], b.p[2])) && echo(), falls = landmarksNear(b.p[0], b.p[2], 90).some(l => l.kind === 'falls');
        S.echoed = !!(walls && walls.delay < 3) || falls;
        if (S.echoed && ui.open && !G.flags.echo) { G.flags.echo = 1; say('Rock walls all round: your song rings back off them here. Some birds of the rock answer only a song that echoes.', 5); }
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
        // the bird you copy waits while you are singing
        if (S.bird === s && S.res.length && !S.over && G.t - S.lastTry < 4) st.next = Math.max(st.next, 1);
        // mornings are busy, so each bird sings half as often then
        if (st.next <= 0) {
          const morning = chorus || timeOfDay(G.tod) === 'dawn';
          st.next = (chorus ? 2.5 + Math.random() * 3 : 7 + Math.random() * 5) * (morning ? 2 : 1); sing(s);
          // tawny owls call as a pair: the nearest other one answers
          if (s.sp.name === 'Tawny owl') for (const o of near) if (o !== s && o.sp === s.sp && o.out && birds.get(o.id)) {
            birds.get(o.id).next = s.sp.notes.length * s.sp.gap + .8 + Math.random(); break;
          }
        }
        const d = dist3([s.x, s.y, s.z], b.p);
        if (d < SONG.hearR) nearby.add(s.sp.id);
        if (d < cd && b.state !== 'fly' && !s.sp.mimic) { cd = d; close = s; }
      }
      if (birds.size > 800) for (const id of [...birds.keys()].slice(0, 200)) birds.delete(id);
      updateVisitor(dt); updateFlock(dt);

      // the field guide: a songbird seen up close
      if ((sightT -= dt) <= 0 && G.sight) {
        sightT = .5;
        for (const s of near) if (s.out && dist3([s.x, s.y, s.z], b.p) < 30) G.sight('sp' + s.sp.id, s.x, s.y, s.z, .3);
      }

      // the song you are copying: the bird you chose to imitate (once learned), else a songbird
      // close by.
      S.close = close;
      const target = picked && G.learned.has(picked.id) ? picked : close ? songOf(close) : null, bird = close && close.sp === (target?.base || target) ? close : null;
      if (target !== S.target || bird !== S.bird) {
        Object.assign(S, { target, bird, res: [], over: false, hearT: 0 });
      }
      // a finished or failed try stays on the card a moment, then clears
      if (S.over && G.t - S.lastTry > 2.5) { S.res = []; S.over = false; }
      if (!S.over && S.res.length && G.t - S.lastTry > 4) S.res = [];
      S.otherT = Math.max(0, S.otherT - dt); S.hearT = Math.max(0, S.hearT - dt);
      // how to copy a new song, once the controls are out
      if (ui.open && target && !knows(target) && S.told !== target) {
        S.told = target;
        say(G.learned.has(target.id) ? `This ${target.name.toLowerCase()} sings the ${landWord(target.land)} dialect: listen for what is different, then sing it back` : `Learn the ${target.name}: listen, then sing it back. Each note you find shows on the card`, 4);
      }

      const available = b.state !== 'fly' && (b.state === 'perch' || !!close) && !G.menu.open;
      const known = SPECIES.filter(q => !q.mimic && (G.heard.has(q.id) || G.learned.has(q.id)));
      // the card: the song (yours to imitate, or one to learn) or a free song, with how much of it
      // you can see, this try's marks, and who is singing within earshot
      const sp = target || picked, other = S.otherT > 0 && S.otherSp !== sp ? S.otherSp : null;
      const sc = { sp, label: sp?.how ? `${sp.name} (${landWord(sp.land)})` : null, state: !sp ? 'free' : knows(sp) ? 'imitate' : 'learn', seen: sp ? seen(sp) : 0, res: sp === target ? S.res : [], hear: S.hearT > 0, other };
      if (target) {
        const listening = close && young(close) && close.sp !== target && G.learned.has(target.id) ? close : null;
        if (listening && listening !== S.listening && ui.open) say(`A young ${close.sp.name.toLowerCase()} is listening`);
        S.listening = listening;
      }
      G.singing = ui.open;   // the sing controls are out (main.js turns the perched gyro look off)
      ui.update({ available, known, learned: G.learned, picked, sc, nearby, lefty: lefty(), resting: callT > 0 });

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
      lastS = S3;
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
