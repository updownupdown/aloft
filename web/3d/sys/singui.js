// Singing from a perch, and the hawk's call. While the hawk sits (or stands near a singing
// songbird), a Sing button waits bottom left; tap it and the song controls open, in black frames
// so the note colours stand out:
//   right edge  the note pad, five rows from low (bottom) to high, each its own colour. The row
//               is the pitch and the touch is the kind of syllable: swipe up for a note sliding
//               up, down for one sliding down, right for a steady whistle, left for a trill, and
//               tap for a chip. Each touch sings one syllable, the row answering in its own way,
//               and two thumbs can sing.
//   bottom left the song card: the bird whose song you sing, its name, its score (each note's
//               arrow at its pitch, a question mark for a note of an unlearned song not found yet,
//               each note sung in a try boxed by how it went) and, top right, what you are doing
//               (singing freely, learning a song, imitating one you know) and any other bird
//               singing within earshot. Tap it to open the birds you know, the whole height of
//               the screen, to pick one to imitate (a mark on those singing nearby); tap outside
//               the list to close it. Above the card, the stop button (the sing icon crossed out)
// Pick a bird and you sing in its voice, imitating it: play its score through and a bird of that
// kind answers (once you have learned it). Each syllable sung, yours or a songbird's, rises from
// its beak as a little coloured drawing of its kind. Left-handed, the sides swap. Everything sits
// above the canvas, so a thumb on it never reaches the wings; the look is all in songs.css
// (classes and the --note colours), so a restyle need not touch this file.
// The Call button screams: hold it longer to call louder.

export const NOTE_COLS = ['#2f4a74', '#3e7c88', '#608842', '#c49234', '#b04e3a'];
// the same notes lighter, to draw on black and on the sky
const NOTE_LIT = ['#6f93d6', '#5fc0cf', '#8fcf5a', '#f2c14e', '#f0745a'];
export const KINDS = [['u', 'Up'], ['d', 'Down'], ['l', 'Left'], ['r', 'Right'], ['c', 'Tap']];
// a little drawing of each kind of syllable: a line ending in an arrowhead the way the touch goes
// (and the way the note slides, as on a sonogram), and a dot for a tap
const ARROW = '<path class="ln" d="M12 21V10" stroke-width="3.2" stroke-linecap="round"/><path d="M6.5 11L12 3.5 17.5 11Z" stroke-width="1.6" stroke-linejoin="round"/>';
const GLYPH = {
  u: ARROW,
  d: `<g transform="rotate(180 12 12)">${ARROW}</g>`,
  r: `<g transform="rotate(90 12 12)">${ARROW}</g>`,
  l: `<g transform="rotate(-90 12 12)">${ARROW}</g>`,
  c: '<circle cx="12" cy="12" r="5.5" stroke-width="1.6"/>',
  // a note not found yet
  q: '<path class="ln" d="M8.6 8.6a3.4 3.4 0 1 1 4.9 3.1c-.9.4-1.5 1.2-1.5 2.1v.9" stroke-width="2.8" stroke-linecap="round"/><circle cx="12" cy="19.3" r="1.6" stroke-width="1"/>',
};
export const glyph = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[k] || GLYPH.r}</svg>`;
const CHEVRON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5l5-5 5 5" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// a touch on the pad: a path shorter than MOVE px is a tap; otherwise a swipe, its way the one it
// has gone furthest, once it is SWIPE px from where it began or on release
const MOVE = 10, SWIPE = 30;

import { songbirdPic } from '../pics.js';
import { project } from '../shot.js';
import { icon, ICONS, birdIcon } from '../icons.js';
import { BIRD } from '../hawk.js';
// stop singing: the sing icon, crossed out
// what you are doing, top right of the card: singing freely, learning a song, imitating one
const STATE = {
  free: ['Singing freely', ICONS.sing],
  learn: ['Learning this song: listen, then sing it back', '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.2-3.2 4.2-3.2 7.2a2.8 2.8 0 0 1-5.2 1.4"/><path d="M9.6 10a2.4 2.4 0 0 1 4.8 0c0 1.2-1 1.7-1.9 2.3"/>'],
  imitate: ['Imitating a song you know', '<path d="M4.5 11a7 7 0 0 1 12.3-4.6M19.5 13a7 7 0 0 1-12.3 4.6"/><path d="M17.5 3v3.8h-3.8M6.5 21v-3.8h3.8"/>'],
};
const svg24 = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const UNSING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.sing}<path d="M3.5 3.5l17 17"/></svg>`;

const css = new URL('./songs.css', import.meta.url).href;
if (!document.querySelector(`link[href="${css}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: css }));

export function createSingUI(ui, { audio, voice, onSyll, onPick, onCall }) {
  ui.insertAdjacentHTML('beforeend', `<div class="rise3"></div><div class="sing3 hidden">
      <button class="singbtn3"><span class="pic3"></span><b>Sing</b></button>
      <div class="notepad3">${NOTE_COLS.map((c, i) => `<i data-lane="${i}" style="--note:${c};--lit:${NOTE_LIT[i]}"></i>`).reverse().join('')}</div>
      <div class="sgleft3"><button class="sgdone3" aria-label="Stop singing" title="Stop singing">${UNSING}</button>
      <div class="songcard3" role="button" aria-label="Imitate a bird">
        <span class="pic3"></span><span class="txt3"><b></b><span class="score3"></span></span><span class="sgstate3"><i></i><em></em></span>
      </div>
      </div>
      <div class="birds3"><header><span>Imitate a bird</span><button class="sgless3" aria-label="Close">${CHEVRON}</button></header><div class="cards3"></div></div>
    </div>
    <button class="call3" aria-label="Call" title="Call">${birdIcon(BIRD)}</button>`);
  const root = [...ui.querySelectorAll('.sing3')].at(-1), q = s => root.querySelector(s);
  const pad = q('.notepad3'), card = q('.songcard3'), score = q('.score3'), cards = q('.cards3');
  const name = card.querySelector('b'), pic = card.querySelector('.pic3'), stateEl = card.querySelector('.sgstate3 i'), otherEl = card.querySelector('.sgstate3 em'), singPic = q('.singbtn3 .pic3');
  const callBtn = [...ui.querySelectorAll('.call3')].at(-1), rise = [...ui.querySelectorAll('.rise3')].at(-1);
  const rows = [...pad.children].sort((a, b) => a.dataset.lane - b.dataset.lane);
  const S = { ready: false, on: false, kind: 'r', species: '', score: '', name: '', };
  const flash = (el, cls = 'hit') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ---- the note pad ----------------------------------------------------------------------------
  const laneAt = y => {
    for (const r of rows) { const b = r.getBoundingClientRect(); if (y >= b.top - 3 && y <= b.bottom + 3) return +r.dataset.lane; }
    const b = pad.getBoundingClientRect(); return y < b.top + b.height / 2 ? 4 : 0;
  };
  // the row answers the touch: a tap pulses, a swipe sweeps light the way it went
  const ANSWER = { c: 'k-c', u: 'k-u', d: 'k-d', l: 'k-l', r: 'k-r' };
  function sound(lane, kind) {
    const r = rows[lane]; r.classList.remove(...Object.values(ANSWER)); void r.offsetWidth; r.classList.add(ANSWER[kind]);
    audio.note(lane, voice(), .18, kind); onSyll(lane, kind);
  }
  const touches = new Map();
  const way = t => { const dx = t.x - t.x0, dy = t.y - t.y0; return Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'u' : 'd') : dx < 0 ? 'l' : 'r'; };
  function decide(t, kind) {
    if (t.done) return; t.done = true;
    sound(t.lane, kind || (t.sx + t.sy <= MOVE ? 'c' : way(t)));
  }
  pad.addEventListener('pointerdown', e => {
    e.preventDefault(); pad.setPointerCapture?.(e.pointerId); audio.unlock();
    const t = { lane: laneAt(e.clientY), x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, sx: 0, sy: 0, done: false };
    touches.set(e.pointerId, t); rows[t.lane].classList.add('down');
  });
  pad.addEventListener('pointermove', e => {
    const t = touches.get(e.pointerId); if (!t || t.done) return;
    t.sx += Math.abs(e.clientX - t.x); t.sy += Math.abs(e.clientY - t.y); t.x = e.clientX; t.y = e.clientY;
    if (Math.hypot(t.x - t.x0, t.y - t.y0) > SWIPE) decide(t, way(t));
  });
  const lift = e => {
    const t = touches.get(e.pointerId); if (!t) return;
    touches.delete(e.pointerId);
    if (e.type === 'pointercancel') t.done = true; else decide(t);
    if (![...touches.values()].some(o => o.lane === t.lane)) rows[t.lane].classList.remove('down');
  };
  pad.addEventListener('pointerup', lift); pad.addEventListener('pointercancel', lift);

  // ---- open and close: Sing, stop, the birds ---------------------------------
  const setOn = on => {
    S.on = on; root.classList.toggle('on', on);
    if (!on) { big(false); touches.clear(); rows.forEach(r => r.classList.remove('down')); }
  };
  const big = on => root.classList.toggle('big', on);
  q('.singbtn3').addEventListener('click', () => { audio.unlock(); setOn(true); });
  q('.sgdone3').addEventListener('click', () => setOn(false));
  card.addEventListener('click', () => { if (performance.now() - S.shut < 400) return; audio.unlock(); big(true); });
  // a touch anywhere outside the open list closes it (and does nothing else)
  S.shut = 0;
  addEventListener('pointerdown', e => {
    if (!root.classList.contains('big') || e.target.closest?.('.birds3')) return;
    big(false); S.shut = performance.now();
    if (e.target.closest?.('.sing3')) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  q('.sgless3').addEventListener('click', () => big(false));
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
    cards.innerHTML = list.map(sp => `<button data-sp="${sp.id}" class="${learned.has(sp.id) ? '' : 'heard'}${picked === sp ? ' on' : ''}" title="${learned.has(sp.id) ? sp.name : sp.name + ': heard, not learned'}">${nearby.has(sp.id) ? NEAR : ''}<span class="pic3"><img src="${songbirdPic(sp, 64)}" alt=""></span><span>${sp.name}</span></button>`).join('')
      + (picked ? '<button data-sp="none" class="stop"><span>Sing as yourself</span></button>' : '')
      + (list.length ? '' : '<p>No songs yet. Perch near a singing bird and listen.</p>');
    singPic.innerHTML = picked ? `<img src="${songbirdPic(picked, 64)}" alt="">` : icon('sing');
  }
  // the card: the bird, its name, its score (found notes in their colours, the rest question
  // marks; this try's notes boxed green, blue, orange or red), what you are doing and who else sings
  function setScore(sc) {
    const sp = sc.sp, key = [sp?.id, sc.state, sc.seen, sc.res.join(''), sc.hear, sc.other?.id].join();
    if (key === S.score) return;
    S.score = key;
    name.textContent = sp ? sp.name : 'Free song';
    pic.innerHTML = sp ? `<img src="${songbirdPic(sp, 64)}" alt="">` : icon('sing');
    if (sp && !singPic.querySelector('img')) singPic.innerHTML = `<img src="${songbirdPic(sp, 64)}" alt="">`;
    const [title, body] = STATE[sc.state];
    stateEl.innerHTML = svg24(body); stateEl.className = `st-${sc.state}${sc.hear ? ' hear' : ''}`; stateEl.title = title;
    otherEl.innerHTML = sc.other ? `${NEAR}<img src="${songbirdPic(sc.other, 32)}" alt="">` : '';
    otherEl.title = sc.other ? `A ${sc.other.name.toLowerCase()} is singing nearby` : '';
    if (!sp) { score.innerHTML = `<small>Sing anything, or tap to pick a bird</small>`; return; }
    score.innerHTML = sp.notes.map((n, i) => {
      const r = sc.res[i], shown = i < sc.seen;
      return `<span class="${shown ? '' : 'q'}${r ? ' r-' + r : ''}" style="--note:${shown ? NOTE_LIT[n] : '#d8dee3'};--lane:${shown ? n : 0}">${glyph(shown ? sp.kinds[i] : 'q')}</span>`;
    }).join('');
  }

  // ---- notes rising from a beak: the syllable's drawing in its note's colour, edged in white,
  // drifting up and away. At most a few dozen at once.
  function riseAt(S3, p, lane, kind, faint = false) {
    if (!S3 || rise.childElementCount > 40) return;
    const at = project(S3, p, innerWidth, innerHeight);
    if (!at || at.z > 70 || at.x < -40 || at.x > innerWidth + 40 || at.y < -40 || at.y > innerHeight + 40) return;
    const g = GLYPH[kind] || GLYPH.r, size = Math.max(.55, Math.min(1.25, 14 / at.z)) * (faint ? .7 : 1);
    const el = document.createElement('i'); if (faint) el.className = 'faint';
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="edge">${g}</g><g style="stroke:${NOTE_LIT[lane]};fill:${NOTE_LIT[lane]}">${g}</g></svg>`;
    el.style.cssText = `left:${at.x}px;top:${at.y}px;--s:${size};--dx:${(Math.random() - .5) * 50}px;--up:${80 + lane * 10}px`;
    rise.append(el); el.addEventListener('animationend', () => el.remove());
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
    // the kind the keys 1 to 5 sing (keys 6 to 0 choose it)
    get kind() { return S.kind; },
    setKind(k) { S.kind = k; },
    // per frame: whether the hawk can sing, the birds you know, who you imitate, the score
    update({ available, known, learned, picked, sc, nearby = new Set(), lefty, resting }) {
      root.classList.toggle('lefty', lefty); S.lefty = lefty;
      callBtn.classList.toggle('rest', resting);
      if (callBtn.dataset.bird !== BIRD) { callBtn.dataset.bird = BIRD; callBtn.innerHTML = birdIcon(BIRD); }   // Call shows the bird you fly
      if (!!available !== S.ready) {
        S.ready = !!available; root.classList.toggle('hidden', !S.ready); ui.classList.toggle('singing3', S.ready);
        if (!S.ready) big(false);
      }
      if (!S.ready) return;
      setBirds(known, learned, picked, nearby); setScore(sc);
    },
    glow(lane) { if (S.ready && S.on) flash(rows[lane], 'glow'); },
    // a syllable rising from a beak at world point p (the scene S3 gives the camera)
    rise: riseAt,
    openBirds() { audio.unlock(); setOn(true); big(true); },
    // where a row sits on screen (for test scripts)
    lanePt(lane) { const r = rows[lane].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
