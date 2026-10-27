// Hidden places, on by default, switch in Settings > Advanced > Hidden places (or ?hidden=1): a ledge behind
// the sheer waterfalls (fly through the curtain), rock shelters high in the ridges (a roof over a
// dry perch; roost there) and oases where date palms grow (a pool to drink from, reeds round it); the caves
// are sys/caves.js, found here too. All
// are pure functions of position, with no new terrain: the ledge and the shelter are hard shapes
// (world.js env.solids) the hawk lands on, the pool is drunk from like a rain pool (G.oases,
// food.js). What is found is kept under aloft.save3d, and listed in Journal > Places.
import { height, normalAt, landmarksNear, biomeAt, placeName, groundColour, env, WATER, ih } from '../world.js';
import { EARTH, latLon } from '../earth.js';
import { builder, blob, palm, reseed, rnd } from '../shapes.js';
import { store, TAU } from '../util.js';
import { pool } from './oceanshapes.js';
import { journal, esc } from '../journal.js';
import { CAVE_KINDS } from './caves.js';

const CELL = 2400, NCX = Math.round(EARTH.W / CELL);   // the cells the shelters and oases roll in; x wraps
const SHELTER_LANDS = new Set(['mountains', 'alpine', 'cliffs', 'fjord', 'canyon']);
const SH = { back: -3.2, front: 3.4, half: 3.8, roof: 3.2, roofTop: 4.5 };   // the shelter's frame (metres): x out of the mouth, z across, y up from the floor
const CURTAIN = 3.4;
// oases with date palms only where they grow: the Sahara, Arabia and on to the Persian deserts (keep the Earth real)
const palmLands = (x, z) => { const [la, lo] = latLon(x, z); return la > 14 && la < 36 && lo > -17 && lo < 63; };    // how far out from the face the curtain of a sheer fall hangs (lands.js fallsMesh)

// a box with jittered corners; each face its own colour (the two-sided shader paints back faces with
// the second colour, so a face's colour is given for both sides)
function box(B, x0, x1, y0, y1, z0, z1, col, j = .18) {   // j: how far the corners stray
  const P = {}; for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) P[x + '' + y + z] = [(x ? x1 : x0) + (rnd() - .5) * j, (y ? y1 : y0) + (rnd() - .5) * j * .5, (z ? z1 : z0) + (rnd() - .5) * j];
  const q = (a, b, c, d, k) => { B.tri(P[a], P[b], P[c], col[k]); B.tri(P[a], P[c], P[d], col[k]); };
  q('010', '011', '111', '110', 'top'); q('000', '100', '101', '001', 'bottom');
  q('100', '110', '111', '101', 'front'); q('000', '001', '011', '010', 'back');
  q('001', '101', '111', '011', 'right'); q('000', '010', '110', '100', 'left');
}
const ROCK = [.5, .48, .45], ROCK2 = [.43, .41, .38], DUST = [.52, .47, .4], DARK = [.15, .14, .13], DIM = [.24, .22, .2];
const all = c => ({ top: c, bottom: c, front: c, back: c, left: c, right: c });
function shelterMesh() {
  reseed(71); const B = builder(), r1 = [.5, .48, .45], r2 = [.44, .42, .39], in1 = [.27, .25, .23], in2 = [.21, .2, .18];
  box(B, SH.back, 3.0, -.9, 0, -3.4, 3.4, { ...all(ROCK2), top: DUST, bottom: DIM }, .5);                            // the floor shelf
  box(B, SH.back - .4, SH.front, SH.roof, SH.roofTop, -SH.half, SH.half, { ...all(r1), bottom: in2, front: r2 }, .6);  // the roof slab, dim beneath
  // the brow: lumps of rock on and over the roof's lip, and down its sides
  for (let i = 0; i < 7; i++) blob(B, SH.front - 1.2 + rnd() * 1.6, SH.roofTop - .3 + rnd() * .8, -SH.half + .6 + i * 1.15, 1.1 + rnd() * .5, i & 1 ? r1 : r2, r2, [1.2, .8, 1]);
  for (let i = 0; i < 4; i++) blob(B, SH.back + 1.2 + rnd() * 2.6, SH.roofTop + .4 + rnd() * .6, -SH.half + 1 + rnd() * (2 * SH.half - 2), 1.6 + rnd() * .6, r1, r2, [1.3, .7, 1.2]);
  // the walls: a pile of lumps each side, the inner faces in shade
  for (const k of [-1, 1]) for (let i = 0; i < 4; i++) blob(B, SH.back + .4 + i * 1.3, .9 + (i % 2) * 1.5, k * (SH.half - .5) + (rnd() - .5) * .4, 1.15 + rnd() * .35, i & 1 ? r1 : r2, in1, [1.1, 1.15, .8]);
  box(B, SH.back - .4, SH.back + .9, 0, SH.roof, -SH.half, SH.half, all(in2), .7);                                 // the back, in shade
  blob(B, 1.5, .4, 1.5, .55, [.46, .44, .41], [.4, .38, .36], [1.1, .8, 1]);                                        // a boulder to stand on, by the mouth
  return B.out();
}
// the ledge in the rock of its cliff (option H1): dark basalt, warm sandstone or grey granite
const LEDGE_ROCK = [[[.3, .29, .28], [.36, .35, .33]], [[.62, .5, .38], [.68, .58, .45]], [[.5, .48, .45], [.46, .47, .44]]];
function ledgeMesh(k) {
  reseed(72); const B = builder(), [r1, r2] = LEDGE_ROCK[k];
  box(B, -.6, 2.0, -.8, 0, -2.6, 2.6, { ...all(r1), top: r2, bottom: DIM });
  blob(B, -.1, .25, -1.6, .4, r2, r1, [1, .7, 1.2]);
  return B.out();
}
const rockOf = c => (c[0] + c[1] + c[2] < 1.05 ? 0 : c[0] - c[2] > .1 ? 1 : 2);

export function hiddenSystem(G) {
  const b = G.b, R = G.R;
  let on = !!store.get('hidden', true) || /[?&]hidden=1/.test(location.search);
  const St = { found: {} };
  const cells = new Map();     // cell key -> the shelter or oasis there (or null)
  const ledges = new Map();    // falls landmark id -> its ledge (or null)
  let near = [], nearT = 0, inside = null, spray = 0, shaped = false;

  // ---- where things are ----------------------------------------------------------------------
  // a shelter: the steepest spot of the cell high on a ridge, its mouth facing downhill; an oasis:
  // a flat spot of a desert cell. One in two ridge cells, one in five desert cells.
  function placeOf(gx, gz) {
    const gxw = ((gx % NCX) + NCX) % NCX, key = gxw * 1000 + gz + 500;
    if (cells.has(key)) return cells.get(key);
    const cx = (gx + .5) * CELL, cz = (gz + .5) * CELL, land = biomeAt(cx, cz).name;
    let p = null;
    if (SHELTER_LANDS.has(land) && ih(gxw, gz, 901) < .5) {
      let best = null;
      for (let i = 0; i < 70; i++) {
        const a = i * 2.39996 + ih(gxw, gz, 902) * TAU, r = 40 + i * 14, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, n = normalAt(x, z), y = height(x, z);
        if (n[1] < .76 && y > WATER + 25 && (!best || n[1] < best.n[1])) best = { x, z, y, n };
      }
      if (best) {
        const d = Math.hypot(best.n[0], best.n[2]) || 1, dx = best.n[0] / d, dz = best.n[2] / d, x = best.x + dx * 1.2, z = best.z + dz * 1.2, y = height(x, z) + .3;
        p = { kind: 'shelter', id: 'sh' + key, x, y, z, dx, dz, yaw: Math.atan2(dz, dx), perch: { x: x + dx * 1.5 - dz * 1.5, y: y + .9, z: z + dz * 1.5 + dx * 1.5 }, name: `a shelter in the rock, ${placeName(x, z)}` };
      }
    } else if (land === 'desert' && ih(gxw, gz, 903) < .5 && palmLands(cx, cz)) {   // one desert cell in two where palms grow (few cells: the strip is small)
      for (let i = 0; i < 60 && !p; i++) {
        const a = i * 2.39996, r = 30 + i * 22, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        // level ground: the pool is flat, so the ground under and round it must be too (on a slope
        // one side of it hung in the air): within 20 cm of the middle out to 6 m
        const y0 = height(x, z); let flat = normalAt(x, z)[1] > .965 && y0 > WATER + 1.5;
        for (let k = 0; k < 24 && flat; k++) { const rr = 2 + (k % 3) * 2, ra = k / 24 * TAU; if (Math.abs(height(x + Math.cos(ra) * rr, z + Math.sin(ra) * rr) - y0) > .2) flat = false; }
        if (flat) {
          const y = y0 - .02, palms = [], n = 6 + Math.floor(ih(gxw, gz, 904) * 3);
          reseed(1000 + key % 977);
          for (let k = 0; k < n; k++) { const pa = k / n * TAU + rnd() * .5, pr = 5.5 + rnd() * 3.5, px = x + Math.cos(pa) * pr, pz = z + Math.sin(pa) * pr; palms.push([px, height(px, pz) - .1, pz, 5 + rnd() * 2.5, rnd() * TAU]); }
          const reeds = []; for (let k = 0; k < 9; k++) { const ra = k / 9 * TAU + rnd() * .4, rr = 3.6 + rnd() * .9; const rx = x + Math.cos(ra) * rr, rz = z + Math.sin(ra) * rr; reeds.push([rx, height(rx, rz) - .05, rz, .8 + rnd() * .5, rnd() * TAU]); }
          p = { kind: 'oasis', id: 'oa' + key, x, y, z, r: 4, palms, reeds, name: `an oasis, ${placeName(x, z)}` };
        }
      }
    }
    if (cells.size > 600) cells.delete(cells.keys().next().value);
    cells.set(key, p);
    return p;
  }
  // the ledge behind a fall: only where the face is sheer (the ground is below the ledge's height
  // within 5 m of the lip), at four tenths of the way down, out from the face under the curtain
  function ledgeOf(l) {
    if (ledges.has(l.id)) return ledges.get(l.id);
    let g = null;
    const top = height(l.x, l.z), y = top - Math.min(l.drop * .4, 28);
    for (let s = .5; s <= 5; s += .25) if (height(l.x + l.dx * s, l.z + l.dz * s) < y - .4) {
      const x = l.x + l.dx * (s + .9), z = l.z + l.dz * (s + .9);
      g = { kind: 'ledge', id: 'lg' + l.id, l, x, y, z, s, yaw: Math.atan2(l.dz, l.dx), perch: { x, y, z }, rock: rockOf(groundColour(l.x - l.dx * 3, y, l.z - l.dz * 3, .3)), name: `the ledge behind ${l.name}` };
      break;
    }
    if (ledges.size > 200) ledges.delete(ledges.keys().next().value);
    ledges.set(l.id, g);
    return g;
  }
  const placesNear = (x, z, r) => {
    const out = [], g0 = Math.floor((x - r) / CELL), g1 = Math.floor((x + r) / CELL), h0 = Math.floor((z - r) / CELL), h1 = Math.floor((z + r) / CELL);
    for (let gz = h0; gz <= h1; gz++) for (let gx = g0; gx <= g1; gx++) { const p = placeOf(gx, gz); if (p && Math.hypot(p.x - x, p.z - z) < r + 20) out.push(p); }
    for (const l of landmarksNear(x, z, r + 40)) if (l.kind === 'falls') { const g = ledgeOf(l); if (g) out.push(g); }
    return out;
  };
  // the shelter's frame: s out of the mouth, w across
  const local = (p, x, z) => { const dx = x - p.x, dz = z - p.z, c = Math.cos(p.yaw), s = Math.sin(p.yaw); return [dx * c + dz * s, -dx * s + dz * c]; };
  const inShelter = (p, x, y, z) => { const [s, w] = local(p, x, z); return s > SH.back && s < SH.front && Math.abs(w) < SH.half - .6 && y > p.y - 1 && y < p.y + SH.roofTop; };

  // ---- the hard parts: walls and a perch ----------------------------------------------------------
  env.solids.push((x, z, r, out) => {
    if (!on) return;
    for (const p of placesNear(x, z, r)) {
      if (p.kind === 'ledge') out.push({ x: p.x, z: p.z, r: 1.6, y0: p.y - .8, top: p.y, perch: { ...p.perch, top: true } });
      if (p.kind === 'shelter') {
        const c = Math.cos(p.yaw), s = Math.sin(p.yaw), at = (ls, lw) => [p.x + ls * c - lw * s, p.z + ls * s + lw * c];
        for (const [ls, lw] of [[-.8, -SH.half + .6], [-.8, SH.half - .6]]) { const [wx, wz] = at(ls, lw); out.push({ x: wx, z: wz, r: 1.4, y0: p.y - 1, top: p.y + SH.roofTop, perch: { x: wx, y: p.y + SH.roofTop, z: wz, top: true } }); }
        out.push({ x: p.perch.x, z: p.perch.z, r: .5, y0: p.y - 1, top: p.perch.y, perch: { ...p.perch, top: true } });
      }
    }
  });

  // ---- finding them -------------------------------------------------------------------------------
  const found = p => {
    if (St.found[p.id]) return;
    St.found[p.id] = { day: G.day, kind: p.kind, name: p.name, at: [Math.round(p.x ?? p.mouth?.x ?? b.p[0]), Math.round(p.z ?? p.mouth?.z ?? b.p[2])] };
    G.hud.say(p.name[0].toUpperCase() + p.name.slice(1), { kind: 'event', secs: 4.5, icon: 'landmarks' });
    G.emit('hidden', p); draw();
  };
  const KINDS = { ledge: 'ledges behind the falls', shelter: 'shelters in the rock', oasis: 'oases', ...CAVE_KINDS };
  const sec = journal(G).section(44, 'Hidden places');
  function draw() {
    const F = Object.values(St.found);
    sec.el.style.display = on || F.length ? '' : 'none';   // with the switch off and nothing found, the Journal shows nothing of it
    sec.body.innerHTML = F.length ? `<p>${F.length} found: ${Object.keys(KINDS).filter(k => F.some(f => f.kind === k)).map(k => `${F.filter(f => f.kind === k).length} ${KINDS[k]}`).join(', ')}.</p><ul class="list3">${F.map(f => `<li${f.at ? ` data-at="${f.at}"` : ''}>${esc(f.name[0].toUpperCase() + f.name.slice(1))} <small>Day ${f.day}</small></li>`).join('')}</ul>`
      : '<p>Behind the sheer waterfalls, high in the ridges, in the caves and the old tunnels, in the old trees and where palms stand in the desert: places to find and rest in.</p>';
  }
  draw();

  // ---- settings and dev -------------------------------------------------------------------------
  G.menu.toggle('play', { label: 'Hidden places', sub: 'ledges behind the sheer falls, shelters in the ridges, oases', group: 'looks', get: () => on, set: v => { on = v; store.set('hidden', v); draw(); } });
  // the nearest of a kind, for Try it
  const nearest = kind => {
    let best = null, bd = 1e9;
    if (kind === 'ledge') { for (const l of landmarksNear(b.p[0], b.p[2], 30000)) if (l.kind === 'falls') { const g = ledgeOf(l), d = g && Math.hypot(g.x - b.p[0], g.z - b.p[2]); if (g && d < bd) { bd = d; best = g; } } }
    else {
      const gx0 = Math.floor(b.p[0] / CELL), gz0 = Math.floor(b.p[2] / CELL);
      for (let ring = 0; ring < 18 && !best; ring++) for (let gz = gz0 - ring; gz <= gz0 + ring; gz++) for (let gx = gx0 - ring; gx <= gx0 + ring; gx++) {
        if (Math.max(Math.abs(gx - gx0), Math.abs(gz - gz0)) !== ring) continue;
        const p = placeOf(gx, gz); if (!p || p.kind !== kind) continue;
        const d = Math.hypot(p.x - b.p[0], p.z - b.p[2]); if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  };
  const go = kind => () => { on = true; store.set('hidden', true); const p = nearest(kind); if (!p) { G.hud.say('None within reach of here.', { kind: 'warn', secs: 3 }); return; } G.travelTo(p.perch?.x ?? p.x + 6, p.perch?.z ?? p.z); };
  // lands.js asks how far out a fall's curtain hangs; the dev tools and tests reach the rest
  // sys/quests.js: a hidden place you have found, perched on, can be your ledge
  G.hiddenHere = () => b.state === 'perch' ? near.find(p => p.perch && St.found[p.id] && Math.hypot(p.perch.x - b.p[0], p.perch.z - b.p[2]) < 1.6 && Math.abs(p.perch.y - b.p[1]) < 1.5) || null : null;
  G.hidden = { find: found, near: () => near, get on() { return on; }, curtain: l => (on && ledgeOf(l) ? CURTAIN : 0), go: kind => go(kind)(), nearest, placeOf, ledgeOf, inShelter, local, found: () => St.found, debug: () => ({ near: near.map(p => p.id), inside: inside?.id, on }) };
  G.dev?.add({ id: 'hidden-ledge', title: 'Hidden places: a ledge behind the falls', area: 'World', round: 'study', how: 'Settings > Advanced > Hidden places on. Where a fall drops over a sheer face, its curtain hangs clear of the rock and a ledge waits behind it: fly through the water to land there (spray as you pass), roost there at night. Try it puts you on the nearest one.', go: go('ledge') });
  G.dev?.add({ id: 'hidden-shelter', title: 'Hidden places: shelters in the ridges', area: 'World', round: 'study', how: 'A roof of rock over a dry floor, high on a steep face in the mountain lands, its mouth downhill: a boulder inside to perch and roost on, walls you bump. Try it puts you on the nearest one.', go: go('shelter') });
  G.dev?.add({ id: 'hidden-oasis', title: 'Hidden places: oases', area: 'World', round: 'study', how: 'In the deserts where date palms grow (the Sahara, Arabia, Persia), now and then, a pool under palms with reeds round it: land by it and tap the water to drink (the only fresh water for miles). Try it lands you by the nearest one.', go: go('oasis') });

  return {
    id: 'hidden',
    save: () => ({ found: St.found }),
    load(o) { if (o?.found) St.found = o.found; draw(); },
    update(dt) {
      if (!on) { G.oases = []; return; }
      if ((nearT -= dt) <= 0) {
        nearT = .7; near = placesNear(b.p[0], b.p[2], 700);
        G.oases = []; for (const p of near) if (p.kind === 'oasis') G.oases.push(p.x, p.y + .04, p.z, p.r, 0, .5, 0, 0);
      }
      inside = null;
      for (const p of near) {
        const d = Math.hypot(p.x - b.p[0], p.z - b.p[2]);
        if (p.kind === 'shelter' && d < 12) {
          if (inShelter(p, b.p[0], b.p[1], b.p[2])) {
            inside = p;
            // the roof: nothing flies through it, from below or from above
            if (b.state === 'fly' && b.p[1] > p.y + SH.roof - .7) {
              if (b.p[1] < p.y + SH.roof + .65) { b.p[1] = p.y + SH.roof - .7; b.vy = Math.min(b.vy, 0); }
              else if (b.p[1] < p.y + SH.roofTop + .3) { b.p[1] = p.y + SH.roofTop + .3; b.vy = Math.max(b.vy, 0); }
            }
          }
        }
        if (p.kind === 'ledge' && d < 40) {
          // through the curtain: a burst of spray; on the ledge: found
          const [s, w] = local(p, b.p[0], b.p[2]), cs = CURTAIN - .9;   // the curtain, out from the ledge's middle
          if (b.state === 'fly' && Math.abs(w) < 3.6 && b.p[1] < height(p.l.x, p.l.z) + 1 && b.p[1] > p.y - 25 && Math.abs(s - cs) < 1.2) {
            if (spray <= 0) { for (let i = 0; i < 14; i++) G.part(b.p, [(Math.random() - .5) * 4, Math.random() * 2.5, (Math.random() - .5) * 4], 1.1, [.86, .92, .96], .08); spray = .6; }
          }
          if (b.state === 'perch' && Math.hypot(b.p[0] - p.x, b.p[2] - p.z) < 2.2 && Math.abs(b.p[1] - p.y) < 1) found(p);
        }
        if (p.kind === 'oasis' && d < 9 && b.state === 'ground') found(p);
        // mist drifting from the fall's foot past the ledge
        if (p.kind === 'ledge' && d < 70 && Math.random() < dt * 4) { const w = (Math.random() - .5) * 6, c = Math.cos(p.yaw), s = Math.sin(p.yaw), o = CURTAIN + Math.random() * 3; G.part([p.l.x + c * o - s * w, p.y - 3 + Math.random() * 6, p.l.z + s * o + c * w], [(Math.random() - .5) * .5, .3 + Math.random() * .4, (Math.random() - .5) * .5], 3.5, [.9, .93, .95], .5 + Math.random() * .4); }
      }
      spray -= dt;
      if (inside && b.state !== 'fly') found(inside);   // landed under the roof: found
    },
    scene(S) {
      if (!on || !near.length) return;
      if (!shaped) { shaped = true; R.shape('hid_shelter', shelterMesh()); LEDGE_ROCK.forEach((_, k) => R.shape('hid_ledge' + k, ledgeMesh(k))); R.shape('hid_pool', pool()); R.shape('hid_palm', palm()); }
      const cam = S.cam;
      for (const p of near) {
        if (Math.abs(p.x - cam[0]) > 900 || Math.abs(p.z - cam[2]) > 900) continue;
        if (p.kind === 'shelter') (S.props.hid_shelter ||= []).push(p.x, p.y, p.z, 1, p.yaw, .5, 0, 0);
        if (p.kind === 'ledge') (S.props['hid_ledge' + p.rock] ||= []).push(p.x, p.y, p.z, 1, p.yaw, .5, 0, 0);
        if (p.kind === 'oasis') {
          (S.props.hid_pool ||= []).push(p.x, p.y + .04, p.z, p.r, 0, .5, 0, 0);
          for (const [x, y, z, s, yaw] of p.palms) (S.props.hid_palm ||= []).push(x, y, z, s, yaw, .5, 0, 0);
          for (const [x, y, z, s, yaw] of p.reeds) (S.props.reeds ||= []).push(x, y, z, s, yaw, .5, 0, 0);
        }
      }
    },
  };
}
