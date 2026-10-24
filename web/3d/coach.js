// The coach for the lessons (sys/lessons.js): a card top centre with a phone and two thumbs doing
// the move (the Tutorial's drawings, howto.js thumbs()), the move's name and one line, the keys on a
// keyboard, and a bar that fills while the move is held; ghost thumbs, big soft circles where the
// thumbs rest on each side of the screen, doing the move too (hidden while a thumb is down); and
// a Skip pill, top right, that asks which: this flight or every lesson.
import { thumbs, dir, desk as fine } from './sys/howto.js';
import { icon } from './icons.js';


export function createCoach(ui) {
  ui.insertAdjacentHTML('beforeend', `<div class="coach3 hidden" role="status" aria-live="polite">
      <span class="cth3"></span>
      <span class="ctx3"><small class="cn3"></small><b class="ct3"></b><span class="cl3"></span><small class="ck3"></small><i class="cbar3"><i></i></i>
        <button class="cskip3 hidden">Skip this one</button></span>
      <span class="cok3">${icon('check')}</span>
    </div>
    <div class="ghost3 L hidden"><i></i></div><div class="ghost3 R hidden"><i></i></div>
    <div class="skip3 hidden"><button data-s="ask">Skip</button>
      <span class="sk3 hidden"><button data-s="flight">Skip this flight</button><button data-s="all">Skip all lessons</button><button data-s="no" class="main3">Keep going</button></span></div>`);
  const q = s => ui.querySelector(s);
  const el = q('.coach3'), th = q('.cth3'), n = q('.cn3'), t = q('.ct3'), line = q('.cl3'), keys = q('.ck3'), bar = q('.cbar3 i'), one = q('.cskip3');
  const ghosts = [q('.ghost3.L'), q('.ghost3.R')], skip = q('.skip3'), ask = skip.querySelector('.sk3');
  let key = '';
  const C = {
    onSkip: null, onSkipOne: null,
    // { n, of, title, line, keys, l, r, progress (0..1, or null for no bar), done, skipOne, big (ghost thumbs too) }
    show(o) {
      const k = [o.title, o.line, o.l, o.r, o.n, o.keys].join('|');
      if (k !== key) {
        key = k;
        th.innerHTML = thumbs(o.l || '', o.r || '', 'currentColor');
        n.textContent = o.n ? `${o.n} of ${o.of}` : o.small || '';
        t.textContent = o.title; line.textContent = o.line;
        keys.textContent = o.keys && fine() ? `Keyboard: ${o.keys}` : '';
        for (const [i, g] of ghosts.entries()) {
          const m = i ? o.r : o.l, s = i ? -1 : 1, d = dir(m, s) || [0, 0];
          g.firstChild.className = m ? 'mv-' + m.replace(' ', '-') : '';
          g.style.setProperty('--dx', (d[0] * 26).toFixed(1) + 'px'); g.style.setProperty('--dy', (d[1] * 26).toFixed(1) + 'px');
        }
      }
      el.classList.remove('hidden'); el.classList.toggle('done', !!o.done); el.classList.toggle('mini', !o.big);
      bar.parentNode.classList.toggle('hidden', o.progress == null);
      if (o.progress != null) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, o.progress)).toFixed(3)})`;
      one.classList.toggle('hidden', !o.skipOne);
    },
    hide() { el.classList.add('hidden'); key = ''; C.ghosts(false); },
    // the ghost thumbs show while no thumb is down and the move has thumbs in it
    ghosts(on, input) {
      for (const [i, g] of ghosts.entries()) {
        const P = i ? input?.R : input?.L, has = !!g.firstChild.className;
        g.classList.toggle('hidden', !on || !has || fine() || (P && P.id !== null));
      }
    },
    skipBar(on) { skip.classList.toggle('hidden', !on); if (!on) ask.classList.add('hidden'); },
  };
  skip.addEventListener('click', e => {
    const s = e.target.closest('[data-s]')?.dataset.s; if (!s) return;
    e.stopPropagation();
    if (s === 'ask') ask.classList.toggle('hidden');
    else { ask.classList.add('hidden'); if (s !== 'no') C.onSkip?.(s); }
  });
  for (const ev of ['touchstart', 'pointerdown']) skip.addEventListener(ev, e => e.stopPropagation());
  one.addEventListener('click', e => { e.stopPropagation(); C.onSkipOne?.(); });
  return C;
}
