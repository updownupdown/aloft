// The empty places people left (settle.js places them, ruinshapes.js builds them): drawing the
// farmsteads, villages, hamlets, folds and bridges, and the things left lying about them.
// A glint in the grass by a doorstep, the well, the barn door or up on a lighthouse gallery:
// land beside it (or skim low over it) and you take it. Trinkets brighten your nest (they are
// set round its rim when you next land there) and count as keepsakes, for a mate and for the
// raven's hoard; the treasures are one of a kind, and each tells a little of who lived here.
import { settlementsNear, bridgesNear } from '../settle.js';
import { groundAt, ih } from '../world.js';
import * as M from './ruinshapes.js';
import { journal, esc } from '../journal.js';

const DRAW = 650, NEST_R = 3.2;
const cap = s => s[0].toUpperCase() + s.slice(1);

export function ruinsSystem(G) {
  const R = G.R, b = G.b;
  for (const v of [0, 1, 2]) for (const k of ['cottage', 'farmhouse', 'hut', 'chapel']) R.shape(`ru_${k}${v}`, M[k](v));
  for (const v of [0, 1]) { R.shape('ru_keeper' + v, M.keeper(v)); R.shape('ru_barn' + v, M.barn(v)); }
  for (const k of ['well', 'pump', 'cart', 'boat']) R.shape('ru_' + k, M[k]());
  for (const k in M.ARTEFACT_SHAPES) R.shape('af_' + k, M.artefactMesh(k));
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

  // ---- the journal ----------------------------------------------------------------------------
  const sec = journal(G).section(42, 'Things people left');
  sec.body.innerHTML = '<p class="j-relic"></p><ul class="list3"></ul>';
  G.menu.onOpen(() => {
    const T = Object.keys(St.treasures), all = Object.keys(M.TREASURES).length;
    const counts = {}; for (const k of St.trinkets) counts[k] = (counts[k] || 0) + 1;
    const tr = Object.entries(counts).map(([k, n]) => n > 1 ? `${M.TRINKETS[k].replace(/^an? /, '')} ×${n}` : M.TRINKETS[k].replace(/^an? /, ''));
    sec.body.querySelector('.j-relic').textContent = (St.trinkets.length || T.length)
      ? `Treasures: ${T.length} of ${all}. Trinkets: ${tr.length ? tr.join(', ') : 'none yet'}.${St.nest.length ? ` In your nest: ${St.nest.length} of them.` : ''}${St.kept.length ? ` ${St.kept.length} waiting to go in a nest.` : ''}`
      : 'Nobody lives in the old farms and villages now. Things they left still glint by the doorsteps and wells: land beside one to take it.';
    sec.body.querySelector('ul').innerHTML = T.map(k => `<li>${esc(M.TREASURES[k][0])} <small>${esc(M.TREASURES[k][2])} Found on day ${St.treasures[k].day}${St.treasures[k].place ? `, at ${esc(St.treasures[k].place)}` : ''}.</small></li>`).join('');
  });

  let sets = [], bridges = [], near = [], setT = 0, nearT = 0;
  return {
    id: 'ruins',
    update(dt) {
      if ((setT -= dt) <= 0) { setT = 1; sets = settlementsNear(b.p[0], b.p[2], DRAW + 50); bridges = bridgesNear(b.p[0], b.p[2], DRAW); }
      if ((nearT -= dt) <= 0) {
        nearT = .5; near = [];
        for (const S of sets) if (Math.hypot(S.x - b.p[0], S.z - b.p[2]) < 260) near.push(...artefactsOf(S));
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
      for (const T of sets) {
        if (Math.hypot(T.x - cam[0], T.z - cam[2]) > DRAW + 40) continue;
        for (const bd of T.build) {
          const v = bd.kind === 'barn' || bd.kind === 'keeper' ? Math.min(bd.v, 1) : bd.v, name = ['well', 'pump', 'cart', 'boat'].includes(bd.kind) ? 'ru_' + bd.kind : `ru_${bd.kind}${v}`;
          (S.props[name] ||= []).push(bd.x, bd.y, bd.z, 1, bd.yaw, .5, 0, 0);
        }
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
    save: () => ({ found: [...St.found], treasures: St.treasures, trinkets: St.trinkets, kept: St.kept, nest: St.nest }),
    load(o) { St.found = new Set(o?.found || []); St.treasures = o?.treasures || {}; St.trinkets = o?.trinkets || []; St.kept = o?.kept || []; St.nest = o?.nest || []; },
  };
}
