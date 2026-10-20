// Which bird you fly as: Settings > Bird cycles the red-tail, osprey, barn owl and raven, which
// share the controls (birds.js builds them; this gives each its flight feel in FLY). ?bird=swift,
// heron or mallard tries the others for a session. The story stays the hawk's for now.
import { FLY } from '../flight.js';
import { BIRD, setBird } from '../hawk.js';
import { BIRDS } from '../birds.js';

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
  const row = G.menu.button('play', { label: '', onClick: el => {
    if (tried) return;
    use(CHOICES[(CHOICES.indexOf(BIRD) + 1) % CHOICES.length]);
    G.store.set('bird', BIRD); label(el);
  } });
  const label = el => { el.innerHTML = `Bird: ${nameOf(BIRD)} <em>${tried ? 'a study bird, from the link' : 'tap for the next; same controls'}</em>`; };
  label(row);
  return { id: 'species' };
}
