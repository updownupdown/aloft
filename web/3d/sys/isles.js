// Islands as stepping stones across the sea (world.js islesNear): pools of rain water in the rock
// to drink from (the sea is salt, food.js), seabirds nesting on the slopes with more wheeling
// over them, and one sight to find in each archipelago: a blowhole, lava steaming into the sea,
// a great seabird colony or a sea arch. (The gulls' shapes are sealife.js's.) Rest, drink and sleep on one before crossing on.
import { height, groundAt, groundNormal, WATER, ih, islesNear, latAt } from '../world.js';
import { pool, sitter } from './oceanshapes.js';
import { inSentence } from './journey.js';

export const ISLES = { near: 3200, group: 7800 };
// the real islands (world.js REAL_ISLES, by index): which archipelago, and its sight
const REAL = [['Hawaii', 'steam'], ['Hawaii', 'steam'], ['the Azores', 'blowhole'], ['Madeira', 'arch'], ['the Canaries', 'blowhole'], ['Bermuda', 'colony'], ['the Galápagos', 'colony'],
  ['Tahiti', 'arch'], ['Rapa Nui', 'colony'], ['the Faroes', 'colony'], ['the Mascarenes', 'steam'], ['the Mascarenes', 'steam'], ['the Maldives', 'colony'], ['the Seychelles', 'arch'],
  ['the Marquesas', 'blowhole'], ['the Marianas', 'arch'], ['Saint Helena', 'blowhole'], ['Ascension', 'colony'], ['Tristan da Cunha', 'colony'], ['Cape Verde', 'blowhole'], ['Socotra', 'arch'],
  ['the Cook Islands', 'colony'], ['Samoa', 'blowhole']];
const SIGHT = { blowhole: 'the blowhole', steam: 'the lava coast', colony: 'the seabird colony', arch: 'the sea arch' };

export function islesSystem(G) {
  const b = G.b, R = G.R, H = G.hud;
  R.shape('pool', pool()); R.shape('sitter', sitter());
  const once = (id, title, msg, ic, how) => { if (!G.flags[id]) { G.flags[id] = 1; G.hud.quietly(how, title, msg, ic); } };
  const info = new Map();   // island key -> its pools, nesters, sight
  let near = [], from = null, puffT = 0;
  G.pools = [];             // rain pools near the bird, 8 floats each (food.js drinks from them)

  const keyOf = I => I.real !== undefined ? 'r' + I.real : `i${Math.round(I.x)},${Math.round(I.z)}`;
  // a spot on the island's shore, on the side the hash picks
  function shoreSpot(I, h) {
    for (let k = 0; k < 12; k++) {
      const a = (h + k / 12) * 6.283; let last = null;
      for (let r = I.r * .3; r < I.r * 1.6; r += 6) { const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r; if (height(x, z) < WATER) return last && { x: last[0], z: last[1], a }; last = [x, z]; }
    }
    return null;
  }
  // which archipelago an island is in, and whether it holds the sight (the real ones by name;
  // the scattered ones by a wide cell: its first island)
  function sightOf(I) {
    if (I.real !== undefined) {
      const [name, kind] = REAL[I.real] || ['the island', 'colony'];
      if (REAL.findIndex(r => r[0] === name) !== I.real) return null;
      return { kind, name: `${SIGHT[kind][0].toUpperCase()}${SIGHT[kind].slice(1)} of ${name}`.replace('The ', 'The '), group: name, real: 1 };
    }
    const gx = Math.floor(I.x / ISLES.group), gz = Math.floor(I.z / ISLES.group);
    const all = islesNear((gx + .5) * ISLES.group, (gz + .5) * ISLES.group, ISLES.group / 2).filter(J => J.real === undefined && Math.floor(J.x / ISLES.group) === gx && Math.floor(J.z / ISLES.group) === gz);
    all.sort((p, q) => p.x - q.x || p.z - q.z);
    if (all[0] !== I && !(all[0] && all[0].x === I.x && all[0].z === I.z)) return null;
    const kind = ['blowhole', 'colony', 'arch', 'colony'][Math.floor(ih(gx, gz, 471) * 4)];
    const lat = latAt(I.x, I.z), sea = lat < 0 ? 'the southern islands' : 'the island sea';
    return { kind, name: `${SIGHT[kind][0].toUpperCase()}${SIGHT[kind].slice(1)} of ${sea}`, group: `${gx},${gz}` };
  }
  // how many archipelagos hold a sight, for the Map's count of landmarks (map.js, counted once)
  G.isleNear = () => near;   // (sys/lore.js: the gannets' colony)
  G.isleSights = () => islesNear(0, 0, 1e5).filter(I => sightOf(I)?.real).length;   // (the named ones: Journal > Places > Landmarks lists only those)
  function infoOf(I) {
    const k = keyOf(I); let o = info.get(k); if (o) return o;
    const seed = I.real !== undefined ? I.real * 13 + 1 : Math.abs(Math.round(I.x * .013 + I.z * .029));
    const pools = [], nest = [];
    for (let i = 0; i < 40 && pools.length < 4; i++) {
      const a = ih(seed, i, 472) * 6.283, r = Math.sqrt(ih(seed, i, 473)) * I.r * .8, x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r, y = height(x, z);
      if (y > 2 && groundNormal(x, z)[1] > .93) pools.push(x, groundAt(x, z) + .03, z, 1 + ih(seed, i, 474) * 1.4, a, .5, 0, 0);
    }
    for (let i = 0; i < 60; i++) {
      const a = ih(seed, i, 475) * 6.283, r = I.r * (.5 + ih(seed, i, 476) * .7), x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r, y = height(x, z);
      if (y > 1.5 && y < 40) nest.push([x, groundAt(x, z), z, a]);
    }
    const s = sightOf(I), at = s && shoreSpot(I, ih(seed, 0, 477));
    o = { k, I, pools, nest, sight: s && at ? { ...s, ...at, id: 'isle_' + k } : null, birds: Array.from({ length: 10 }, (_, i) => ({ a: i * .63, r: I.r * (.4 + (i % 3) * .2), h: 18 + (i % 4) * 8, v: .12 + (i % 5) * .02 })) };
    if (o.sight?.kind === 'colony') for (let i = 0; i < 80; i++) { const a = o.sight.a + (ih(seed, i, 478) - .5) * 1.2, r = I.r * (.55 + ih(seed, i, 479) * .5), x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r, y = height(x, z); if (y > 1 && y < 50) nest.push([x, groundAt(x, z), z, a]); }
    info.set(k, o); if (info.size > 200) info.delete(info.keys().next().value);
    return o;
  }
  function refresh() {
    from = [b.p[0], b.p[2]];
    near = islesNear(b.p[0], b.p[2], ISLES.near).map(infoOf);
    G.pools = near.flatMap(o => o.pools);
  }
  G.on('wrap', () => { from = null; });

  // finding the archipelago's sight: written into the Journal's landmarks like any other (journey.js)
  function find() {
    const J = G.journey; if (!J) return;
    for (const o of near) {
      const s = o.sight; if (!s || J.found[s.id] || Math.hypot(s.x - b.p[0], s.z - b.p[2]) > 160) continue;
      J.found[s.id] = { real: s.real || 0, name: s.name, x: Math.round(s.x), z: Math.round(s.z), note: `Found on ${G.date?.text || `day ${G.day}`}, in ${G.season.name}, in ${inSentence(G.placeName?.(s.x, s.z) || 'the sea')}.` };
      H.name(s.name, 'landmarks'); G.audio.learned?.();
      G.emit('landmark', { id: s.id, name: s.name, x: s.x, z: s.z });
    }
  }
  // the sights at work
  function sights(dt) {
    puffT += dt;
    for (const o of near) {
      const s = o.sight; if (!s || Math.hypot(s.x - b.p[0], s.z - b.p[2]) > 900) continue;
      const ox = s.x + Math.cos(s.a) * 4, oz = s.z + Math.sin(s.a) * 4;
      if (s.kind === 'blowhole' && (puffT + ih(s.x | 0, 0, 480) * 6) % 7 < dt * 1.01) {   // a wave drives up through the rock
        for (let i = 0; i < 40; i++) G.part([ox, WATER + 1, oz], [(Math.random() - .5) * 2.4, 9 + Math.random() * 6, (Math.random() - .5) * 2.4], 2 + Math.random(), [.9, .94, .96], .3);
      }
      if (s.kind === 'steam' && Math.random() < dt * 10) G.part([ox + (Math.random() - .5) * 10, WATER + .5, oz + (Math.random() - .5) * 10], [(Math.random() - .5), 2.5 + Math.random() * 2, (Math.random() - .5)], 4, [.86, .86, .88], .6);
    }
  }

  G.hud.tip('island', () => b.state !== 'fly' && near.some(o => Math.hypot(o.I.x - b.p[0], o.I.z - b.p[2]) < o.I.r * 1.2), 'An island in the open sea: rest here, drink from the rain pools in the rock (the sea is salt), and sleep the night before you cross on.');
  G.dev?.add({ id: 'isles', title: 'Islands: rain pools, seabirds, one sight per archipelago', area: 'World', how: 'The islands of the Mediterranean and the South Pacific, and the real ones (Hawaii, the Azores, the Canaries...): rain pools to drink from, nesting seabirds, and a sight per archipelago (Journal > Landmarks). Go takes you to the nearest sight.',
    go: () => {
      let o = near.filter(q => q.sight).sort((p, q) => Math.hypot(p.sight.x - b.p[0], p.sight.z - b.p[2]) - Math.hypot(q.sight.x - b.p[0], q.sight.z - b.p[2]))[0];
      if (!o) { const I = islesNear(b.p[0], b.p[2], 30000).filter(J => J.real !== undefined).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (I) o = infoOf(I); }
      const s = o?.sight || (o && { x: o.I.x, z: o.I.z, a: 0 }); if (!s) return H.reply('No islands near', 2);
      b.state = 'fly'; b.p = [s.x + Math.cos(s.a) * 120, 40, s.z + Math.sin(s.a) * 120]; b.yaw = Math.atan2(-Math.cos(s.a), Math.sin(s.a)); b.s = 9; b.gamma = 0; b.vy = 0;
    } });

  return {
    id: 'isles',
    update(dt) {
      if (!from || Math.hypot(b.p[0] - from[0], b.p[2] - from[1]) > 150) refresh();
      if (!near.length) return;
      find(); sights(dt);
      for (const o of near) for (const q of o.birds) q.a += q.v * dt;
      if (b.state === 'ground' && G.pools.length) for (let i = 0; i < G.pools.length; i += 8) if (Math.hypot(G.pools[i] - b.p[0], G.pools[i + 2] - b.p[2]) < 6) { once('rainPool', 'Rain pool', 'A pool of rain water in the rock: fresh, not salt. Tap it to drink.', 'thirst'); break; }
    },
    scene(S) {
      if (!near.length) return;
      const cam = S.cam, P = S.props.pool ||= [], N = S.props.sitter ||= [], gu = S.props.gullU ||= [], gd = S.props.gullD ||= [];
      for (let i = 0; i < G.pools.length; i += 8) if (Math.abs(G.pools[i] - cam[0]) < 220 && Math.abs(G.pools[i + 2] - cam[2]) < 220) P.push(...G.pools.slice(i, i + 8));
      for (const o of near) {
        const d = Math.hypot(o.I.x - cam[0], o.I.z - cam[2]); if (d > o.I.r + 1400) continue;
        if (d < o.I.r + 350) for (const [x, y, z, a] of o.nest) N.push(x, y, z, 1.6, a, .5, 0, 0);
        const n = o.sight?.kind === 'colony' ? 10 : 5;
        for (let i = 0; i < n; i++) {
          const q = o.birds[i], x = o.I.x + Math.cos(q.a) * q.r, z = o.I.z + Math.sin(q.a) * q.r, y = Math.max(height(o.I.x, o.I.z), 0) * .6 + q.h;
          (Math.sin(G.t * 5 + i) > 0 ? gu : gd).push(x, y, z, 1.4, q.a + Math.PI / 2, .5, 0, 0);
        }
        // the arch: a span of rock standing off the shore
        if (o.sight?.kind === 'arch' && d < 1800) (S.props.rock_arch ||= []).push(o.sight.x + Math.cos(o.sight.a) * 30, -2, o.sight.z + Math.sin(o.sight.a) * 30, 26, o.sight.a + Math.PI / 2, .5, 0, 0);
      }
    },
  };
}
