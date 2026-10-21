// Tips, as a few words and an icon at the bottom of the screen. Swipe one away and it never comes
// back; touch its i to pause and read the whole of it, with a way into How to play. Systems still
// write their tips in full with G.hud.tip(id, when, text); the short line and the icon for each are
// here, keyed by id (a tip not listed shows its full text with a plain dot).
const SHORT = {
  flap: ['up', 'Tap both thumbs to flap'],
  hop: ['dot', 'Tap a green ring to hop there'],
  worms: ['dot', 'Worms! Tap to hop to one'],
  sleep: ['dot', 'Night: tap Sleep to rest till dawn'],
  bank: ['bank', 'One thumb up, one down: turn'],
  climb: ['updown', 'Both up to climb, both down to dive'],
  tuck: ['tuck', 'Thumbs together: stoop'],
  flare: ['flare', 'Thumbs apart: flare and land'],
  aim: ['aim', 'The dots show where you are headed'],
  hunt: ['mouse', 'A mouse! Dive at it'],
  drink: ['drop', 'Land by water to drink'],
  ride: ['spiral', 'Rising air: hold a thumb still'],
  ring: ['ring', 'Fly through the ring'],
  south: ['compass', 'Head south for the winter'],
  twig: ['twig', 'A twig: land beside it'],
  nestbranch: ['twig', 'Perch on a branch to build'],
  keepsake: ['spark', 'Something glints: land by it'],
  song: ['note', 'Copy the songbird'],
  imitate: ['note', 'Tap Sing, then pick a bird to imitate'],
  call: ['call', 'Hold Call to call out'],
};
// 20-unit line icons, drawn in the text colour
const ICON = {
  up: 'M10 16V4M5 9l5-5 5 5',
  bank: 'M3 13l7-6 7 3M14 7l3 3-3 3',
  updown: 'M7 16V4M3 8l4-4 4 4M13 4v12M9 12l4 4 4-4',
  tuck: 'M3 10h5M12 10h5M6 7l3 3-3 3M14 7l-3 3 3 3',
  flare: 'M8 10H3M12 10h5M5 7l-3 3 3 3M15 7l3 3-3 3',
  aim: 'M10 3v2M10 15v2M3 10h2M15 10h2M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  mouse: 'M10 3v11M6 10l4 4 4-4M5 17h10',
  drop: 'M10 3C7 7.5 5.5 10 5.5 12.5a4.5 4.5 0 0 0 9 0C14.5 10 13 7.5 10 3z',
  spiral: 'M10 10a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0',
  ring: 'M10 3.5c2.5 0 4 2.9 4 6.5s-1.5 6.5-4 6.5-4-2.9-4-6.5 1.5-6.5 4-6.5M2 10h5M13 10h5',
  compass: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M10 6l2 6-2-1.5L8 12z',
  twig: 'M3 16L16 4M9 10l-3-4M12 7l3 1',
  spark: 'M10 3v4M10 13v4M3 10h4M13 10h4M6 6l2 2M12 12l2 2M14 6l-2 2M8 12l-2 2',
  note: 'M8 15V5l8-2v10M8 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0M16 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  call: 'M4 8v4h3l5 4V4L7 8zM15 7a4 4 0 0 1 0 6',
  dot: 'M10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
};
const svg = d => `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

export function tipBar(G, ui, H) {
  ui.insertAdjacentHTML('beforeend', `<div class="hint3" role="status"><span class="ic3"></span><span class="tx3"></span><button class="more3" aria-label="Pause and learn more">i</button></div>
    <div class="tipmore3 hidden" role="dialog" aria-label="Tip"><p></p><div><button data-t="how">How to play</button><button data-t="ok" class="main3">Got it</button></div></div>`);
  const el = ui.querySelector('.hint3'), more = ui.querySelector('.tipmore3');
  let tip = null, x0 = null, dx = 0;
  const T = {
    show(t) {
      tip = t; const [ic, short] = SHORT[t.id] || ['dot', t.text];
      el.querySelector('.ic3').innerHTML = svg(ICON[ic] || ICON.dot);
      el.querySelector('.tx3').textContent = short;
      el.style.transform = ''; el.classList.add('show');
    },
    hide() { el.classList.remove('show'); },
    get id() { return tip?.id; },
  };
  // swipe it away, either way: gone for good
  el.addEventListener('pointerdown', e => { if (e.target.closest('.more3')) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
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
  more.addEventListener('click', e => {
    const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
    more.classList.add('hidden'); if (tip) H.did(tip.id);
    if (t === 'how') G.menu.set(true, 'how'); else G.paused = false;
  });
  return T;
}
