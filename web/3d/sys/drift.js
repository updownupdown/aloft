// What floats: icebergs in the cold seas (the far north and south, and down the North Atlantic),
// pans of sea ice along the pack's edge with seals hauled out on them, driftwood logs on every
// ocean, and now and then a bottle with a note curled inside, left by people long gone. A bird can
// stand on a berg, a pan or a log (world.js solidsNear, through env.solids); skim low over a
// bottle to pick it up: it joins your keepsakes, and its note the Journal.
// All of it is placed by hash in cells (the same berg is always in the same place).
import { height, WATER, ih, env, latAt } from '../world.js';
import { oceanAt } from '../earth.js';
import { berg, floe, driftwood, bottle } from './oceanshapes.js';
import { journal, esc } from '../journal.js';

export const DRIFT = { bergCell: 700, bergR: 2200, floeCell: 70, floeR: 360, woodCell: 450, woodR: 700, bottleCell: 1900, bottleR: 900, refresh: 25 };
const NOTES = [
  'If anyone finds this: the lamp oil is in the blue shed. Keep the light lit for us. M.',
  'Day forty. The birds come every morning now, as if they are checking on us.',
  'We are leaving the island today. The terns can have it back.',
  'To whoever reads this: I hope the sea is kind to you. It was to me, mostly.',
  'A list for the boat: rope, water, the green jumper, the good knife. Do not forget the cat.',
  'They say the whales sing louder now that the engines have stopped. I think it is true.',
  'Happy birthday, Ana. I am throwing this into the sea because I cannot reach you any other way.',
  'Seed vault coordinates are on the back. Plant them somewhere they will be left alone.',
  'The lighthouse keeper says the birds know the way better than any chart. Follow the birds.',
  'If found, please return to the sea. It has further to go.',
  'Tide tables, 1 to 30 June. Low water at dawn, all month. The best month for shells.',
  'We counted a thousand albatross today and then gave up counting.',
];

export function driftSystem(G) {
  const b = G.b, R = G.R, H = G.hud;
  R.shape('bergT', berg(false)); R.shape('bergP', berg(true)); R.shape('floe', floe()); R.shape('drift', driftwood()); R.shape('bottle', bottle());
  const found = new Set(G.store.get('bottles3d', [])), notes = G.store.get('bottleNotes3d', []);
  const once = (id, title, msg, ic, how) => { if (!G.flags[id]) { G.flags[id] = 1; G.hud.quietly(how, title, msg, ic); } };
  let list = { bergs: [], floes: [], woods: [], bottles: [] }, from = null;
  const seals = new Map();   // floe id -> the moment its seal slid in

  // ---- where they are ----------------------------------------------------------------------
  const cold = (lat, o) => o.travel === 'ice' ? 1 : lat > 44 && o.key === 'atlantic-n' ? smooth01((lat - 44) / 14) * .7 : lat < -46 ? smooth01((-lat - 46) / 8) * .8 : 0;
  function bergAt(gx, gz) {
    const x = (gx + .2 + ih(gx, gz, 431) * .6) * DRIFT.bergCell, z = (gz + .2 + ih(gx, gz, 432) * .6) * DRIFT.bergCell;
    const o = oceanAt(x, z); if (!o) return null;
    const lat = latAt(x, z); if (ih(gx, gz, 433) > cold(lat, o) * .6 || height(x, z) > -8) return null;
    const peaked = ih(gx, gz, 434) < .45, s = peaked ? 12 + ih(gx, gz, 435) * 14 : 22 + ih(gx, gz, 435) * 40;
    return { id: gx * 100003 + gz, x, z, s, peaked, yaw: ih(gx, gz, 436) * 6.283 };
  }
  function floeAt(gx, gz) {
    const x = (gx + .2 + ih(gx, gz, 441) * .6) * DRIFT.floeCell, z = (gz + .2 + ih(gx, gz, 442) * .6) * DRIFT.floeCell;
    const lat = Math.abs(latAt(x, z)); if (lat < 60 || ih(gx, gz, 443) > (lat - 60) / 14 || height(x, z) > -.6) return null;
    const s = 3 + ih(gx, gz, 444) * 7, id = gx * 100003 + gz;
    return { id, x, z, s, yaw: ih(gx, gz, 445) * 6.283, seal: ih(gx, gz, 446) < .14 && s > 5 };
  }
  function woodAt(gx, gz) {
    const x = (gx + .2 + ih(gx, gz, 451) * .6) * DRIFT.woodCell, z = (gz + .2 + ih(gx, gz, 452) * .6) * DRIFT.woodCell;
    if (ih(gx, gz, 453) > .28 || height(x, z) > -2) return null;
    const o = oceanAt(x, z); if (!o || o.travel === 'ice') return null;
    return { id: gx * 100003 + gz, x, z, s: 4 + ih(gx, gz, 454) * 5, yaw: ih(gx, gz, 455) * 6.283 };
  }
  function bottleAt(gx, gz) {
    const x = (gx + .2 + ih(gx, gz, 461) * .6) * DRIFT.bottleCell, z = (gz + .2 + ih(gx, gz, 462) * .6) * DRIFT.bottleCell, id = `b${gx},${gz}`;
    if (ih(gx, gz, 463) > .3 || found.has(id) || height(x, z) > -2 || !oceanAt(x, z)) return null;
    return { id, x, z, note: Math.floor(ih(gx, gz, 464) * NOTES.length) };
  }
  const scan = (cell, r, at, x0, z0) => {
    const out = [], a = Math.floor((x0 - r) / cell), c = Math.floor((x0 + r) / cell), d = Math.floor((z0 - r) / cell), e = Math.floor((z0 + r) / cell);
    for (let gz = d; gz <= e; gz++) for (let gx = a; gx <= c; gx++) { const o = at(gx, gz); if (o) out.push(o); }
    return out;
  };
  function refresh(x, z) {
    from = [x, z];
    if (height(x, z) > 40) { list = { bergs: [], floes: [], woods: [], bottles: [] }; return; }
    list = { bergs: scan(DRIFT.bergCell, DRIFT.bergR, bergAt, x, z), floes: scan(DRIFT.floeCell, DRIFT.floeR, floeAt, x, z), woods: scan(DRIFT.woodCell, DRIFT.woodR, woodAt, x, z), bottles: scan(DRIFT.bottleCell, DRIFT.bottleR, bottleAt, x, z) };
  }

  // ---- standing on them --------------------------------------------------------------------
  // a broad top: a hard rim all round, and a landing spot right under the bird wherever it comes
  // down on top (a pillar so narrow it has no sides of its own)
  const bob = (o, k = .06) => Math.sin(G.t * .9 + o.id) * k;
  function top(o, r, y, out, x, z) {
    out.push({ x: o.x, z: o.z, r, y0: -4, top: y, perch: { x: o.x, y: -999, z: o.z, top: true } });
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), k = d > r * .85 ? r * .85 / d : 1;
    out.push({ x: o.x + dx * k, z: o.z + dz * k, r: .4, y0: y - .2, top: y, perch: { x: o.x + dx * k, y, z: o.z + dz * k, top: true } });
  }
  env.solids.push((x, z, r, out) => {
    for (const o of list.bergs) if (Math.abs(o.x - x) < r + o.s && Math.abs(o.z - z) < r + o.s) {
      if (o.peaked) out.push({ x: o.x, z: o.z, r: o.s * .75, y0: -4, top: o.s * 1.2, perch: { x: o.x + o.s * .3, y: o.s * 1.25, z: o.z + o.s * .1, top: true } });
      else top(o, o.s * .98, o.s * .35, out, x, z);
    }
    for (const o of list.floes) if (Math.abs(o.x - x) < r + o.s && Math.abs(o.z - z) < r + o.s) top(o, o.s * .8, .12 + bob(o, .03), out, x, z);
    for (const o of list.woods) if (Math.abs(o.x - x) < r + o.s && Math.abs(o.z - z) < r + o.s) out.push({ x: o.x, z: o.z, r: .5, y0: -1, top: .06 + bob(o), perch: { x: o.x, y: .06 + bob(o) + o.s * .06, z: o.z, top: true, a: o.yaw } });
  });
  G.on('land', kind => {
    if (kind !== 'perch') return;
    const near = (L, r) => L.some(o => Math.hypot(o.x - b.p[0], o.z - b.p[2]) < r(o));
    if (near(list.bergs, o => o.s * 1.1)) once('berg', 'Iceberg', 'An iceberg: rest a while. The cold seas have few other perches, and the bergs drift south a long way.', 'pin');
    else if (near(list.floes, o => o.s)) once('floe', 'Sea ice', 'A pan of sea ice, rocking gently. The seals haul out on these to rest.', 'pin');
    else if (near(list.woods, o => o.s)) once('driftwood', 'Driftwood', 'A drifting log, salt-silvered: a perch in the middle of the sea.', 'pin');
  });

  // ---- bottles -----------------------------------------------------------------------------
  const sec = journal(G).section(42, 'Messages in bottles');
  const show = () => { sec.body.innerHTML = notes.length ? `<ul class="bottles3">${notes.map(n => `<li>“${esc(NOTES[n.note] || '')}”<br><small>${esc(n.where || '')}</small></li>`).join('')}</ul>` : '<p class="muted3">None yet. They drift on every ocean; skim low over one to pick it up.</p>'; };
  show(); G.menu?.onOpen?.(show);
  function pick(o) {
    found.add(o.id); G.store.set('bottles3d', [...found]);
    notes.push({ note: o.note, where: G.placeNote?.(o.x, o.z) || '' }); G.store.set('bottleNotes3d', notes);
    list.bottles = list.bottles.filter(q => q !== o);
    G.story?.keepsakes?.push('message in a bottle');
    G.audio.feather?.(); G.emit('keepsake', { kind: 'bottle' });
    H.glint('A bottle', `A bottle, with a note curled inside: “${NOTES[o.note]}”`, 'keepsake');
  }

  G.dev?.add({ id: 'drift', title: 'Icebergs, sea ice, driftwood and bottles', area: 'World', how: 'Bergs in the cold seas and down the North Atlantic, pans of ice with seals near the poles, logs and bottles on every ocean. Stand on a berg, a pan or a log; skim low over a bottle for its note (Journal > Log). Go puts you by the nearest berg, else log, else bottle.',
    go: () => {
      const pickO = L => L.sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
      const o = pickO(list.bergs) || pickO(list.woods) || pickO(list.bottles); if (!o) return H.reply('Nothing drifting near', 2);
      b.state = 'fly'; b.p = [o.x - 50, 18 + (o.s || 0) * .4, o.z]; b.yaw = Math.PI / 2; b.s = 8; b.gamma = 0; b.vy = 0;
    } });

  return {
    id: 'drift',
    update(dt) {
      if (!from || Math.hypot(b.p[0] - from[0], b.p[2] - from[1]) > DRIFT.refresh) refresh(b.p[0], b.p[2]);
      if (b.state === 'fly' && b.p[1] - WATER < 3) for (const o of list.bottles) if (Math.hypot(o.x - b.p[0], o.z - b.p[2]) < 2.2 + (G.aim?.focus || 0)) { pick(o); break; }
      // a seal slides off its pan when you come close
      for (const o of list.floes) if (o.seal && !seals.has(o.id) && Math.hypot(o.x - b.p[0], o.z - b.p[2]) < 22 && b.p[1] < 30) {
        seals.set(o.id, G.clock); for (let i = 0; i < 8; i++) G.part([o.x, WATER, o.z], [(Math.random() - .5) * 2, 2 + Math.random() * 2, (Math.random() - .5) * 2], .8, [.88, .93, .95], .06); G.audio.splash(false);
      }
      for (const [id, t] of seals) if (G.clock - t > 90) seals.delete(id);
    },
    scene(S) {
      const cam = S.cam, vis = (o, r) => Math.abs(o.x - cam[0]) < r && Math.abs(o.z - cam[2]) < r;
      const T = S.props.bergT ||= [], P = S.props.bergP ||= [], F = S.props.floe ||= [], D = S.props.drift ||= [], B = S.props.bottle ||= [], SL = S.props.seal ||= [];
      for (const o of list.bergs) if (vis(o, 2400)) (o.peaked ? P : T).push(o.x, -.3, o.z, o.s, o.yaw, .5, 0, 0);
      for (const o of list.floes) if (vis(o, 400)) {
        F.push(o.x, bob(o, .03), o.z, o.s, o.yaw, .5, 0, 0);
        if (o.seal && !seals.has(o.id)) { SL.push(o.x, .12 + bob(o, .03), o.z, 1.4, o.yaw + 1, .5, 0, 0); G.sight?.(latAt(o.x, o.z) < 0 ? 'furseal' : 'seal', o.x, .3, o.z, .8); }
      }
      for (const o of list.woods) if (vis(o, 600)) D.push(o.x, bob(o) - .02, o.z, o.s, o.yaw, .5, 0, 0);
      for (const o of list.bottles) if (vis(o, 300)) {
        B.push(o.x, bob(o, .05), o.z, .9, G.t * .2 + o.x, .5, 0, 0);
        // a glint, to be seen from the air
        if (Math.sin(G.t * 2.3 + o.x) > .7 && G.light.daylight > .3) S.motes.push(o.x, .3, o.z, 1, .98, .85, 3);
      }
    },
  };
}
function smooth01(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
