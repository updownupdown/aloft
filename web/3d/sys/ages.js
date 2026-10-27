// The ways between the ages (W1 to W4 of the gameplay study), and what keeps you oriented in them.
// - Doors in the deep caves (W4): one cave in seven or so (a cave in the hill or in the ice) ends in a
//   wall of light. In the present each leads to one age (The Ice, The Drowned or The Red Age), and
//   opens once you hold enough far signs (finds.js: 1, 3, 5); in any other age every door leads home.
//   Through it the screen goes white, the game saves and comes back in the other age, in the same cave.
// - The gap in the aurora (W3): with the notebook's last page (its quest), on a night of the lights,
//   the pole wall opens onto the Other Shore (poles.js asks here before crossing); its wall leads back.
// - Dreams (W2): wake at first light somewhere that matters (your ledge, a hidden place you found,
//   under the aurora) and dream before the morning: high over the land in other colours, a chain of
//   soft rings to fly through, then awake on the perch with a feather. Once for each place; with all
//   seven far signs, the far dream (the Other Shore's colours, and a strength).
// - Each other age has sights to find (the dry land bridges of the Ice, drowned villages, the floors
//   of the dry oceans, the Other Shore itself), a quest that counts them and a strength for them all.
// - Orientation: the age's name under the day dial, the way home always on the compass and followed
//   in Quests (Ways between the ages), every door found on the Map, Journal > Places > The ages.
import { height, WATER, wrapX, placeName, toXZ, latLon } from '../world.js';
import { NORTH, SOUTH } from '../earth.js';
import { cavesNear } from '../caves.js';
import { settlementsNear } from '../settle.js';
import { AGES, AGE_ID, AGE } from '../ages.js';
import { ih } from '../noise.js';
import { store, mix3, smooth } from '../util.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';

const DOOR = { odds: .16, need: { ice: 1, drowned: 3, red: 5 }, show: 160, near: 40 };
const TO = ['ice', 'drowned', 'red'];
const SIGHTS = {
  ice: { stat: 'recovery', list: [['dogger', 'The dry Dogger Bank', 54.7, 2], ['channel', 'The Channel valley', 50.2, -1], ['sunda', 'The dry Sunda shelf', 3, 107], ['sahul', 'The land bridge to New Guinea', -10, 142]] },
  drowned: { stat: 'lift', villages: 5 },
  red: { stat: 'height', list: [['atlantic', 'The floor of the Atlantic', 30, -40], ['pacific', 'The floor of the Pacific', 0, -150], ['indian', 'The floor of the Indian Ocean', -20, 75], ['middle', 'The bed of the Middle Sea', 36, 18]] },
  shore: { stat: 'speed', list: [] },
};
const DREAM = { up: 240, rings: 9, gap: 64, rise: 3.5, r: 8, secs: 150 };
const DREAMS = [[.55, .45, .8], [.85, .6, .45], [.4, .65, .75], [.75, .5, .7]];
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
const yawTo = (dx, dz) => Math.atan2(dx, -dz);

export function agesSystem(G) {
  const b = G.b, H = G.hud, ui = document.getElementById('ui3') || document.body;
  const A = { doors: {}, seen: {}, sights: {}, dreamt: {}, far: false, been: {} };
  ui.insertAdjacentHTML('beforeend', `<div class="agev3"></div><style>
    .agev3 { position: fixed; inset: 0; background: #fffaf0; opacity: 0; pointer-events: none; transition: opacity 1.1s ease-in; z-index: 5; }
    .agev3.on { opacity: 1; pointer-events: auto; }
    .agev3.back { transition: opacity 2.4s ease-out; }
    .corner3 .age3 { margin-top: 2px; text-align: center; font: 600 13px var(--text); color: #fff; white-space: nowrap; filter: var(--halo); display: flex; justify-content: center; align-items: center; gap: 6px; }
    .corner3 .age3::before { content: ''; width: 7px; height: 7px; border-radius: 2px; transform: rotate(45deg); background: var(--ac); }
  </style>`);
  const veil = ui.querySelector('.agev3');
  // the age's name under the dial, all the time you are out of the present
  if (AGE_ID !== 'earth') {
    const c = ui.querySelector('.corner3');
    c?.insertAdjacentHTML('beforeend', `<div class="age3" style="--ac:${AGE.col}">${esc(AGE.name)}</div>`);
  }
  const arrived = store.get('ageGo', null); store.set('ageGo', null);
  let first = true;

  // ---- going -------------------------------------------------------------------------------------
  let going = false;
  function go(to, how = {}) {
    if (going || !AGES[to]) return;
    going = true; G.noControl = true; veil.classList.add('on'); G.audio.learned?.();
    setTimeout(() => {
      store.set('ageGo', { to, from: AGE_ID, ...how, back: [b.p[0], b.p[2], b.yaw] });
      G.persist?.();
      store.set('age', to);
      const q = new URLSearchParams(location.search); q.delete('age');
      location.replace(location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }, 1300);
  }

  // ---- the doors ---------------------------------------------------------------------------------
  let doors = [], scanT = 0;
  const doorOf = cv => {
    if (cv.kind !== 'cave' && cv.kind !== 'icecave') return null;
    const h = hash(cv.id); if (h >= DOOR.odds) return null;
    const P = cv.pts, p = P[P.length - 1], q = P[P.length - 2];
    let dx = q.x - p.x, dz = q.z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;   // toward the mouth
    const to = AGE_ID === 'earth' ? TO[Math.floor(h / DOOR.odds * 3)] : 'earth';
    const x = p.x - dx * p.w * .45, z = p.z - dz * p.w * .45;
    return { id: cv.id, to, x, z, f: p.f, c: p.c, w: p.w, dx, dz, need: AGE_ID === 'earth' ? DOOR.need[to] : 0, name: `${G.caves?.NAMES[cv.kind] || 'a cave'}, ${placeName(cv.mouth.x, cv.mouth.z)}` };
  };
  const signs = () => G.finds?.signs?.() || 0;
  const open = d => signs() >= d.need;
  function doorQuest(d) {
    const been = A.been[d.to], ok = open(d);
    G.quests.set('door:' + d.id, { group: 'way', icon: 'door', title: d.to === 'earth' ? 'A door home' : `A door to ${AGES[d.to].name}`, x: d.x, z: d.z, age: AGE_ID, quiet: !!A.doors[d.id],
      text: d.to === 'earth' ? `At the back of ${d.name}: the light leads back to the present.`
        : ok ? `At the back of ${d.name}: the light is warm. Fly into it${been ? ` to go back to ${AGES[d.to].name}` : ''}.`
        : `At the back of ${d.name}: the light is cold and shut. It opens to one holding ${d.need} far ${d.need === 1 ? 'sign' : 'signs'} (you have ${signs()}).` });
  }
  function seeDoor(d) {
    if (d.told === signs()) return; d.told = signs();
    if (A.doors[d.id]) { doorQuest(d); return; }
    A.doors[d.id] = { to: d.to, x: Math.round(d.x), z: Math.round(d.z), name: d.name, age: AGE_ID, day: G.day };
    doorQuest(d);
    H.name(d.to === 'earth' ? 'A door home' : 'A door of light', 'door');
    H.say(d.to === 'earth' ? 'A wall of light at the back of the cave: the way home.'
      : open(d) ? `A wall of light at the back of the cave, warm: it leads to ${AGES[d.to].name}. Fly into it.`
      : `A wall of light at the back of the cave, cold and shut. The far signs open it: ${d.need} of them.`, { kind: 'event', secs: 6, icon: 'door' });
    G.emit('door', d);
  }
  let bumped = 0;
  function doorsStep(dt) {
    if ((scanT -= dt) <= 0) { scanT = 1; doors = cavesNear(b.p[0], b.p[2], 400).map(doorOf).filter(Boolean); }
    bumped = Math.max(0, bumped - dt);
    for (const d of doors) {
      const rx = wrapX(b.p[0] - d.x), rz = b.p[2] - d.z, along = rx * d.dx + rz * d.dz, side = Math.abs(rx * -d.dz + rz * d.dx);
      if (along > -2 && along < DOOR.near && side < d.w * 2 && b.p[1] > d.f - 2 && b.p[1] < d.f + d.c + 4) seeDoor(d);
      if (along > .6 || along < -4 || side > d.w * .8 || b.p[1] < d.f - .5 || b.p[1] > d.f + d.c) continue;
      if (open(d)) { go(d.to, { via: 'door', door: { x: d.x, z: d.z, f: d.f, c: d.c, dx: d.dx, dz: d.dz, name: d.name, id: d.id } }); return; }
      // shut: it holds you off, softly
      b.p[0] = d.x + d.dx * .7 + (-d.dz) * (rx * -d.dz + rz * d.dx); b.p[2] = d.z + d.dz * .7 + d.dx * (rx * -d.dz + rz * d.dx); b.s *= .5;
      if (!bumped) { bumped = 6; H.reply(`The light is cold: ${d.need} far ${d.need === 1 ? 'sign' : 'signs'} open it (you have ${signs()})`, 3); }
    }
  }
  // the wall of light: a soft sheet across the back of the hall, pale lines rising through it
  function drawDoors(S) {
    const R = S.ribbon ||= [], t = G.t;
    for (const d of doors) {
      const dist = Math.hypot(wrapX(d.x - S.cam[0]), d.z - S.cam[2]); if (dist > DOOR.show) continue;
      const fade = smooth(DOOR.show, DOOR.show * .5, dist), ok = open(d), col = d.to === 'earth' ? [1, .95, .82] : ok ? hexRGB(AGES[d.to].col).map(v => .55 + v * .45) : [.78, .84, .9];
      const px = -d.dz, pz = d.dx, w = d.w * .85, y0 = d.f - .3, y1 = d.f + d.c * .92;
      const v = (s, y, a) => R.push(d.x + px * s, y, d.z + pz * s, col[0], col[1], col[2], a * fade);
      const quad = (s0, s1, ya, yb, a, a2 = a) => { v(s0, ya, a); v(s1, ya, a); v(s1, yb, a2); v(s0, ya, a); v(s1, yb, a2); v(s0, yb, a2); };
      const pulse = (ok ? .75 : .45) + .12 * Math.sin(t * 1.3);
      quad(-w, w, y0, y1, .42 * pulse, .12 * pulse);
      quad(-w, w, y0, y0 + .8, .6 * pulse, .3 * pulse);
      for (let i = 0; i < 7; i++) { const s = -w + (i + .5) / 7 * 2 * w + Math.sin(t * .4 + i) * .3, h = (t * .5 + i * .37) % 1; quad(s - .12, s + .12, y0, y0 + (y1 - y0) * (.4 + .6 * h), .5 * pulse * (1 - h * .5), 0); }
    }
  }
  const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

  // ---- arriving ----------------------------------------------------------------------------------
  function arrive() {
    const g = arrived; if (!g || g.to !== AGE_ID) return;
    const fresh = !A.been[AGE_ID]; A.been[AGE_ID] = (A.been[AGE_ID] || 0) + 1;
    if (g.via === 'door' && g.door) {
      const d = g.door;
      Object.assign(b, { state: 'fly', p: [d.x + d.dx * 3, d.f + d.c * .45, d.z + d.dz * 3], yaw: yawTo(d.dx, d.dz), s: 8, vy: 0, perch: null, tree: null, from: null, snapCam: true });
      if (AGE_ID !== 'earth') G.quests.set('home:' + AGE_ID, { group: 'way', icon: 'door', title: 'The way home', text: `Back through the door of light at the back of ${d.name}.`, x: d.x, z: d.z, age: AGE_ID, quiet: true });
    } else if (g.via === 'aurora') {
      const north = (g.back?.[1] ?? b.p[2]) < (NORTH + SOUTH) / 2;
      if (AGE_ID === 'shore') {
        // out of the lights over the Other Shore: the first land toward the middle of the world
        const lon = latLon(b.p[0], b.p[2])[1]; let at = null;
        for (let la = north ? 58 : -52; !at && Math.abs(la) > 20; la += north ? -2 : 2) { const p = toXZ(la, lon); if (p && height(p[0], p[1]) > WATER + 3) at = p; }
        at ||= [b.p[0], (NORTH + SOUTH) / 2];
        Object.assign(b, { state: 'fly', p: [at[0], Math.max(height(...at), WATER) + 70, at[1]], yaw: north ? Math.PI : 0, s: 12, vy: 0, perch: null, from: null, snapCam: true });
        G.quests.set('home:' + AGE_ID, { group: 'way', icon: 'door', title: 'The way home', text: 'Back through the pole wall, under the lights, as you came; any door of light in the caves leads home too.', x: at[0], z: north ? NORTH + 800 : SOUTH - 800, age: AGE_ID, quiet: true });
        G.quests.done('aurora', 'Through the gap in the lights, to the Other Shore.');
      } else {
        const [x, z, yaw] = g.back || [b.p[0], b.p[2], b.yaw], z2 = north ? NORTH + 900 : SOUTH - 900;
        Object.assign(b, { state: 'fly', p: [x, Math.max(height(x, z2), WATER) + 40, z2], yaw: yaw + Math.PI, s: 12, vy: 0, perch: null, from: null, snapCam: true });
      }
    }
    const q = G.quests.get('home:' + AGE_ID); if (q && G.quests.tracked()?.id !== q.id) G.quests.track(q.id);
    if (AGE_ID === 'earth') { H.name('Home, in the present', 'age'); H.say('Back in your own age: the sea where it was, the meters running again.', { kind: 'event', secs: 5, icon: 'age' }); }
    else {
      H.name(AGE.name, 'age');
      H.say(`${AGE.name}. ${AGE.note} Nothing grows hungry here; the way home is on your compass.`, { kind: 'event', secs: 8, icon: 'age' });
      if (fresh || !G.gifted?.('visit:' + AGE_ID)) G.gift?.('stamina', `Reached ${AGE.name}`, 'visit:' + AGE_ID);
    }
    G.emit('age', AGE_ID, g.from);
  }

  // ---- the sights of each age ----------------------------------------------------------------------
  const SG = SIGHTS[AGE_ID];
  const sightList = SG?.list?.map(([id, name, la, lo]) => { const p = toXZ(la, lo); return p && { id, name, x: p[0], z: p[1] }; }).filter(Boolean) || [];
  const of = () => SG ? (SG.villages || sightList.length) : 0;
  const got = () => Object.keys(A.sights[AGE_ID] || {}).length;
  function sightQuest() {
    if (!SG || !of()) return;
    G.quests.set('age:' + AGE_ID, { group: 'way', icon: 'age', title: `The sights of ${AGE.name}`, age: AGE_ID, quiet: true, n: got(), of: of(),
      text: SG.villages ? 'The villages the sea came up over: fly over them, their spires under the water.' : `Find them: ${sightList.map(s => s.name).join(', ')}.` });
  }
  function sight(id, name, x, z) {
    const S = A.sights[AGE_ID] ||= {}; if (S[id]) return;
    S[id] = { name, at: [Math.round(x), Math.round(z)], day: G.day };
    H.name(name, 'age'); G.audio.learned?.();
    sightQuest();
    if (got() >= of()) { G.quests.done('age:' + AGE_ID, `All of them: ${AGE.name} seen.`); G.gift?.(SG.stat, `The sights of ${AGE.name}`, 'sights:' + AGE_ID, 2); }
    G.emit('find', { kind: 'age', id, name });
  }
  let sightT = 0;
  function sightsStep(dt) {
    if (!SG || (sightT -= dt) > 0) return; sightT = 1.5;
    for (const s of sightList) if (Math.hypot(wrapX(s.x - b.p[0]), s.z - b.p[2]) < 900) sight(s.id, s.name, s.x, s.z);
    if (SG.villages) for (const v of settlementsNear(b.p[0], b.p[2], 120, false)) if (v.kind !== 'drowned' && height(v.x, v.z) < WATER - .5 && Math.hypot(wrapX(v.x - b.p[0]), v.z - b.p[2]) < 90) sight(v.id, `${v.name}, under the sea`, v.x, v.z);
  }
  // the sights still to find, for the compass once you are near (2 km)
  (G.marks ||= []).push(() => {
    const out = [];
    if (AGE_ID !== 'earth') {
      const q = G.quests.get('home:' + AGE_ID);
      if (q && Math.hypot(wrapX(q.x - b.p[0]), q.z - b.p[2]) > 60) out.push(['door', q.x, q.z, 'The way home']);
      for (const s of sightList) if (!A.sights[AGE_ID]?.[s.id] && Math.hypot(wrapX(s.x - b.p[0]), s.z - b.p[2]) < 6000) out.push(['find', s.x, s.z, s.name]);
    }
    return out;
  });

  // ---- dreams ----------------------------------------------------------------------------------------
  let dream = null;
  function special() {
    const l = G.ledge?.(); if (l && Math.hypot(wrapX(l.x - b.p[0]), l.z - b.p[2]) < 4) return { id: 'ledge', name: 'your ledge' };
    const h = G.hiddenHere?.(); if (h) return { id: h.id, name: h.name };
    if ((G.aurora || 0) > .3) return { id: 'aurora:' + Math.round(b.p[0] / 2000) + ',' + Math.round(b.p[2] / 2000), name: 'under the lights' };
    return null;
  }
  G.on('wake', early => {
    if (early || AGE_ID !== 'earth' || dream) return;
    const s = special(); if (!s) return;
    const far = signs() >= 7 && !A.far;
    if (A.dreamt[s.id] && !far) return;
    setTimeout(() => startDream(s, far), 3500);
  });
  function startDream(s, far) {
    if (dream || b.state !== 'perch') return;
    veil.classList.add('on');
    setTimeout(() => {
      const keep = { p: [...b.p], yaw: b.yaw, perch: b.perch, tree: b.tree, state: b.state };
      const f = [Math.sin(b.yaw), -Math.cos(b.yaw)], y0 = Math.max(height(b.p[0], b.p[2]), WATER) + DREAM.up;
      const rings = []; let x = b.p[0] + f[0] * 50, z = b.p[2] + f[1] * 50, y = y0, a = b.yaw;
      for (let i = 0; i < DREAM.rings; i++) { rings.push({ x, y, z, yaw: a, k: i }); a += Math.sin(i * 1.3) * .25; x += Math.sin(a) * DREAM.gap; z -= Math.cos(a) * DREAM.gap; y += DREAM.rise; }
      dream = { s, far, keep, rings, next: 0, t: 0, col: far ? hexRGB(AGES.shore.col) : DREAMS[Object.keys(A.dreamt).length % DREAMS.length] };
      Object.assign(b, { state: 'fly', p: [b.p[0], y0, b.p[2]], s: 13, vy: 0, perch: null, tree: null, from: null, snapCam: true });
      G.timeless = true; b.stamina = b.maxStamina ?? 1;
      veil.classList.remove('on'); veil.classList.add('back'); setTimeout(() => veil.classList.remove('back'), 2500);
      H.say(far ? 'You dream of a far shore, in colours the world has not got.' : 'You dream: high over the land, in other colours. Rings ahead.', { kind: 'event', secs: 5, icon: 'sleep' });
    }, 1200);
  }
  function dreamStep(dt) {
    const D = dream; if (!D) return;
    D.t += dt; b.stamina = Math.max(b.stamina, .5);
    const r = D.rings[D.next];
    if (r && Math.hypot(b.p[0] - r.x, b.p[1] - r.y, b.p[2] - r.z) < DREAM.r) {
      D.next++;
      const A2 = G.audio, PH = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      if (A2.tone && A2.hz) A2.tone({ f: A2.hz(PH[Math.min(D.next - 1, PH.length - 1)] - 12), dur: 1.4, vol: .1, type: 'triangle' }); else A2.ring?.();
      b.s = Math.min(40, b.s + 3);
    }
    if (D.next >= D.rings.length || D.t > DREAM.secs || b.state !== 'fly') endDream();
  }
  function endDream() {
    const D = dream; if (!D || D.ending) return; D.ending = true;
    veil.classList.add('on');
    setTimeout(() => {
      Object.assign(b, { ...D.keep, p: [...D.keep.p], s: 0, vy: 0, snapCam: true });
      G.timeless = AGE_ID !== 'earth'; dream = null;
      A.dreamt[D.s.id] = G.day;
      veil.classList.remove('on'); veil.classList.add('back'); setTimeout(() => veil.classList.remove('back'), 2500);
      G.feather?.(`A dream, ${D.s.name}`);
      if (D.far) { A.far = true; G.gift?.('height', 'The far dream', 'fardream', 2); if (!G.quests.get('aurora')) G.quests.set('aurora', { group: 'way', icon: 'age', title: 'The gap in the aurora', text: 'You dreamt it: on a night of the aurora, fly into the pole wall where the lights are brightest.' }); }
      H.say(D.far ? 'Awake on your perch. The far shore stays with you: on a night of the lights, the pole wall has a gap.' : 'Awake on your perch, the morning come.', { kind: 'event', secs: 6, icon: 'sleep' });
      G.emit('dream', D.s.id, D.far);
    }, 1200);
  }

  // ---- the gap in the aurora (asked by poles.js before it crosses) ---------------------------------------
  G.ages = {
    go, doors: () => doors, here: AGE_ID,
    gap() {
      if (first || going) return true;   // (not before the arrival has moved you off the wall)
      if (AGE_ID === 'shore') { go('earth', { via: 'aurora' }); return true; }
      if (AGE_ID !== 'earth') return false;
      if (!G.quests.get('aurora')) return false;   // (the notebook's last page, or the far dream, tells of it)
      if ((G.aurora || 0) < .45 || (G.light?.night || 0) < .5) return false;
      go('shore', { via: 'aurora' }); return true;
    },
  };

  // ---- Journal > Places > The ages ------------------------------------------------------------------
  const sec = journal(G).section(47, 'The ages');
  G.menu.onOpen(() => {
    const ds = Object.entries(A.doors), seen = Object.keys(A.been);
    sec.el.classList.toggle('hidden', !ds.length && !seen.length && AGE_ID === 'earth');
    const ages = Object.entries(AGES).filter(([id]) => id !== 'earth').map(([id, a]) => {
      const S = A.sights[id] || {}, n = Object.keys(S).length, total = SIGHTS[id] ? (SIGHTS[id].villages || SIGHTS[id].list.length) : 0;
      const known = A.been[id] || ds.some(([, d]) => d.to === id) || (id === 'shore' && G.quests.get('aurora'));
      return `<li class="set3"><b>${known ? esc(a.name) : 'An age not yet found'}</b>${known ? `<small>${A.been[id] ? `Been ${A.been[id]} ${A.been[id] === 1 ? 'time' : 'times'}` : 'Not yet reached'}${total ? ` · sights ${n} of ${total}` : ''}</small><p>${esc(a.note)}</p>` : ''}
        ${Object.values(S).map(s => `<span class="at3" data-at="${s.at}">${icon('map')}${esc(s.name)}</span>`).join(' ')}</li>`;
    }).join('');
    const doorList = ds.filter(([, d]) => d.age === AGE_ID).map(([, d]) => `<li data-at="${d.x},${d.z}">${d.to === 'earth' ? 'Home' : esc(AGES[d.to].name)}: ${esc(d.name)} <small>${icon('map')}</small></li>`).join('');
    sec.body.innerHTML = `<p>${AGE_ID === 'earth' ? 'The same Earth in other ages, through the doors of light at the back of some deep caves, and the gap in the aurora.' : `You are in ${esc(AGE.name)}. The way home is on your compass.`}</p><ul class="sets3">${ages}</ul>${doorList ? `<h4>Doors ${AGE_ID === 'earth' ? 'found' : 'here'}</h4><ul class="list3">${doorList}</ul>` : ''}`;
  });

  // ---- dev ----------------------------------------------------------------------------------------------
  for (const id of Object.keys(AGES)) G.dev?.add({ id: 'age-' + id, area: 'World', round: 'Gameplay 10-26 W1', title: id === 'earth' ? 'Back to the present' : `Go to ${AGES[id].name}`, how: `${AGES[id].note || 'The present.'} Go reloads into it where you are (?age=${id} too).`, go: () => go(id, { via: 'dev' }) });
  G.dev?.add({ id: 'doors', area: 'World', round: 'Gameplay 10-26 W4', title: 'Doors of light in the deep caves', how: 'About one cave in the hills or the ice in six ends in a wall of light: to The Ice (1 far sign), The Drowned (3) or The Red Age (5); from other ages every door leads home. Go takes you to the nearest door.',
    go: () => { const all = cavesNear(b.p[0], b.p[2], 9000).map(doorOf).filter(Boolean).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2])); const d = all[0]; if (!d) { H.reply('No door within 9 km', 2); return; } Object.assign(b, { state: 'fly', p: [d.x + d.dx * 30, d.f + d.c * .5, d.z + d.dz * 30], yaw: yawTo(-d.dx, -d.dz), s: 6, perch: null, snapCam: true }); scanT = 0; } });
  G.dev?.add({ id: 'dream', area: 'Ground and perch', round: 'Gameplay 10-26 W2', title: 'Dreams in special places', how: 'Sleep on your ledge, at a hidden place you found or under the aurora: at first light you dream a short flight through rings, then wake with a feather (once a place). All seven far signs: the far dream. Go dreams now (perched).', go: () => { if (b.state === 'perch') startDream({ id: 'dev' + G.t, name: 'here' }, signs() >= 7 && !A.far); else H.reply('Perch first', 2); } });

  return {
    id: 'ages',
    update(dt) {
      if (first) { first = false; arrive(); sightQuest(); if (arrived && arrived.to === AGE_ID) { veil.classList.add('on'); requestAnimationFrame(() => { veil.classList.remove('on'); veil.classList.add('back'); setTimeout(() => veil.classList.remove('back'), 2600); }); } }
      if (going) return;
      doorsStep(dt); sightsStep(dt); dreamStep(dt);
    },
    scene(S) {
      drawDoors(S);
      const dk = dream ? Math.min(1, dream.t / 3) * (dream.ending ? 0 : 1) : 0;
      if (AGE.sky) { const k = AGE.skyK * (.35 + .65 * (G.light?.daylight ?? 1)); S.horizon = mix3(S.horizon, AGE.sky, k); S.zenith = mix3(S.zenith, AGE.sky.map(v => v * .8), k * .7); if (S.cloud) S.cloud = mix3(S.cloud, AGE.sky.map(v => .5 + v * .5), k * .5); }
      if (AGE.aurora && S.aurora != null) S.aurora = Math.max(S.aurora, AGE.aurora * (G.light?.night || 0));
      if (dk > 0) {
        const c = dream.col; S.horizon = mix3(S.horizon, c, .5 * dk); S.zenith = mix3(S.zenith, c.map(v => v * .6), .45 * dk); if (S.cloud) S.cloud = mix3(S.cloud, c.map(v => .6 + v * .4), .4 * dk);
        for (const r of dream.rings.slice(dream.next)) (S.props.ringv ||= []).push(r.x, r.y, r.z, DREAM.r, r.yaw, r.k === dream.next ? 1 : .5, 0, 0);
      }
    },
    save: () => A,
    load(o) { if (o) Object.assign(A, o); },
  };
}
