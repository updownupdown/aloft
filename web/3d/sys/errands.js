// Errands (James, 2026-10-26: "quests to find items and return them"; Q1, Q2, Q4 and Q5 of the
// gameplay study). Their reward is the world waking up, and a little growth for the bird that does it.
// - The lamps (Q1): every lighthouse is dark, each missing one part of its lamp (the lens prism or the
//   lamp room key); the other part lies on its gallery, spare. Take a part, carry it to a lighthouse
//   that is missing it, land on that gallery: the lamp lights for good (a beam at night, a mark on the
//   compass out at sea). The part left on that gallery is the one the next lighthouse needs: a chain.
// - Bring it home (Q2): a name is scratched on each treasure, a place of its kind nearby; carry it there
//   and it stays: a window lit at night, and the bell rings at dawn, the sheep bell on the wind...
// - Bottle threads (Q4): some notes answer each other, or say where to look next (a rumour).
// - The seed tin (Q5): a note leads far north to a rusted tin of seeds; plant them on open ground and
//   the tree that grows wild there comes up: a sapling next day, a young tree in a season, a perch in a year.
// Carrying is sys/quests.js (G.hold); the lamp parts lie by sys/ruins.js (G.lamps.spare).
import { landmarksNear, height, groundAt, WATER, ih, wrapX, toXZ, treeLookAt, treesNear, env } from '../world.js';
import { settlementsNear } from '../settle.js';
import { oceanAt } from '../earth.js';
import { TREASURES } from './ruinshapes.js';
import { TREE_LOOKS } from '../shapes.js';
import { whereTo } from './quests.js';

const PART = { lens: 'the lens prism', lampkey: 'the lamp room key' };
// where each treasure's story comes true, once home, and the growth it gives
const HOME = {
  bell: ['The handbell is home: it rings at dawn now.', 'recovery'], locket: ['The locket is home.', 'stamina'],
  watch: ['The watch is home, and ticking.', 'speed'], teacup: ['The teacup is home on its shelf.', 'recovery'],
  horseshoe: ['The horseshoe is home over the barn door, ends up.', 'climb'], whistle: ['The whistle is home: the wind finds a note in it.', 'lift'],
  float: ['The float is home with the nets.', 'stamina'], sheepbell: ['The sheep bell is home on the hill.', 'height'],
  spyglass: ['The spyglass is home in the tower.', 'height'],
};
const SEED = { tin: [69.6, 18.9], seeds: 12, near: 45 };   // the tin's place (lat, lon: the hills over the last fjords, before the ice)
const GROW_DAYS = { sapling: 1, young: 8, tree: 32 };      // days from planting (sky.js: a season is 8 days, a year 32)
const cap = s => s[0].toUpperCase() + s.slice(1);
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

export function errandsSystem(G) {
  const b = G.b, H = G.hud, R = G.R;
  const E = { lit: {}, homes: {}, planted: [], seeds: 0, tin: false, threads: {}, lamps: 0 };
  const d2 = (x, z) => Math.hypot(wrapX(x - b.p[0]), z - b.p[2]);

  // ---- the lamps (Q1) ----------------------------------------------------------------------------
  const needs = id => (ih(hash(id), 3, 811) < .5 ? 'lens' : 'lampkey');
  G.lamps = { lit: id => !!E.lit[id], needs, spare: id => (needs(id) === 'lens' ? 'lampkey' : 'lens'), list: () => E.lit };
  // the nearest dark lighthouse that is missing this part (not the one it came from)
  function lampFor(part, x, z, not) {
    for (const r of [5000, 12000, 24000]) {
      let best = null, bd = 1e9;
      for (const l of landmarksNear(x, z, r)) {
        if (l.kind !== 'lighthouse') continue;
        const id = 'k' + l.id; if (id === not || E.lit[id] || needs(id) !== part) continue;
        const d = Math.hypot(wrapX(l.x - x), l.z - z); if (d < bd) { bd = d; best = l; }
      }
      if (best) return best;
    }
    return null;
  }
  function holdPart(a) {
    const l = lampFor(a.kind, a.x, a.z, a.S?.id), qid = 'lamp' + (E.lamps + 1);
    G.quests.set(qid, { group: 'hold', icon: 'lamp', title: 'Light a lamp',
      text: l ? `${l.name} is missing ${PART[a.kind]}: carry it there and land on the gallery.` : `Carry ${PART[a.kind]} to a dark lighthouse that is missing one.`,
      ...(l ? { x: l.x, z: l.z, to: 'k' + l.id } : {}) });
    G.hold({ id: 'part:' + a.id, kind: a.kind, name: PART[a.kind], goes: l ? `${l.name} needs it` : 'A dark lighthouse needs it', quest: qid });
    if (!E.lamps && !G.flags.lampTold) { G.flags.lampTold = 1; H.say('A part of a lighthouse lamp. Somewhere along the coast a dark lamp is missing it: Journal > Quests keeps the way.', { kind: 'event', secs: 6, icon: 'lamp' }); }
  }
  function light(l, item) {
    const id = 'k' + l.id;
    G.letGo();
    E.lit[id] = { day: G.day || 1, x: l.x, y: l.y, z: l.z, name: l.name };
    E.lamps++;
    const q = G.quests.all().find(o => o.id === item.quest); if (q) G.quests.done(q.id, `Lit ${l.name} on day ${G.day}.`);
    G.quests.set('lamps', { group: 'find', icon: 'lamp', title: 'The dark lamps', text: 'Each lighthouse is missing the lens or its key; the spare part lies on another\'s gallery.', n: E.lamps, quiet: true });
    G.audio.learned?.(); G.audio.chord?.();
    H.say(`${l.name} is lit again. It will turn all night, and show on your compass from far out at sea.`, { kind: 'event', secs: 6, icon: 'lamp' });
    G.gift('stamina', `Lit ${l.name}`, 'lamp:' + id);
    G.emit('lamp', E.lit[id]);
  }

  // ---- bring it home (Q2) ------------------------------------------------------------------------
  function homeFor(kind, a) {
    const kinds = TREASURES[kind][1];
    let best = null, bd = 1e9;
    for (const S of settlementsNear(a.x, a.z, 9000, true)) {
      if (!kinds.includes(S.kind) || S.id === a.S?.id) continue;
      const d = Math.hypot(wrapX(S.x - a.x), S.z - a.z); if (d > 300 && d < bd) { bd = d; best = S; }
    }
    return best;
  }
  function holdTreasure(a) {
    const T = homeFor(a.kind, a); if (!T) return;
    const name = TREASURES[a.kind][0].replace(/^A /, 'the ').replace(/^The /, 'the '), qid = 'home:' + a.kind;
    G.quests.set(qid, { group: 'hold', icon: 'carry', title: `Take ${name} home`, text: `“${T.name}” is scratched on it. Carry it there and land.`, x: T.x, z: T.z, home: { id: T.id, x: T.x, y: T.y, z: T.z, name: T.name, spot: T.spots?.[0] || null } });
    G.hold({ id: qid, kind: a.kind, name, goes: `It belongs at ${T.name}`, quest: qid });
  }
  function home(item, q) {
    const T = q.home, sp = T.spot || T;
    G.letGo();
    E.homes[item.kind] = { day: G.day || 1, id: T.id, name: T.name, x: sp.x, y: sp.y ?? groundAt(sp.x, sp.z), z: sp.z, cx: T.x, cz: T.z };
    G.quests.done(q.id, `Home at ${T.name} on day ${G.day}.`);
    const [line, stat] = HOME[item.kind] || [`${cap(item.name)} is home.`, 'stamina'];
    G.audio.learned?.();
    H.say(`${line} ${T.name} has one window lit at night again.`, { kind: 'event', secs: 6, icon: 'carry' });
    G.gift(stat, `${cap(item.name)} home`, 'home:' + item.kind);
    G.emit('home', item.kind);
  }

  G.on('artefact', a => {
    if (a.part) holdPart(a);
    else if (a.treasure && HOME[a.kind] && !E.homes[a.kind]) holdTreasure(a);
  });

  // ---- bottle threads (Q4) and the seed tin (Q5) -------------------------------------------------
  // drift.js asks which note a bottle carries: a thread's answer when one is due
  const T = E.threads;
  G.noteFor = o => {
    const far = (t, k = 2000) => !t.at || Math.hypot(wrapX(o.x - t.at[0]), o.z - t.at[1]) > k;
    if (T.ana && !T.anaDone && far(T.ana) && oceanAt(o.x, o.z)?.key !== T.ana.sea) { T.anaDone = 1; return 12; }
    if (T.keeper && !T.keeperDone && far(T.keeper)) { T.keeperDone = 1; return 13; }
    if (T.seed && !T.seedDone && far(T.seed, 1000)) { T.seedDone = 1; return 14; }
    if ((G.bottleNotes?.().length || 0) >= 4 && !T.chart) { T.chart = 1; return 15; }
    return null;
  };
  G.on('note', ({ note, x, z }) => {
    const at = [x, z];
    if (note === 6) { T.ana = { at, sea: oceanAt(x, z)?.key }; G.quests.set('ana', { group: 'find', icon: 'notebook', title: 'An answer for Ana', text: 'Someone threw a birthday note into the sea for Ana. Perhaps Ana wrote back, across another ocean.', quiet: false }); }
    if (note === 12) G.quests.done('ana', 'Ana wrote back: the bottle crossed the world.');
    if (note === 8) {   // follow the birds: the nearest sea road, where the shearwaters fly (sys/ocean.js)
      let best = null, bd = 1e9; for (const r of G.ocean?.roads() || []) for (const p of r.P) { const d = Math.hypot(wrapX(p.x - x), p.z - z); if (d < bd) { bd = d; best = { r, p }; } }
      if (best) G.quests.set('birds', { group: 'rumour', icon: 'ring', title: 'Follow the birds', text: `Lines of shearwaters fly the sea roads. The nearest is ${best.r.name}, ${best.r.way} to ${best.r.end}.`, x: wrapX(best.p.x), z: best.p.z, r: 2000 });
    }
    if (note === 0) { T.keeper ||= { at }; const l = landmarksNear(x, z, 12000).filter(l => l.kind === 'lighthouse').sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z))[0];
      if (l && !Object.keys(E.lit).length) G.quests.set('keeper', { group: 'rumour', icon: 'lamp', title: 'Keep the light lit', text: `A keeper's note. The nearest lighthouse is ${l.name}: land on its gallery.`, x: l.x, z: l.z, r: 400 }); }
    if (note === 7) { T.seed ||= { at }; tinQuest(); }
  });
  G.on('lamp', () => G.quests.get('keeper') && G.quests.done('keeper', 'A lamp is lit again.'));
  function tinQuest() {
    if (E.tin) return;
    const [x, z] = toXZ(...SEED.tin);
    G.quests.set('seedtin', { group: 'rumour', icon: 'seed', title: 'The seed tin', text: 'A note says the seeds were left far north, in the hills over the last fjords before the ice.', x, z, r: 1200 });
  }
  // the tin lies by a cairn of stones on the hill
  const tinAt = (() => { let p = null; return () => p ||= (() => { const [x, z] = toXZ(...SEED.tin); return { x, z, y: groundAt(x, z) }; })(); })();
  function takeTin() {
    E.tin = true; E.seeds = SEED.seeds;
    G.quests.done('seedtin', `Found the tin on day ${G.day}.`);
    G.quests.set('seeds', { group: 'errand', icon: 'seed', title: 'Plant the seeds', text: 'Land on open ground and plant one where nothing grows: the tree that grows wild there comes up.', n: 0, of: SEED.seeds });
    G.story?.keepsakes?.push('the seed tin');
    G.audio.learned?.();
    H.say(`The seed tin: ${SEED.seeds} seeds still dry inside. Land on open ground to plant one.`, { kind: 'event', secs: 6, icon: 'seed' });
  }
  // planting: on bare open ground, out of the water, nothing growing close
  const open = () => {
    const x = b.p[0], z = b.p[2], y = height(x, z);
    if (y < 1 || y > 150) return false;
    if (treesNear(x, z, 5).some(t => Math.hypot(t.x - x, t.z - z) < 4)) return false;
    return !E.planted.some(p => Math.hypot(wrapX(p.x - x), p.z - z) < 8);
  };
  (G.actions ||= {}).plant = {
    label: 'Plant a seed', icon: 'seed',
    when: () => E.seeds > 0 && b.state === 'ground' && !(b.settle > 0) && open(),
    run: () => {
      const x = b.p[0] + Math.sin(b.yaw) * .8, z = b.p[2] - Math.cos(b.yaw) * .8;
      E.planted.push({ x, z, y: groundAt(x, z), look: treeLookAt(x, z), day: G.day || 1, yaw: Math.random() * 6.28 });
      E.seeds--;
      const n = SEED.seeds - E.seeds;
      G.quests.set('seeds', { n });
      if (!E.seeds) G.quests.done('seeds', `All ${SEED.seeds} planted.`);
      H.tally(`A seed planted (${n} of ${SEED.seeds})`, 'seed');
      G.emit('planted', n);
    },
  };
  // a planted tree's height now (m), and whether it is grown enough to perch on
  const tall = p => { const age = (G.day || 1) - p.day; return age < GROW_DAYS.sapling ? .35 : age < GROW_DAYS.young ? .9 + age * .2 : age < GROW_DAYS.tree ? 2.6 + (age - 8) * .14 : 7; };
  env.solids.push((x, z, r, out) => {
    for (const p of E.planted) {
      const h = tall(p); if (h < 6 || Math.abs(wrapX(p.x - x)) > r + 2 || Math.abs(p.z - z) > r + 2) continue;
      out.push({ x: p.x, z: p.z, r: .4, y0: p.y - 1, top: p.y + h * .95, perch: { x: p.x, y: p.y + h * .95, z: p.z, top: true } });
    }
  });

  // ---- the Map, the compass ----------------------------------------------------------------------
  G.mapPlaces = (prev => () => [...(prev?.() || []),
    ...Object.values(E.lit).map(l => ({ x: l.x, z: l.z, name: l.name, note: `Lit again on day ${l.day}.`, col: '#d8a23a', rank: 2 })),
    ...Object.entries(E.homes).map(([k, h]) => ({ x: h.cx, z: h.cz, name: h.name, note: `${cap(TREASURES[k][0].replace(/^(A|An|The) /, ''))}: home again on day ${h.day}.`, col: '#c08a4a', rank: 1 })),
    ...E.planted.filter(p => tall(p) >= 6).map(p => ({ x: p.x, z: p.z, name: 'A tree you planted', note: `Planted on day ${p.day}.`, col: '#5f8a45', rank: 1 })),
  ])(G.mapPlaces);
  // a lit lamp shows out at sea or at night, from far off (the keeper's set: the dark ones too, sys/finds.js)
  (G.marks ||= []).push(() => {
    const out = [], sea = height(b.p[0], b.p[2]) < WATER, night = (G.light?.daylight ?? 1) < .45;
    if (sea || night) for (const id in E.lit) { const l = E.lit[id], d = d2(l.x, l.z); if (d > 200 && d < 9000) out.push(['lamp', l.x, l.z, l.name]); }
    return out;
  });

  // ---- making them ----------------------------------------------------------------------------
  const planted = new Set();
  const shapeOf = look => { const n = 'plant_' + look; if (!planted.has(n)) { planted.add(n); R.shape(n, TREE_LOOKS[look].near()); } return n; };
  let near = [], nearT = 0, dawn = G.tod, tick = 0;
  const tone = (f, dur, vol, lp) => G.audio.tone?.({ f, dur, vol, lp });
  G.dev?.add({ id: 'lamps', area: 'World', round: 'Gameplay 10-26 Q1', title: 'Light the dark lamps', how: 'A part of a lamp (the lens or the key) lies on every lighthouse gallery. Take it: Journal > Quests shows the dark lighthouse missing it. Land on that gallery: lit, with a beam at night and a compass mark at sea. Go puts you on the nearest gallery.',
    go: () => { const l = landmarksNear(b.p[0], b.p[2], 20000).filter(l => l.kind === 'lighthouse').sort((p, q) => d2(p.x, p.z) - d2(q.x, q.z))[0]; if (!l) return H.reply('No lighthouse near', 2); G.travelTo(l.x + 30, l.z, () => { b.state = 'fly'; b.p = [l.x + 8, l.y + 21, l.z]; b.yaw = -Math.PI / 2; b.s = 4; }); } });
  G.dev?.add({ id: 'home', area: 'World', round: 'Gameplay 10-26 Q2', title: 'Bring a treasure home', how: 'Take a starred treasure (by a village well, a farm door): a name is scratched on it. Carry it to that place and land: a window lit at night, and the bell rings at dawn, the sheep bell in the wind, the watch ticks.' });
  G.dev?.add({ id: 'seedtin', area: 'World', round: 'Gameplay 10-26 Q5', title: 'The seed tin: plant native trees', how: 'A bottle note (the seed vault) leads to a tin far north. Then, on open ground, the action button plants a seed: the tree that grows wild there, a sapling next day, young in a season, a perch in a year. Go gives you the tin.',
    go: () => { if (!E.tin) takeTin(); else E.seeds = SEED.seeds; } });

  return {
    id: 'errands',
    update(dt) {
      const h = G.held?.();
      if ((nearT -= dt) <= 0) { nearT = 1; near = landmarksNear(b.p[0], b.p[2], 120).filter(l => l.kind === 'lighthouse'); }
      // landing on a gallery with the part its lamp is missing
      if (h && PART[h.kind] && b.state === 'perch' && !(b.settle > 0)) for (const l of near) {
        const id = 'k' + l.id;
        if (!E.lit[id] && needs(id) === h.kind && Math.hypot(b.p[0] - l.x, b.p[2] - l.z) < 3.5 && Math.abs(b.p[1] - (l.y + 18.8)) < 1.5) { light(l, h); break; }
        if (!E.lit[id] && needs(id) !== h.kind && Math.hypot(b.p[0] - l.x, b.p[2] - l.z) < 3.5 && !G.flags['wrongpart' + id]) { G.flags['wrongpart' + id] = 1; H.reply(`This lamp has its ${h.kind === 'lens' ? 'lens' : 'key'}: it is missing the other part`, 3.5); }
      }
      // landing at a treasure's home with it
      if (h && (b.state === 'ground' || b.state === 'perch') && !(b.settle > 0)) {
        const q = G.quests.get(h.quest);
        if (q?.home && !q.done && d2(q.home.x, q.home.z) < 55) home(h, q);
      }
      // the seed tin, on the hill
      if (!E.tin && G.quests.get('seedtin') && b.state !== 'fly') { const t = tinAt(); if (d2(t.x, t.z) < SEED.near) takeTin(); }
      // the homes' sounds: the handbell at dawn, the sheep bell and the whistle in the wind, the watch ticking
      const wind = (G.windK ?? .3) + (G.gustWind || 0) * 1.5, dawnNow = dawn < .25 && G.tod >= .25; dawn = G.tod;
      for (const k in E.homes) {
        const o = E.homes[k], d = d2(o.x, o.z);
        if (k === 'bell' && dawnNow && d < 1500) for (let i = 0; i < 5; i++) G.audio.tone?.({ f: G.audio.hz?.(0) || 520, dur: 2.4, vol: .05 * (1 - d / 1500), delay: i * .7, lp: 3000 });
        if (k === 'sheepbell' && d < 500 && Math.random() < dt * wind * .3) tone(G.audio.hz?.(-5) || 330, 1.2, .04 * (1 - d / 500), 1800);
        if (k === 'whistle' && d < 300 && (G.gustWind || 0) > .2 && Math.random() < dt * .4) tone(G.audio.hz?.(12) || 1400, 1.4, .02 * (1 - d / 300), 5000);
        if (k === 'watch' && d < 25 && b.state !== 'fly' && (tick -= dt) <= 0) { tick = 1; tone(3200, .015, .015, 6000); }
      }
    },
    scene(S) {
      const cam = S.cam, night = 1 - (G.light?.daylight ?? 1), vis = (x, z, r) => Math.abs(wrapX(x - cam[0])) < r && Math.abs(z - cam[2]) < r;
      // a lit lamp: the lantern glowing, and at night flashing as it turns
      for (const id in E.lit) {
        const l = E.lit[id]; if (!vis(l.x, l.z, 9000)) continue;
        const y = l.y + 20.2;
        // the lamp turns: it flashes as the beam sweeps past you (no beam drawn, only the flash)
        const a = G.t * .7 + l.x, toCam = Math.atan2(cam[2] - l.z, wrapX(cam[0] - l.x)), face = Math.max(0, Math.cos(a - toCam)) ** 12;
        S.motes.push(l.x, y, l.z, 1, .92, .62, 2.5 + night * (3 + face * 9));
      }
      // a home: what was carried there, by the door; a window lit at night
      for (const k in E.homes) {
        const o = E.homes[k]; if (!vis(o.x, o.z, 1500)) continue;
        if (vis(o.x, o.z, 160)) (S.props['af_' + k] ||= []).push(o.x, o.y + .01, o.z, 1.5, 0, .5, 0, 0);
        if (night > .35) S.motes.push(o.cx, groundAt(o.cx, o.cz) + 2.2, o.cz, 1, .8, .45, 4 * night);
      }
      // the trees you planted, growing
      for (const p of E.planted) if (vis(p.x, p.z, 500)) (S.props[shapeOf(p.look)] ||= []).push(p.x, p.y - .05, p.z, tall(p), p.yaw, .5, 0, 0);
      // the tin, waiting by its cairn
      if (!E.tin && G.quests?.get('seedtin')) { const t = tinAt(); if (vis(t.x, t.z, 200)) { (S.props.af_tin ||= []).push(t.x, t.y + .01, t.z, 1.6, .4, .5, 0, 0); (S.props.lm_cairn ||= []).push(t.x + 1.4, t.y - .3, t.z + .6, .8, 0, .5, 0, 0); } }
    },
    save: () => E,
    load(o) { Object.assign(E, o || {}); E.threads ||= {}; Object.assign(T, E.threads); E.threads = T; },
  };
}
