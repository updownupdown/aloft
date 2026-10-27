// Two small errands with other birds (Q3 and Q6 of the gameplay study), never ones you can fail.
// - The lost bird (Q3): after a storm, near the coast, a small songbird of another land is circling
//   low over the sea, blown off course (vagrants after storms are real). Fly close and it falls in
//   behind you; lead it, at its pace, to land. Safe, it sings its song for you to learn (songs.js
//   callVisitor), and a feather if this is its own continent. Lose it and it waits on the water.
// - The companion's asks (Q6): some dawns your companion hawk flies off to something and waits: a
//   hidden place, a ring course, water. Join it there that day and it brings you a mouse or a feather.
import { height, WATER, wrapX, ringsNear } from '../world.js';
import { coastDist, continentAt } from '../earth.js';
import { SPECIES } from '../../src/songs.js';
import { FOOD } from './food.js';
import { whereTo } from './quests.js';
import { pushBird } from './songbirds.js';

const LOST = { near: 25, back: 6, v: 13, lose: 160, odds: .25 };
const CONT = { 'n-america': 'North America', 's-america': 'South America', europe: 'Europe', africa: 'Africa', asia: 'Asia', oceania: 'Oceania' };
const cap = s => s[0].toUpperCase() + s.slice(1);

export function visitorsSystem(G) {
  const b = G.b, H = G.hud;
  const V = { lost: null, ask: null, asks: 0 };
  const d2 = (x, z) => Math.hypot(wrapX(x - b.p[0]), z - b.p[2]);

  // ---- the lost bird ------------------------------------------------------------------------------
  let stormWas = 0;
  function spawnLost() {
    if (V.lost || G.lessons?.learning) return;
    const here = continentAt(b.p[0], b.p[2]);
    const pool = SPECIES.filter(s => s.cont?.length && !s.cont.includes(here) && !s.spot);
    const fresh = pool.filter(s => !G.learned?.has(s.id)), L = fresh.length ? fresh : pool; if (!L.length) return;
    const sp = L[Math.floor(Math.random() * L.length)];
    // out over the water, a little way off
    let at = null;
    for (let i = 0; i < 16 && !at; i++) { const a = Math.random() * 6.28, r = 250 + Math.random() * 300, x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r; if (height(x, z) < WATER - 1) at = [x, z]; }
    if (!at) return;
    V.lost = { id: sp.id, x: at[0], y: WATER + 5, z: at[1], follow: false, a: 0 };
    G.quests.set('lost', { group: 'errand', icon: 'songs', title: `A lost ${sp.name.toLowerCase()}`, text: `Blown off course by the storm, far from ${sp.cont.map(c => CONT[c]).join(' and ')}. Fly close and it falls in behind you; lead it to land.`, x: at[0], z: at[1] });
    H.say(`A small bird circles low over the water, ${whereTo(b, at[0], at[1])}: blown off course.`, { kind: 'event', secs: 5, icon: 'songs' });
  }
  G.on('newDay', () => { if (!V.lost && coastDist(b.p[0], b.p[2]) < 0 && Math.random() < LOST.odds) setTimeout(spawnLost, 20000); });

  function lostStep(dt) {
    const o = V.lost; if (!o) return;
    const sp = SPECIES[o.id], d = Math.hypot(wrapX(o.x - b.p[0]), o.y - b.p[1], o.z - b.p[2]);
    if (!o.follow) {
      // waiting: little circles over the water (or on it, resting)
      o.a += dt * .9; const cx = o.cx ??= o.x, cz = o.cz ??= o.z;
      o.x = cx + Math.cos(o.a) * 8; o.z = cz + Math.sin(o.a) * 8; o.y += (Math.max(height(o.x, o.z), WATER) + 5 - o.y) * Math.min(1, dt);
      if (d < LOST.near && b.state === 'fly') { o.follow = true; delete o.cx; delete o.cz; H.tally(`The ${sp.name.toLowerCase()} falls in behind you`, 'songs'); G.quests.set('lost', { text: `It follows you now, at its own pace: not too fast. Lead it to land.` }); }
    } else {
      // following: a few metres behind and above, no faster than it can fly
      const f = [Math.sin(b.yaw), -Math.cos(b.yaw)], tx = b.p[0] - f[0] * LOST.back, ty = b.p[1] + 1.2, tz = b.p[2] - f[1] * LOST.back;
      const dx = wrapX(tx - o.x), dy = ty - o.y, dz = tz - o.z, dd = Math.hypot(dx, dy, dz), s = Math.min(dd, LOST.v * dt);
      if (dd > .01) { o.x += dx / dd * s; o.y += dy / dd * s; o.z += dz / dd * s; o.yaw = Math.atan2(dx, -dz); }
      if (d > LOST.lose) { o.follow = false; G.quests.set('lost', { x: o.x, z: o.z, text: 'It could not keep up, and waits where you lost it. Fly back for it, and go slower.' }); H.reply(`The ${sp.name.toLowerCase()} fell behind: it waits`, 3); }
      // land: safe
      if ((b.state === 'ground' || b.state === 'perch') && height(b.p[0], b.p[2]) > WATER + .5 && d < 40) {
        const home = sp.cont.includes(continentAt(b.p[0], b.p[2]));
        V.lost = null;
        G.quests.done('lost', home ? 'Led home to its own land.' : 'Led safe to land.');
        G.callVisitor?.(sp);
        H.say(`The ${sp.name.toLowerCase()} is safe on land. It sings for you: copy it and the song is yours.${home ? ' Its own land, too: a feather.' : ''}`, { kind: 'event', secs: 6, icon: 'songs' });
        if (home) G.feather?.('A lost bird led home');
        G.emit('lostSafe', sp);
      }
    }
    if (V.lost) { const q = G.quests.get('lost'); if (q && (Math.abs(q.x - o.x) > 30 || Math.abs(q.z - o.z) > 30)) G.quests.set('lost', { x: o.x, z: o.z }); }
  }

  // ---- the companion's asks -----------------------------------------------------------------------
  function ask() {
    const C = G.companion; if (!C || V.ask || G.lessons?.learning) return;
    const found = G.hidden?.found?.() || {};
    const opts = [];
    for (const p of G.hidden?.near?.() || []) if (!found[p.id] && p.perch && d2(p.x, p.z) < 3000) opts.push({ x: p.perch.x, y: p.perch.y, z: p.perch.z, what: 'somewhere hidden', id: p.id });
    const r = ringsNear(b.p[0], b.p[2], 2500).find(q => q.k === 0); if (r) opts.push({ x: r.x, y: r.y, z: r.z, what: 'the first ring of a course' });
    const tarn = G.tarns?.length ? { x: G.tarns[0], y: G.tarns[1] + 3, z: G.tarns[2], what: 'water' } : null; if (tarn) opts.push(tarn);
    if (!opts.length) return;
    const o = opts[Math.floor(Math.random() * opts.length)];
    V.ask = { ...o, day: G.day, gift: V.asks++ % 2 ? 'feather' : 'mouse' };
    const go = () => { if (V.ask) C.fly([[o.x, o.y + 6, o.z], [o.x + 6, o.y + 8, o.z], [o.x, o.y + 6, o.z + 6]], 13, go); };
    go();
    G.quests.set('ask', { group: 'errand', icon: 'quest', title: 'Your companion waits', text: `It flew off to ${o.what} and waits there for you, today.`, x: o.x, z: o.z });
    H.say('Your companion calls and flies off, then waits, circling: it has found something to show you.', { kind: 'event', secs: 5, icon: 'quest' });
  }
  G.on('newDay', () => { V.ask = null; if (G.quests.get('ask') && !G.quests.get('ask').done) G.quests.drop('ask'); if (G.offered?.('ask') !== false && Math.random() < .7) setTimeout(ask, 30000); });   // (on the days it is one of the three offers: aims.js)

  G.dev?.add({ id: 'lostbird', area: 'Songs', round: 'Gameplay 10-26 Q3', title: 'A lost bird after a storm', how: 'Near the coast after a storm (or one day in four), a songbird of another land circles over the water: fly close, it follows; lead it to land, slowly, and it sings for you. Go makes one now.', go: () => { V.lost = null; spawnLost(); } });
  G.dev?.add({ id: 'asks', area: 'Ground and perch', round: 'Gameplay 10-26 Q6', title: 'Your companion\'s asks', how: 'Some dawns your companion flies off to a hidden place, a ring course or water, and waits: join it there that day for a mouse or a feather. Go sends it now.', go: () => { V.ask = null; G.quests.drop('ask'); ask(); } });

  return {
    id: 'visitors',
    update(dt) {
      // a storm passing near the coast leaves a lost bird
      const st = G.storm || 0;
      if (st > .5) stormWas = 1;
      else if (stormWas && st < .15) { stormWas = 0; if (coastDist(b.p[0], b.p[2]) < 400) spawnLost(); }
      lostStep(dt);
      // the companion's ask: joined
      const a = V.ask;
      if (a && d2(a.x, a.z) < 30 && Math.abs(b.p[1] - a.y) < 25) {
        V.ask = null; G.companion?.stop(); G.offerDone?.('ask');
        G.quests.done('ask', 'You found it together.');
        if (a.gift === 'mouse') { G.hunger = Math.min(1, (G.hunger ?? 1) + FOOD.mouse); H.tally('Your companion brings you a mouse', 'prey'); }
        else { G.feather?.('Your companion'); }
      }
    },
    scene(S) {
      const o = V.lost; if (!o) return;
      pushBird(S, SPECIES[o.id], o.x, o.y, o.z, o.yaw ?? Math.atan2(-Math.sin(o.a), -Math.cos(o.a)), true, G.t * 14);
    },
    save: () => ({ lost: V.lost, asks: V.asks }),
    load(o) { if (o) { V.lost = o.lost || null; V.asks = o.asks || 0; } },
  };
}
