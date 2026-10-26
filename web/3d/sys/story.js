// The long arc of a hawk's year: health built up by eating, drinking and flying well (it shows in
// how red the tail is), keepsakes gathered for a nest, acrobatics, songs, and the courtship in
// spring they all add up to. Nothing here ever punishes: low meters only slow the health down,
// and a courtship that doesn't take can be tried again another day.
// Other hawks of your own (a suitor, your mate, your fledglings) fly here too, as shapes built
// from the hawk's own mesh.
import { height, WATER, ih } from '../world.js';
import { buildHawk, BIRD } from '../hawk.js';
import { builder, blob, reseed } from '../shapes.js';
import { journal, esc } from '../journal.js';
import { icon, birdKey } from '../icons.js';
import { clamp, lerp, angleTo } from '../util.js';

export const HEALTH_START = .35;
export const KEEPSAKES = ['blue jay feather', 'snail shell', 'smooth white pebble', 'curl of birch bark', 'robin’s eggshell', 'tuft of thistledown', 'acorn cap', 'heron feather'];
const KC = 420;   // one keepsake maybe in each cell this many metres across
const COURT = { need: .62, time: 75, keep: 5, songs: 5, tricks: 8 };
// your mate and young are always your own kind, whichever bird you fly now (Settings > Bird):
// what the words call it, its field guide page (guide.js) and its full name
const KIND = { hawk: ['hawk', 'redtail', 'red-tail'], osprey: ['osprey', 'osprey', 'osprey'], owl: ['owl', 'barnowl', 'barn owl'], raven: ['raven', 'raven', 'raven'], albatross: ['albatross', 'albatross', 'albatross'] };
export const kind = () => KIND[BIRD] || KIND.hawk;
// health shows in the red-tail's tail; in the others, in the gloss of their feathers
const show = () => BIRD === 'hawk' ? 'a red tail' : 'glossy feathers';

// a hawk turned to face +x (as instanced shapes do), coloured by which way each face looks:
// instanced shapes have one colour per face, so the underside takes the pale underwing colours
function hawkShape(pose) {
  const m = buildHawk({ flapL: 0, flapR: 0, handL: 0, handR: 0, fold: 0, flare: 0, legs: 0, tail: .2, tailPitch: 0, t: 0, tailRed: 1, ...pose });
  const o = new Float32Array(m.length);
  for (let i = 0; i < m.length; i += 12) {
    o[i] = m[i + 2]; o[i + 1] = m[i + 1]; o[i + 2] = -m[i];
    o[i + 3] = m[i + 5]; o[i + 4] = m[i + 4]; o[i + 5] = -m[i + 3];
    const under = m[i + 4] < 0 ? 9 : 6;
    for (let k = 0; k < 3; k++) o[i + 6 + k] = o[i + 9 + k] = m[i + under + k];
  }
  return o;
}
function keepsakeShape() {
  reseed(11); const B = builder();
  blob(B, 0, .04, 0, .07, [.93, .9, .84], [.8, .76, .7], [1.3, .6, 1]);
  blob(B, .06, .05, .03, .03, [.55, .66, .82], [.45, .55, .7]);
  return B.out();
}

export function storySystem(G) {
  const b = G.b;
  const St = { health: HEALTH_START, flapQ: .6, keepsakes: [], kept: new Set(), tricks: 0, mate: null, bonus: 0, courtDay: 0, suitor: null, feedT: 0 };
  G.story = St;
  // your mate and young are your own species: rebuilt when Settings > Bird changes
  const ownKind = () => ['hawkGlide', 'hawkUp', 'hawkDown'].forEach((k, i) => G.R.shape(k, hawkShape([{}, { flapL: 1, flapR: 1, handL: -.3, handR: -.3 }, { flapL: -.7, flapR: -.7, handL: .4, handR: .4 }][i])));
  ownKind(); G.on('bird', ownKind);
  G.R.shape('keepsake', keepsakeShape());
  G.dev?.add({ id: 'own-kind', area: 'Story', title: 'Your mate, suitor, young and the neighbours are your own kind, even after you switch birds',
    how: 'Pick the osprey, owl, raven or albatross and fly in spring: the suitor, the texts and the field guide page are that bird. Switch birds with a mate: it changes with you. Try it gives you a mate and a fledgling.',
    go: () => { St.mate ||= { day: G.day, note: `day ${G.day}` }; addKin('young', 16); } });
  // courting time: your own spring (sky.js G.season, by latitude), or any day in the tropics
  const inMarsh = () => G.season.name === 'spring' || G.season.tropic;
  const adult = () => (G.journey?.year || 1) > 1 || G.day > 16;

  // ---- other hawks of your own ----------------------------------------------------------
  const kin = [];   // { kind, p, yaw, s, phase, r, leave }
  const addKin = (kind, r) => { const k = { kind, p: [b.p[0] - 60, b.p[1] + 25, b.p[2] - 40], yaw: b.yaw, s: 12, phase: Math.random() * 6, r, leave: 0 }; kin.push(k); return k; };
  function flyKin(k, dt) {
    // circle a point above the hawk (or wander off, when leaving), banking into the turn
    const above = Math.max(height(b.p[0], b.p[2]), WATER) + (b.state === 'fly' ? 0 : 18);
    const ang = G.t * (12 / k.r) + k.phase;
    let goal = [b.p[0] + Math.cos(ang) * k.r, Math.max(b.p[1], above) + 6 + Math.sin(ang * .7) * 3, b.p[2] + Math.sin(ang) * k.r];
    if (k.leave > 0) { k.leave += dt; goal = [k.p[0] + Math.sin(k.yaw) * 50, k.p[1] + 8, k.p[2] - Math.cos(k.yaw) * 50]; }
    else { const own = G.kinGoal?.(k, dt); if (own) goal = own; }   // a young one learning to soar (wingcraft.js)
    const dx = goal[0] - k.p[0], dz = goal[2] - k.p[2], d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, -dz), turn = angleTo(k.yaw, want);
    k.yaw += clamp(turn, -1.2 * dt, 1.2 * dt);
    k.s = lerp(k.s, clamp(d / 3, 9, Math.max(14, b.s + 3)), dt);
    k.p[0] += Math.sin(k.yaw) * k.s * dt; k.p[2] -= Math.cos(k.yaw) * k.s * dt;
    k.p[1] += clamp(goal[1] - k.p[1], -4, 4) * dt;
    k.p[1] = Math.max(k.p[1], height(k.p[0], k.p[2]) + 4);
  }

  // ---- health ------------------------------------------------------------------------------
  // well fed and watered, health climbs over about a quarter of an hour of play (faster with
  // clean wingbeats); with a meter run low it drifts back down, slowly, never below .15
  G.on('flap', q => { St.flapQ = lerp(St.flapQ, typeof q === 'number' ? q : b.stamina > .35 ? .8 : .4, .08); });
  function health(dt) {
    const fed = G.thirst > .5 && G.hunger > .5, low = G.thirst < .2 || G.hunger < .2;
    if (fed) St.health = Math.min(1, St.health + dt / 900 * (.55 + .45 * St.flapQ) * (G.warmT > 0 ? 2 : 1));
    else if (low && !((G.ease ?? 1) < 1)) St.health = Math.max(.15, St.health - dt / 2400);
    // a young hawk's tail is barred brown; it moults red after the first migration, deeper with health
    G.tailRed = adult() ? .55 + .45 * St.health : St.health * .35;
  }
  const healthWord = h => h < .3 ? 'thin and dull' : h < .55 ? 'fair' : BIRD !== 'hawk' ? (h < .8 ? 'good, the feathers sleek' : 'glossy, in full feather') : h < .8 ? 'good, the tail reddening' : 'glossy, the tail bright red';

  // ---- keepsakes: rare things in the grass, glinting -----------------------------------------
  function keepsakesNear(x, z, r) {
    const out = [];
    for (let j = Math.floor((z - r) / KC); j <= Math.floor((z + r) / KC); j++) for (let i = Math.floor((x - r) / KC); i <= Math.floor((x + r) / KC); i++) {
      if (ih(i, j, 301) > .28) continue;
      const kx = (i + .2 + ih(i, j, 302) * .6) * KC, kz = (j + .2 + ih(i, j, 303) * .6) * KC, y = height(kx, kz), id = `k${i},${j}`;
      if (y < 1.5 || St.kept.has(id)) continue;
      out.push({ id, x: kx, y, z: kz, kind: Math.floor(ih(i, j, 304) * KEEPSAKES.length) });
    }
    return out;
  }
  G.hud.tip('keepsake', () => b.state === 'fly' && keepsakesNear(b.p[0], b.p[2], 35).length > 0, 'Something glints in the grass. Land beside it to pick it up: a keepsake for a nest.');
  function pickUp() {
    for (const k of keepsakesNear(b.p[0], b.p[2], 6)) {
      if (Math.hypot(k.x - b.p[0], k.z - b.p[2]) > 3.5) continue;
      St.kept.add(k.id); St.keepsakes.push(k.kind); G.audio.feather?.(); G.hud.did('keepsake');
      const n = St.keepsakes.length;
      G.hud.tally(`A ${KEEPSAKES[k.kind]}: keepsake ${n}`, 'keepsake');
      G.emit('keepsake', k);
    }
  }
  G.on('land', kind => { if (kind === 'ground') pickUp(); });

  // ---- acrobatics and courtship ---------------------------------------------------------------
  G.on('trick', k => {
    St.tricks++;
    if (inMarsh()) St.bonus += .06;   // showing off where the other hawks can see
    if (St.suitor) G.hud.tally({ stoop: `A stoop! The ${kind()[0]} watches`, tumble: 'A tumble! Your suitor follows' }[k] || `A wingover! The ${kind()[0]} comes closer`, birdKey(BIRD));
  });
  // a song sung well where the other hawks can hear helps too (songs.js emits 'song')
  G.on('song', (sp, q) => { if (inMarsh()) St.bonus += .04 * (typeof q === 'number' ? q : 1); });
  const parts = () => ({ health: St.health, keepsakes: Math.min(1, St.keepsakes.length / COURT.keep), songs: Math.min(1, (G.learned?.size || 0) / COURT.songs), acrobatics: Math.min(1, St.tricks / COURT.tricks) });
  const score = () => { const p = parts(); return .35 * p.health + .2 * p.keepsakes + .25 * p.songs + .2 * p.acrobatics + St.bonus; };
  function tip() {
    const low = Object.entries(parts()).sort((a, c) => a[1] - c[1])[0][0];
    return { health: `${BIRD === 'hawk' ? 'A redder tail' : 'Glossier feathers'} would catch its eye: keep well fed and watered, and flap cleanly.`, keepsakes: 'Keepsakes for a nest would help: rare things glint in the grass along the way.', songs: 'More songs would help: learn them from the songbirds.', acrobatics: 'Some acrobatics would help: a full-speed stoop, or a wingover (bank hard one way, then the other).' }[low];
  }
  function courtship(dt) {
    if (St.mate) {
      // a mate helps raise the chick, bringing a meal now and then (the last is left to you)
      const n = G.nest;
      if (n?.chick && n.fed < 4) { St.feedT += dt; if (St.feedT > 120) { St.feedT = 0; n.fed++; n.fedAt = G.clock; n.mateFed = (n.mateFed || 0) + 1; G.hud.tally(`Your mate fed the chick: ${n.fed} of 5`, 'nest'); } }
      return;
    }
    const S = St.suitor;
    if (!S) {
      if (!inMarsh() || St.courtDay === G.day || b.state !== 'fly') return;
      St.courtDay = G.day; St.bonus = 0;
      St.suitor = { t: 0, k: addKin('suitor', 24) }; G.audio.call?.(BIRD, true);
      G.hud.toast(`A${'aeiou'.includes(kind()[0][0]) ? 'n' : ''} ${kind()[0]} comes circling up on the spring air to look at you. Show it what you can do: stoops, wingovers, songs, ${show()}, keepsakes.`, 7);
      return;
    }
    S.t += dt;
    if (score() >= COURT.need) {
      S.k.kind = 'mate'; S.k.r = 30; St.mate = { day: G.day, note: G.placeNote?.() || `day ${G.day}` }; St.suitor = null;
      G.audio.call?.(BIRD, true); G.audio.learned?.();
      G.hud.toast(`The ${kind()[0]} answers your display and stays at your side. You have found a mate.`, 6);
    } else if (S.t > COURT.time) {
      S.k.leave = .01; St.suitor = null;
      G.hud.toast(`The ${kind()[0]} circles a while, then drifts off. ${tip()} Another may come another day.`, 8);
    }
  }
  G.on('wrap', dx => { for (const k of kin) k.p[0] += dx; });
  G.on('fledged', () => addKin('young', 16 + kin.filter(k => k.kind === 'young').length * 5));
  G.on('newYear', () => { for (const k of kin) if (k.kind === 'young') k.leave = .01; G.hud.glint('The young leave', 'Last year’s young are grown, and fly off to find lands of their own.', birdKey(BIRD)); });

  // ---- the journal ---------------------------------------------------------------------------
  // Journal > Nest: your mate, or what wins one (four bars and what would help most); the keepsakes
  // themselves are a shelf under Journal > Things (ruins.js)
  const sec = journal(G).section(40, 'Your mate');
  sec.el.classList.add('fam3');
  sec.body.innerHTML = '<p class="fnote3"></p><ul class="court3"></ul><p class="ftip3"></p>';
  const bar = (ic, t, v, label) => `<li><span class="si3">${icon(ic)}</span><b>${t}</b><span class="cb3"><i style="width:${Math.round(Math.min(1, v) * 100)}%"></i></span><em>${label}</em></li>`;
  G.menu.onOpen(() => {
    const q = c => sec.body.querySelector(c), p = parts(), songs = G.learned?.size || 0;
    sec.head.firstChild.textContent = St.mate ? 'Your mate' : 'Finding a mate';
    q('.fnote3').textContent = St.mate ? `Met ${St.mate.note.replace(/\.$/, '').replace(/^Day/, 'on day')}, your mate flies with you and brings the chick a meal now and then.`
      : `In spring a${'aeiou'.includes(kind()[0][0]) ? 'n' : ''} ${kind()[0]} may come circling up to look you over. Win it with ${show()}, keepsakes, songs and acrobatics.`;
    q('.court3').innerHTML = St.mate ? '' : [
      bar('health', 'Health', p.health, healthWord(St.health).split(',')[0]),
      bar('keepsake', 'Keepsakes', p.keepsakes, `${Math.min(St.keepsakes.length, COURT.keep)} of ${COURT.keep}`),
      bar('songs', 'Songs', p.songs, `${Math.min(songs, COURT.songs)} of ${COURT.songs}`),
      bar('stoop', 'Acrobatics', p.acrobatics, `${Math.min(St.tricks, COURT.tricks)} of ${COURT.tricks}`),
    ].join('');
    q('.ftip3').textContent = St.mate ? '' : tip();
  });

  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  G.on('mock', k => { St.mate = k >= .5 ? { day: G.day, note: 'Met in a dev mock' } : null; St.tricks = Math.round(k * 12); St.health = Math.max(St.health, .4 + k * .6); });

  return {
    id: 'story',
    kin,
    update(dt) {
      health(dt);
      courtship(dt);
      if (St.mate && !kin.some(k => k.kind === 'mate')) addKin('mate', 30);
      for (const k of kin) flyKin(k, dt);
      for (let i = kin.length - 1; i >= 0; i--) if (kin[i].leave > 12) kin.splice(i, 1);
      // glints over keepsakes, to be seen from the air
      if (Math.random() < .3) for (const k of keepsakesNear(b.p[0], b.p[2], 90)) G.part([k.x + (Math.random() - .5) * .3, k.y + .2, k.z + (Math.random() - .5) * .3], [0, .6, 0], .6, [1, .95, .75], .08);
    },
    scene(S) {
      for (const k of kin) {
        const beat = Math.sin(G.t * 1.3 + k.phase) > .85, ph = (G.t * 7 + k.phase) % 2;
        const shape = !beat ? 'hawkGlide' : ph < 1 ? 'hawkUp' : 'hawkDown', sc = (k.kind === 'young' ? .5 : .62);
        (S.props[shape] ||= []).push(k.p[0], k.p[1], k.p[2], sc, k.yaw - Math.PI / 2, k.kind === 'mate' ? .4 : .55, 0, 0);
        G.sight?.(kind()[1], k.p[0], k.p[1], k.p[2], .9);
      }
      const d = S.props.keepsake ||= [];
      for (const k of keepsakesNear(S.cam[0], S.cam[2], 140)) d.push(k.x, k.y, k.z, 1.4, ih(k.x | 0, 1, 5) * 6, .5, 0, 0);
    },
    save: () => ({ health: +St.health.toFixed(3), keepsakes: St.keepsakes, kept: [...St.kept], tricks: St.tricks, mate: St.mate }),
    load(o) { St.health = o.health ?? HEALTH_START; St.keepsakes = o.keepsakes || []; St.kept = new Set(o.kept || []); St.tricks = o.tricks || 0; St.mate = o.mate || null; },
  };
}
