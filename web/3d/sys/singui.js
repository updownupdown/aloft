// Singing from a perch, and the hawk's call. While the hawk sits (or stands near a singing
// songbird), a Sing button waits bottom left; tap it and the song controls open:
//   right edge  the note pad, five rows from low (bottom) to high, each its own colour. The row
//               is the pitch and the touch is the kind of syllable: tap for a chip, hold for a
//               whistle, wiggle up and down for a trill, rub left and right for a buzz. Each
//               touch sings one syllable, and two thumbs can sing at once.
//   beside it   the legend of those four touches, stacked; its chevron folds it away
//   bottom left the song card: the bird you imitate, its name (or a moment's cheer) and its
//               score (each syllable's kind and pitch, the next one boxed). Its chevron opens
//               the large card: the song's words, Hear it, Slow practice and every bird you
//               know, to pick one to imitate (a mark on those singing nearby)
//   above it    Done, which closes the controls again
// Pick a bird and you sing in its voice, imitating it: play its score through and a bird of that
// kind answers (once you have learned it). Left-handed, the sides swap. Everything sits above the
// canvas, so a thumb on it never reaches the wings; the look is all in songs.css (classes and the
// --note colours), so a restyle need not touch this file.
// The Call button screams: hold it longer to call louder.

export const NOTE_COLS = ['#2f4a74', '#3e7c88', '#608842', '#c49234', '#b04e3a'];
export const KINDS = [['w', 'Whistle'], ['c', 'Chip'], ['t', 'Trill'], ['b', 'Buzz']];
// a little drawing of each kind of syllable, as on a sonogram: the trill shakes up and down, the
// buzz rubs left and right
const GLYPH = {
  w: '<path d="M5 13 Q20 5 35 10" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  c: '<path d="M17 5 L23 15" stroke-width="3.6" fill="none" stroke-linecap="round"/>',
  t: '<path d="M4 10 l4 -5 l4 10 l4 -10 l4 10 l4 -10 l4 10 l4 -10 l4 5" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  b: '<path d="M11 3 L29 5 L11 7.5 L29 10 L11 12.5 L29 15 L11 17" stroke-width="1.7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
};
export const glyph = k => `<svg viewBox="0 0 40 20" aria-hidden="true">${GLYPH[k] || GLYPH.w}</svg>`;
// the touches, in the legend's order: [kind, word]
const TOUCHES = [['c', 'tap'], ['w', 'hold'], ['t', 'wiggle'], ['b', 'rub']];
const CHEVRON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5l5-5 5 5" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// a touch on the pad: still for TAP seconds is a hold; a path longer than MOVE px is a wiggle or a
// rub (by which way it went), and past DECIDE px it sings at once
const TAP = .22, MOVE = 10, DECIDE = 22;

import { songbirdPic } from '../pics.js';
import { store } from '../util.js';

const css = new URL('./songs.css', import.meta.url).href;
if (!document.querySelector(`link[href="${css}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: css }));

export function createSingUI(ui, { audio, voice, onSyll, onPick, onCall, onPractice, onHear }) {
  ui.insertAdjacentHTML('beforeend', `<div class="sing3 hidden">
      <button class="singbtn3"><span class="pic3"></span><b>Sing</b></button>
      <div class="notepad3">${NOTE_COLS.map((c, i) => `<i data-lane="${i}" style="--note:${c}"></i>`).reverse().join('')}</div>
      <button class="sgdone3" aria-label="Stop singing">✕ Done</button>
      <div class="sglegend3"><button class="sgfold3" aria-label="Hide the touches">${CHEVRON}</button>
        ${TOUCHES.map(([k, w]) => `<div data-kind="${k}">${glyph(k)}<span>${w}</span></div>`).join('')}</div>
      <div class="songcard3">
        <div class="sghead3"><span class="pic3"></span><span class="txt3"><b></b><i></i></span><button class="sgmore3" aria-label="More">${CHEVRON}</button></div>
        <div class="score3"></div>
        <div class="sgtools3"><button class="hearit3"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z"/></svg>Hear it</button><button class="slow3">Slow</button></div>
        <div class="birds3"><header>Imitate a bird</header><div class="cards3"></div></div>
      </div>
    </div>
    <button class="call3" aria-label="Hawk call">Call</button>`);
  const root = [...ui.querySelectorAll('.sing3')].at(-1), q = s => root.querySelector(s);
  const pad = q('.notepad3'), card = q('.songcard3'), legend = q('.sglegend3'), score = q('.score3'), cards = q('.cards3');
  const name = card.querySelector('b'), words = card.querySelector('i'), pic = card.querySelector('.pic3'), singPic = q('.singbtn3 .pic3'), callBtn = [...ui.querySelectorAll('.call3')].at(-1);
  const rows = [...pad.children].sort((a, b) => a.dataset.lane - b.dataset.lane);
  const keys = [...legend.querySelectorAll('[data-kind]')];
  const S = { ready: false, on: false, kind: 'w', species: '', score: '', name: '', cheer: '' };
  let cheerTimer = 0;
  const flash = (el, cls = 'hit') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ---- the note pad ----------------------------------------------------------------------------
  const laneAt = y => {
    for (const r of rows) { const b = r.getBoundingClientRect(); if (y >= b.top - 3 && y <= b.bottom + 3) return +r.dataset.lane; }
    const b = pad.getBoundingClientRect(); return y < b.top + b.height / 2 ? 4 : 0;
  };
  function sound(lane, kind) {
    flash(rows[lane]); const key = keys.find(d => d.dataset.kind === kind); if (key) flash(key, 'hit');
    audio.note(lane, voice(), .18, kind); onSyll(lane, kind);
  }
  const touches = new Map();
  function decide(t) {
    if (t.done) return; t.done = true; clearTimeout(t.timer);
    const moved = t.sx + t.sy > MOVE;
    sound(t.lane, !moved ? (t.up ? 'c' : 'w') : t.sy >= t.sx ? 't' : 'b');
  }
  pad.addEventListener('pointerdown', e => {
    e.preventDefault(); pad.setPointerCapture?.(e.pointerId); audio.unlock();
    const t = { lane: laneAt(e.clientY), x: e.clientX, y: e.clientY, sx: 0, sy: 0, done: false, up: false };
    t.timer = setTimeout(() => decide(t), TAP * 1000);
    touches.set(e.pointerId, t); rows[t.lane].classList.add('down');
  });
  pad.addEventListener('pointermove', e => {
    const t = touches.get(e.pointerId); if (!t || t.done) return;
    t.sx += Math.abs(e.clientX - t.x); t.sy += Math.abs(e.clientY - t.y); t.x = e.clientX; t.y = e.clientY;
    if (t.sx + t.sy > DECIDE) decide(t);
  });
  const lift = e => {
    const t = touches.get(e.pointerId); if (!t) return;
    touches.delete(e.pointerId); t.up = true;
    if (e.type === 'pointercancel') { t.done = true; clearTimeout(t.timer); } else decide(t);
    if (![...touches.values()].some(o => o.lane === t.lane)) rows[t.lane].classList.remove('down');
  };
  pad.addEventListener('pointerup', lift); pad.addEventListener('pointercancel', lift);

  // ---- open and close: Sing, Done, the legend's fold, the card's chevron ----------------------
  const setOn = on => {
    S.on = on; root.classList.toggle('on', on);
    if (!on) { big(false); for (const [, t] of touches) clearTimeout(t.timer); touches.clear(); rows.forEach(r => r.classList.remove('down')); }
  };
  const big = on => { root.classList.toggle('big', on); card.querySelector('.sgmore3').setAttribute('aria-label', on ? 'Less' : 'More'); };
  const fold = off => { root.classList.toggle('fold', off); legend.querySelector('.sgfold3').setAttribute('aria-label', off ? 'Show the touches' : 'Hide the touches'); store.set('singLegendOff', off); };
  fold(store.get('singLegendOff', false));
  q('.singbtn3').addEventListener('click', () => { audio.unlock(); setOn(true); });
  q('.sgdone3').addEventListener('click', () => setOn(false));
  legend.querySelector('.sgfold3').addEventListener('click', () => fold(!root.classList.contains('fold')));
  card.querySelector('.sghead3').addEventListener('click', () => { audio.unlock(); big(!root.classList.contains('big')); });
  q('.hearit3').addEventListener('click', () => { audio.unlock(); onHear?.(); });
  q('.slow3').addEventListener('click', () => {
    // slow practice: the bird's phrase loops at half speed, the next note lit on the pad
    S.practice = !S.practice; root.classList.toggle('practice', S.practice); onPractice?.(S.practice);
  });
  cards.addEventListener('click', e => {
    const b = e.target.closest('[data-sp]'); if (!b) return;
    audio.unlock(); big(false); onPick(b.dataset.sp === 'none' ? null : +b.dataset.sp);
  });
  for (const el of [root, callBtn]) el.addEventListener('contextmenu', e => e.preventDefault());

  // ---- the birds you know, and the score -------------------------------------------------------
  // a little sound-wave mark for a bird singing within earshot
  const NEAR = '<svg class="near3" viewBox="0 0 16 16" aria-label="singing nearby"><path d="M5 5 Q7.5 8 5 11 M8.5 3 Q12.5 8 8.5 13" fill="none" stroke-width="1.8" stroke-linecap="round"/><circle cx="2.6" cy="8" r="1.6"/></svg>';
  function setBirds(list, learned, picked, nearby) {
    const key = list.map(s => s.id + (learned.has(s.id) ? '' : '?') + (nearby.has(s.id) ? '*' : '')).join() + '/' + (picked?.id ?? -1);
    if (key === S.species) return;
    S.species = key;
    cards.innerHTML = list.map(sp => `<button data-sp="${sp.id}" class="${learned.has(sp.id) ? '' : 'heard'}${picked === sp ? ' on' : ''}" title="${learned.has(sp.id) ? sp.name : sp.name + ': heard, not learned'}">${nearby.has(sp.id) ? NEAR : ''}<img src="${songbirdPic(sp, 64)}" alt=""><span>${sp.name}</span></button>`).join('')
      + (picked ? '<button data-sp="none" class="stop"><span>Sing as yourself</span></button>' : '')
      + (list.length ? '' : '<p>No songs yet. Perch near a singing bird and listen.</p>');
    S.idle = list.length ? `${learned.size} known` : 'Listen to the birds';
    singPic.innerHTML = picked ? `<img src="${songbirdPic(picked, 64)}" alt="">` : glyph('w');
  }
  // the card: the bird, its name (or a cheer for a moment), and the score, one glyph per
  // syllable at its pitch; the bird's own half of a duet is dimmed. With no bird, an invitation.
  const setName = () => { name.textContent = S.cheer || S.name; card.classList.toggle('cheer', !!S.cheer); };
  function setScore(sc) {
    const key = sc ? [sc.sp.id, sc.title, sc.done, sc.bird, sc.state, sc.hidden, sc.words].join() : S.idle;
    if (key === S.score) return;
    S.score = key; card.classList.toggle('idle', !sc);
    S.name = sc ? sc.title : 'Imitate a bird'; setName();
    words.textContent = sc?.words || '';
    pic.innerHTML = sc ? `<img src="${songbirdPic(sc.sp, 64)}" alt="">` : glyph('w');
    if (sc && !singPic.querySelector('img')) singPic.innerHTML = `<img src="${songbirdPic(sc.sp, 64)}" alt="">`;
    if (!sc || sc.hidden) { score.innerHTML = `<small>${sc ? sc.note : S.idle}</small>`; return; }
    score.innerHTML = sc.sp.notes.map((n, i) => {
      const st = i < sc.bird ? 'bird' : i < sc.done ? 'done' : i === sc.done ? (sc.state === 'wrong' ? 'next wrong' : 'next') : '';
      return `<span class="${st}" style="--note:${NOTE_COLS[n]};--lane:${n}">${glyph(sc.sp.kinds[i])}</span>`;
    }).join('');
  }

  // ---- Call: hold to call louder. It goes on release, or by itself at full strength once held
  // long enough; the button swells as it fills.
  const HOLD = 1.5;
  let from = null, timer = 0;
  const go = () => {
    if (from === null) return;
    const k = Math.min(1, (performance.now() - from) / 1000 / HOLD);
    from = null; clearTimeout(timer); callBtn.style.transform = ''; callBtn.style.transition = '';
    onCall(k);
  };
  callBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); audio.unlock(); if (callBtn.classList.contains('rest')) return;
    from = performance.now(); callBtn.style.transition = `transform ${HOLD}s ease-out`; callBtn.style.transform = 'scale(1.3)';
    timer = setTimeout(go, HOLD * 1000);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) callBtn.addEventListener(ev, go);

  return {
    // the controls are out (Sing tapped, and the hawk can sing here)
    get open() { return S.ready && S.on; },
    // the hawk can sing here (the Sing button shows)
    get ready() { return S.ready; },
    sing(on) { setOn(on); },
    // the kind the keys 1 to 5 sing (keys 6 to 9 choose it)
    get kind() { return S.kind; },
    setKind(k) { S.kind = k; for (const d of keys) d.classList.toggle('on', d.dataset.kind === k); },
    // per frame: whether the hawk can sing, the birds you know, who you imitate, the score
    update({ available, known, learned, picked, sc, nearby = new Set(), lefty, resting }) {
      root.classList.toggle('lefty', lefty); S.lefty = lefty;
      callBtn.classList.toggle('rest', resting);
      if (!!available !== S.ready) {
        S.ready = !!available; root.classList.toggle('hidden', !S.ready); ui.classList.toggle('singing3', S.ready);
        if (!S.ready) big(false);
      }
      if (!S.ready) return;
      setBirds(known, learned, picked, nearby); setScore(sc);
    },
    glow(lane) { if (S.ready && S.on) flash(rows[lane], 'glow'); },
    // light the row and the touch to sing next (practice), or none (-1)
    hint(lane, kind) {
      const key = lane + (kind || ''); if (key === S.hint) return; S.hint = key;
      rows.forEach((r, i) => r.classList.toggle('next', i === lane));
      for (const d of keys) d.classList.toggle('next', lane >= 0 && d.dataset.kind === kind);
    },
    get practice() { return !!S.practice; },
    openBirds() { audio.unlock(); setOn(true); big(true); },
    cheer(text) {
      // in the card's name line for a moment: one line of news at a time
      S.cheer = text; setName(); flash(card, 'pop');
      clearTimeout(cheerTimer); cheerTimer = setTimeout(() => { S.cheer = ''; setName(); }, 2600);
    },
    // where a row sits on screen (for test scripts)
    lanePt(lane) { const r = rows[lane].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
