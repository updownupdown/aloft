// Which bird you fly as: Settings > Your bird picks the red-tail, osprey, barn owl or raven, which
// share the controls (birds.js builds them; this gives each its flight feel in FLY). ?bird=swift,
// heron or mallard tries the others for a session. Each has its own move (moves.js) and life goal (life.js).
import { FLY } from '../flight.js';
import { BIRD, setBird } from '../hawk.js';
import { BIRDS } from '../birds.js';
import { startLab } from '../birdlab.js';
import { FOOD } from './food.js';
import { FAUNA } from './fauna.js';
import { GOALS } from './life.js';

export const CHOICES = ['hawk', 'osprey', 'owl', 'raven'];
const HAWK_FLY = { ...FLY }, HAWK_FOOD = { catchR: FOOD.catchR }, HAWK_FAUNA = { catchR: FAUNA.catchR, catchDive: FAUNA.catchDive, catchH: FAUNA.catchH };

// what each bird is good at beyond its flight numbers, and what it gives up
const ABILITY = {
  hawk: { food: {}, fauna: {}, good: ['Steady all-rounder', 'Its tail reddens as it grows strong'], bad: ['Nothing special at night'] },
  osprey: { food: {}, fauna: { catchR: 2.6, catchDive: 2.4, catchH: 3.4 }, good: ['Fastest dive, longest glide', 'Snatches fish from higher up'], bad: ['Wide turns', 'Flapping tires it quickly'] },
  owl: { food: { catchR: 2.1 }, fauna: {}, night: .6, good: ['Sees in the dark', 'Hovers almost still, lands softly', 'Silent: reaches mice from further'], bad: ['Slow', 'Sinks faster in a glide'] },
  raven: { food: {}, fauna: {}, good: ['Tightest turns and rolls', 'Flapping costs little'], bad: ['Lower top speed', 'Hovers poorly'] },
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
    Object.assign(FOOD, HAWK_FOOD, ABILITY[id]?.food || {}); Object.assign(FAUNA, HAWK_FAUNA, ABILITY[id]?.fauna || {});
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
  // drawn only while Settings shows), with arrows either side to pick the one before or after
  // one colour per stat, so the same stat reads the same across birds
  const STAT_COL = { Speed: '#d0703a', Glide: '#3f88c5', Agility: '#8a5cc6', Hover: '#2e9c86', Stamina: '#c99a1e' };
  const MOVE = { hawk: 'Kites: flare into the wind to hang still', osprey: 'Plunges: dive into water for deep fish', owl: 'Silent glide: mice don’t hear it', raven: 'Tumbles: flick a bank twice the same way' };
  const BLURB = { hawk: 'Soars on thermals, stoops on mice', osprey: 'Long wings, plunges for fish', owl: 'Soft and slow, sees in the dark', raven: 'Agile, rolls and tumbles' };
  const traits = id => {
    const a = ABILITY[id];
    return `<span class="stats3">${stats(id).map(([k, v]) => `<span class="st3" style="--pc:${STAT_COL[k]}">${k}</span><span class="pips3" style="--pc:${STAT_COL[k]}" aria-label="${v} of 5">${[1, 2, 3, 4, 5].map(n => `<i${n <= v ? ' class="on"' : ''}></i>`).join('')}</span>`).join('')}</span>`
      + (a ? `<span class="traits3">${a.good.map(t => `<span class="good">${t}</span>`).join('')}${a.bad.map(t => `<span class="bad">${t}</span>`).join('')}</span>` : '')
      + (MOVE[id] ? `<span class="traits3"><span class="move">${MOVE[id]}</span><span class="goal">Life goal: ${GOALS[id].title.toLowerCase()}</span></span>` : '');
  };
  const box = G.menu.group('bird');
  box.insertAdjacentHTML('beforeend', `<div class="birdpick3"><button class="arr3" data-step="-1" aria-label="The bird before">‹</button>
    <div class="birdcard3"><canvas aria-hidden="true"></canvas><span class="pic"></span><button class="hear3" aria-label="Hear its call"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none"/></svg></button><b></b><small></small><span class="birdmore3"></span><span class="dots3">${CHOICES.map(() => '<i></i>').join('')}</span></div>
    <button class="arr3" data-step="1" aria-label="The next bird">›</button></div>${tried ? `<p><small>Flying as ${nameOf(tried).toLowerCase()} for now, a study bird from the link.</small></p>` : ''}`);
  const card = box.querySelector('.birdcard3'), pic = card.querySelector('.pic'), dots = [...card.querySelectorAll('.dots3 i')];
  const show = () => {
    const id = tried || BIRD, i = CHOICES.indexOf(BIRD);
    pic.dataset.bird = id; card.querySelector('b').textContent = nameOf(id); card.querySelector('small').textContent = tried ? 'A study bird' : BLURB[id] || '';
    card.querySelector('.birdmore3').innerHTML = traits(id);
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };
  show();
  box.addEventListener('click', e => {
    if (e.target.closest('.hear3')) { G.audio.unlock?.(); G.audio.call?.(tried || BIRD); return; }
    const a = e.target.closest('[data-step]'); if (!a || tried) return;
    use(CHOICES[(CHOICES.indexOf(BIRD) + +a.dataset.step + CHOICES.length) % CHOICES.length]); G.store.set('bird', BIRD); show();
  });
  let shown = false;
  G.on('menuTab', id => { shown = id === 'game'; });
  G.on('resume', () => { shown = false; });
  queueMicrotask(() => startLab(card.querySelector('canvas'), [pic], () => 'hover', { active: () => shown && G.menu.open }));
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
