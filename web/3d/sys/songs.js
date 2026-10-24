// Songs: songbirds sit in some trees and sing in their hours, songs written from the real
// birds' (notes sliding up or down, steady whistles, trills and chips at five pitches; see
// src/songs.js). Perch near one and copy its song on the note pad to learn it: its score shows as
// question marks that fill in as you find each note. To use a song you know, pick its bird on the
// song card and imitate it: sing it right from any perch and a bird of that kind answers, with its
// gift. Each try sings the whole song from its first note, each note marked good, fair, rough or
// wrong; a clean, well-timed song makes the gift last longer.
// Every clear dawn but in winter the whole wood sings for a few minutes (the dawn chorus); call
// from a perch just before first light and it starts from your tree, spreading out bird by bird.
// Most species have more than one song (src/songs.js: sp.songs, a song and its calls); each bird
// in the world sings one of its kind's, every one a song to learn. Each continent has its own
// birds (src/songs.js cont and lands; songbirds.js places them by earth.js continentAt). Imitating a bird, you sing any of its songs you know (pick it in the
// birds' list); Journal > Songs lists them all and plays the ones you know.
// Learning: perched beside a bird whose song you do not know, singing turns to learning from it.
// It sings (each note lights its row on the pad), then waits for you; sing back and it stops to
// listen, and it tries again a moment after you stop. Other birds near by sing softer meanwhile. Starlings (and mockingbirds down south) sing pieces of other birds' songs; an unknown
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
import { SPECIES, active, timeOfDay, songOf as songN, songKey, TAP_GAP } from '../../src/songs.js';
import { continentAt } from '../earth.js';
import { period, DAY } from '../sky.js';
import { height, WATER, treesNear, perchesOf, thermalsNear, landmarksNear } from '../world.js';
import { clamp, dist3 } from '../util.js';
import { registerSongbirds, pushBird, songTreesNear, habitat, land, clearSpots } from './songbirds.js';
import { createSingUI, NOTE_COLS, KINDS, glyph } from './singui.js';
import { journal } from '../journal.js';
import { BIRD } from '../hawk.js';
import { songbirdPic } from '../pics.js';

// lands with rock walls to sing against (songs echo there)
const ECHO_LANDS = new Set(['canyon', 'badlands', 'fjord', 'cliffs', 'coast', 'karst']);
export const SONG = {
  hearR: 90,        // a songbird is heard (and joins the left pools) within this
  nearR: 45,        // close enough to learn from, sitting or standing (any tree near by, not only yours)
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
const FAR = { hawk: 'hawks', osprey: 'ospreys', owl: 'owls', raven: 'ravens', albatross: 'albatrosses' };
const PHRASE = { dawn: 'at dawn', day: 'in the daytime', dusk: 'at dusk', night: 'at night' };
const PLACE = { forest: 'the woods', ridge: 'the great ridge', coast: 'the coast', meadow: 'a meadow', marsh: 'the marsh', lakeland: 'the lakeland', cliffs: 'the high ground', mountains: 'the mountains' };
const compass = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((Math.atan2(dx, -dz) / (Math.PI / 4) + 8)) % 8];

export function songsSystem(G) {
  const b = G.b, A = G.audio, H = G.hud, store = G.store;
  // song news and how-to go on the message line at the bottom middle, marked as song messages;
  // a place waking or a bird of other lands is an event
  const say = (msg, secs = 3) => H.toast(msg, secs, 'song'), news = (msg, secs = 5) => H.toast(msg, secs, 'event'), noteNew = (title, msg) => H.glint(title, msg, 'songs');
  registerSongbirds(G.R);
  G.learned = new Set(store.get('learned', []));
  // the songs learned ('species id', or 'id.k' for its song k). (Saves from before the Earth are
  // not kept: James, 10-22, while the game is this experimental.)
  G.dialects = new Set(store.get('songsKnown', [...G.learned].map(id => songKey(SPECIES[id]))));
  G.heard = new Set(store.get('heard', []));
  G.species = SPECIES;
  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  G.on('mock', k => {
    const some = SPECIES.slice(0, Math.round(k * SPECIES.length));
    G.learned = new Set(some.map(sp => sp.id)); G.dialects = new Set(some.flatMap(sp => k >= 1 ? sp.songs.map(g => songKey(sp, g.k)) : [songKey(sp)])); G.heard = new Set(G.learned);
    store.set('learned', [...G.learned]); store.set('songsKnown', [...G.dialects]); store.set('heard', [...G.heard]);
  });
  G.gifts = {};
  const songLog = store.get('songlog', {});
  let placeK = 0, placeSent = 0;
  const sungAt = {};                 // landmark id -> the day a song opened it
  const taught = {};                 // young bird's spot id -> { from: species id, day } (a song you taught it)
  const mixHeard = {};               // spot ids whose mixed song you have heard
  let wonder = null, S3night = 0;                 // a place's answer under way: { kind, l, t }   // how much the rock walls echo, eased
  const birds = new Map();          // songbird tree id -> { next, singT }
  let near = [], refreshT = 0, sightT = 0, perchT = 0, callT = 0, chorus = null, chorusDay = 0, picked = null, pickedK = 0;
  let visitor = null, flock = [], trailT = 0;
  // the world wrapped round (over the open Pacific): the songbirds near by are found again, and
  // the birds flying with you and the gifts' marks move round with you
  G.on('wrap', dx => {
    clearSpots(); near = []; refreshT = 0; S.chosen = null; S.close = null;
    if (visitor) { for (const p of [visitor, visitor.from, visitor.to]) if (p) Array.isArray(p) ? p[0] += dx : p.x += dx; }
    for (const f of flock) f.x += dx;
    for (const p of [glintAt, bellAt]) if (p) p[0] += dx;
  });
  const powerCD = {};                // species id -> G.clock when its gift works again
  // the song you are copying: `target` (a species), with its bird beside you (`bird`) or not
  const S = { target: null, bird: null, res: [], over: false, lastTry: -9, listening: null, hearT: 0, teachI: -1, answerT: 0, answer: '', closeId: null, learnedT: 0, mine: [], chosen: null, self: false };
  // how far into each song you have not learned you have found its notes (by species id)
  const found = store.get('songFound', {});
  const lefty = () => store.get('lefty', false);
  // ---- the song tests (Settings > Advanced > Song tests; the songs study, 10-24): ideas behind
  // switches, each off until James turns it on; saved under aloft.songTest.<id>
  const TESTS = [
    { id: 'stereo', letter: 'A', label: 'Birds around you', sub: 'each song comes from where its bird sits: left or right, near or far' },
    { id: 'voices', letter: 'B', label: 'Distinct voices', sub: 'big birds sing lower, and each kind has its own brightness, vibrato and attack' },
    { id: 'phrases', letter: 'C', label: 'Living phrases', sub: 'songs breathe: loose timing, a swell, a repeat now and then (the bird teaching you stays exact)' },
    { id: 'finding', letter: 'D', label: 'Learn by finding', sub: 'a wrong note no longer ends the try; the song is learned once every note has been found' },
    { id: 'hints', letter: 'E', label: 'A hint after two misses', sub: 'miss the same note twice and its shape shows on the card' },
    { id: 'linen', letter: 'F', label: 'Sing in Linen', sub: 'the song controls in cream glass and warm ink, like the rest of the UI' },
    { id: 'compass', letter: 'G', label: 'Singers on the compass', sub: 'a note on the compass for each bird singing near by (amber: one that could teach you)' },
  ];
  const test = {}; for (const T of TESTS) test[T.id] = !!store.get('songTest.' + T.id, false);
  const foundBits = store.get('songFoundBits', {});   // D: the notes of a song found so far, by index (bits)
  const hints = store.get('songHints', {}), missAt = {};   // E: the notes missed twice (bits), and the misses
  let marks = [];   // G: the singers near by, for the compass
  const applyTests = () => { A.songTests?.({ stereo: test.stereo, voices: test.voices }); ui.linen?.(test.linen); };
  // a song (a species' song, or a land's version of it) and what you know of it
  // (a bird sings its kind's first song half the time, else one of the others, fixed by its spot)
  const spotHash = id => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  const spotSong = s => { const n = s.sp.songs.length, u = spotHash(s.id); return n < 2 || u < .5 ? 0 : 1 + Math.floor((u - .5) * 2 * (n - 1)); };
  const songOf = s => s.song ||= songN(s.sp, spotSong(s));
  // the songs of a species you know, by number (in any land), and the version of song k you know
  // best (its home land's, else the first you learned)
  const parse = key => { const [id, k] = key.split('.'); return { id: +id, k: +(k || 0) }; };
  const knownSongs = sp => { const ks = new Set(); for (const key of G.dialects) { const p = parse(key); if (p.id === sp.id) ks.add(p.k); } if (!ks.size && G.learned.has(sp.id)) ks.add(0); return [...ks].sort((a, c) => a - c); };
  const versionOf = (sp, k) => {
    if (G.dialects.has(songKey(sp, k))) return songN(sp, k);
    return k ? null : sp;
  };
  // the voice you sing in: the bird you imitate, else the one you learn from, else your own
  const voiceId = () => picked ? picked.id : S.bird ? S.bird.sp.id : null;
  const imitating = () => picked && G.learned.has(picked.id) ? versionOf(picked, knownSongs(picked).includes(pickedK) ? pickedK : knownSongs(picked)[0] ?? 0) || picked : null;
  const knows = t => t.dkey ? G.dialects.has(t.dkey) : G.learned.has(t.id);
  const fkey = t => t.dkey || t.id;
  // learning: the song you copy is one you do not know, sung by the bird beside you
  const learning = () => !!(S.target && S.bird && !knows(S.target) && ui.open);
  // the card's top: the bird you sing as and what you are doing (and, while off, a bird beside you
  // that could teach you)
  function modeOf(sp, learn) {
    const teacher = S.target && S.bird && !knows(S.target) ? S.bird.sp : null;
    if (!ui.open) return { kind: 'off', state: '', who: null, teacher };
    if (S.learnedT > 0) return { kind: 'learn', state: 'Learned', who: sp };
    if (learn) return { kind: 'learn', state: 'Learning', who: sp };
    if (sp && knows(sp)) return { kind: 'imitate', state: S.answerT > 0 ? 'Answered' : 'Imitating', who: sp };
    if (sp) return { kind: 'imitate', state: 'Voice only', who: sp };
    return { kind: 'free', state: 'Free song', who: null };
  }
  const learnable = SPECIES.filter(q => !q.mimic);
  const songCount = () => learnable.reduce((a, sp) => a + knownSongs(sp).length, 0);
  const songTotal = learnable.reduce((a, sp) => a + sp.songs.length, 0);
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  // round eight, in Settings > Advanced > Feature list
  const PR = 188;
  for (const f of [
    { id: 'valley-felt', title: 'Valley again: a felted piano, richer chords, a drone', how: 'Music on; listen a few minutes. Settings > Advanced > Music lab shapes it.' },
    { id: 'alarm-calls', title: 'Alarm calls run ahead of you', how: 'Fly 15-70 m over trees with songbirds: thin seet calls run on ahead and mice freeze. Skim low and they stay quiet.' },
    { id: 'mimic', title: 'Mimics: the starling (and the mockingbird down south)', how: 'Perch near a starling in meadows or by lakes: it sings snatches of other songs; an unknown song\'s opening fills in on its card.' },
    { id: 'more-songs', round: 9, pr: 191, title: 'Several songs per bird; Journal > Songs plays the ones you know', how: 'Perch by songbirds of one kind in different trees: each sings one of its kind\'s songs. The birds\' list (tap the song card) shows each bird\'s songs; tap one to imitate it. Journal > Songs: play buttons, question marks for songs to find.' },
    { id: 'slow-teacher', round: 10, pr: 234, title: 'Miss a fast song and the bird you learn from sings it slower each time, down to half speed after 5 misses', how: 'Learn a wren or a chaffinch and get a note wrong a few times: it sings slower each time.' },
    { id: 'song-says', round: 10, pr: 226, title: 'A song\'s result shows over the card, so the card does not move; Journal > Songs shows each song\'s notes; Dev mode refreshes the songbook at once', how: 'Sing a song to a bird: the answer shows above the card. Turn on Dev mode in Settings, then open Journal > Songs: every song plays and shows its notes.' },
    { id: 'tap-songs', round: 10, pr: 219, title: 'Fast or long songs are copied with taps alone; slow, short ones keep their swipes', how: 'Learn a Wren, Chaffinch or Skylark (fast): the card shows dots, and any touch on the right row counts. A Cuckoo or Hoopoe still wants its swipes.' },
    { id: 'earth-songbirds', round: 10, pr: 216, title: 'Each continent its own songbirds: 86 real singers, at least two in every land, no dialects', how: 'Fly to Europe, Africa, Asia, South America or Oceania and perch in a wood: robins and blackbirds in Europe, bulbuls and robin-chats in Africa, kookaburras and tui in Oceania. Settings > Advanced > Dev mode, then Journal > Songs: every bird, by continent.' },
    { id: 'sing-three', round: 9, pr: 211, title: 'At most three birds sing at once; no piano under your notes; your own bird on the rail sings as yourself', how: 'Perch in a busy wood and listen: never more than three songs overlap. Tap Sing, then your own bird at the top of the rail: Free song, even beside a bird that could teach you.' },
    { id: 'learn-near', round: 9, pr: 203, title: 'Learn from any bird near by; tap its logo to choose it; Dev mode unlocks every song in the Journal', how: 'Perch within about 45 m of a songbird whose song you do not know (amber dot on the rail), or tap its logo: Learning, notes light up, the card fills in from the first note. Settings > Advanced > Dev mode, then Journal > Songs: play every song. The states are explained at the top of Journal > Songs.' },
    { id: 'sing-rail2', round: 9, pr: 197, title: 'Sing rail round two: you on top, birds by name, every bird at the bottom; the card comes out from under it', how: 'Perch among songbirds and tap Sing: the rail runs from under the menu button, your bird first, then the birds near by A to Z (picking one keeps the order), the list button always at the bottom. The card tucks under the rail; the You row keeps its height.' },
    { id: 'bird-logos', round: 9, pr: 195, title: 'Song card in one: bird, Learning or Imitating, every bird, close; each songbird a little logo', how: 'Perch by a songbird and tap Sing: the top says who and what, the bottom shows its logo, the song name and notes. While it teaches, its logo pops up in each row it sings, with a ring.' },
    { id: 'dawn-start', title: 'Start the dawn chorus with your call', how: 'Perch before first light and hold Call: the chorus spreads out from your tree. Try it sets the clock to just before dawn.', go: () => { G.tod = .16; } },
    { id: 'song-tests', round: 11, pr: 298, title: 'Song tests A to G: birds around you (stereo), distinct voices, living phrases, learn by finding, a hint after two misses, Sing in Linen, singers on the compass', how: 'Settings > Advanced > Song tests: switch one on (each is off to begin with), then perch in a wood and listen, or sing.', go: () => G.menu.set(true, 'play', 'dev') },
  ]) G.dev?.add({ area: 'Songs and music', round: 8, pr: PR, ...f });

  // things that happen a moment later, on the game clock (so a pause holds them)
  const queue = [];
  const later = (s, fn, by = null) => queue.push({ t: G.t + s, fn, by });
  // a bird stops mid-song (the rest of its notes dropped)
  const hush = o => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].by === o) queue.splice(i, 1); o.singT = 0; };

  const ui = createSingUI(document.getElementById('ui3'), {
    audio: A, voice: () => SPECIES[voiceId() ?? 1].voice, species: () => SPECIES[voiceId() ?? 1], store,
    onSyll: (lane, kind) => { notePart(b.p, lane, kind, true); singNote(lane, kind); },   // (no piano echo: James, 10-22)
    onPick: pick, onCall: call, onNext: nextSong,
  });
  G.hud.songLine = (msg, secs) => ui.say(msg, secs);
  applyTests(); G.compassMarks = () => marks;

  // ---- songbirds singing --------------------------------------------------------------------
  const storm = () => G.storm || 0, winter = () => G.season.winter;
  const young = s => s.young && !winter();
  // a chorus you started reaches a bird once it has spread that far from your tree
  const reached = s => !chorus.o || Math.hypot(s.x - chorus.o[0], s.z - chorus.o[1]) < (G.t - chorus.at) * SONG.chorusSpread;
  // (in an eclipse the songbirds fall silent)
  const isOut = s => !(G.eclipse > .4) && active(s.sp, G.tod, storm(), winter()) || ((G.gifts.sing > 0 || chorus && !s.sp.look.owl && reached(s)) && storm() < .6);
  // a syllable rising from a beak: a songbird's (at its perch), or the hawk's (a little ahead of
  // where it sits)
  let lastS = null;
  // A: where a bird sits, for the ear: pan from the camera's view (-1 left to 1 right) and how far
  // off it is from the hawk (0..1 of earshot); the hawk's own notes sit in the middle
  const placeOf = (x, z) => {
    const S3 = lastS; if (!test.stereo || !S3?.cam) return {};
    const fx = S3.look[0] - S3.cam[0], fz = S3.look[2] - S3.cam[2], l = Math.hypot(fx, fz) || 1, rx = -fz / l, rz = fx / l;
    const cx = x - S3.cam[0], cz = z - S3.cam[2], cd = Math.hypot(cx, cz) || 1;
    return { pan: clamp((cx * rx + cz * rz) / cd * .85, -1, 1), dist: clamp(Math.hypot(x - b.p[0], z - b.p[2]) / SONG.hearR, 0, 1) };
  };
  const hawkAt = sp => ({ pan: 0, dist: 0, sp });
  // a note rising from a beak: the hawk's own clear, a songbird's fainter (and only its pitch, as a
  // question mark, until you have learned its song)
  function notePart(p, lane, kind, hawk = false, sp = null) {
    const at = hawk ? [p[0] + Math.sin(b.yaw) * .2, p[1] + .32, p[2] - Math.cos(b.yaw) * .2] : [p[0], p[1] + .15, p[2]];
    ui.rise(lastS, at, lane, hawk ? kind : sp && knows(sp) ? (sp.tap ? 'c' : kind) : 'q', !hawk);
  }
  function hear(sp) { if (!G.heard.has(sp.id)) { G.heard.add(sp.id); store.set('heard', [...G.heard]); } }
  // a songbird (or a visitor) sings
  // a fast song you keep missing: the bird you learn from sings it slower after each miss, down to
  // half speed after SLOW_MISSES (James, 10-23). Kept per song until you learn it.
  const SLOW_MISSES = 5, misses = {};
  const slowOf = t => t.gap < TAP_GAP && !knows(t) ? 1 + Math.min(misses[fkey(t)] || 0, SLOW_MISSES) / SLOW_MISSES : 1;
  function sing(o) {
    if (o.sp.mimic) return medley(o);
    // (the bird you learn from is always clear, however far across the clearing it sits)
    const sp = o.sp, song = songOf(o), d = dist3([o.x, o.y, o.z], b.p), v = S.bird === o ? Math.max(.1, .16 * clamp(1 - d / SONG.hearR, 0, 1)) : .16 * clamp(1 - d / SONG.hearR, 0, 1) * (learning() ? .3 : 1);
    // a bird you taught, days on, sings its own first half and then your phrase
    const t = taught[o.id], mix = t && G.day - t.day >= 2 && S.bird !== o ? SPECIES[t.from] : null;
    const half = Math.ceil(song.notes.length / 2), tune = mix ? { notes: [...song.notes.slice(0, half), ...mix.notes.slice(Math.floor(mix.notes.length / 2))], kinds: song.kinds.slice(0, half) + mix.kinds.slice(Math.floor(mix.notes.length / 2)) } : song;
    if (mix && v > .04 && !mixHeard[o.id]) {
      mixHeard[o.id] = 1;
      later(tune.notes.length * song.gap, () => say(`Listen: the ${sp.name.toLowerCase()} you taught sings its own song, then ends it with the ${mix.name}'s phrase.`, 5));
    }
    const step = song.gap * (S.bird === o ? slowOf(song) : 1), n = tune.notes.length;
    // C. Living phrases: any bird but the one teaching you sings a little loosely, swells through
    // the phrase, and now and then sings it twice over after a short rest
    const live = test.phrases && S.bird !== o, twice = live && n <= 6 && !o.young && Math.random() < .35, rest = twice ? .5 + Math.random() * .6 : 0;
    o.singT = n * step * (twice ? 2 : 1) + rest + .2;
    // the card shows who is singing within earshot: the bird you copy, or another one
    if (S.bird === o) S.hearT = o.singT;
    const where = { ...placeOf(o.x, o.z), sp };
    for (let r = 0; r < (twice ? 2 : 1); r++) tune.notes.forEach((note, i) => later(r * (n * step + rest) + i * step + (live ? (Math.random() - .5) * step * .16 : 0), () => {
      const swell = live ? .85 + .3 * Math.sin(Math.PI * (i + .5) / n) : 1;
      if (v > .012) A.note(note, sp.voice, v * (o.young && !winter() ? .8 : 1) * swell, tune.kinds[i], where);   // (fainter than that is lost under the wind, and each note costs the audio thread)
      if (v > .04) hear(sp);
      if (v > .02) notePart([o.x, o.y, o.z], note, tune.kinds[i], false, song);
      // the bird you learn from: each note lights its row, and its place on the card
      if (S.bird === o) { ui.teach(note, sp); S.teachI = i; }
    }, o));
  }
  // a mimic's medley: three snatches of other birds' songs, each in that bird's own voice; often
  // a bird you know, one you do not (always from the top of its song), and your own last song.
  // Hearing an unknown song's opening this way fills those notes in on its card.
  const borrowed = {}; let borrowSaid = -99;
  function medley(o) {
    // (the songs of its own continent's birds)
    const c = continentAt(o.x, o.z), d = dist3([o.x, o.y, o.z], b.p), v = .15 * clamp(1 - d / SONG.hearR, 0, 1), pool = learnable.filter(q => !q.look.owl && q.spot !== 'falls' && (!c || q.cont.includes(c)));
    const unknown = pool.filter(q => !G.learned.has(q.id)), known = pool.filter(q => G.learned.has(q.id));
    const any = a => a[(Math.random() * a.length) | 0];
    const picks = [known.length && Math.random() < .7 ? any(known) : any(pool), unknown.length ? any(unknown) : any(pool), S.target?.base || S.target || picked || any(pool)];
    let at = 0; o.singT = 0;
    const where = placeOf(o.x, o.z);
    hear(o.sp);
    if (v > .04 && !G.flags.mimic) { G.flags.mimic = 1; noteNew(`A ${o.sp.name.toLowerCase()}`, `A ${o.sp.name.toLowerCase()}: it has no song of its own, only pieces of the songs around it, yours included.`); }
    for (const [k, q] of picks.entries()) {
      const len = 2 + (Math.random() < .5 ? 1 : 0), from = G.learned.has(q.id) && k !== 1 ? Math.floor(Math.random() * Math.max(1, q.notes.length - len)) : 0;
      const notes = q.notes.slice(from, from + len), kinds = q.kinds.slice(from, from + len);
      notes.forEach((n, i) => later(at + i * q.gap, () => {
        if (v > .005) A.note(n, q.voice, v, kinds[i], { ...where, sp: q });
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
    if (!G.flags.alarm) { G.flags.alarm = 1; later(1.5, () => noteNew('Alarm calls', 'Thin seet calls run on ahead of you: the songbirds have seen you, and mice near them freeze. Come in low over the trees to stay unseen.')); }
  }

  // ---- your singing: copying a songbird, or imitating one you know ------------------------
  // a syllable on the pad (or the keys) against the next note of the score: right if both its
  // pitch and its kind match, and then good, fair or rough by its timing. A wrong note or a long
  // pause ends the try; the next note starts the song again from the top.
  const GRADE = { good: 1, ok: .7, meh: .35 };
  function singNote(lane, kind) {
    const sp = S.target;
    // a free song: the last few notes you sang show on the card
    if (!sp) { if (G.t - S.lastTry > 4) S.mine = []; S.lastTry = G.t; S.mine = [...S.mine, { lane, kind }].slice(-10); return; }
    const gap = Math.max(sp.gap * slowOf(sp) * 2, .45);
    if (S.over || G.t - S.lastTry > Math.max(3, gap * 3)) { S.res = []; S.over = false; }
    const i = S.res.length, late = i ? clamp((Math.abs(G.t - S.lastTry - gap) - .15) / gap, 0, 1) : 0;
    S.lastTry = G.t;
    // the bird you learn from stops to listen
    if (S.bird && S.bird.singT > 0) { hush(S.bird); S.hearT = 0; }
    S.teachI = -1;
    const mine = { lane, kind }; S.mine = i ? [...S.mine.slice(0, i), mine] : [mine];
    // how it went shows on the row itself: right, right row but not the touch, or wrong row
    // (a tap-only song takes any touch on the right row)
    const k = fkey(sp), wrong = sp.notes[i] !== lane || (!sp.tap && sp.kinds[i] !== kind);
    if (wrong) {
      S.res.push('wrong'); mine.r = 'wrong';
      if (!knows(sp)) {
        misses[k] = (misses[k] || 0) + 1;
        // E. A hint after two misses: from then on the note's shape shows on the card
        const m = missAt[k] ||= {}; m[i] = (m[i] || 0) + 1;
        if (m[i] >= 2 && !(hints[k] & (1 << i))) { hints[k] = (hints[k] || 0) | (1 << i); store.set('songHints', hints); }
      }
      ui.mark(lane, sp.notes[i] === lane ? 'half' : 'no');
      // D. Learn by finding: while you learn, a wrong note does not end the try
      if (!(test.finding && !knows(sp)) || i + 1 >= sp.notes.length) { S.over = true; if (test.finding && !knows(sp) && allFound(sp)) { learn(sp); S.learnedT = 4; } return; }
      return;
    }
    ui.mark(lane, 'yes');
    S.res.push(mine.r = late < .25 ? 'good' : late < .55 ? 'ok' : 'meh');
    if (!knows(sp)) {
      // the notes found so far: the first run of right notes from the top (the card fills in from
      // the first note), and (D) every note found, by index
      if (!S.res.slice(0, i).includes('wrong') && (found[k] || 0) <= i) { found[k] = i + 1; store.set('songFound', found); }
      if (!(foundBits[k] & (1 << i))) { foundBits[k] = (foundBits[k] || 0) | (1 << i); store.set('songFoundBits', foundBits); }
    }
    if (i + 1 < sp.notes.length) return;
    S.over = true;
    const q = S.res.reduce((a, r) => a + GRADE[r], 0) / S.res.length;
    if (!knows(sp)) { if (!test.finding || allFound(sp)) { learn(sp); S.learnedT = 4; } }
    else { respond(sp, S.bird || near.find(s => s.sp === (sp.base || sp) && s.out && dist3([s.x, s.y, s.z], b.p) < SONG.hearR), q); teach(sp); opens(sp, q); }
  }
  const allFound = sp => (foundBits[fkey(sp)] || 0) === (1 << sp.notes.length) - 1;
  // how many notes of a song you can see on the card: all of a learned song, else those found
  // (an opening a mimic sang you counts for every version that starts the same way)
  const seen = sp => knows(sp) ? sp.notes.length : Math.max(found[fkey(sp)] || 0, (sp.k ? 0 : alike(sp, found[sp.id] || 0)));
  const alike = (t, n) => { const s = t.base || t; let i = 0; while (i < n && t.notes[i] === s.notes[i] && t.kinds[i] === s.kinds[i]) i++; return i; };
  // which notes the card shows, as bits: all of a learned song, else those found (the first run
  // from the top; with D every note found), and apart (E) those hinted
  const shownOf = sp => { if (knows(sp)) return (1 << sp.notes.length) - 1; let m = (1 << seen(sp)) - 1; if (test.finding) m |= foundBits[fkey(sp)] || 0; return m; };
  const hintOf = sp => knows(sp) || !test.hints ? 0 : hints[fkey(sp)] || 0;
  // learning a song (and the species, the first time)
  function learn(t) {
    const sp = t.base || t, first = !G.learned.has(sp.id), newSong = !first && !knownSongs(sp).includes(t.k || 0);
    if (t.dkey) { G.dialects.add(t.dkey); store.set('songsKnown', [...G.dialects]); }
    A.learned();
    if (first) {
      G.learned.add(sp.id); store.set('learned', [...G.learned]);
      songLog[sp.id] = `Learned on day ${G.day} ${PHRASE[period(G.tod)]}, in ${PLACE[habitat(b.p[0], b.p[2])]}.`;
      store.set('songlog', songLog);
      news(`Song learned: the ${sp.name}${t.k ? `'s ${t.title.toLowerCase()}` : ''}. Sing it from any perch and a ${sp.name.toLowerCase()} answers with a gift.`, 5);
    } else if (newSong) news(`A new song: the ${sp.name}'s ${t.title.toLowerCase()}, ${t.words}. ${songCount()} of ${songTotal} songs known.`, 6);
    H.did('song');
    for (let k = 0; k < 14; k++) G.part([b.p[0], b.p[1] + .4, b.p[2]], [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], 1.4, [1, .85, .45], .1);
    if (first) G.emit('learn', sp); else G.emit('song', t);
  }
  // choose a bird from Songs: you sing in its voice and imitate it. It sings its song once, softly,
  // as you remember it (a bird you have only heard: its voice, but no song to copy yet).
  // (k: which of its songs; none, the first you know). Sing as yourself: id null.
  function pick(id, k = null) {
    // a bird of that kind singing within earshot a song you do not know yet: learn from it
    S.chosen = id === null || k !== null ? null : teacherOf(id);
    // your own bird: sing as yourself, whoever sings near by, until you pick a bird or stop singing
    S.self = id === null;
    if (S.chosen) id = null;
    picked = id === null ? null : SPECIES[id]; pickedK = k ?? (picked ? knownSongs(picked)[0] ?? 0 : 0);
    S.res = []; S.over = false;
    if (!picked || !G.learned.has(id)) return;
    H.did('imitate');
    preview(imitating());
  }
  // the nearest bird of a kind within earshot singing a song you do not know
  function teacherOf(id) {
    let best = null, bd = SONG.hearR;
    for (const s of near) {
      if (!s.out || s.sp.id !== id || knows(songOf(s))) continue;
      const d = dist3([s.x, s.y, s.z], b.p); if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  // the next song you know of the bird you imitate
  function nextSong() {
    if (!picked) return;
    const ks = knownSongs(picked); if (ks.length < 2) return;
    pick(picked.id, ks[(ks.indexOf(pickedK) + 1) % ks.length]);
  }
  // a song sung once, softly, as you remember it
  function preview(t) { if (t) t.notes.forEach((n, i) => later(.5 + i * t.gap, () => { A.note(n, t.voice, .07, t.kinds[i], hawkAt(t.base || t)); ui.glow(n); })); }

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
    S.answerT = 5; S.answer = bird ? `A ${sp.name.toLowerCase()} answers` : `A ${sp.name.toLowerCase()} flies in to answer`;
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
      later(1.6, () => { H.name('Dawn chorus', 'songs'); noteNew('Dawn chorus', 'A bird answers your call from the dark, then another: the dawn chorus starts from your tree and spreads out across the valley.'); G.music.moment?.('the dawn chorus', 1); });
    }
    if (!G.flags.call) { G.flags.call = 1; noteNew('Your call', `Your call carries over the valley. Mice freeze where they stand, and ${FAR[BIRD] || 'birds of your kind'} far off answer.`); }
  }

  // ---- keys: 1 to 5 sing at each pitch, 6 to 0 choose up, down, left, right, tap; C calls -------
  addEventListener('keydown', e => {
    if (G.paused || e.repeat) return;
    const n = '12345'.indexOf(e.key), k = '67890'.indexOf(e.key);
    if (n >= 0 && ui.ready && !ui.open) ui.sing(true);
    if (n >= 0 && ui.open) { A.note(n, SPECIES[voiceId() ?? 1].voice, .18, ui.kind, hawkAt(SPECIES[voiceId() ?? 1])); ui.glow(n); notePart(b.p, n, ui.kind, true); singNote(n, ui.kind); }
    if (k >= 0 && ui.open) ui.setKind(KINDS[k][0]);
    if (e.code === 'KeyC') call(.6);
  });

  // ---- tips and the Songs tab ---------------------------------------------------------------------
  H.tip('song', () => S.bird && !G.learned.has(S.bird.sp.id) && !S.bird.sp.mimic, 'A songbird! Tap the notes button, bottom left, to learn its song: each note it sings lights a row; find the swipe or tap that matches it.');
  H.tip('imitate', () => b.state === 'perch' && G.learned.size && !picked && perchT > 3, 'Tap the notes button, then the song card (bottom left), and pick a song to imitate. Sing it right and its bird answers with a gift.');
  H.tip('call', () => b.state === 'fly' && G.clock > 240, 'Hold Call, top right, to scream: the longer you hold, the louder. Mice freeze and far hawks answer.');
  // Journal > Songs, a section a continent (each bird under the first it lives on)
  const CONTS = [['n-america', 'North America'], ['s-america', 'South America'], ['europe', 'Europe'], ['africa', 'Africa'], ['asia', 'Asia'], ['oceania', 'Oceania']];
  // what Sing is doing, and what starts each, at the top of Journal > Songs
  const MODES = `<details class="sghow3"><summary>How singing works</summary><dl class="sgmodes3">
    <dt class="learn">Learning</dt><dd>Perch within about 45 m of a songbird singing a song you do not know (an amber dot on its logo in the rail), or tap its logo, and tap Sing. Each note it sings lights its row on the pad and its place on the card: copy it with the same swipe or tap. Fast or long songs are copied with taps alone. Every note you get right shows on the card, the first note first, then the next; sing the whole song right to learn it. It stops to listen while you sing and sings again when you stop.</dd>
    <dt class="imitate">Imitating</dt><dd>Tap the logo of a bird whose song you know (or pick a song from the list). Sing it and a bird of that kind near by answers with a gift. Tap the song's name for the next song you know of that bird.</dd>
    <dt>Voice only</dt><dd>A bird you have heard but whose song you do not know, with none of its kind singing near: you sing in its voice, with no song to copy yet.</dd>
    <dt>Free song</dt><dd>Your own bird, at the top of the rail: sing anything you like.</dd>
    <dt>Learned, Answered</dt><dd>For a moment after you learn a song, or a bird answers yours.</dd></dl></details>`;
  // (after the core's own tabs, which main.js adds once the systems are made)
  queueMicrotask(songsTab);
  function songsTab() {
    const pane = journal(G).page('songs');
    pane.insertAdjacentHTML('beforeend', '<div class="songbook3"></div>');
    const book = pane.querySelector('.songbook3');
    // a song's notes, each at its pitch, as on the card (taps alone for a tap-only song)
    const notesOf = g => `<span class="mini3 sgnotes3">${g.notes.map((n, i) => `<i style="--note:${NOTE_COLS[n]};--lane:${n}">${glyph(g.tap ? 'c' : g.kinds[i])}</i>`).join('')}</span>`;
    G.menu.onOpen(fill);
    function fill() {
      // a card for each songbird: its picture, its name, what its songs give, and each of its songs:
      // those you know with a play button and their words; the rest as question marks. By continent.
      const card = sp => {
        const k = G.learned.has(sp.id) ? 'learned' : G.heard.has(sp.id) ? 'heard' : 'unknown';
        const pic = `<img alt="" src="${songbirdPic(sp, 128)}">`;
        const n = sp.songs.length, ks = knownSongs(sp);
        if (k === 'unknown') return `<li class="unknown"><div class="pic">${pic}</div><div><b>Not yet heard</b><small>${sp.hint}.${n > 1 && !sp.mimic ? ` ${n} songs to find.` : ''}</small></div></li>`;
        if (sp.mimic) return `<li class="heard seen"><div class="pic">${pic}</div><div><b>${sp.name}</b><small>A mimic: no song of its own, only pieces of the songs around it. Listen to one for the openings of songs you do not know. ${sp.hint}.</small></div></li>`;
        const gift = GIFT_TEXT[sp.powerKey] || sp.power, what = k === 'learned' ? `${gift[0].toUpperCase()}${gift.slice(1)}. ${songLog[sp.id] || (G.learned.has(sp.id) ? 'Learned.' : 'Dev mode: not learned yet.')}` : `Heard, not yet learned. ${sp.hint}.`;
        const rows = sp.songs.map(g => {
          if (!ks.includes(g.k)) return `<li class="q"><span class="sgq3">?</span><span><b>Unknown song</b></span></li>`;
          return `<li><button class="sgplay3" data-play="${sp.id}.${g.k}" aria-label="Play the ${g.title}">${PLAY}</button><span><b>${g.title}</b>${notesOf(g)}<small>${g.words}</small></span></li>`;
        }).join('');
        return `<li class="${k} seen"><div class="pic">${pic}</div><div><b>${sp.name}</b><small>${what}</small></div><ol class="sglist3">${rows}</ol></li>`;
      };
      // the top: what you know, how to sort (the birds of this continent, or every continent in turn),
      // and how singing works, folded away; then the songbirds; then the other birds the field guide keeps
      const here = continentAt(b.p[0], b.p[2]), near = sort === 'near' && here;
      const groups = near ? [[here, `Near here: ${CONTS.find(c => c[0] === here)?.[1] || 'this land'}`, sp => sp.cont.includes(here)]] : CONTS.map(([c, t]) => [c, t, sp => sp.cont[0] === c]);
      book.innerHTML = `<div class="sgtop3"><p class="sub"><b>${songCount()}</b> of ${songTotal} songs <span>·</span> <b>${G.learned.size}</b> of ${learnable.length} songbirds</p>
        <div class="gbar3"><button data-sort="near" class="${sort === 'near' ? 'on' : ''}">Near here</button><button data-sort="cont" class="${sort !== 'near' ? 'on' : ''}">By continent</button></div></div>${MODES}`
        + groups.map(([, title, f]) => { const L = SPECIES.filter(f); return `<h3 class="sgcont3">${title} <small>${L.filter(sp => G.learned.has(sp.id)).length} of ${L.length}</small></h3><ul class="guide3 songs3">${L.map(card).join('')}</ul>`; }).join('')
        + (G.guide?.cards ? G.guide.cards('bird', 'Other birds') : '');
    }
    // a known song played from the book, in its bird's voice (the version you know best)
    let playing = 0, sort = store.get('songSort', 'near');
    book.addEventListener('click', e => {
      const so = e.target.closest('[data-sort]'); if (so) { sort = so.dataset.sort; store.set('songSort', sort); fill(); return; }
      const btn = e.target.closest('[data-play]'); if (!btn) return;
      const [id, k] = btn.dataset.play.split('.').map(Number), t = versionOf(SPECIES[id], k); if (!t) return;
      A.unlock(); clearTimeout(playing);
      for (const el of book.querySelectorAll('.sgplay3.on')) el.classList.remove('on');
      btn.classList.add('on');
      t.notes.forEach((n, i) => setTimeout(() => A.note(n, t.voice, .16, t.kinds[i], hawkAt(t.base || t)), 100 + i * t.gap * 1000));
      playing = setTimeout(() => btn.classList.remove('on'), 300 + t.notes.length * t.gap * 1000);
    });
    G.menu.toggle('play', { label: 'Left-handed', sub: 'note pad and Take off on the left, Sing on the right', get: lefty, set: v => store.set('lefty', v) });
    for (const T of TESTS) G.menu.toggle('play', { label: `${T.letter}. ${T.label}`, sub: T.sub, group: 'songtests', get: () => test[T.id], set: v => { test[T.id] = v; store.set('songTest.' + T.id, v); applyTests(); } });
  }

  // ---- each frame --------------------------------------------------------------------------------
  return {
    id: 'songs', ui, near: () => near, chorus: () => chorus, sing: o => sing(o), pick: (id, k) => pick(id, k), singNote: (l, k) => singNote(l, k),   // (for test scripts)
    update(dt) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].t <= G.t) { const q = queue[i]; queue.splice(i, 1); q.fn(); }
      for (const k in G.gifts) { G.gifts[k] -= dt; if (G.gifts[k] <= 0) delete G.gifts[k]; }
      callT = Math.max(0, callT - dt);
      perchT = b.state === 'perch' ? perchT + dt : 0;

      // the dawn chorus: every clear morning but in winter
      if (chorus) { if ((chorus.t -= dt) <= 0) chorus = null; }
      else if (chorusDay !== G.day && G.tod > .27 && G.tod < .31 && winter() < .5 && storm() < .4) {
        chorusDay = G.day; chorus = { t: SONG.chorus };
        H.name('Dawn chorus', 'songs'); noteNew('Dawn chorus', 'The dawn chorus: for a few minutes every bird nearby sings. Join in, and all the songs you know answer at once.');
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
      // (how many birds other than your teacher are mid-song)
      let singing = 0; for (const s of near) if (s.out && s.singT > 0 && s !== S.bird) singing++;
      let close = null, cd = SONG.nearR, fresh = null, fd = SONG.nearR; const nearby = new Set(), teachers = new Set();   // kinds singing within earshot, and those with a song you do not know
      for (const s of near) {
        let st = birds.get(s.id);
        if (!st) { st = { next: 1 + Math.random() * 6, out: false }; birds.set(s.id, st); }
        s.out = isOut(s);
        if (!s.out) continue;
        s.singT = Math.max(0, (s.singT || 0) - dt);
        st.next -= dt;
        // the bird you learn from teaches: it sings more often, waits while you try, and tries
        // again a moment after you stop; the others sing less while you learn
        if (S.bird === s && learning()) { st.next = Math.min(st.next, 6); if (G.t - S.lastTry < 3) st.next = Math.max(st.next, 1.5); }
        // mornings are busy, so each bird sings half as often then
        // at most three birds sing at once (the one you learn from among them), so a busy wood stays
        // clear and light on the phone; the others wait a moment
        if (st.next <= 0 && S.bird !== s && singing >= (S.bird ? 2 : 3)) st.next = .8 + Math.random() * 1.5;
        if (st.next <= 0) {
          if (S.bird !== s) singing++;
          const morning = chorus || timeOfDay(G.tod) === 'dawn';
          st.next = (chorus ? 2.5 + Math.random() * 3 : 7 + Math.random() * 5) * (morning ? 2 : 1) * (1 + (G.hush || 0) * 2) * (learning() && S.bird !== s ? 2 : 1); sing(s);   // fewer songs in a hush
          // tawny owls call as a pair: the nearest other one answers
          if (s.sp.name === 'Tawny owl') for (const o of near) if (o !== s && o.sp === s.sp && o.out && birds.get(o.id)) {
            birds.get(o.id).next = s.sp.notes.length * s.sp.gap + .8 + Math.random(); break;
          }
        }
        const d = dist3([s.x, s.y, s.z], b.p);
        if (d < SONG.hearR) { nearby.add(s.sp.id); if (!s.sp.mimic && !knows(songOf(s))) teachers.add(s.sp.id); }
        if (d < cd && b.state !== 'fly' && !s.sp.mimic) { cd = d; close = s; }
        if (d < fd && b.state !== 'fly' && !s.sp.mimic && !knows(songOf(s))) { fd = d; fresh = s; }
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
      // the bird you chose to learn from stays your teacher while it sings within earshot
      const ch = S.chosen;
      if (ch && (!ch.out || b.state === 'fly' || dist3([ch.x, ch.y, ch.z], b.p) > SONG.hearR)) S.chosen = null;
      // perched near a new bird whose song you do not know: singing turns to learning from it
      // (the nearest one with a song you do not know, before a nearer one you know)
      if ((fresh?.id ?? null) !== S.closeId) { S.closeId = fresh?.id ?? null; if (fresh && !S.chosen) picked = null; }
      if (!ui.open) S.self = false;
      const teacher = S.self ? null : S.chosen || fresh || close;
      const target = imitating() || (teacher ? songOf(teacher) : null), bird = teacher && teacher.sp === (target?.base || target) ? teacher : null;
      if (target !== S.target || bird !== S.bird) {
        Object.assign(S, { target, bird, res: [], over: false, hearT: 0, teachI: -1 });
      }
      // a finished or failed try stays on the card a moment, then clears
      if (S.over && G.t - S.lastTry > 2.5) { S.res = []; S.over = false; }
      if (!S.over && S.res.length && G.t - S.lastTry > 4) S.res = [];
      S.hearT = Math.max(0, S.hearT - dt); if (!S.hearT) S.teachI = -1;
      S.answerT = Math.max(0, S.answerT - dt); S.learnedT = Math.max(0, S.learnedT - dt);

      const available = b.state !== 'fly' && (b.state === 'perch' || !!close) && !G.menu.open;
      const known = SPECIES.filter(q => !q.mimic && (G.heard.has(q.id) || G.learned.has(q.id)));
      // the card: the song (yours to imitate, or one to learn) or a free song, with how much of it
      // you can see, this try's marks, and who is singing within earshot
      const sp = target || picked, learn = learning();
      const song = sp && (sp.title || sp.songs[0].title);
      const at = S.teachI >= 0 ? S.teachI : sp === target && S.res.length && !S.over ? S.res.length : -1;
      const mine = !sp ? (G.t - S.lastTry > 6 ? [] : S.mine) : sp === target ? S.mine.slice(0, S.res.length) : [];
      const sc = { sp, song, many: !learn && picked && knownSongs(picked).length > 1, shown: sp ? shownOf(sp) : 0, hint: sp ? hintOf(sp) : 0, at, learn, mine };
      // G. Singers on the compass: the six nearest birds singing within earshot
      marks = test.compass ? near.filter(s => s.out && !s.sp.mimic && dist3([s.x, s.y, s.z], b.p) < SONG.hearR).sort((p, q) => dist3([p.x, p.y, p.z], b.p) - dist3([q.x, q.y, q.z], b.p)).slice(0, 6).map(s => ['song', s.x, s.z, s.sp.name, knows(songOf(s)) ? '#3f5a35' : '#b0791f']) : [];
      // the rail: the birds singing within earshot and the one you sing as, by name
      const mode = modeOf(sp, learn), rail = [];
      for (const id of [sp?.base?.id ?? sp?.id, ...nearby]) {
        if (id == null || rail.some(r => r.sp.id === id) || SPECIES[id].mimic) continue;
        const on = id === (sp?.base?.id ?? sp?.id);
        rail.push({ sp: SPECIES[id], on, state: on ? mode.kind : teachers.has(id) ? 'teach' : '' });
      }
      rail.sort((p, q) => p.sp.name.localeCompare(q.sp.name));
      if (target) {
        const listening = close && young(close) && close.sp !== target && G.learned.has(target.id) ? close : null;
        if (listening && listening !== S.listening && ui.open) say(`A young ${close.sp.name.toLowerCase()} is listening`);
        S.listening = listening;
      }
      G.singing = ui.open;   // the sing controls are out (main.js turns the perched gyro look off)
      ui.update({ available, known, learned: G.learned, picked, pickedK, sc, mode, rail, nearby, lefty: lefty(), resting: callT > 0, knownK: knownSongs });

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
