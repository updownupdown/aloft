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
  // Settings > Your bird: one card, the bird flying through its poses (the bird lab's renderer,
  // drawn only while Settings shows), with arrows either side to pick the one before or after
  const BLURB = { hawk: 'Soars on thermals, stoops on mice', osprey: 'Long wings, plunges for fish', owl: 'Soft and slow, sees in the dark', raven: 'Agile, rolls and tumbles' };
  const box = G.menu.group('bird');
  box.insertAdjacentHTML('beforeend', `<div class="birdpick3"><button class="arr3" data-step="-1" aria-label="The bird before">‹</button>
    <div class="birdcard3"><canvas aria-hidden="true"></canvas><span class="pic"></span><b></b><small></small><span class="dots3">${CHOICES.map(() => '<i></i>').join('')}</span></div>
    <button class="arr3" data-step="1" aria-label="The next bird">›</button></div>${tried ? `<p><small>Flying as ${nameOf(tried).toLowerCase()} for now, a study bird from the link.</small></p>` : ''}`);
  const card = box.querySelector('.birdcard3'), pic = card.querySelector('.pic'), dots = [...card.querySelectorAll('.dots3 i')];
  const show = () => {
    const id = tried || BIRD, i = CHOICES.indexOf(BIRD);
    pic.dataset.bird = id; card.querySelector('b').textContent = nameOf(id); card.querySelector('small').textContent = tried ? 'A study bird' : BLURB[id] || '';
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };
  show();
  box.addEventListener('click', e => {
    const a = e.target.closest('[data-step]'); if (!a || tried) return;
    use(CHOICES[(CHOICES.indexOf(BIRD) + +a.dataset.step + CHOICES.length) % CHOICES.length]); G.store.set('bird', BIRD); show();
  });
  let shown = false;
  G.on('menuTab', id => { shown = id === 'play'; });
  G.on('resume', () => { shown = false; });
  queueMicrotask(() => startLab(card.querySelector('canvas'), [pic], () => 'cycle', { active: () => shown && G.menu.open }));
  return { id: 'species' };
}
