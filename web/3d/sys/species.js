// A study: flying as another species. hawk.js reads ?bird= and swaps the mesh; this gives the
// flight its feel (FLY in flight.js) and says which bird you are. The hawk is untouched without it.
import { FLY } from '../flight.js';
import { BIRD } from '../hawk.js';
import { BIRDS } from '../birds.js';

export function speciesSystem(G) {
  const sp = BIRDS[BIRD];
  if (sp) {
    Object.assign(FLY, sp.fly);
    setTimeout(() => G.hud.toast?.(`Flying as ${/^[aeiou]/i.test(sp.name) ? 'an' : 'a'} ${sp.name.toLowerCase()} (a study)`), 1500);
  }
  return { id: 'species' };
}
