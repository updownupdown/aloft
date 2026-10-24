// Which bird you fly as: Settings > Your bird picks the red-tail, osprey, barn owl or raven, which
// share the controls (birds.js builds them; this gives each its flight feel in FLY). ?bird=swift,
// heron or mallard tries the others for a session. Each has its own move (moves.js) and life goal (life.js).
import { FLY } from '../flight.js';
import { height, WATER } from '../world.js';
import { BIRD, setBird } from '../hawk.js';
import { BIRDS } from '../birds.js';
import { startLab } from '../birdlab.js';
import { FOOD } from './food.js';
import { FAUNA } from './fauna.js';
import { SWELL } from './swells.js';
import { GOALS } from './life.js';
import { icon } from '../icons.js';

export const CHOICES = ['hawk', 'osprey', 'owl', 'raven', 'albatross'];
const HAWK_FLY = { ...FLY }, HAWK_FOOD = { catchR: FOOD.catchR }, HAWK_FAUNA = { catchR: FAUNA.catchR, catchDive: FAUNA.catchDive, catchH: FAUNA.catchH }, BASE_SWELL = { gain: SWELL.gain, lose: SWELL.lose, top: SWELL.top, elsewhere: SWELL.elsewhere };

// what each bird is good at beyond its flight numbers, and what it gives up
const ABILITY = {
  hawk: { food: {}, fauna: {}, good: ['Steady all-rounder', 'Its tail reddens as it grows strong'], bad: ['Nothing special at night'] },
  osprey: { food: {}, fauna: { catchR: 2.6, catchDive: 2.4, catchH: 3.4 }, good: ['Fastest dive, longest glide', 'Snatches fish from higher up'], bad: ['Wide turns', 'Flapping tires it quickly'] },
  owl: { food: { catchR: 2.1 }, fauna: {}, night: .6, good: ['Sees in the dark', 'Hovers almost still, lands softly', 'Silent: reaches mice from further'], bad: ['Slow', 'Sinks faster in a glide'] },
  raven: { food: {}, fauna: {}, good: ['Tightest turns and rolls', 'Flapping costs little'], bad: ['Lower top speed', 'Hovers poorly'] },
  albatross: { food: {}, fauna: { catchR: 2.4, catchH: 3 }, swell: { gain: 2.4, lose: .2, top: 40, elsewhere: .7 }, good: ['The longest glide of all: it barely needs to flap', 'Twice the speed from every weave over the swells'], bad: ['Turns wide and slow', 'Can’t hover; flapping is hard work'] },
};
// the card's stats, worked out from the flight numbers so they always tell the truth (1 to 5)
const rate = (v, lo, hi) => Math.max(1, Math.min(5, Math.round(1 + 4 * (v - lo) / (hi - lo))));
export function stats(id) {
  const f = { ...HAWK_FLY, ...(BIRDS[id]?.fly || {}) };
  return [
    ['Speed', rate(f.maxS, 30, 52)],
    ['Glide', rate(9.8 / (f.cd * f.best * f.best), 9, 13)],
    ['Agility', rate(f.roll, .7, 1.5)],
    ['Hover', rate(f.flapHover + (5 - f.stallFlare) * .3, 2.7, 5)],
    ['Stamina', rate(-f.flapCost, -.078, -.045)],
  ];
}
const nameOf = id => id === 'hawk' ? 'Red-tailed hawk' : BIRDS[id].name;

export function speciesSystem(G) {
  const tried = BIRD !== 'hawk' && !CHOICES.includes(BIRD) ? BIRD : null;   // a ?bird= study bird
  const use = id => {
    setBird(id); Object.assign(FLY, HAWK_FLY, BIRDS[id]?.fly || {});
    Object.assign(FOOD, HAWK_FOOD, ABILITY[id]?.food || {}); Object.assign(FAUNA, HAWK_FAUNA, ABILITY[id]?.fauna || {}); Object.assign(SWELL, BASE_SWELL, ABILITY[id]?.swell || {});
    G.emit('bird', id);
  };
  if (tried) {
    use(tried);
    setTimeout(() => G.hud.toast?.(`Flying as ${/^[aeiou]/i.test(nameOf(tried)) ? 'an' : 'a'} ${nameOf(tried).toLowerCase()} (a study)`), 1500);
  } else {
    // ?bird=osprey (one of the choices) picks it as if from Settings
    use(BIRD !== 'hawk' ? BIRD : G.store.get('bird', 'hawk'));
    if (!CHOICES.includes(BIRD)) use('hawk');
    G.store.set('bird', BIRD);
  }
  // Settings > Your bird: one card, the bird hovering on the breeze, a button to hear its call (the bird lab's renderer,
  // drawn only while Settings shows); swipe it, or tap a dot, for another bird
  // one colour per stat, so the same stat reads the same across birds
  const STAT_COL = { Speed: '#d0703a', Glide: '#3f88c5', Agility: '#8a5cc6', Hover: '#2e9c86', Stamina: '#c99a1e' };
  const STAT_ICON = { Speed: 'speed', Glide: 'glide', Agility: 'agility', Hover: 'hoverstat', Stamina: 'staminastat' };
  const MOVE = { hawk: 'Kites: flare into the wind to hang still', osprey: 'Plunges: dive into water for deep fish', owl: 'Silent glide: mice don’t hear it', raven: 'Tumbles: flick a bank twice the same way', albatross: 'Dynamic soaring: weave over the swells, up into the wind, down with it' };
  const HOME = { hawk: 'a forest edge by the Finger Lakes', osprey: 'a Scottish loch', owl: 'the Loire farmland', raven: 'a Norwegian fjord', albatross: 'Taiaroa Head, New Zealand' };
  const BLURB = { hawk: 'Soars on thermals, stoops on mice', osprey: 'Long wings, plunges for fish', owl: 'Soft and slow, sees in the dark', raven: 'Agile, rolls and tumbles', albatross: 'Three metres of wing, at home on the open sea' };
  const traits = id => {
    const a = ABILITY[id];
    return `<span class="stats3">${stats(id).map(([k, v]) => `<span class="st3" style="--pc:${STAT_COL[k]}">${icon(STAT_ICON[k])}${k}</span><span class="pips3" style="--pc:${STAT_COL[k]}" aria-label="${v} of 5">${[1, 2, 3, 4, 5].map(n => `<i${n <= v ? ' class="on"' : ''}></i>`).join('')}</span>`).join('')}</span>`
      + (a ? `<span class="traits3">${a.good.map(t => `<span class="good">${t}</span>`).join('')}${a.bad.map(t => `<span class="bad">${t}</span>`).join('')}</span>` : '')
      + (MOVE[id] ? `<span class="traits3"><span class="move">${MOVE[id]}</span><span class="goal">Life goal: ${GOALS[id].title.toLowerCase()}</span></span>` : '');
  };
  const box = G.menu.group('bird');
  box.insertAdjacentHTML('beforeend', `<div class="birdpick3">
    <div class="birdcard3"><canvas aria-hidden="true"></canvas><span class="pic"></span><button class="hear3" aria-label="Hear its call"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none"/></svg></button><b></b><small></small><span class="birdmore3"></span><button class="home3"></button><span class="dots3">${CHOICES.map((c, k) => `<button data-to="${k}" aria-label="${nameOf(c)}"><i></i></button>`).join('')}</span></div></div>${tried ? `<p><small>Flying as ${nameOf(tried).toLowerCase()} for now, a study bird from the link.</small></p>` : ''}`);
  const card = box.querySelector('.birdcard3'), pic = card.querySelector('.pic'), dots = [...card.querySelectorAll('.dots3 button')];
  const show = () => {
    const id = tried || BIRD, i = CHOICES.indexOf(BIRD);
    pic.dataset.bird = id; card.querySelector('b').textContent = nameOf(id); card.querySelector('small').textContent = tried ? 'A study bird' : BLURB[id] || '';
    card.querySelector('.birdmore3').innerHTML = traits(id);
    card.querySelector('.home3').textContent = `Fly from its home: ${HOME[id] || 'its own country'}`;
    card.querySelector('.home3').hidden = !!tried;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };
  show();
  box.addEventListener('click', e => {
    if (e.target.closest('.home3')) {   // start over in this bird's own country (main.js STARTS)
      const [x, z] = G.startOf(BIRD), b = G.b;
      Object.assign(b, { state: 'ground', perch: null, s: 0, vy: 0, settle: .4 }); b.p = [x, Math.max(height(x, z), WATER) + .35, z]; G.home = [x, z];
      G.menu.set(false); G.hud.reply(`You fly from ${HOME[BIRD]}.`, 4); return;
    }
    if (e.target.closest('.hear3')) { G.audio.unlock?.(); G.audio.call?.(tried || BIRD); return; }
    const d = e.target.closest('[data-to]'); if (d && !tried) pick(CHOICES[+d.dataset.to]);
  });
  const pick = id => { use(id); G.store.set('bird', BIRD); show(); };
  const step = n => { if (!tried) pick(CHOICES[(CHOICES.indexOf(BIRD) + n + CHOICES.length) % CHOICES.length]); };
  // swipe the card sideways for the next bird (left) or the one before (right)
  let sx = null, sy = 0;
  card.addEventListener('pointerdown', e => { if (!e.target.closest('button')) { sx = e.clientX; sy = e.clientY; } });
  card.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
  card.addEventListener('pointercancel', () => { sx = null; });
  G.dev?.add({ id: 'albatross', area: 'Birds', round: 'Earth', pr: 215, title: 'Royal albatross: a seabird to fly, from Taiaroa Head',
    how: 'Settings > Journey > Your bird: the albatross, then Fly from its home. Skim low over the sea in S-turns across the wind to soar without flapping.',
    go: () => { use('albatross'); G.store.set('bird', BIRD); show(); card.querySelector('.home3').click(); } });
  let shown = false;
  G.on('menuTab', () => { shown = false; }); G.on('menuPage', (tab, id) => { shown = tab === 'play' && id === 'journey'; });
  G.on('resume', () => { shown = false; });
  queueMicrotask(() => startLab(card.querySelector('canvas'), [pic], () => 'hover', { active: () => shown && G.menu.open, backdrop: false }));
  return {
    id: 'species',
    // the owl's night sight: the dark lifts as if the owl's gift were on
    scene(S) {
      const k = (S.night || 0) * (ABILITY[BIRD]?.night || 0);
      if (!k) return;
      const up = (c, to) => c.map((v, i) => v + (to[i] - v) * k);
      S.skyAmb = up(S.skyAmb, [.36, .4, .5]); S.gndAmb = up(S.gndAmb, [.24, .24, .24]); S.sunCol = up(S.sunCol, [.42, .46, .56]);
    },
  };
}
