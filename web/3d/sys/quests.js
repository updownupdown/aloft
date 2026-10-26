// Quests (James, 2026-10-26): everything there is to go and do, kept for you, since there is no
// inventory to look in: what is in your talons and where it belongs, what was set down and where it
// waits, the rumours the songbirds told (a circle on the Map), the errands and the long finds, the
// ways between the ages. Journal > Quests lists them; one is followed at a time (Track): it shows on
// the compass, as the next step under it (quiet.js, after an open lesson) and in Today's Next card,
// and every quest with a place is marked on the Map. For those who like to finish everything; the rest
// can ignore the page and still find a tracked step under the compass.
// Systems write quests by id (G.quests.set(id, {...})): { group, title, text, icon, x, z, r (a rumour's
// circle), age (the world it is in, sys/ages.js), steps: [[text, done]], n, of, done }. Quests save here.
// Also kept here: what you hold (one thing in the talons: G.hold(item), G.held(), G.letGo()), the things
// set down (they wait where they were left, glinting, and are taken up again by landing by them), and
// your ledge (K1): a perch you choose (a favourite perch or a hidden place you have found) where
// things you leave are kept and shown, the place every errand comes back to.
import { height, WATER, wrapX, ih } from '../world.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';

// the page's groups, in order
const GROUPS = [
  ['hold', 'In your talons'], ['wait', 'Set down'], ['errand', 'Errands'], ['rumour', 'Rumours'], ['find', 'Long finds'],
  ['sea', 'Crossings'], ['way', 'Ways between the ages'], ['done', 'Done'],
];
const POINT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// a bearing and a distance in words: "3.2 km north-east", "400 m west"
export function whereTo(b, x, z) {
  const dx = wrapX(x - b.p[0]), dz = z - b.p[2], d = Math.hypot(dx, dz);
  if (d < 60) return 'here';
  const a = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2), p = POINT[Math.round(a / (Math.PI / 4)) % 8];
  return `${d < 1000 ? `${Math.round(d / 50) * 50} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`} ${p}`;
}

export function questsSystem(G) {
  const b = G.b, H = G.hud;
  const Q = { list: {}, tracked: null, hold: null, waiting: [], ledge: null, seen: {} };
  const age = () => G.age || 'earth';

  // ---- the quests ---------------------------------------------------------------------------------
  const api = {
    // add or change a quest (a new one is tracked when none is); returns it
    set(id, o) {
      const was = Q.list[id], q = Q.list[id] = { ...(was || { t: G.day || 0 }), ...o, id };
      if (!was && !q.done) {
        if (!Q.tracked && q.x != null && !o.quiet) Q.tracked = id;
        if (!o.quiet) H.tally(`${q.group === 'rumour' ? 'A rumour' : 'New'}: ${q.title}`, q.icon || 'quest');
        G.emit('quest', q);
      }
      return q;
    },
    get: id => Q.list[id],
    done(id, note) {
      const q = Q.list[id]; if (!q || q.done) return;
      q.done = G.day || 1; if (note) q.note = note;
      if (Q.tracked === id) Q.tracked = next();
      H.nextDone?.('quest');
      G.emit('questDone', q);
    },
    drop(id) { delete Q.list[id]; if (Q.tracked === id) Q.tracked = next(); },
    track(id) { Q.tracked = Q.tracked === id ? null : id; H.reply(Q.tracked ? `Following: ${Q.list[id].title}` : 'Not following a quest', 2.5); },
    tracked: () => Q.list[Q.tracked],
    open: () => Object.values(Q.list).filter(q => !q.done),
    all: () => Object.values(Q.list),
  };
  G.quests = api;
  // the next to follow when one ends: the nearest open quest with a place, in this age
  function next() {
    let best = null, bd = 1e9;
    for (const q of api.open()) if (q.x != null && (q.age || 'earth') === age()) { const d = Math.hypot(wrapX(q.x - b.p[0]), q.z - b.p[2]); if (d < bd) { bd = d; best = q.id; } }
    return best;
  }

  // ---- holding a thing ---------------------------------------------------------------------------
  // item: { id, kind (an artefact shape: af_<kind>), name, goes (where it belongs, in words), quest }
  G.held = () => Q.hold;
  G.hold = item => {
    if (Q.hold) setDown(Q.hold, b.p[0], b.p[1], b.p[2]);
    Q.hold = item;
    if (item.quest && Q.list[item.quest]) { Q.list[item.quest].group = 'hold'; Q.tracked = item.quest; }
    G.emit('hold', item);
  };
  G.letGo = () => { const h = Q.hold; Q.hold = null; return h; };
  // set down where you are: it waits there (or on your ledge), glinting, on the Map and the Quests page
  function setDown(item, x, y, z, ledge = false) {
    const w = { ...item, x, y: ledge ? y : Math.max(height(x, z), WATER) + .05, z, ledge, day: G.day, fresh: true };   // fresh: not taken up again till you have left it
    if (!ledge && b.state === 'perch') w.y = y - .12;
    Q.waiting.push(w);
    if (item.quest && Q.list[item.quest]) Object.assign(Q.list[item.quest], { group: 'wait', x, z, where: ledge ? 'On your ledge' : `Set down ${G.placeWhere?.(x, z) || 'here'}` });
    H.tally(ledge ? `${cap(item.name)} left on your ledge` : `${cap(item.name)} set down here: it waits`, 'carry');
  }
  const cap = s => s[0].toUpperCase() + s.slice(1);
  function takeUp(w) {
    Q.waiting = Q.waiting.filter(o => o !== w);
    const { x, y, z, ledge, day, fresh, ...item } = w;
    G.hold(item);
    H.tally(`You take up ${item.name}`, 'carry');
  }

  // ---- your ledge -------------------------------------------------------------------------------
  // where the bird stands is a place that can be a ledge: a favourite perch (still.js) or a found
  // hidden place's perch (hidden.js)
  const spot = () => {
    if (b.state !== 'perch') return null;
    const h = G.hiddenHere?.(); if (h) return { x: h.perch.x, y: h.perch.y, z: h.perch.z, name: h.name };
    const f = G.favHere?.(); if (f) return { x: f.x, y: f.y, z: f.z, name: `your favourite perch, ${G.placeWhere?.(f.x, f.z) || ''}`.replace(/, $/, '') };
    return null;
  };
  const atLedge = () => Q.ledge && b.state === 'perch' && Math.hypot(wrapX(Q.ledge.x - b.p[0]), Q.ledge.z - b.p[2]) < 2.5 && Math.abs(Q.ledge.y - b.p[1]) < 2;
  G.ledge = () => Q.ledge;
  G.atLedge = atLedge;
  (G.actions ||= {}).ledge = {
    label: 'Make this your ledge', icon: 'ledge',
    when: () => !(b.settle > 0) && !b.asleep && !atLedge() && !!spot(),
    run: () => {
      const s = spot(); if (!s) return;
      const had = Q.ledge; Q.ledge = s;
      for (const w of Q.waiting) if (w.ledge) Object.assign(w, { x: s.x + (ih(w.id.length, 3, 1) - .5) * 1.4, y: s.y, z: s.z + (ih(w.id.length, 4, 1) - .5) * 1.4 });
      H.say(had ? 'This is your ledge now: what you kept moves here.' : 'This is your ledge: leave things here to keep them, and come back to it when an errand is done.', { kind: 'event', secs: 5, icon: 'ledge' });
      G.emit('ledge', s);
    },
  };
  G.actions.keep = {
    label: () => `Leave ${Q.hold?.name || 'it'} here`, icon: 'ledge',
    when: () => !!Q.hold && atLedge() && !(b.settle > 0),
    run: () => { const h = G.letGo(); const n = Q.waiting.filter(w => w.ledge).length; setDown(h, Q.ledge.x + Math.cos(n * 2.4) * .7, Q.ledge.y, Q.ledge.z + Math.sin(n * 2.4) * .7, true); G.emit('kept', h); },
  };
  G.actions.takeback = {
    label: () => `Take ${Q.waiting.find(w => w.ledge)?.name || 'it'}`, icon: 'carry',
    when: () => !Q.hold && atLedge() && Q.waiting.some(w => w.ledge) && !(b.settle > 0),
    run: () => { const w = Q.waiting.find(o => o.ledge); if (w) takeUp(w); },
  };
  G.actions.setdown = {
    label: () => `Set ${Q.hold?.name || 'it'} down`, icon: 'carry',
    when: () => !!Q.hold && !atLedge() && (b.state === 'ground' || b.state === 'perch') && !(b.settle > 0) && !b.carry,
    run: () => { const h = G.letGo(); setDown(h, b.p[0], b.p[1], b.p[2]); },
  };

  // ---- the compass, the next step, the Map -----------------------------------------------------
  const here = q => q.x != null && (q.age || 'earth') === age();
  (G.marks ||= []).push(() => {
    const out = [], q = Q.list[Q.tracked];
    if (q && !q.done && here(q)) out.push([q.group === 'rumour' ? 'rumour' : 'quest', q.x, q.z, q.title]);
    if (Q.ledge && Math.hypot(wrapX(Q.ledge.x - b.p[0]), Q.ledge.z - b.p[2]) > 80) out.push(['ledge', Q.ledge.x, Q.ledge.z, 'Your ledge']);
    return out;
  });
  const COL = { hold: '#b8862f', wait: '#b8862f', errand: '#c0533f', rumour: '#5f7fae', find: '#8a6fc0', sea: '#3f8fd0', way: '#3fb0a8' };
  G.mapPlaces = (prev => () => [...(prev?.() || []),
    ...api.open().filter(here).map(q => ({ x: q.x, z: q.z, r: q.r, name: q.title, note: [q.text, q.where].filter(Boolean).join(' '), col: COL[q.group] || '#5f7fae', quest: q.id, tracked: q.id === Q.tracked, rank: 1 })),
    ...(Q.ledge ? [{ x: Q.ledge.x, z: Q.ledge.z, name: 'Your ledge', note: cap(Q.ledge.name) + '.', col: '#b8862f', rank: 1 }] : []),
  ])(G.mapPlaces);
  // the Map opened on a place (the Quests page, Show on map)
  G.showOnMap = (x, z) => { G.mapFocus = [x, z]; G.menu.set(true, 'map'); };

  // ---- Journal > Quests --------------------------------------------------------------------------
  const page = journal(G).page('quests');
  page.addEventListener('click', e => {
    const a = e.target.closest('[data-q]'); if (!a) return;
    const q = Q.list[a.dataset.id];
    if (a.dataset.q === 'track' && q) { api.track(q.id); draw(); }
    if (a.dataset.q === 'map' && q) G.showOnMap(q.x, q.z);
    if (a.dataset.q === 'ledge' && Q.ledge) G.showOnMap(Q.ledge.x, Q.ledge.z);
  });
  const line = q => {
    const far = q.x != null ? (here(q) ? whereTo(b, q.x, q.z) : `in ${G.ageName?.(q.age) || 'another age'}`) : '';
    const steps = q.steps?.length ? `<ul class="qsteps3">${q.steps.map(([t, d]) => `<li class="${d ? 'done' : ''}"><i></i>${esc(t)}</li>`).join('')}</ul>` : '';
    const count = q.of ? `<small class="qn3">${q.n || 0} of ${q.of}</small>` : '';
    return `<li class="q3${q.id === Q.tracked ? ' on' : ''}${q.done ? ' done' : ''}" style="--qc:${COL[q.group] || '#5f7fae'}">
      <span class="qi3">${icon(q.icon || 'quest')}</span>
      <div><b>${esc(q.title)}</b>${count}${q.text ? `<p>${esc(q.text)}</p>` : ''}${steps}
        ${q.done ? `<small>${esc(q.note || `Done on day ${q.done}`)}</small>` : far ? `<small>${esc([q.where, far === 'here' ? 'You are here' : far].filter(Boolean).join(' · '))}</small>` : ''}
        ${!q.done && q.x != null ? `<span class="qb3"><button data-q="track" data-id="${q.id}">${q.id === Q.tracked ? 'Following' : 'Follow'}</button>${here(q) ? `<button data-q="map" data-id="${q.id}">${icon('map')}Map</button>` : ''}</span>` : ''}</div></li>`;
  };
  function draw() {
    const open = api.open(), done = api.all().filter(q => q.done);
    let html = '';
    if (Q.hold) html += `<p class="qhold3">${icon('carry')}<span><b>In your talons: ${esc(Q.hold.name)}</b>${Q.hold.goes ? `<small>${esc(Q.hold.goes)}</small>` : ''}</span></p>`;
    if (Q.ledge) html += `<p class="qhold3">${icon('ledge')}<span><b>Your ledge</b><small>${esc(cap(Q.ledge.name))}${Q.waiting.some(w => w.ledge) ? `: ${Q.waiting.filter(w => w.ledge).map(w => w.name).join(', ')}` : ''}. ${esc(whereTo(b, Q.ledge.x, Q.ledge.z))}.</small></span><button data-q="ledge">${icon('map')}Map</button></p>`;
    for (const [g, title] of GROUPS) {
      const L = g === 'done' ? done.sort((a, c) => c.done - a.done) : open.filter(q => (q.group || 'errand') === g).sort((a, c) => (c.id === Q.tracked) - (a.id === Q.tracked) || a.t - c.t);
      if (!L.length) continue;
      html += g === 'done' ? `<details class="qdone3"><summary>${title} <small>${L.length}</small></summary><ul class="qs3">${L.map(line).join('')}</ul></details>`
        : `<section><h3><span>${title}</span><small class="count3">${L.length}</small></h3><ul class="qs3">${L.map(line).join('')}</ul></section>`;
    }
    page.innerHTML = html || '<p class="muted3">Nothing to go and do yet. Rumours from the songbirds, things to carry home and the long finds collect here, each with a place on the Map. Follow one and it shows on your compass.</p>';
  }
  G.menu.onOpen(draw);
  // Today's Next card: the quest you follow, when no lesson is open
  const nextSec = journal(G).section(4, 'Quest');
  nextSec.body.addEventListener('click', e => {
    const a = e.target.closest('[data-q]')?.dataset.q, q = Q.list[Q.tracked];
    if (a === 'map' && q) G.showOnMap(q.x, q.z);
    if (a === 'all') G.menu.set(true, 'journal', 'quests');
    if (a === 'stop') { Q.tracked = null; nextSec.el.classList.add('hidden'); }
  });
  G.menu.onOpen(() => {
    const q = Q.list[Q.tracked], show = q && !q.done && !G.lessons?.learning;
    nextSec.el.classList.toggle('hidden', !show);
    if (show) nextSec.body.innerHTML = `<p class="nch3">${icon(q.icon || 'quest')}<span>Following</span>${q.of ? `<small>${q.n || 0} of ${q.of}</small>` : ''}</p>
      <p class="ntask3">${esc(q.title)}</p><p class="nsay3">${esc([q.text, here(q) ? whereTo(b, q.x, q.z) : ''].filter(Boolean).join(' '))}</p>
      <div class="nbtns3">${here(q) ? `<button data-q="map" class="main3">Show on map</button>` : ''}<button data-q="stop">Stop following</button><button data-q="all" class="nall3">All quests</button></div>`;
  });

  // ---- the frame --------------------------------------------------------------------------------
  let lineT = 0, glintT = 0;
  G.dev?.add({ id: 'quests', area: 'Menu and map', round: 'Gameplay 10-26', title: 'Quests: Journal > Quests, one followed on the compass and under it, all on the Map', how: 'Learn a song or pick up a treasure: it shows under Journal > Quests. Follow one: a mark on the compass, the next step under it, a circle or a mark on the Map.' });
  G.dev?.add({ id: 'ledge', area: 'Ground and perch', round: 'Gameplay 10-26 K1', title: 'Your ledge: make a favourite perch or a hidden place yours, and keep things there', how: 'Perch on a favourite perch or in a hidden place you found: the action button offers Make this your ledge. Carry a treasure there: Leave it here.' });
  return {
    id: 'quests',
    update(dt) {
      // the next step under the compass: the quest you follow, how far and which way
      if ((lineT -= dt) <= 0) {
        lineT = 1;
        const q = Q.list[Q.tracked];
        if (q && !q.done && here(q)) {
          const d = Math.hypot(wrapX(q.x - b.p[0]), q.z - b.p[2]);
          H.next?.('quest', q.title, q.r && d < q.r ? 'somewhere near: look about' : whereTo(b, q.x, q.z));
        } else H.next?.('quest', null);
      }
      // taking up a thing set down (not on the ledge: the action does that), by landing beside it
      if ((b.state === 'ground' || b.state === 'perch') && !(b.settle > 0)) {
        for (const w of Q.waiting) if (!w.ledge && !w.fresh && !Q.hold && Math.hypot(wrapX(w.x - b.p[0]), w.z - b.p[2]) < 2.6 && Math.abs(w.y - b.p[1]) < 2) { takeUp(w); break; }
      }
      for (const w of Q.waiting) if (w.fresh && Math.hypot(wrapX(w.x - b.p[0]), w.z - b.p[2]) > 8) w.fresh = false;
      // what waits glints now and then
      if ((glintT -= dt) <= 0) {
        glintT = .25;
        for (const w of Q.waiting) if (Math.hypot(wrapX(w.x - b.p[0]), w.z - b.p[2]) < 120) G.part([w.x + (Math.random() - .5) * .3, w.y + .25, w.z + (Math.random() - .5) * .3], [0, .5, 0], .5, [1, .9, .6], .09);
      }
    },
    scene(S) {
      for (const w of Q.waiting) if (Math.abs(wrapX(w.x - S.cam[0])) < 200 && Math.abs(w.z - S.cam[2]) < 200) (S.props['af_' + w.kind] ||= []).push(w.x, w.y + .01, w.z, 1.5, ih(w.id.length, 7, 2) * 6, .5, 0, 0);
      // what you hold, under you in the talons
      const h = Q.hold; if (h && S.props) (S.props['af_' + h.kind] ||= []).push(b.p[0], b.p[1] - (b.state === 'fly' ? .32 : .1), b.p[2], 1.2, b.yaw, .5, 0, 0);
    },
    save: () => Q,
    load(o) { Object.assign(Q, o || {}); },
  };
}
