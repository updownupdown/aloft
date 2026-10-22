// Tips, as a few words and an icon at the top of the screen. Swipe one away and it never comes
// back; touch its i to pause and read the whole of it, with a way into How to play; its gear opens
// How to play > Hints (hints.js), where each group of tips can be turned off. Systems still
// write their tips in full with G.hud.tip(id, when, text); the short line and the icon for each are
// here, keyed by id (a tip not listed shows its full text with a plain dot).
import { icon } from './icons.js';
const SHORT = {
  flap: ['up', 'Tap both thumbs to flap'],
  hop: ['dot', 'Tap a green ring to hop there'],
  ground: ['dot', 'Tap the ground to hop there'],
  worms: ['dot', 'Worms! Tap to hop to one'],
  sleep: ['dot', 'Night: tap Sleep to rest till dawn'],
  bank: ['bank', 'One thumb up, one down: turn'],
  climb: ['updown', 'Both up to climb, both down to dive'],
  tuck: ['tuck', 'Thumbs together and down: stoop'],
  flare: ['flare', 'Thumbs apart and down: brake and land'],
  aim: ['aim', 'The dots show where you are headed'],
  hunt: ['mouse', 'A mouse! Dive at it'],
  drink: ['drop', 'Land by water to drink'],
  ride: ['spiral', 'Rising air: spread wide and circle'],
  ring: ['ring', 'Fly through the ring'],
  south: ['compass', 'Head south for the winter'],
  twig: ['twig', 'A twig: land beside it'],
  nestbranch: ['twig', 'Perch on a branch to build'],
  keepsake: ['spark', 'Something glints: land by it'],
  relic: ['spark', 'Something people left: land by it'],
  song: ['note', 'Copy the songbird'],
  imitate: ['note', 'Tap Sing, then pick a bird to imitate'],
  call: ['call', 'Hold Call to call out'],
  carry: ['mouse', 'Take off to carry your catch'],
  skim: ['glide', 'Skim low: the air cushions you'],
  gust: ['glide', 'A gust: meet it nose up'],
  canopy: ['dot', 'Under the trees: thread the trunks'],
  slip: ['glide', 'Tuck in beside the wild hawk'],
  kite: ['flare', 'Into the wind: flare to kite'],
  plunge: ['tuck', 'Over water: dive in feet first'],
  silent: ['glide', 'Glide silent: mice can’t hear you'],
};
// the Hints page (hints.js) lists tips in these groups, and each group can be turned off:
// [id, title, icon, tip ids]; a tip not listed falls in 'other'
export const TIP_GROUPS = [
  ['flying', 'Flying', 'flap', ['flap', 'bank', 'climb', 'tuck', 'flare', 'aim', 'kite', 'plunge', 'silent']],
  ['air', 'The air', 'thermal', ['ride', 'ring', 'skim', 'gust', 'canopy', 'slip']],
  ['ground', 'Perched and on the ground', 'takeoff', ['hop', 'ground', 'sleep']],
  ['food', 'Food and water', 'prey', ['hunt', 'drink', 'worms', 'carry']],
  ['songs', 'Songs and calls', 'songs', ['song', 'imitate', 'call']],
  ['journey', 'Journey and nest', 'south', ['south', 'twig', 'nestbranch', 'keepsake', 'relic']],
  ['other', 'Other', 'how', []],
];
export const tipGroup = id => (TIP_GROUPS.find(g => g[3].includes(id)) || TIP_GROUPS.at(-1))[0];
// each tip's icon (icons.js), by the names SHORT uses
export const ICON = { glide: 'glide', up: 'flap', bank: 'turn', updown: 'climb', tuck: 'stoop', flare: 'flare', aim: 'aim', mouse: 'prey', drop: 'thirst', spiral: 'thermal',
  ring: 'ring', compass: 'south', twig: 'twig', spark: 'keepsake', note: 'songs', call: 'call' };

export { SHORT };

export function tipBar(G, ui, H) {
  ui.insertAdjacentHTML('beforeend', `<div class="hint3" role="status"><span class="ic3"></span><span class="tx3"></span><button class="more3" aria-label="Pause and learn more">i</button><button class="set3" aria-label="Choose which hints show">${icon('settings')}</button></div>
    <div class="tipmore3 hidden" role="dialog" aria-label="Tip"><p></p><div><button data-t="how">How to play</button><button data-t="ok" class="main3">Got it</button></div></div>`);
  const el = ui.querySelector('.hint3'), more = ui.querySelector('.tipmore3');
  let tip = null, x0 = null, dx = 0;
  const T = {
    show(t) {
      tip = t; const [ic, short] = SHORT[t.id] || ['dot', t.text];
      el.querySelector('.ic3').innerHTML = icon(ICON[ic] || 'how');
      el.querySelector('.tx3').textContent = short;
      el.style.transform = ''; el.classList.add('show');
    },
    hide() { el.classList.remove('show'); },
    get id() { return tip?.id; },
  };
  // swipe it away, either way: gone for good
  el.addEventListener('pointerdown', e => { if (e.target.closest('.more3, .set3')) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
  el.addEventListener('pointermove', e => { if (x0 === null) return; dx = e.clientX - x0; el.style.transform = `translateX(calc(-50% + ${dx}px))`; el.style.opacity = String(Math.max(.2, 1 - Math.abs(dx) / 160)); });
  const up = () => {
    if (x0 === null) return; x0 = null; el.classList.remove('drag'); el.style.opacity = '';
    if (Math.abs(dx) > 50 && tip) { el.style.transform = `translateX(calc(-50% + ${Math.sign(dx) * 400}px))`; H.did(tip.id); setTimeout(() => { el.style.transform = ''; }, 400); }
    else el.style.transform = '';
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  // the i: hold the world still and say it all
  el.querySelector('.more3').addEventListener('click', () => {
    if (!tip) return;
    G.paused = true; more.querySelector('p').textContent = tip.text;
    more.classList.remove('hidden'); T.hide();
  });
  el.querySelector('.set3').addEventListener('click', () => G.menu.set(true, 'how', 'hints'));
  more.addEventListener('click', e => {
    const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
    more.classList.add('hidden'); if (tip) H.did(tip.id);
    if (t === 'how') G.menu.set(true, 'how'); else G.paused = false;
  });
  return T;
}
