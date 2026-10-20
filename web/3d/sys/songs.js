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
import { height, WATER, treesNear, perchesOf, thermalsNear } from '../world.js';
import { clamp, dist3 } from '../util.js';
import { registerSongbirds, pushBird, songTreesNear, habitat } from './songbirds.js';
import { createSingUI, NOTE_COLS, KINDS } from './singui.js';
import { journal } from '../journal.js';
import { BIRD } from '../hawk.js';
import { songbirdPic } from '../pics.js';

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
    onPick: pick, onCall: call,
  });

  // ---- songbirds singing --------------------------------------------------------------------
  const storm = () => G.storm || 0, winter = () => G.season.winter;
  const isOut = s => active(s.sp, G.tod, storm(), winter()) || ((G.gifts.sing > 0 || chorus && s.sp.name !== 'Owl') && storm() < .6);
  function notePart(p, lane, col = NOTE01[lane]) {
    G.part([p[0], p[1] + .35, p[2]], [(Math.random() - .5) * .8, 2.4 + lane * .2, (Math.random() - .5) * .8], 1.5, col, .13);
  }
  function hear(sp) { if (!G.heard.has(sp.id)) { G.heard.add(sp.id); store.set('heard', [...G.heard]); } }
  // a songbird (or a visitor) sings; in a duet it sings only the first half and leaves the rest to you
  function sing(o, duet = false) {
    const sp = o.sp, d = dist3([o.x, o.y, o.z], b.p), v = .16 * clamp(1 - d / SONG.hearR, 0, 1);
    const count = duet ? Math.ceil(sp.notes.length / 2) : sp.notes.length;
    o.singT = count * sp.gap + .2;
    if (duet) { S.tries = []; S.errs = []; S.wrongT = 0; S.doneT = 0; S.lastTry = G.t + count * sp.gap; }
    sp.notes.slice(0, count).forEach((n, i) => later(i * sp.gap, () => {
      if (v > .005) A.note(n, sp.voice, v, sp.kinds[i]);
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
      if (!G.learned.has(sp.id)) learn(sp); else respond(sp, S.bird || near.find(s => s.sp === sp && s.out && dist3([s.x, s.y, s.z], b.p) < SONG.hearR), quality());
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

  // ---- answers and gifts ---------------------------------------------------------------------
  function respond(sp, bird, q = 1) {
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
    if (n >= 0 && ui.open) { A.note(n, SPECIES[voice ?? 1].voice, .18, ui.kind); ui.glow(n); notePart(b.p, n); G.music.echo(n); singNote(n, ui.kind); }
    if (k >= 0 && ui.open) ui.setKind(KINDS[k][0]);
    if (e.code === 'KeyC') call(.6);
  });

  // ---- tips and the Songs tab ---------------------------------------------------------------------
  H.tip('song', () => S.bird && !G.learned.has(S.bird.sp.id), 'A songbird! Copy its score: choose the sound on the left, then the pitch on the right.');
  H.tip('imitate', () => b.state === 'perch' && G.learned.size && !picked && perchT > 3, 'Open Songs (left) and pick a bird to imitate. Sing its song right and it answers with a gift.');
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
    id: 'songs', ui,   // (ui.lanePt and ui.kindPt for test scripts)
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
      if ((refreshT -= dt) <= 0) { refreshT = .5; near = songTreesNear(b.p[0], b.p[2], SONG.simR); }
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
        sc = { sp: target, title, words, done: off + S.tries.length, bird: off, state: S.wrongT > 0 ? 'wrong' : S.doneT > 0 ? 'done' : '' };
      } else if (picked) sc = { sp: picked, hidden: true, title: picked.name, note: 'Listen for one nearby to learn its song' };
      ui.update({ available, known, learned: G.learned, picked, sc, nearby, lefty: lefty(), resting: callT > 0 });

      // gifts that run for a while
      const g = G.gifts;
      if (g.tailwind > 0 && b.state === 'fly' && b.s < 20) b.s += .9 * dt;
      if (g.lift > 0 && b.state === 'fly' && b.lift > .5) b.p[1] += b.lift * .5 * dt;
      if (g.warm > 0) b.recover = (b.recover ?? 1) * 1.5;
      if (g.dusk > 0 && period(G.tod) === 'dusk') G.tod -= dt / DAY * .6;   // the evening lingers
      if ((trailT -= dt) <= 0) {
        trailT = .35;
        // a trail of motes: toward rising air (thrush), toward an unknown songbird (jay)
        const to = g.companion > 0 ? (thermalsNear(b.p[0], b.p[2], 500).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]) : null;
        const aim = to ? [to.x, Math.max(height(to.x, to.z), WATER) + 20, to.z] : g.glint > 0 ? glintAt : null;
        if (aim) {
          const dx = aim[0] - b.p[0], dy = aim[1] - b.p[1], dz = aim[2] - b.p[2], d = Math.hypot(dx, dy, dz) || 1;
          for (const r of [6, 12, 18]) if (r < d) G.part([b.p[0] + dx / d * r, b.p[1] + dy / d * r + .5, b.p[2] + dz / d * r], [dx / d * 2, 1.2, dz / d * 2], .9, g.companion > 0 ? [1, .9, .6] : [.45, .6, .9], .12);
        }
        // a meadowlark's gift: golden flecks over every mouse near you
        if (g.mice > 0) for (const m of G.systems.food?.mice?.values() || []) G.part([m.x, m.y + .5, m.z], [0, 2.5, 0], 1, [1, .8, .3], .16);
      }
    },
    scene(S3) {
      for (const s of near) if (s.out) {
        const sing = (s.singT || 0) > 0, bob = sing ? Math.abs(Math.sin(G.t * 14)) * .015 : 0;
        const look = s.heading + Math.sin(G.t * .3 + s.id) * .9 * (Math.sin(G.t * .07 + s.id) > 0 ? 1 : 0);
        pushBird(S3, s.sp, s.x, s.y + bob, s.z, look);
      }
      if (visitor) pushBird(S3, visitor.sp, visitor.x, visitor.y, visitor.z, visitor.heading, visitor.flying, G.t * 30);
      for (const f of flock) pushBird(S3, f.sp, f.x, f.y, f.z, f.heading, true, G.t * 28 + f.ph);
      // night sight: knowing the owl's song lifts the dark a little; its gift, a lot
      const night = S3.night || 0, k = night * Math.min(.75, (G.learned.has(6) ? .3 : 0) + (G.gifts.night > 0 ? .55 : 0));
      if (k > 0) {
        const up = (c, to) => c.map((v, i) => v + (to[i] - v) * k);
        S3.skyAmb = up(S3.skyAmb, [.36, .4, .5]); S3.gndAmb = up(S3.gndAmb, [.24, .24, .24]); S3.sunCol = up(S3.sunCol, [.42, .46, .56]);
      }
    },
    save: () => ({ chorusDay, gifts: G.gifts, cd: Object.fromEntries(Object.entries(powerCD).map(([id, t]) => [id, t - G.clock])) }),
    load(o) {
      chorusDay = o.chorusDay || 0; Object.assign(G.gifts, o.gifts || {});
      for (const id in o.cd || {}) powerCD[id] = G.clock + o.cd[id];
    },
  };
}
