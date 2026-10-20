// Which bird you fly as: Settings > Your bird picks the red-tail, osprey, barn owl or raven, which
// share the controls (birds.js builds them; this gives each its flight feel in FLY). ?bird=swift,
// heron or mallard tries the others for a session. The story stays the hawk's for now.
import { FLY } from '../flight.js';
import { BIRD, setBird } from '../hawk.js';
import { BIRDS } from '../birds.js';
import { startLab } from '../birdlab.js';

export const CHOICES = ['hawk', 'osprey', 'owl', 'raven'];
const HAWK_FLY = { ...FLY };
const nameOf = id => id === 'hawk' ? 'Red-tailed hawk' : BIRDS[id].name;

export function speciesSystem(G) {
  const tried = BIRD !== 'hawk' && !CHOICES.includes(BIRD) ? BIRD : null;   // a ?bird= study bird
  const use = id => { setBird(id); Object.assign(FLY, HAWK_FLY, BIRDS[id]?.fly || {}); G.emit('bird', id); };
  if (tried) {
    use(tried);
    setTimeout(() => G.hud.toast?.(`Flying as ${/^[aeiou]/i.test(nameOf(tried)) ? 'an' : 'a'} ${nameOf(tried).toLowerCase()} (a study)`), 1500);
  } else {
    // ?bird=osprey (one of the choices) picks it as if from Settings
    use(BIRD !== 'hawk' ? BIRD : G.store.get('bird', 'hawk'));
    if (!CHOICES.includes(BIRD)) use('hawk');
    G.store.set('bird', BIRD);
  }
  // Settings > Your bird: a card for each, flying through its poses (the bird lab's renderer, drawn
  // only while Settings shows)
  const BLURB = { hawk: 'Soars on thermals, stoops on mice', osprey: 'Long wings, plunges for fish', owl: 'Soft and slow, sees in the dark', raven: 'Agile, rolls and tumbles' };
  const box = G.menu.group('bird');
  box.insertAdjacentHTML('beforeend', `<div class="birdpick3"><canvas aria-hidden="true"></canvas>${CHOICES.map(id => `<button class="birdcard3" data-pick="${id}"><span class="pic" data-bird="${id}"></span><b>${nameOf(id)}</b><small>${BLURB[id] || ''}</small></button>`).join('')}</div>${tried ? `<p><small>Flying as ${nameOf(tried).toLowerCase()} for now, a study bird from the link.</small></p>` : ''}`);
  const grid = box.querySelector('.birdpick3'), cards = [...grid.querySelectorAll('.birdcard3')];
  const mark = () => cards.forEach(c => c.classList.toggle('on', c.dataset.pick === BIRD));
  mark();
  grid.addEventListener('click', e => {
    const c = e.target.closest('[data-pick]'); if (!c || tried) return;
    use(c.dataset.pick); G.store.set('bird', BIRD); mark();
  });
  let shown = false;
  G.on('menuTab', id => { shown = id === 'play'; });
  G.on('resume', () => { shown = false; });
  queueMicrotask(() => startLab(grid.querySelector('canvas'), cards.map(c => c.querySelector('.pic')), el => el.parentElement.classList.contains('on') ? 'cycle' : 'glide', { active: () => shown && G.menu.open }));
  return { id: 'species' };
}
