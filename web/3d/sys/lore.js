// Songs as knowledge (S1 to S5 of the gameplay study; James, 2026-10-26: "learning birdsong should
// unlock tips, like ring courses across the ocean, or the location of hidden places, which have treasure").
// - Songs tell you where (S1): learning a song, the singer tells one true thing about here: a hidden
//   place, a cave, a landmark not yet found (sea birds: a sea cave). A rumour: a soft circle on the Map
//   and a line in Journal > Quests, never an exact pin; close by, the place glints (sys/finds.js).
// - Mastered songs (S2): sing a species' song cleanly three times and it gives the bird singing it a
//   lasting step of growth (sys/growth.js G.gift: each bird masters its own).
// - Songs as keys (S3): sing in a cave and the hill sings back what it keeps; sing in a rock shelter
//   you found at dusk and the owl there answers with a feather (the notebook's riddles say so).
// - A land's chorus (S4): learn every songbird of one land of a continent and its chorus is yours: a
//   step of growth, and its hidden places show on your compass when you are near.
// - Sea songs (S5): ride a whale long enough to learn its song, then sing it from a perch at sea and a
//   whale comes up to carry you; rest by a gannet colony to learn their call, and the islands near show
//   on your compass for a day.
import { SPECIES } from '../../src/songs.js';
import { landmarksNear, isNotable, height, WATER, wrapX, ih, biomeAt, islesNear } from '../world.js';
import { continentAt } from '../earth.js';
import { cavesNear } from '../caves.js';
import { TRINKETS } from './ruinshapes.js';
import { whereTo } from './quests.js';
import { BIRD } from '../hawk.js';
import { journal, esc } from '../journal.js';

const CONT = { 'n-america': 'North America', 's-america': 'South America', europe: 'Europe', africa: 'Africa', asia: 'Asia', oceania: 'Oceania' };
const LAND = { meadow: 'meadows', forest: 'forests', lakeland: 'lakelands', swamp: 'swamps', marsh: 'marshes', coast: 'coasts', desert: 'deserts', steppe: 'steppes', savanna: 'savannas', mountains: 'mountains', alpine: 'high peaks', tundra: 'tundra', taiga: 'taiga', rainforest: 'rainforests', redwood: 'redwood groves', canyon: 'canyons', karst: 'karst', moor: 'moors', maquis: 'scrub', birch: 'birch woods', badlands: 'badlands', saltflat: 'salt flats', fjord: 'fjords', cliffs: 'cliffs', volcano: 'fire mountains', ice: 'ice' };
// a mastered song's growth, by what its gift does
const STAT = { worms: 'recovery', ripen: 'recovery', fish: 'recovery', juice: 'recovery', clear: 'recovery', moths: 'recovery', fireflies: 'recovery', dew: 'stamina', lark: 'stamina', hardy: 'stamina',
  tailwind: 'speed', companion: 'speed', flock: 'speed', lift: 'lift', updraft: 'lift', warm: 'lift', calm: 'height', night: 'height', dusk: 'height', glint: 'climb', bells: 'climb', mice: 'climb', sing: 'climb', hush: 'climb' };
const LORE = { tellR: 7000, clean: .85, master: 3, whale: 40, gannet: 15 };
const cap = s => s[0].toUpperCase() + s.slice(1);
const hash = s => { let h = 7; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0; return h; };
const chorusKey = (c, l) => c + ':' + l;
const chorusName = key => { const [c, l] = key.split(':'); return `the ${LAND[l] || l} of ${CONT[c] || c}`; };
// the songbirds of each land of each continent
const CHORUS = {};
for (const sp of SPECIES) for (const c of sp.cont || []) for (const l of sp.lands || []) (CHORUS[chorusKey(c, l)] ||= []).push(sp.id);

export function loreSystem(G) {
  const b = G.b, H = G.hud;
  const L = { told: {}, clean: {}, opened: {}, chorus: {}, whale: 0, whaleSong: false, gannet: 0, gannetSong: false, gannetDay: -1 };
  const d2 = (x, z) => Math.hypot(wrapX(x - b.p[0]), z - b.p[2]);

  // ---- songs tell you where (S1) ----------------------------------------------------------------
  function candidates(sp) {
    const out = [], sea = (sp.lands || []).some(l => l === 'coast' || l === 'marsh' || l === 'fjord' || l === 'cliffs');
    const found = G.hidden?.found?.() || {}, J = G.journey?.found || {};
    for (const kind of ['ledge', 'shelter', 'oasis']) {
      const p = G.hidden?.nearest(kind);
      if (p && !found[p.id] && d2(p.x, p.z) < LORE.tellR) out.push({ id: p.id, x: p.x, z: p.z, what: p.name || kind, hidden: true });
    }
    for (const cv of cavesNear(b.p[0], b.p[2], 4500)) if (!found[cv.id]) out.push({ id: cv.id, x: cv.mouth.x, z: cv.mouth.z, what: G.caves?.NAMES[cv.kind] || 'a cave', hidden: true, sea: cv.kind === 'seacave' });
    for (const l of landmarksNear(b.p[0], b.p[2], 4000)) if (!J[l.id] && isNotable(l)) out.push({ id: l.id, x: l.x, z: l.z, what: l.name, lm: true });
    const t = G.ocean?.tell?.(sp); if (t) out.push(t);
    return out.filter(o => !L.told[o.id] && d2(o.x, o.z) > 150).map(o => ({ ...o, score: d2(o.x, o.z) * (sea && (o.sea || o.road) ? .3 : 1) })).sort((a, c) => a.score - c.score);
  }
  function tell(sp) {
    const o = candidates(sp)[0]; if (!o) return;
    L.told[o.id] = sp.id; if (o.road) G.ocean?.reveal(o.road);
    const j = k => (ih(hash(o.id), k, 881) - .5) * 360, text = `The ${sp.name.toLowerCase()} knows ${o.what}, ${whereTo(b, o.x, o.z)}.`;
    G.quests.set('tell:' + o.id, { group: o.road ? 'sea' : 'rumour', icon: o.road ? 'ring' : 'rumour', title: cap(o.what.replace(/^(a|an) /, '')), text: `${text} Somewhere in the circle.`, x: o.x + j(1), z: o.z + j(2), r: o.road ? undefined : 320, hidden: o.hidden ? o.id : undefined, lm: o.lm ? o.id : undefined, road: o.road });
    later(5.5, () => H.glint(`The ${sp.name} knows a place`, text, 'rumour'));
  }
  const later = (s, f) => setTimeout(f, s * 1000);
  G.on('learn', sp => { tell(sp); chorus(sp); });
  G.on('song', (t, q) => { if (q === undefined && t?.base) tell(t.base); });
  G.on('landmark', l => { const q = G.quests.get('tell:' + l.id); if (q && !q.done) G.quests.done(q.id, `Found on day ${G.day}.`); });

  // ---- mastered songs (S2) and songs as keys (S3) -----------------------------------------------
  G.on('song', (sp, q) => {
    if (typeof q !== 'number') return;
    sp = sp.base || sp;
    if (q >= LORE.clean) {
      const C = L.clean[BIRD] ||= {}, n = C[sp.id] = (C[sp.id] || 0) + 1;
      if (n === LORE.master) { G.gift(STAT[sp.powerKey] || 'stamina', `Mastered the ${sp.name.toLowerCase()}'s song`, 'master:' + sp.id); G.emit('mastered', sp); }
      else if (n < LORE.master && !G.flags.masterTold) { G.flags.masterTold = 1; H.glint('A clean song', `Sing a song cleanly three times and your bird masters it: a little lasting strength. ${n} of ${LORE.master} for the ${sp.name.toLowerCase()}.`, 'songs'); }
    }
    if (q >= .45) keys();
  });
  function keys() {
    const cv = b.inCave;
    if (cv && !L.opened[cv.id]) {
      L.opened[cv.id] = G.day || 1;
      const tk = Object.keys(TRINKETS)[Math.floor(ih(hash(cv.id), 1, 882) * Object.keys(TRINKETS).length)];
      const St = G.relics; if (St) { St.trinkets.push(tk); (St.at ||= {})[tk] ||= [Math.round(b.p[0]), Math.round(b.p[2])]; }
      G.audio.chord?.();
      H.say(`The hill sings your song back, and in the echo something falls from a crack in the rock: ${TRINKETS[tk]}.`, { kind: 'event', secs: 6, icon: 'songs' });
      G.emit('keepsake', { kind: tk }); G.emit('opened', 'cave');
      return;
    }
    const h = (G.hidden?.near?.() || []).find(p => p.kind === 'shelter' && G.hidden.found()[p.id] && d2(p.perch.x, p.perch.z) < 8);
    if (h && !L.opened[h.id]) {
      const dusk = G.tod > .68 || G.tod < .22;
      if (!dusk) { H.reply('Nothing answers from the shelter: owls sleep by day', 3); return; }
      L.opened[h.id] = G.day || 1;
      G.feather?.('The owl in the rock');
      H.say('A soft hoot from the back of the shelter, then a feather drifts out to you: the owl trades for a song.', { kind: 'event', secs: 6, icon: 'feather' });
      G.emit('opened', 'owl');
    }
  }

  // ---- a land's chorus (S4) ----------------------------------------------------------------------
  const learned = () => G.learned || new Set();
  function chorus(sp) {
    for (const c of sp.cont || []) for (const l of sp.lands || []) {
      const key = chorusKey(c, l), all = CHORUS[key]; if (!all || L.chorus[key]) continue;
      if (all.every(id => learned().has(id))) {
        L.chorus[key] = G.day || 1;
        G.audio.chord?.();
        H.say(`Every songbird of ${chorusName(key)}: the chorus there is yours. Near you in that land, its hidden places show on your compass.`, { kind: 'event', secs: 7, icon: 'songs' });
        G.gift('lift', `The chorus of ${chorusName(key)}`, 'chorus:' + key);
        G.emit('chorus', key);
      }
    }
  }
  const hereKey = () => chorusKey(continentAt(b.p[0], b.p[2]), biomeAt(b.p[0], b.p[2]).name);

  // ---- the compass ------------------------------------------------------------------------------
  let isles = [], islesT = 0, here = '', hereT = 0;
  (G.marks ||= []).push(() => {
    const out = [];
    if (L.chorus[here]) for (const p of G.hidden?.near?.() || []) if (!G.hidden.found()[p.id] && d2(p.x, p.z) < 900 && d2(p.x, p.z) > 40) out.push(['door', p.x, p.z, cap(p.name || 'a hidden place')]);
    if (L.gannetDay >= (G.day || 0)) for (const I of isles) { const d = d2(I.x, I.z); if (d > I.r + 200) out.push(['shore', I.x, I.z, 'An island']); }
    return out;
  });

  // ---- sea songs (S5) ---------------------------------------------------------------------------
  const atSea = () => height(b.p[0], b.p[2]) < WATER - 2;
  function tones(sts, gap, vol = .07) { sts.forEach((st, i) => G.audio.tone?.({ f: G.audio.hz?.(st) || 200, dur: 1.6, vol, delay: i * gap, lp: 1200 })); }
  let whaleCd = 0, gannetCd = 0;
  (G.actions ||= {}).whalesong = {
    label: 'Sing the whale\'s song', icon: 'songs',
    when: () => L.whaleSong && b.state === 'perch' && !b.perch?.ride && atSea() && whaleCd <= 0,
    run: () => {
      whaleCd = 60; tones([-24, -19, -26], .9, .09);
      const ok = G.sea?.summon(b.p[0], b.p[2]);
      later(2.5, () => H.say(ok ? 'Far below, a whale answers, and rises beside you: land on its back.' : 'Nothing answers: no whale in these waters.', { kind: ok ? 'event' : 'reply', secs: 4, icon: 'songs' }));
    },
  };
  G.actions.gannets = {
    label: 'Call like the gannets', icon: 'songs',
    when: () => L.gannetSong && (b.state === 'perch' || b.state === 'ground') && gannetCd <= 0 && L.gannetDay < (G.day || 0),
    run: () => {
      gannetCd = 30; L.gannetDay = G.day || 1; tones([7, 9, 7, 9], .18, .05);
      H.say('Your gannet call carries out over the sea; for today the islands near show on your compass.', { kind: 'event', secs: 5, icon: 'songs' });
    },
  };

  // ---- Journal > Songs: choruses, mastered songs, the sea songs -----------------------------------
  const box = document.createElement('section'); box.className = 'lore3';
  queueMicrotask(() => journal(G).page('songs').prepend(box));
  G.menu.onOpen(() => {
    const done = Object.keys(L.chorus).map(chorusName), C = L.clean[BIRD] || {}, mastered = Object.keys(C).filter(id => C[id] >= LORE.master).map(id => SPECIES[id]?.name).filter(Boolean);
    const now = CHORUS[here], nowN = now ? now.filter(id => learned().has(id)).length : 0;
    box.innerHTML = `<h3><span>What the songs give</span></h3>
      ${now && !L.chorus[here] ? `<p>The chorus of ${esc(chorusName(here))}: ${nowN} of ${now.length} songbirds learned.</p>` : ''}
      <p>${done.length ? `Choruses that are yours: ${esc(done.join(', '))}.` : 'Learn every songbird of one land (the meadows of Europe, the forests of Asia...) and its chorus is yours.'}</p>
      <p>${mastered.length ? `Mastered by this bird: ${esc(mastered.join(', '))}.` : 'Sing a song cleanly three times and your bird masters it, and grows a little.'}</p>
      ${L.whaleSong || L.gannetSong ? `<p>Sea songs: ${[L.whaleSong && 'the whale\'s (sing it from a perch at sea)', L.gannetSong && 'the gannets\' call (the islands near, for a day)'].filter(Boolean).join('; ')}.</p>` : ''}`;
  });

  G.dev?.add({ id: 'tells', area: 'Songs', round: 'Gameplay 10-26 S1', title: 'Songs tell you where', how: 'Learn a song: the singer tells you of a hidden place, a cave or a landmark near (a circle on the Map, Journal > Quests > Rumours).' });
  G.dev?.add({ id: 'mastery', area: 'Songs', round: 'Gameplay 10-26 S2 S3 S4', title: 'Mastered songs, songs as keys, a land\'s chorus', how: 'Sing a learned song cleanly 3 times: your bird grows. Sing in a cave: the hill gives something back. Sing at a found rock shelter at dusk: an owl\'s feather. Learn every songbird of one land: its chorus (Journal > Songs).' });
  G.dev?.add({ id: 'seasongs', area: 'Songs', round: 'Gameplay 10-26 S5', title: 'Sea songs: the whale and the gannets', how: 'Ride a whale 40 s: you learn its song; sing it (action button) from a perch at sea and a whale comes. Rest 15 s by a gannet colony: their call shows the islands near on the compass for a day. Go teaches both.',
    go: () => { L.whaleSong = L.gannetSong = true; H.reply('Whale song and gannet call learned', 2.5); } });

  return {
    id: 'lore',
    update(dt) {
      whaleCd -= dt; gannetCd -= dt;
      if ((hereT -= dt) <= 0) { hereT = 2; here = hereKey(); }
      if ((islesT -= dt) <= 0) { islesT = 4; isles = L.gannetDay >= (G.day || 0) ? islesNear(b.p[0], b.p[2], 20000).filter(I => I.r > 60).slice(0, 12) : []; }
      // riding a whale, you learn its song
      if (!L.whaleSong && b.state === 'perch' && b.perch?.ride) {
        if ((L.whale += dt) >= LORE.whale) { L.whaleSong = true; tones([-24, -19, -26], .9); H.say('Long enough on its back that you know its song: three low notes. Sing it from a perch at sea (a berg, a buoy, a log) and a whale will come.', { kind: 'event', secs: 7, icon: 'songs' }); }
      }
      // resting by a gannet colony, you learn their call
      if (!L.gannetSong && b.state !== 'fly') {
        const o = (G.isleNear?.() || []).find(o => o.sight?.kind === 'colony' && d2(o.sight.x, o.sight.z) < 140);
        if (o && (L.gannet += dt) >= LORE.gannet) { L.gannetSong = true; tones([7, 9, 7, 9], .18, .05); H.say('Among the gannets long enough to call like them: from any perch, their call shows the islands near on your compass for a day.', { kind: 'event', secs: 7, icon: 'songs' }); }
      }
    },
    save: () => L,
    load(o) { Object.assign(L, o || {}); },
  };
}
