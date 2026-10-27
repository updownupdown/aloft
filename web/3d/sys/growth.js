// Your bird's growth (James, 2026-10-26): each bird grows on its own, and what one earns never
// passes to another, so you can bring one bird into its prime or grow several by turns.
// Six strengths, each a share over the bird's own flight numbers (species.js), with a most it can
// reach (GROW: steps of `per`; the stamina also takes the feathers):
//   stamina   flapping and hovering cost less (b.endure divides the cost, flight.js)
//   recovery  the wings refill faster (b.recover)
//   speed     a faster top speed (b.speedK times FLY.maxS)
//   climb     stronger wingbeats (b.climbK times the flap's push)
//   lift      rising air carries you up faster (env.liftK, world.js airLift)
//   height    thermals carry you higher before they fade (env.topK times each column's top)
// What grows them, all kept per bird:
//   feathers  the day's aim, each lesson chapter (sys/aims.js, sys/lessons.js): stamina, 3% each, up to 20
//   moults    a good day (four of the day's good things: a roost, a calm meal, fresh water...) grows
//             a notch; two notches and the bird moults: a step in the strength it used most since the last
//   gifts     quests, sets, mastered songs and pages (G.gift): a step each, once each per bird
//   condition health above where a bird starts (HEALTH_START): recovery, speed, climb and lift for
//             as long as it lasts (not counted toward the most a strength can reach)
// Health itself lives here now (once story.js): fed and watered it climbs, run low it drifts down,
// never below .15; it reddens the red-tail's tail. A good evening also makes a strong morning: roost
// well fed and watered and you wake with the wings past full, a gold tip that is spent first (H3).
// The breakdown: Today > Strength, a bar for each with what made it, tapped open.
import { BIRD } from '../hawk.js';
import { env, height, WATER } from '../world.js';
import { journal, esc } from '../journal.js';
import { icon } from '../icons.js';
import { lerp } from '../util.js';

export const HEALTH_START = .35;
export const GROW = {
  stamina: { label: 'Stamina', icon: 'staminastat', col: '#c99a1e', what: 'flapping and hovering cost less', steps: 5, per: .04 },
  recovery: { label: 'Recovery', icon: 'recover', col: '#2e9c86', what: 'your wings refill faster', steps: 6, per: .07 },
  speed: { label: 'Speed', icon: 'speed', col: '#d0703a', what: 'a faster top speed in the dive and the stoop', steps: 6, per: .02 },
  climb: { label: 'Climb', icon: 'climb', col: '#8a5cc6', what: 'stronger wingbeats to climb and take off', steps: 6, per: .05 },
  lift: { label: 'Lift', icon: 'thermal', col: '#3f88c5', what: 'rising air carries you up faster', steps: 6, per: .05 },
  height: { label: 'Height', icon: 'height', col: '#5f7f9a', what: 'thermals carry you higher before they fade', steps: 6, per: .1 },
};
export const FEATHER = { per: .03, most: 20 };   // each feather: stamina +3%, up to 20 feathers
const KEYS = Object.keys(GROW);
// condition: at full health, for as long as the health lasts
const CONDITION = { recovery: .25, speed: .05, climb: .1, lift: .1 };
// the day's good things: once each a day, each does the health a little good; GOOD of them make a good day
const ACTS = {
  roost: 'slept the night on a roost', meal: 'a calm meal on a branch', drink: 'a drink of fresh water', sun: 'dried your wings in the sun',
  course: 'a whole ring course', glide: 'a long glide without a wingbeat', land: 'a land you hadn’t seen', song: 'sang with a songbird', catch: 'a catch', far: 'flew far',
};
const DAY = { good: 4, moult: 2, act: .025, glide: 60, over: .2 };
// what the bird did most, for the strength a moult grows: seconds, counts and kilometres weighed alike
const LEAN = { lift: 1 / 60, height: 1 / 60, speed: 1, climb: 1 / 25, stamina: 1 / 1.5, recovery: 1 / 120 };
const fresh = () => ({ health: HEALTH_START, feathers: 0, notches: 0, moults: [], gifts: [], lean: {}, days: 0, prime: false, today: { day: -1, acts: {} } });

export function growthSystem(G) {
  const b = G.b, H = G.hud;
  const per = {};                                  // per[bird]: what that bird has grown, and its good things today
  let flapQ = .6, glideT = 0, lastS = 1, fedAtSleep = false;
  const cur = () => per[BIRD] ||= fresh();

  // ---- the strengths ---------------------------------------------------------------------------
  // what each source gives a strength, for a bird (or the one flying)
  function parts(k, o = cur()) {
    const g = GROW[k], out = [];
    if (k === 'stamina' && o.feathers) out.push({ what: `${o.feathers} ${o.feathers === 1 ? 'feather' : 'feathers'}`, v: FEATHER.per * Math.min(o.feathers, FEATHER.most), src: 'feathers' });
    const m = o.moults.filter(q => q.stat === k).length;
    if (m) out.push({ what: `${m} ${m === 1 ? 'moult' : 'moults'}`, v: m * g.per, src: 'moults' });
    for (const q of o.gifts) if (q.stat === k) out.push({ what: q.why, v: (q.steps || 1) * g.per, src: 'gift' });
    return out;
  }
  const most = k => GROW[k].steps * GROW[k].per + (k === 'stamina' ? FEATHER.per * FEATHER.most : 0);
  const lasting = (k, o) => Math.min(most(k), parts(k, o).reduce((s, p) => s + p.v, 0));
  const cond = (o = cur()) => Math.max(0, Math.min(1, (o.health - HEALTH_START) / (1 - HEALTH_START)));
  const live = k => (CONDITION[k] || 0) * cond();
  const full = (k, o) => lasting(k, o) >= most(k) - 1e-6;
  const grownOf = (o = cur()) => KEYS.reduce((s, k) => s + lasting(k, o) / most(k), 0) / KEYS.length;
  // a gift or a moult to a strength already at its most goes to the one least grown
  const room = (k, o) => full(k, o) ? KEYS.filter(q => !full(q, o)).sort((a, c) => lasting(a, o) / most(a) - lasting(c, o) / most(c))[0] : k;

  function apply() {
    const o = cur();
    b.endure = 1 + lasting('stamina', o);
    b.speedK = 1 + lasting('speed', o) + live('speed');
    b.climbK = 1 + lasting('climb', o) + live('climb');
    env.liftK = 1 + lasting('lift', o) + live('lift');
    env.topK = 1 + lasting('height', o);
    G.recoverK = 1 + lasting('recovery', o) + live('recovery');
  }
  function primeCheck(o = cur()) {
    if (o.prime || !KEYS.every(k => full(k, o))) return;
    o.prime = true;
    G.audio.learned?.();
    H.say('Your bird is in its prime: every strength grown as far as it goes.', { kind: 'event', secs: 6, icon: 'strength' });
    G.emit('prime', BIRD);
  }

  // ---- feathers ----------------------------------------------------------------------------------
  G.feather = why => {
    const o = cur(); o.feathers++; apply();
    const n = Math.min(o.feathers, FEATHER.most);
    H.tally(o.feathers <= FEATHER.most ? `${why}: a feather. Stamina +${Math.round(n * FEATHER.per * 100)}%` : `${why}: a feather`, 'feather');
    G.audio.ring?.(); primeCheck(); G.emit('grow', 'feather');
  };
  G.feathers = () => cur().feathers;
  G.wingBonus = () => Math.round(lasting('stamina') * 100);

  // ---- gifts: a step in a strength, once for each id, for the bird that earned it ---------------
  G.gift = (stat, why, id, steps = 1) => {
    const o = cur();
    if (id && o.gifts.some(q => q.id === id)) return false;
    const k = room(GROW[stat] ? stat : 'stamina', o);
    if (!k) { o.gifts.push({ stat: null, why, id, day: G.day }); H.tally(`${why}: your bird is already in its prime`, 'strength'); return true; }
    o.gifts.push({ stat: k, why, id, steps, day: G.day });
    apply();
    H.tally(`${why}: ${GROW[k].label.toLowerCase()} +${Math.round(steps * GROW[k].per * 100)}%`, GROW[k].icon);
    primeCheck(); G.emit('grow', 'gift', k);
    return true;
  };
  G.gifted = id => cur().gifts.some(q => q.id === id);

  // ---- health (once story.js) -------------------------------------------------------------------
  G.on('flap', q => { flapQ = lerp(flapQ, typeof q === 'number' ? q : b.stamina > .35 ? .8 : .4, .08); });
  function health(dt) {
    const o = cur(), fed = G.thirst > .5 && G.hunger > .5, low = G.thirst < .2 || G.hunger < .2;
    if (fed) o.health = Math.min(1, o.health + dt / 900 * (.55 + .45 * flapQ) * (G.warmT > 0 ? 2 : 1));
    else if (low && !((G.ease ?? 1) < 1) && !G.timeless) o.health = Math.max(.15, o.health - dt / 2400);
    // a young hawk's tail is barred brown; it moults red after the first migration, deeper with health
    const adult = (G.journey?.year || 1) > 1 || G.day > 16;
    G.tailRed = adult ? .55 + .45 * o.health : o.health * .35;
  }
  const bump = v => { const o = cur(); o.health = Math.min(1, o.health + v); };
  G.story ||= {};
  Object.defineProperty(G.story, 'health', { get: () => cur().health, set: v => { cur().health = Math.max(.15, Math.min(1, v)); }, configurable: true });

  // ---- the day's good things, the good days and the moult --------------------------------------
  // a day is judged when the bird next flies after it (each bird its own days): four good things, a
  // notch; two notches, a moult into the strength it used most
  const today = () => { const o = cur(); if (o.today.day !== G.day) { closeDay(o); o.today = { day: G.day, acts: {} }; } return o.today; };
  function act(k) {
    const t = today(); if (t.acts[k]) return;
    t.acts[k] = 1; bump(DAY.act);
    if (Object.keys(t.acts).length === DAY.good) H.tally('A good day: your bird will grow from it', 'strength');
  }
  const lean = (k, v) => { const o = cur(); o.lean[k] = (o.lean[k] || 0) + v * LEAN[k]; };
  function closeDay(o) {
    if (o.today.day < 0 || Object.keys(o.today.acts).length < DAY.good) return;
    o.days++; o.notches++;
    if (o.notches < DAY.moult) { H.tally(`A good day behind you: ${o.notches} of ${DAY.moult} toward a moult`, 'strength'); return; }
    o.notches = 0;
    const k = room(KEYS.filter(q => !full(q, o)).sort((a, c) => (o.lean[c] || 0) - (o.lean[a] || 0))[0] || 'stamina', o);
    o.lean = {};
    if (!k) return;
    o.moults.push({ stat: k, day: G.day });
    apply();
    G.audio.learned?.();
    H.glint('A moult', `Your new feathers have grown in, the way you have been flying: ${GROW[k].label.toLowerCase()} +${Math.round(GROW[k].per * 100)}% (${GROW[k].what}). See Today > Strength.`, 'strength');
    primeCheck(o); G.emit('grow', 'moult', k);
  }
  G.on('ate', () => { if (b.state === 'perch') act('meal'); });
  G.on('drink', () => act('drink'));
  G.on('ringLoop', () => act('course'));
  G.on('newLand', () => act('land'));
  G.on('song', () => act('song'));
  G.on('catch', () => act('catch'));
  G.on('far', () => act('far'));
  G.on('trick', k => { if (k === 'stoop') lean('speed', 1); });
  G.on('flap', () => { glideT = 0; lean('climb', 1); });
  G.on('seaKm', () => lean('stamina', 1));
  G.on('far', () => lean('stamina', 1));
  G.on('sleep', () => { fedAtSleep = G.hunger > .5 && G.thirst > .5 && cur().health > .55; if (b.state === 'perch') { act('roost'); lean('recovery', 120); } });
  // H3: a good evening, a strong morning
  G.on('wake', early => {
    if (early || !fedAtSleep) return;
    b.over = DAY.over * (.5 + .5 * cond()) * (G.has?.('sheepbell') ? 1.4 : 1);   // the sheep bell (sys/finds.js)
    if (!G.flags.over) { G.flags.over = 1; H.glint('A strong morning', 'You roosted well fed and watered, so your wings start the day past full: the gold tip is spent first.', 'strength'); }
  });

  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  G.on('mock', k => {
    const o = cur(); o.health = Math.max(o.health, .4 + k * .6); o.feathers = Math.round(k * FEATHER.most);
    o.moults = []; for (const q of KEYS) for (let i = 0; i < Math.round(k * GROW[q].steps); i++) o.moults.push({ stat: q, day: 1 });
    o.prime = false; apply(); primeCheck();
  });
  G.on('bird', () => { apply(); });

  // ---- Today > Strength --------------------------------------------------------------------------
  const sec = journal(G).section(7, 'Strength');
  // the ways still open to this bird (F of the review): systems add { stat ('any' for whichever),
  // text, left: () => steps still to earn for the bird flying now (Infinity: no end) }
  const ways = G.ways ||= [];
  ways.push({ stat: 'any', text: 'Moults: good days, two to a moult, into what you do most', left: () => Infinity });
  const open = k => ways.filter(w => w.stat === k && (w.left() || 0) > 0);
  const pct = v => `+${Math.round(v * 100)}%`;
  let openK = null;
  sec.body.addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (!li) return; openK = openK === li.dataset.k ? null : li.dataset.k; draw(); });
  function draw() {
    const o = cur(), c = cond(), acts = Object.keys(today().acts);
    sec.count(o.prime ? 'In its prime' : `${Math.round(grownOf(o) * 100)}% grown`);
    sec.body.innerHTML = `<ul class="grow3">${KEYS.map(k => {
      const g = GROW[k], L = lasting(k, o), M = most(k), lv = live(k), P = parts(k, o);
      return `<li data-k="${k}" class="${openK === k ? 'open' : ''}${full(k, o) ? ' full' : ''}" style="--gc:${g.col}">
        <span class="gi3">${icon(g.icon)}</span><span class="gt3">${g.label}</span>
        <span class="gb3"><i style="width:${(L / M * 100).toFixed(1)}%"></i>${lv ? `<u style="left:${(L / M * 100).toFixed(1)}%;width:${(Math.min(lv, M) / M * 100).toFixed(1)}%"></u>` : ''}</span>
        <em>${pct(L + lv)}</em>
        <div class="gx3"><small>${esc(g.what)}. Grown ${pct(L)} of the most it can, ${pct(M)}.</small>
          <ul>${P.map(p => `<li><span>${esc(p.what)}</span><b>${pct(p.v)}</b></li>`).join('')}${lv ? `<li class="cond"><span>Today’s condition (health)</span><b>${pct(lv)}</b></li>` : ''}${!P.length && !lv ? '<li><span>Nothing yet</span></li>' : ''}</ul>
          ${!full(k, o) && open(k).length ? `<p class="gways3"><b>Still to earn</b>${open(k).map(w => `<span>${esc(w.text)}</span>`).join('')}</p>` : ''}</div>
      </li>`;
    }).join('')}</ul>
    <p class="gday3">${icon('strength')}<span>${o.prime ? 'Every strength is grown as far as it goes.' : `Today: ${acts.length ? acts.map(a => ACTS[a]).join(', ') : 'nothing yet'} (${Math.min(acts.length, DAY.good)} of ${DAY.good} for a good day). Good days toward a moult: ${o.notches} of ${DAY.moult}.`}
      ${c > 0 ? ` Your health adds to recovery, speed, climb and lift while it lasts.` : ''} Each bird grows on its own; a step past a full strength goes to the least grown.</span></p>
    ${o.prime ? '' : `<p class="gways3 gany3"><b>Any strength</b>${open('any').map(w => `<span>${esc(w.text)}</span>`).join('')}</p>`}`;
  }
  G.menu.onOpen(draw);
  // for Settings > Your bird: how far each bird has grown
  G.growth = { of: id => per[id], grown: id => per[id] ? grownOf(per[id]) : 0, prime: id => !!per[id]?.prime, lasting: k => lasting(k), most, GROW, act, draw };

  G.dev?.add({ id: 'growth', area: 'Birds', round: 'Gameplay 10-26', title: 'Your bird’s strength: six strengths per bird from feathers, moults, gifts and health', how: 'Today > Strength: tap a strength for what made it. A good day (four of: roost, calm meal, fresh drink, sunning, ring course, long glide, new land, song, catch, flying far) grows a notch; two and the bird moults into the strength you used most.' });
  G.dev?.add({ id: 'over', area: 'Birds', round: 'Gameplay 10-26 H3', title: 'A strong morning: wings past full after roosting well fed and watered', how: 'Eat and drink, roost and sleep: the wings bar wakes with a gold tip, spent first.' });

  return {
    id: 'growth',
    update(dt) {
      if (cur().today.day !== G.day) today();
      // a journey from before growth: its feathers and health go to the bird flying now
      if (G.oldFeathers != null || G.oldHealth != null) { const o = cur(); o.feathers = Math.max(o.feathers, G.oldFeathers || 0); if (G.oldHealth != null) o.health = G.oldHealth; G.oldFeathers = G.oldHealth = null; apply(); }
      health(dt);
      // the strengths, and condition (health) as it changes; recovery on top of what food.js and the songs set
      apply();
      b.recover = (b.recover ?? 1) * G.recoverK;
      // the gold tip: spent before the wings themselves
      if (b.over > 0 && b.stamina < lastS) { const d = Math.min(b.over, lastS - b.stamina); b.stamina += d; b.over -= d; }
      lastS = b.stamina;
      // what the bird does most, for its next moult
      if (b.state === 'fly') {
        const above = b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER);
        if (b.lift > .8) lean('lift', dt);
        if (above > 180) lean('height', dt);
        if (b.s > 30) lean('speed', dt / 20);
        if ((glideT += dt) > DAY.glide && b.s > 6) act('glide');
      } else { glideT = 0; lean('recovery', dt); }
      if (b.sunning) act('sun');
    },
    save: () => ({ per }),
    load(o) {
      for (const [k, v] of Object.entries(o?.per || {})) per[k] = { ...fresh(), ...v };
      apply();
    },
  };
}
