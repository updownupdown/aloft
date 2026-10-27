// The ocean made readable from the sky (O1 to O6 of the gameplay study; James, 2026-10-26: "when
// traversing the ocean, we could have clearer paths/winds?"). Crossings are where players got lost.
// - Sea roads (O1): each ocean has a way across, along real routes birds and boats took (the westerlies
//   from Newfoundland by the Azores to Ireland, the trade winds from Cape Verde to Brazil, the island
//   road down the Mediterranean...). Along a road: a line of small clouds, a drifting log to rest on
//   every few km, lines of shearwaters, a ring course now and then. Stray and the signs thin out.
// - The far shore and the next rest on the compass (O2): out of sight of land the compass shows which
//   way land is (the road's end when on one), and when the wings are low the nearest rest ahead. On a
//   road, it is a quest you follow (Journal > Quests > Crossings), so the next step names the way.
// - A cloud over every island (O3), seen long before the land, as the navigators of the Pacific read them.
// - Ring courses across the sea (O4): along the roads, climbing, each ring a little wing back; the
//   songs of the sea birds tell where one starts (sys/lore.js), and then it shows from far off.
// - Follow the birds (O5): fly in behind a shearwater and its wake rests your wings.
// - Landfall (O6): reaching the far shore is remembered (Journal > Places > Crossings); each ocean's
//   first crossing is worth a feather.
import { height, WATER, wrapX, toXZ, ih, islesNear, regionAt, env } from '../world.js';
import { coastDist, oceanAt, OCEANS } from '../earth.js';
import { journal, esc } from '../journal.js';

// [id, name, which way, where it ends, [lat, lon]...]
const ROADS = [
  ['westerlies', 'the westerlies road', 'east', 'Ireland', [[47.6, -52.7], [45, -41], [41, -31], [38.7, -27.2], [44, -18], [49.5, -11.5], [51.8, -10.2]]],
  ['trades', 'the trade wind road', 'south-west', 'the coast of Brazil', [[14.7, -17.6], [15, -23.5], [8, -29], [1, -32], [-5.8, -35.1]]],
  ['islands', 'the island road', 'east', 'Cyprus', [[39.4, -.3], [39.6, 2.7], [39.2, 9.1], [38.1, 13.4], [36.5, 18], [35.3, 25.1], [34.8, 32.9]]],
  ['monsoon', 'the monsoon road', 'east', 'Sri Lanka', [[-4, 39.7], [-4.6, 55.5], [-.6, 64], [3.2, 73.2], [6.9, 79.8]]],
  ['albatross', 'the albatross road', 'west', 'Kamchatka', [[59.5, -151.5], [55, -162], [52, -176], [52.5, 173], [53, 158.6]]],
  ['polynesia', 'the long island road', 'north-east', 'the Marquesas', [[-36.8, 174.8], [-29, -178], [-21.1, -175.2], [-13.8, -172], [-21.2, -159.8], [-17.6, -149.4], [-9, -140]]],
  ['tasman', 'the Tasman road', 'east', 'New Zealand', [[-33.9, 151.3], [-35, 160], [-36, 168], [-36.8, 174.6]]],
  ['farsouth', 'the far south road', 'west', 'the Plate', [[-34.4, 18.4], [-36, 5], [-37.1, -12.3], [-36, -30], [-34.9, -56]]],
];
const SEA = { cloud: 520, cloudY: 300, rest: 2400, flocks: 3, flockV: 12, course: 6000, rings: 7, ringGap: 260, ringR: 7, near: 2500, far: 800, show: 5000 };   // far: out of sight of land (coastDist, m; the deep ocean reads 2 to 3 km)
const cap = s => s[0].toUpperCase() + s.slice(1);

// a road's points in the world, unwrapped along it, and how far along each one is
function build([id, name, way, end, ll]) {
  const P = [];
  for (const [la, lo] of ll) { const [x, z] = toXZ(la, lo); const q = P[P.length - 1]; P.push({ x: q ? q.x + wrapX(x - q.x) : x, z }); }
  let s = 0; P.forEach((p, i) => { if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.s = s; });
  return { id, name, way, end, P, len: s };
}
// the point a distance s along a road, and its heading
function at(R, s) {
  const P = R.P; s = Math.max(0, Math.min(R.len, s));
  let i = 1; while (i < P.length - 1 && P[i].s < s) i++;
  const a = P[i - 1], c = P[i], t = (s - a.s) / (c.s - a.s || 1), dx = (c.x - a.x) / (c.s - a.s || 1), dz = (c.z - a.z) / (c.s - a.s || 1);
  return { x: wrapX(a.x + (c.x - a.x) * t), z: a.z + (c.z - a.z) * t, dx, dz };
}
// the nearest point of a road to (x, z): how far along, how far off
function onRoad(R, x, z) {
  let best = { s: 0, d: 1e9 };
  const P = R.P;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], c = P[i], ux = c.x - a.x, uz = c.z - a.z, l2 = ux * ux + uz * uz || 1, px = a.x + wrapX(x - a.x);
    const t = Math.max(0, Math.min(1, ((px - a.x) * ux + (z - a.z) * uz) / l2)), d = Math.hypot(px - a.x - ux * t, z - a.z - uz * t);
    if (d < best.d) best = { s: a.s + Math.sqrt(l2) * t, d };
  }
  return best;
}

export function oceanSystem(G) {
  const b = G.b, H = G.hud;
  const O = { revealed: {}, crossings: [], crossed: {}, courses: {} };
  let roads = null;
  const R = () => roads ||= ROADS.map(build);
  const d2 = (x, z) => Math.hypot(wrapX(x - b.p[0]), z - b.p[2]);
  const wet = (x, z) => height(x, z) < -3;

  // ---- what lies along the roads, near a point ------------------------------------------------------
  // rest logs every few km, a little off the line; ring courses every few km
  function along(r, x, z, reach, step, f) {
    const o = onRoad(r, x, z); if (o.d > reach + 200) return;
    for (let k = Math.floor((o.s - reach) / step); k <= Math.floor((o.s + reach) / step); k++) if (k >= 0 && k * step <= r.len) f(k, at(r, k * step));
  }
  function restsNear(x, z, reach) {
    const out = [];
    for (const r of R()) along(r, x, z, reach, SEA.rest, (k, p) => {
      const side = (ih(k, r.id.length, 901) - .5) * 140, q = { x: p.x - p.dz * side, z: p.z + p.dx * side, yaw: ih(k, 3, 902) * 6.28, id: r.id + k, s: 3.4 };
      if (wet(q.x, q.z) && Math.hypot(wrapX(q.x - x), q.z - z) < reach) out.push(q);
    });
    return out;
  }
  function coursesNear(x, z, reach) {
    const out = [];
    for (const r of R()) along(r, x, z, reach + SEA.ringGap * SEA.rings, SEA.course, (k, p0) => {
      if (k === 0) return;
      const id = r.id + ':' + k, rings = [];
      for (let i = 0; i < SEA.rings; i++) {
        const p = at(r, k * SEA.course + i * SEA.ringGap * (r.way === 'west' ? 1 : 1));
        if (!wet(p.x, p.z)) return;
        rings.push({ id: id + ':' + i, k: i, x: p.x, y: 22 + i * 14, z: p.z, r: SEA.ringR, yaw: Math.atan2(-p.dx, p.dz) });
      }
      out.push({ id, road: r, rings, x: rings[0].x, z: rings[0].z });
    });
    return out;
  }
  // the songs of the sea birds tell where a course starts (sys/lore.js)
  G.ocean = {
    roads: R,
    tell() {
      let best = null, bd = 15000;
      for (const c of coursesNear(b.p[0], b.p[2], 15000)) { if (O.revealed[c.id] || O.courses[c.id]) continue; const d = d2(c.x, c.z); if (d < bd) { bd = d; best = c; } }
      return best && { id: 'course:' + best.id, x: best.x, z: best.z, what: `a ring course over the sea, along ${best.road.name}`, road: best.id };
    },
    reveal(id) { O.revealed[String(id).replace(/^course:/, '')] = G.day || 1; },
  };

  // perched on a road's log: a hard rim and a spot to stand
  let rests = [], courses = [], flocks = [], isles = [], restT = 0, isleT = 0;
  env.solids.push((x, z, r, out) => {
    for (const o of rests) if (Math.abs(wrapX(o.x - x)) < r + 3 && Math.abs(o.z - z) < r + 3) {
      const bob = Math.sin(G.t * .9 + o.x) * .06;
      out.push({ x: o.x, z: o.z, r: .5, y0: -1, top: .06 + bob, perch: { x: o.x, y: .06 + bob + o.s * .06, z: o.z, top: true, a: o.yaw } });
    }
  });

  // ---- the shearwaters (O5) ----------------------------------------------------------------------------
  // a few lines of them on each road, going its way, low over the swell
  function flocksNear() {
    const out = [];
    for (const r of R()) {
      const o = onRoad(r, b.p[0], b.p[2]); if (o.d > 1800) continue;
      for (let f = 0; f < SEA.flocks; f++) {
        const s = ((G.clock * SEA.flockV + f * r.len / SEA.flocks) % r.len);
        if (Math.abs(s - o.s) > 1600) continue;
        for (let i = 0; i < 6; i++) {
          const p = at(r, s - i * 7), side = (i % 2 ? 1 : -1) * Math.min(i, 2) * 1.5;
          const x = p.x - p.dz * side, z = p.z + p.dx * side;
          if (wet(x, z)) out.push({ x, y: WATER + 6 + Math.sin(G.t * .6 + i) * 1.2, z, dx: p.dx, dz: p.dz, i });
        }
      }
    }
    return out;
  }

  // ---- crossings: setting out and landfall (O6) ---------------------------------------------------------
  let crossing = null, farT = 0;
  const sec = journal(G).section(46, 'Crossings');
  function drawCrossings() {
    const L = O.crossings;
    sec.count(L.length ? `${L.length}` : '');
    sec.body.innerHTML = L.length ? `<ul class="list3">${L.slice().reverse().map(c => `<li data-at="${Math.round(c.to[0])},${Math.round(c.to[1])}">${esc(cap(c.ocean))}: ${esc(c.fromName)} to ${esc(c.toName)}, ${c.km} km <small>Day ${c.day}${c.road ? `, by ${esc(c.road)}` : ''}</small></li>`).join('')}</ul>`
      : '<p>Fly out over the open sea and make landfall on the far side: each crossing is kept here. The sea roads show the way across: cloud lines, logs to rest on, shearwaters to follow.</p>';
  }
  G.menu.onOpen(drawCrossings);
  function landfall() {
    const c = crossing; crossing = null;
    const km = Math.round(d2(c.from[0], c.from[1]) / 100) / 10;
    if (km < 3) return;
    const ocean = OCEANS[c.ocean]?.name || 'the sea', toName = regionAt(b.p[0], b.p[2])?.name || G.placeWhere?.() || 'land';
    O.crossings.push({ ocean, from: c.from, to: [b.p[0], b.p[2]], fromName: c.fromName, toName, km, day: G.day || 1, road: c.road });
    if (!O.crossed[c.ocean]) { O.crossed[c.ocean] = G.day || 1; G.feather?.(`Crossed ${ocean}`); }
    G.emit('landfall', { ocean: c.ocean, km, road: c.road, oceans: Object.keys(O.crossed).length });
    H.name(`Landfall: ${cap(toName)}`, 'lands');
    H.say(`Across ${ocean}: ${km} km of open sea, and land again.`, { kind: 'event', secs: 6, icon: 'lands' });
    G.audio.chord?.() || G.audio.learned?.();
    for (const r of R()) { const q = G.quests.get('road:' + r.id); if (q && !q.done && d2(r.P[r.P.length - 1].x, r.P[r.P.length - 1].z) < 4000) G.quests.done(q.id, `Crossed on day ${G.day}.`); }
  }

  // ---- the compass and the next step (O2) ----------------------------------------------------------------
  let shore = null, shoreT = 0, road = null;
  function findShore() {
    // the nearest land: rays out to 25 km
    let best = null;
    for (const d of [2000, 4000, 7000, 11000, 16000, 25000]) {
      for (let a = 0; a < 24; a++) { const t = a / 24 * 6.283, x = b.p[0] + Math.cos(t) * d, z = b.p[2] + Math.sin(t) * d; if (height(x, z) > 1) { best = [x, z]; break; } }
      if (best) break;
    }
    return best;
  }
  (G.marks ||= []).push(() => {
    const out = []; if (!crossing || farT < 2) return out;
    if (road) { const e = road.r.P[road.r.P.length - 1]; out.push(['shore', e.x, e.z, cap(road.r.end)]); const p = at(road.r, road.s + (road.r.way === 'west' ? 1 : 1) * 1500); out.push(['road', p.x, p.z, cap(road.r.name)]); }
    else if (shore) out.push(['shore', shore[0], shore[1], 'Land']);
    if ((b.stamina ?? 1) < .5) {
      const f = [Math.sin(b.yaw), -Math.cos(b.yaw)];
      const all = [...rests, ...(G.driftList?.().woods || []), ...(G.driftList?.().bergs || []), ...isles, ...[...(G.sea?.whales().values() || [])].filter(w => w.up)];
      let best = null, bd = 6000;
      for (const o of all) { const dx = wrapX(o.x - b.p[0]), dz = o.z - b.p[2], d = Math.hypot(dx, dz); if (d < bd && d > 30 && (dx * f[0] + dz * f[1]) / d > -.2) { bd = d; best = o; } }
      if (best) out.push(['rest', best.x, best.z, 'A rest']);
    }
    return out;
  });

  G.dev?.add({ id: 'searoads', area: 'World', round: 'Gameplay 10-26 O1 O2 O3 O5', title: 'Sea roads: cloud lines, logs, shearwaters, the way to land', how: 'Fly out along a sea road (the westerlies from Newfoundland, the island road down the Mediterranean...): a line of small clouds, a log every 2.4 km, lines of shearwaters (tuck in behind one: its wake rests your wings). Out of sight of land the compass shows land and, wings low, the nearest rest. Islands wear a cloud. Go puts you at the start of the nearest road.',
    go: () => { let best = null, bd = 1e9; for (const r of R()) { const d = d2(r.P[0].x, r.P[0].z); if (d < bd) { bd = d; best = r; } } const p = at(best, 2500); b.state = 'fly'; b.p = [p.x, 40, p.z]; b.yaw = Math.atan2(p.dx, -p.dz); b.s = 11; b.gamma = 0; b.vy = 0; } });
  G.dev?.add({ id: 'seacourses', area: 'World', round: 'Gameplay 10-26 O4 O6', title: 'Ring courses across the sea, and landfall', how: 'Every 6 km along a sea road, seven rings climbing toward the sky river: each gives a little wing back. A sea bird\'s song tells where one starts. Make landfall on the far shore: Journal > Places > Crossings, a feather for each ocean\'s first.' });

  // ---- the frame --------------------------------------------------------------------------------------
  let lastRing = null;
  return {
    id: 'ocean',
    update(dt) {
      const sea = coastDist(b.p[0], b.p[2]), out = sea < -SEA.far;
      if ((restT -= dt) <= 0) {
        restT = 1;
        rests = sea < 0 ? restsNear(b.p[0], b.p[2], SEA.show) : [];
        courses = sea < 0 ? coursesNear(b.p[0], b.p[2], 3000) : [];
        // which road you are on, and the quest of it
        road = null;
        if (sea < -300) for (const r of R()) { const o = onRoad(r, b.p[0], b.p[2]); if (o.d < SEA.near && (!road || o.d < road.d)) road = { r, ...o }; }
        if (road && out && !G.quests.get('road:' + road.r.id)?.done) {
          const e = road.r.P[road.r.P.length - 1];
          if (!G.quests.get('road:' + road.r.id)) G.quests.set('road:' + road.r.id, { group: 'sea', icon: 'ring', title: cap(road.r.name), text: `A way across the sea, ${road.r.way} to ${road.r.end}: cloud lines, logs to rest on, shearwaters going the same way.`, x: wrapX(e.x), z: e.z });
        }
        // setting out: far enough from land, a crossing begins
        if (out && !crossing) { const o = oceanAt(b.p[0], b.p[2]); crossing = { from: [b.p[0], b.p[2]], ocean: o?.key || 'sea', fromName: regionAt(b.p[0], b.p[2])?.name || G.lastLand || 'the coast', road: road?.r.name }; }
        if (sea > 0) G.lastLand = regionAt(b.p[0], b.p[2])?.name || G.lastLand;
        if (crossing && road) crossing.road = road.r.name;
      }
      farT = out ? farT + dt : 0;
      if ((shoreT -= dt) <= 0) { shoreT = 4; shore = out && !road ? findShore() : null; }
      if ((isleT -= dt) <= 0) { isleT = 3; isles = islesNear(b.p[0], b.p[2], 9000).filter(I => I.r > 50); }
      // landfall: down on land again after a crossing
      if (crossing && (b.state === 'ground' || b.state === 'perch') && sea > 0 && height(b.p[0], b.p[2]) > WATER) landfall();
      if (crossing && sea > 200) crossing = null;   // back to land in the air without landing: a crossing still, once you come down
      // flocks: in their wake, the wings rest
      flocks = sea < 0 ? flocksNear() : [];
      if (b.state === 'fly') for (const f of flocks) {
        const rx = wrapX(b.p[0] - f.x), rz = b.p[2] - f.z, along = rx * f.dx + rz * f.dz, side = Math.abs(rx * -f.dz + rz * f.dx), dy = b.p[1] - f.y;
        if (along < -2 && along > -11 && side < 4.5 && Math.abs(dy) < 3) {
          b.slip = Math.max(b.slip || 0, .8); b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + .1 * dt);
          if (!G.flags.shearwater) { G.flags.shearwater = 1; H.tally('In the shearwaters\' wake: wings rest', 'glide'); }
          break;
        }
      }
      // the sea rings
      if (b.state === 'fly' && b.prev) for (const c of courses) for (const r of c.rings) {
        if (lastRing === r.id) continue;
        const n = [-Math.sin(r.yaw), 0, Math.cos(r.yaw)];
        const d0 = wrapX(b.prev[0] - r.x) * n[0] + (b.prev[2] - r.z) * n[2], d1 = wrapX(b.p[0] - r.x) * n[0] + (b.p[2] - r.z) * n[2];
        if (Math.sign(d0) === Math.sign(d1)) continue;
        if (Math.hypot(wrapX(b.p[0] - r.x) - n[0] * d1, b.p[1] - r.y, b.p[2] - r.z - n[2] * d1) > r.r) continue;
        lastRing = r.id;
        b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + .05); b.s = Math.min(40, b.s + 2);
        const A = G.audio, last = r.k === SEA.rings - 1;
        if (A.tone && A.hz) A.tone({ f: A.hz([0, 2, 4, 7, 9, 12, 14][r.k] - 12), dur: last ? 2.2 : 1.1, vol: .1, type: 'triangle' });
        if (last && !O.courses[c.id]) { O.courses[c.id] = G.day || 1; H.tally(`A sea course: seven rings along ${c.road.name}`, 'ring'); G.emit('seaCourse', c.id); const q = G.quests.get('tell:course:' + c.id); if (q) G.quests.done(q.id, 'Flown.'); }
      }
    },
    scene(S) {
      const cam = S.cam, vis = (x, z, r) => Math.abs(wrapX(x - cam[0])) < r && Math.abs(z - cam[2]) < r;
      const C = S.props.cloud ||= [];
      // a line of small clouds along each road near
      for (const r of R()) along(r, cam[0], cam[2], SEA.show, SEA.cloud, (k, p) => {
        if (ih(k, r.id.length, 903) < .25 || !wet(p.x, p.z)) return;
        const side = (ih(k, 5, 904) - .5) * 160;
        C.push(p.x - p.dz * side, SEA.cloudY + ih(k, 6, 905) * 50, p.z + p.dx * side, 22 + ih(k, 7, 906) * 16, ih(k, 8, 907) * 7, .75, 0, 0);
      });
      // a cloud standing over every island (O3)
      for (const I of isles) if (vis(I.x, I.z, 9000)) C.push(I.x, (I.H || 10) + 230, I.z, Math.min(90, 30 + I.r * .12), I.x * .01, .8, 0, 0);
      // the logs
      const D = S.props.drift ||= [];
      for (const o of rests) if (vis(o.x, o.z, 700)) D.push(o.x, Math.sin(G.t * .9 + o.x) * .06 - .02, o.z, o.s, o.yaw, .5, 0, 0);
      // the shearwaters, wings up and down
      for (const f of flocks) if (vis(f.x, f.z, 600)) (S.props[(Math.sin(G.t * 9 + f.i) > 0) ? 'gullU' : 'gullD'] ||= []).push(f.x, f.y, f.z, .9, Math.atan2(f.dz, f.dx), .5, 0, 0);
      // the sea rings: soft mist rings, seen from far once a song has told of them
      for (const c of courses) {
        const far = O.revealed[c.id] ? 2500 : 450;
        for (const r of c.rings) { const d = Math.hypot(wrapX(r.x - cam[0]), r.y - cam[1], r.z - cam[2]); if (d < far) (S.props.ringv ||= []).push(r.x, r.y, r.z, r.r, r.yaw, Math.min(1, .35 + (O.courses[c.id] ? 0 : .3)), 0, 0); }
      }
    },
    save: () => O,
    load(o) { Object.assign(O, o || {}); },
  };
}
