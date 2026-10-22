// The empty places people left (settle.js places them, ruinshapes.js builds them): drawing the
// farmsteads, villages, hamlets, folds and bridges, and the things left lying about them.
// A glint in the grass by a doorstep, the well, the barn door or up on a lighthouse gallery:
// land beside it (or skim low over it) and you take it. Trinkets brighten your nest (they are
// set round its rim when you next land there) and count as keepsakes, for a mate and for the
// raven's hoard; the treasures are one of a kind, and each tells a little of who lived here.
import { settlementsNear, bridgesNear, linesNear, DIM } from '../settle.js';
import { groundAt, height, ih } from '../world.js';
import * as M from './ruinshapes.js';
import * as RS from './railshapes.js';
import { railsNear } from '../rail.js';
import { wondersNear, WONDERS } from '../wonders.js';
import * as WS from './wondershapes.js';
import * as SS from './seashapes.js';
import { journal, esc } from '../journal.js';

const DRAW = 650, NEST_R = 3.2;
const cap = s => s[0].toUpperCase() + s.slice(1);

export function ruinsSystem(G) {
  const R = G.R, b = G.b;
  for (const v of [0, 1, 2]) for (const k of ['cottage', 'farmhouse', 'hut', 'chapel']) R.shape(`ru_${k}${v}`, M[k](v));
  for (const v of [0, 1]) { R.shape('ru_keeper' + v, M.keeper(v)); R.shape('ru_barn' + v, M.barn(v)); }
  for (const k of ['well', 'pump', 'cart', 'boat']) R.shape('ru_' + k, M[k]());
  for (const k in M.ARTEFACT_SHAPES) R.shape('af_' + k, M.artefactMesh(k));
  for (const k of [0, 1, 2]) R.shape('ru_pole' + k, M.pole(k));
  R.shape('ru_chime', M.chime()); R.shape('ru_spire0', M.spire());
  // wind chimes left on a few porches (B4): where one hangs, under the eave by the door
  const CHIMED = { cottage: 1, keeper: 1, farmhouse: 1 };
  const chimeAt = bd => {
    if (!CHIMED[bd.kind] || bd.v > 1 || bd.under || ih(Math.round(bd.x), Math.round(bd.z), 720) > .3) return null;
    const d = DIM[bd.kind], u = 1.4, w = d.W / 2 + .45, c = Math.cos(bd.yaw), s = Math.sin(bd.yaw);
    return [bd.x + c * u - s * w, bd.y + d.wall - .25, bd.z + s * u + c * w];
  };
  // a chime rings in the Valley's key (audio.hz: the pentatonic the songs use, an octave down),
  // more often in wind and gusts, softer with distance
  const CHIME_ST = [-12, -10, -8, -5, -3, 0];
  function ring(p, d) {
    const A = G.audio; if (!A.tone || !A.hz) return;
    const vol = .05 * (1 - d / 45) ** 2, n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = A.hz(CHIME_ST[Math.floor(Math.random() * CHIME_ST.length)]), at = i * (.18 + Math.random() * .35);
      A.tone({ f, dur: 3.2, vol, delay: at, lp: 2600 });
      A.tone({ f: f * 2.76, dur: .9, vol: vol * .22, delay: at });
    }
  }
  let chimes = [];
  const wireOf = new Map();
  const wireShape = L => { let m = wireOf.get(L.id); if (!m) { m = M.wires(L); m.shape = 'ru_wire_' + L.id; R.shape(m.shape, m.tris); wireOf.set(L.id, m); } return m; };
  // the railway (B2): track pieces and viaducts each built once, as they come near
  for (const v of [0, 1]) R.shape('ru_car' + v, RS.carriage(v));
  R.shape('ru_station', RS.station()); R.shape('ru_portal', RS.portal());
  const railOf = new Map();
  const railShape = (o, make) => { let m = railOf.get(o.id); if (!m) { m = make(o); m.shape = 'ru_rail_' + o.id; R.shape(m.shape, m.tris); railOf.set(o.id, m); } return m; };
  const bridgeOf = new Map();
  const bridgeShape = g => { let m = bridgeOf.get(g.id); if (!m) { m = M.bridge(g); m.shape = 'ru_bridge_' + g.id; R.shape(m.shape, m.tris); bridgeOf.set(g.id, m); } return m; };

  // ---- what you have found ------------------------------------------------------------------
  const St = { found: new Set(), treasures: {}, trinkets: [], kept: [], nest: [] };   // kept: waiting to go in the nest
  G.relics = St;
  const TKEYS = Object.keys(M.TRINKETS);
  // the things lying at a settlement's spots (a treasure already found leaves a trinket instead)
  function artefactsOf(S) {
    const out = [];
    S.spots.forEach((p, i) => {
      const id = S.id + '_' + i, hx = Math.round(p.x * 7), hz = Math.round(p.z * 7);
      if (St.found.has(id)) return;
      const high = p.what === 'gallery' || p.what === 'walk';
      if (!high && ih(hx, hz, 700) > .6) return;
      let kind = null;
      const cand = Object.keys(M.TREASURES).filter(k => M.TREASURES[k][1].includes(S.kind));
      if (cand.length && ih(hx, hz, 701) < (high ? .85 : .22)) kind = cand[Math.floor(ih(hx, hz, 702) * cand.length)];
      if (kind && St.treasures[kind]) kind = null;
      if (!kind) { if (high && ih(hx, hz, 704) < .5) return; kind = TKEYS[Math.floor(ih(hx, hz, 703) * TKEYS.length)]; }
      out.push({ id, kind, treasure: !!M.TREASURES[kind], x: p.x, y: high ? p.y : groundAt(p.x, p.z), z: p.z, yaw: ih(hx, hz, 705) * 6.283, place: S.name, sk: S.kind });
    });
    return out;
  }
  const say = (msg, secs = 4.5) => G.hud.say(msg, { kind: 'event', secs, icon: 'keepsake' });
  function take(a) {
    St.found.add(a.id);
    const name = a.treasure ? M.TREASURES[a.kind][0] : M.TRINKETS[a.kind];
    if (a.treasure) {
      St.treasures[a.kind] = { day: G.day, place: a.place };
      G.audio.learned?.();
      say(`A treasure: ${name.replace(/^A |^The /, m => m.toLowerCase())}. ${M.TREASURES[a.kind][2]}`, 7);
    } else {
      St.trinkets.push(a.kind); G.audio.feather?.();
      say(`${cap(name)}, left by people long gone. ${G.nest ? 'Take it home: it will brighten your nest.' : 'Keep it for a nest one day.'}`);
    }
    St.kept.push(a.kind);
    G.hud.did('relic');
    // a keepsake too: for a mate's eye (story.js) and the raven's hoard (life.js)
    G.story?.keepsakes?.push(a.treasure ? name.toLowerCase() : name.replace(/^an? /, ''));
    G.emit('keepsake', { kind: a.kind, artefact: true });
    G.emit('artefact', a);
    near = near.filter(o => o !== a);
  }
  // landing at the nest: what you carry is set round its rim
  G.on('land', kind => {
    const n = G.nest;
    if (kind === 'perch' && n && St.kept.length && Math.hypot(b.p[0] - n.x, b.p[1] - n.y, b.p[2] - n.z) < NEST_R) {
      const k = St.kept.splice(0), names = k.map(x => M.TREASURES[x] ? M.TREASURES[x][0].toLowerCase() : M.TRINKETS[x]);
      St.nest.push(...k);
      say(`You set ${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0]} into your nest.`, 4);
    }
    if (kind === 'ground') for (const a of near) if (Math.hypot(a.x - b.p[0], a.z - b.p[2]) < 3.5 && Math.abs(a.y - b.p[1]) < 2) { take(a); break; }
  });
  G.on('newYear', () => { St.nest = []; });   // a new nest each year (the old one's finery is gone)

  G.hud.tip('relic', () => near.some(a => {
    const d = Math.hypot(a.x - b.p[0], a.z - b.p[2]);
    return b.state === 'fly' ? d < 45 && b.p[1] - a.y < 35 : d < 18;
  }), 'Something glints by the old walls: a thing people left. Land beside it, or skim low over it, to take it. Trinkets brighten a nest; some things are treasures.');

  // ---- the wonders (wonders.js): drawn from far off, each mesh built when first near ---------
  const WDRAW = 2400, wonderOf = new Map();
  const WMESH = { eiffel: 'eiffel', liberty: 'liberty', giza: 'giza', colosseum: 'colosseum', taj: 'taj', opera: 'opera', redeemer: 'redeemer', stonehenge: 'stonehenge', pisa: 'pisa', picchu: 'picchu', angkor: 'angkor', moai: 'moai' };
  const wonderShape = W => {
    let m = wonderOf.get(W.id); if (m) return m;
    if (W.key === 'greatwall') { m = WS.greatWall(W.path); m.shape = 'wd_' + W.key; R.shape(m.shape, m.tris); }
    else { m = { shape: 'wd_' + W.key, at: null }; R.shape(m.shape, W.key === 'goldengate' ? WS.goldenGate(W.span || 600) : WS[WMESH[W.key]]()); }
    wonderOf.set(W.id, m); return m;
  };
  // the regional styles (settle.js styleOf), each built when first seen; the things at sea
  const STYLED = new Set(['cottage', 'farmhouse', 'hut', 'keeper']), styledOf = new Set();
  const houseShape = (bd, v) => {
    if (!bd.style || bd.style === 'stone' || !STYLED.has(bd.kind)) return `ru_${bd.kind}${v}`;
    const name = `ru_${bd.kind}${v}_${bd.style}`; if (!styledOf.has(name)) { styledOf.add(name); R.shape(name, M.styled(bd.kind, v, bd.style)); } return name;
  };
  for (const k of ['freighter', 'yacht', 'buoy', 'rig']) R.shape('sea_' + k, SS[k]());
  R.shape('sea_rocklight', SS.rockLight());
  let wonders = [];
  St.wonders = {};
  function seeWonders() {
    for (const W of wonders) if (!St.wonders[W.key] && Math.hypot(W.x - b.p[0], W.z - b.p[2]) < (W.key === 'greatwall' ? 900 : 260))
      St.wonders[W.key] = { day: G.day || 1 };
  }

  // ---- the journal ----------------------------------------------------------------------------
  const sec = journal(G).section(42, 'Things people left'), wsec = journal(G).section(43, 'Wonders');
  sec.body.innerHTML = '<p class="j-relic"></p><ul class="list3"></ul>';
  G.menu.onOpen(() => {
    const T = Object.keys(St.treasures), all = Object.keys(M.TREASURES).length;
    const counts = {}; for (const k of St.trinkets) counts[k] = (counts[k] || 0) + 1;
    const tr = Object.entries(counts).map(([k, n]) => n > 1 ? `${M.TRINKETS[k].replace(/^an? /, '')} ×${n}` : M.TRINKETS[k].replace(/^an? /, ''));
    sec.body.querySelector('.j-relic').textContent = (St.trinkets.length || T.length)
      ? `Treasures: ${T.length} of ${all}. Trinkets: ${tr.length ? tr.join(', ') : 'none yet'}.${St.nest.length ? ` In your nest: ${St.nest.length} of them.` : ''}${St.kept.length ? ` ${St.kept.length} waiting to go in a nest.` : ''}`
      : 'Nobody lives in the old farms and villages now. Things they left still glint by the doorsteps and wells: land beside one to take it.';
    wsec.body.innerHTML = `<p>${Object.keys(St.wonders).length} of ${Object.keys(WONDERS).length} found. People built them, long ago, where the old maps put them.</p><ul class="list3">` + Object.keys(WONDERS).map(k => St.wonders[k]
      ? `<li>${esc(WONDERS[k][0])} <small>${esc(WONDERS[k][5])} Found on day ${St.wonders[k].day}.</small></li>` : '<li class="j-dim">?</li>').join('') + '</ul>';
    sec.body.querySelector('ul').innerHTML = T.map(k => `<li>${esc(M.TREASURES[k][0])} <small>${esc(M.TREASURES[k][2])} Found on day ${St.treasures[k].day}${St.treasures[k].place ? `, at ${esc(St.treasures[k].place)}` : ''}.</small></li>`).join('');
  });

  // the feature list (Settings > Dev tools): each with a Try it that flies you there
  const flyTo = (x, z, tx, tz, up = 30) => { b.state = 'fly'; b.p = [x, Math.max(height(x, z), 0) + up, z]; b.yaw = Math.atan2(tx - x, -(tz - z)); b.s = 12; b.gamma = 0; };
  const nearest = (L, f = o => o) => L.sort((p, q) => Math.hypot(f(p).x - b.p[0], f(p).z - b.p[2]) - Math.hypot(f(q).x - b.p[0], f(q).z - b.p[2]))[0];
  const toward = (o, back = 60, up = 30) => { const a = Math.atan2(o.z - b.p[2], o.x - b.p[0]); flyTo(o.x - Math.cos(a) * back, o.z - Math.sin(a) * back, o.x, o.z, up); };
  const dev = [
    { id: 'r8-poles', title: 'Pole lines along the old tracks', how: 'Follow a long track: leaning poles with sagging wires, some fallen. Perch on top to watch the verge.', round: 'R8 B1',
      go: () => { const o = nearest(linesNear(b.p[0], b.p[2], 4000).flatMap(L => L.poles.filter(o => o.state === 0))); if (o) toward(o, 40, 14); } },
    { id: 'r8-railway', title: 'The old railway: cuttings, viaducts, a station, carriages', how: 'Find the grassed-over line (Map: Landmarks). Fly through a viaduct’s arches; perch on a carriage.', round: 'R8 B2',
      go: () => { const R8 = railsNear(b.p[0], b.p[2], 6000), o = nearest(R8.flatMap(R => R.station ? [R.station] : R.lms)) || nearest(R8.flatMap(R => R.vias.map(v => v.pts[v.pts.length >> 1]))); if (o) toward(o, 90, 35); } },
    { id: 'r8-drowned', title: 'The drowned village: a spire out of a lake', how: 'Perch on the weathervane; in late summer the low water shows roofs and walls.', round: 'R8 B3',
      go: () => { const S = nearest(settlementsNear(b.p[0], b.p[2], 9000, false).filter(S => S.kind === 'drowned')); if (S) toward(S, 70, 30); } },
    { id: 'r8-chimes', title: 'Wind chimes on a few porches', how: 'Land by a cottage door with a chime: it rings in gusts, in the Valley’s key.', round: 'R8 B4',
      go: () => { const bd = nearest(settlementsNear(b.p[0], b.p[2], 4000, false).flatMap(S => S.build.filter(chimeAt))); if (bd) { const c = chimeAt(bd); toward({ x: c[0], z: c[2] }, 35, 10); } } },
    { id: 'wonders', title: 'Wonders where they stood on Earth', how: 'Find the Eiffel Tower, the Great Wall, the Statue of Liberty and more; Journal > Wonders lists them.', round: 'Earth',
      go: () => { const L = Object.keys(WONDERS).map(k => wondersNear(b.p[0], b.p[2], 1e5).find(W => W.key === k)).filter(Boolean), W = nearest(L); if (W) toward(W, 260, 70); } },
    { id: 'regional-ruins', title: 'Ruins built the way each region built', how: 'Whitewashed crofts in Scotland and Ireland, log cabins in the north, stilt houses in swamps, mud brick in dry lands, clapboard in America.', round: 'Earth',
      go: () => { const S = nearest(settlementsNear(b.p[0], b.p[2], 6000, false).filter(S => S.style && S.style !== 'stone')); if (S) toward(S, 80, 25); } },
    { id: 'sea-derelicts', title: 'Things left at sea: wrecks, bell buoys, rock lights, rigs', how: 'Fly out over the sea: rest on a wreck or a rig; a bell buoy rings in the swell.', round: 'Earth',
      go: () => { const S = nearest(settlementsNear(b.p[0], b.p[2], 9000, false).filter(S => S.kind === 'derelict')); if (S) toward(S, 90, 25); } },
  ];
  for (const f of dev) G.dev?.add({ area: 'World', ...f });

  let sets = [], bridges = [], lines = [], rails = [], near = [], setT = 0, nearT = 0;
  return {
    id: 'ruins',
    update(dt) {
      if ((setT -= dt) <= 0) { setT = 1; sets = settlementsNear(b.p[0], b.p[2], DRAW + 50); bridges = bridgesNear(b.p[0], b.p[2], DRAW); lines = linesNear(b.p[0], b.p[2], DRAW); rails = railsNear(b.p[0], b.p[2], DRAW); wonders = wondersNear(b.p[0], b.p[2], WDRAW); seeWonders(); }
      // a bell buoy near you rings as the swell rocks it, low and slow
      for (const T of sets) if (T.what === 'buoy') { const d = Math.hypot(T.x - b.p[0], T.y - b.p[1], T.z - b.p[2]); if (d < 90 && Math.random() < dt * .25 && G.audio.tone && G.audio.hz) { const f = G.audio.hz(-24), v = .06 * (1 - d / 90) ** 2; G.audio.tone({ f, dur: 4.5, vol: v, lp: 1400 }); G.audio.tone({ f: f * 2.4, dur: 1.6, vol: v * .3 }); } }
      // chimes near you ring in the wind
      const wind = (G.windK ?? .3) + (G.gustWind || 0) * 1.5;
      for (const c of chimes) { const d = Math.hypot(c[0] - b.p[0], c[1] - b.p[1], c[2] - b.p[2]); if (d < 45 && Math.random() < dt * (.04 + wind * .5)) ring(c, d); }
      if ((nearT -= dt) <= 0) {
        nearT = .5; near = [];
        for (const S of sets) if (Math.hypot(S.x - b.p[0], S.z - b.p[2]) < 260) near.push(...artefactsOf(S));
        chimes = []; for (const S of sets) if (Math.hypot(S.x - b.p[0], S.z - b.p[2]) < 200) for (const bd of S.build) { const c = chimeAt(bd); if (c) chimes.push(c); }
      }
      // taking: standing or perched beside it, or plucked up skimming low over it
      for (const a of near) {
        const dx = a.x - b.p[0], dz = a.z - b.p[2], dy = b.p[1] - a.y, d = Math.hypot(dx, dz);
        if ((b.state === 'ground' || b.state === 'perch') && b.settle <= 0 && d < 1.9 && Math.abs(dy) < 1.5) { take(a); break; }
        if (b.state === 'fly' && d < 1.6 && dy > -.5 && dy < 2.2 && b.s < 24) { take(a); break; }
      }
      // the sun catches glass and brass: a glint now and then, seen from the air (not at night)
      const day = G.light?.daylight ?? 1;
      if (day > .35) for (const a of near) if (Math.random() < dt * .9 * day && Math.hypot(a.x - b.p[0], a.z - b.p[2]) < 120)
        G.part([a.x + (Math.random() - .5) * .3, a.y + .25, a.z + (Math.random() - .5) * .3], [0, .5, 0], .5, [1, .96, .8], a.treasure ? .11 : .08);
    },
    scene(S) {
      const cam = S.cam;
      for (const W of wonders) {
        if (Math.hypot(W.x - cam[0], W.z - cam[2]) > WDRAW + 600) continue;
        const m = wonderShape(W);
        if (m.at) (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[1], 1, 0, .5, 0, 0);
        else (S.props[m.shape] ||= []).push(W.x, W.y, W.z, 1, W.yaw, .5, 0, 0);
      }
      for (const T of sets) {
        if (T.kind === 'wonder' || Math.hypot(T.x - cam[0], T.z - cam[2]) > DRAW + 40) continue;
        if (T.kind === 'derelict') {   // a buoy rides the swell
          const bob = T.what === 'buoy' ? Math.sin(G.t * 1.1 + T.x) * .25 : 0;
          (S.props['sea_' + T.what] ||= []).push(T.x, T.y + bob, T.z, 1, T.yaw + (T.what === 'buoy' ? Math.sin(G.t * .7 + T.z) * .08 : 0), .5, 0, 0);
          continue;
        }
        for (const bd of T.build) {
          const v = bd.kind === 'barn' || bd.kind === 'keeper' ? Math.min(bd.v, 1) : bd.v, name = ['well', 'pump', 'cart', 'boat'].includes(bd.kind) ? 'ru_' + bd.kind : houseShape(bd, v);
          // the drowned cottages: only in summer, when the reservoir is low, do their roofs break the water
          (S.props[name] ||= []).push(bd.x, bd.under && G.season?.name !== 'summer' ? bd.y - 1.8 : bd.y, bd.z, 1, bd.yaw, .5, 0, 0);
          const c = Math.hypot(bd.x - cam[0], bd.z - cam[2]) < 160 && chimeAt(bd);   // turning a little in the wind
          if (c) (S.props.ru_chime ||= []).push(c[0], c[1], c[2], 1, bd.yaw + Math.sin(G.t * 1.3 + bd.x) * (.2 + (G.windK ?? .3) * .8), .5, 0, 0);
        }
      }
      // the pole lines: each pole near enough, and the wires of a line while any of it is close
      for (const L of lines) {
        let any = false;
        for (const o of L.poles) if (Math.abs(o.x - cam[0]) < DRAW && Math.abs(o.z - cam[2]) < DRAW) { any = true; (S.props['ru_pole' + o.state] ||= []).push(o.x, o.y, o.z, 1, o.yaw, .5, 0, 0); }
        if (any) { const m = wireShape(L); (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[1], 1, 0, .5, 0, 0); }
      }
      // the railway
      const close = (x, z, r = DRAW) => Math.abs(x - cam[0]) < r && Math.abs(z - cam[2]) < r;
      for (const T of rails) {
        for (const ch of T.chunks) { const p = ch.pts[ch.pts.length >> 1]; if (close(p.x, p.z, DRAW + 100)) { const m = railShape(ch, RS.track); (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[1], 1, 0, .5, 0, 0); } }
        for (const v of T.vias) if (v.pts.some(p => close(p.x, p.z, DRAW + 60))) { const m = railShape(v, RS.viaduct); (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[1], 1, 0, .5, 0, 0); }
        const st = T.station; if (st && close(st.x, st.z)) (S.props.ru_station ||= []).push(st.x, st.y, st.z, 1, st.yaw, .5, 0, 0);
        for (const c of T.cars) if (close(c.x, c.z)) (S.props['ru_car' + c.v] ||= []).push(c.x, c.y, c.z, 1, c.yaw, .5, 0, 0);
        for (const o of T.portals) if (close(o.x, o.z)) (S.props.ru_portal ||= []).push(o.x, o.y, o.z, 1, o.yaw, .5, 0, 0);
      }
      for (const g of bridges) { const m = bridgeShape(g); (S.props[m.shape] ||= []).push(m.at[0], 0, m.at[1], 1, 0, .5, 0, 0); }
      for (const a of near) if (Math.hypot(a.x - cam[0], a.z - cam[2]) < 160) (S.props['af_' + a.kind] ||= []).push(a.x, a.y + .01, a.z, 1.5, a.yaw, .5, 0, 0);
      // the nest's finery, round its rim
      const n = G.nest;
      if (n && St.nest.length) St.nest.slice(-10).forEach((k, i) => {
        const ang = i * 2.4 + .5;
        (S.props['af_' + k] ||= []).push(n.x + Math.cos(ang) * .3, n.y + .1, n.z + Math.sin(ang) * .3, .9, ang, .5, 0, 0);
      });
    },
    save: () => ({ found: [...St.found], treasures: St.treasures, trinkets: St.trinkets, kept: St.kept, nest: St.nest, wonders: St.wonders }),
    load(o) { St.found = new Set(o?.found || []); St.treasures = o?.treasures || {}; St.trinkets = o?.trinkets || []; St.kept = o?.kept || []; St.nest = o?.nest || []; St.wonders = o?.wonders || {}; },
  };
}
