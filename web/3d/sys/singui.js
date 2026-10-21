// Singing from a perch, and the hawk's call. While the hawk sits (or stands near a singing
// songbird), the song controls open:
//   right edge  a pitch strip, five bands from low (bottom) to high, each its own colour: touch a
//               band to sing a syllable at that pitch; slide and each band you cross sings
//   left edge   the four kinds of syllable (whistle, chip, trill, buzz) in a column of icons:
//               press and hold, and slide up and down to shift between them; the dark pill
//               follows the thumb and snaps to each kind as you cross into it, and the names
//               show while you slide
//   bottom left beside it, the song box: the bird you imitate, its song in words and its score
//               (each syllable's kind and pitch, the next one marked), or a moment's cheer in
//               its name line. Tap it to open Imitate a bird (every bird you know at once, a
//               mark on those singing nearby); ✕ or a swipe tucks it away to a small round
//               button that opens Imitate a bird
// Pick a bird from Songs and you sing in its voice, imitating it: play its score through and a
// bird of that kind answers (once you have learned it). Left-handed, the sides swap. Everything
// sits above the canvas, so a thumb on it never reaches the wings; the look is all in
// songs.css (classes and the --note colours), so a restyle need not touch this file.
// The Call button screams: hold it longer to call louder.

export const NOTE_COLS = ['#2f4a74', '#3e7c88', '#608842', '#c49234', '#b04e3a'];
export const KINDS = [['w', 'Whistle'], ['c', 'Chip'], ['t', 'Trill'], ['b', 'Buzz']];
// a little drawing of each kind of syllable, as on a sonogram
const GLYPH = {
  w: '<path d="M5 13 Q20 5 35 10" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  c: '<path d="M17 5 L23 15" stroke-width="3.6" fill="none" stroke-linecap="round"/>',
  t: '<path d="M4 10 l4 -5 l4 10 l4 -10 l4 10 l4 -10 l4 10 l4 -10 l4 5" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  b: '<path d="M4 10 l2 -6 l2 12 l2 -12 l2 12 l2 -12 l2 12 l2 -12 l2 12 l2 -12 l2 12 l2 -12 l2 12 l2 -12 l2 12 l2 -6" stroke-width="1.5" fill="none"/>',
};
export const glyph = k => `<svg viewBox="0 0 40 20" aria-hidden="true">${GLYPH[k] || GLYPH.w}</svg>`;

import { songbirdPic } from '../pics.js';

const css = new URL('./songs.css', import.meta.url).href;
if (!document.querySelector(`link[href="${css}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: css }));

export function createSingUI(ui, { audio, voice, onSyll, onPick, onCall, onPractice }) {
  ui.insertAdjacentHTML('beforeend', `<div class="sing3 hidden">
      <div class="strip3">${NOTE_COLS.map((c, i) => `<i data-lane="${i}" style="--note:${c}"></i>`).reverse().join('')}</div>
      <div class="kinds3"><b class="puck3"></b>${KINDS.map(([k, name]) => `<div data-kind="${k}" aria-label="${name}">${glyph(k)}<span>${name}</span></div>`).join('')}</div>
      <div class="rec3" role="button" tabindex="0"><span class="pic3"></span><span class="txt3"><b></b><i></i><span class="score3"></span></span><button class="slow3" aria-label="Slow practice">Slow</button><button class="x3" aria-label="Tuck the song away">✕</button></div>
      <button class="open3 hidden" aria-label="Imitate a bird"></button>
      <div class="birds3 hidden"></div>
    </div>
    <button class="call3" aria-label="Hawk call">Call</button>`);
  const q = s => ui.querySelector(s);
  const root = q('.sing3'), strip = q('.strip3'), kinds = q('.kinds3'), rec = q('.rec3'), birds = q('.birds3'), score = q('.score3');
  const recName = rec.querySelector('b'), recWords = rec.querySelector('i'), recPic = q('.pic3'), openBtn = q('.open3'), callBtn = q('.call3');
  const bands = [...strip.children].sort((a, b) => a.dataset.lane - b.dataset.lane);
  const S = { open: false, kind: 'w', finger: null, slide: null, species: '', score: '', name: '', cheer: '' };
  let cheerTimer = 0;
  const flash = (el, cls = 'hit') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // the pitch strip: the band under the finger, by height
  const laneAt = y => { const r = strip.getBoundingClientRect(); return Math.max(0, Math.min(4, 4 - Math.floor((y - r.top) / r.height * 5))); };
  function sound(lane) { flash(bands[lane]); audio.note(lane, voice(), .18, S.kind); onSyll(lane, S.kind); }
  strip.addEventListener('pointerdown', e => {
    e.preventDefault(); strip.setPointerCapture?.(e.pointerId); audio.unlock();
    const lane = laneAt(e.clientY); S.finger = { id: e.pointerId, lane }; sound(lane);
  });
  strip.addEventListener('pointermove', e => {
    const f = S.finger; if (f?.id !== e.pointerId) return;
    const lane = laneAt(e.clientY); if (lane !== f.lane) { f.lane = lane; sound(lane); }
  });
  const up = e => { if (S.finger?.id === e.pointerId) S.finger = null; };
  strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);

  // the kinds: press and hold, slide to shift. The pill rides under the thumb; the kind changes
  // once the thumb is a little past the line between two (so it never flickers on the line), and
  // on release the pill settles onto the chosen kind.
  const puck = q('.puck3'), segs = [...kinds.querySelectorAll('[data-kind]')];
  const place = (top = null) => {
    const seg = segs.find(b => b.dataset.kind === S.kind);
    puck.style.height = seg.offsetHeight + 'px';
    puck.style.transform = `translateY(${top ?? seg.offsetTop}px)`;
  };
  const setKind = k => {
    if (k !== S.kind) navigator.vibrate?.(8);
    S.kind = k; for (const b of segs) b.classList.toggle('on', b.dataset.kind === k);
    if (!S.slide) place();
  };
  setKind('w');
  const slideTo = y => {
    const r = kinds.getBoundingClientRect(), h = segs[0].offsetHeight, step = (r.height - segs[0].offsetTop * 2) / segs.length;
    const at = y - r.top - segs[0].offsetTop;   // from the top of the first kind
    const cur = segs.findIndex(b => b.dataset.kind === S.kind), f = at / step - .5;
    const i = Math.abs(f - cur) > .62 ? Math.max(0, Math.min(segs.length - 1, Math.round(f))) : cur;
    if (i !== cur) setKind(segs[i].dataset.kind);
    place(Math.max(segs[0].offsetTop, Math.min(segs.at(-1).offsetTop, at + segs[0].offsetTop - h / 2)));
  };
  kinds.addEventListener('pointerdown', e => {
    e.preventDefault(); kinds.setPointerCapture?.(e.pointerId); audio.unlock();
    S.slide = e.pointerId; kinds.classList.add('slide');
    const f = (e.clientY - kinds.getBoundingClientRect().top) / kinds.clientHeight;
    setKind(KINDS[Math.max(0, Math.min(3, Math.floor(f * 4)))][0]); slideTo(e.clientY);
  });
  kinds.addEventListener('pointermove', e => { if (S.slide === e.pointerId) slideTo(e.clientY); });
  const settle = e => { if (S.slide !== e.pointerId) return; S.slide = null; kinds.classList.remove('slide'); place(); };
  kinds.addEventListener('pointerup', settle); kinds.addEventListener('pointercancel', settle);

  // the song box opens the birds you know, folded away until you want one; ✕ or a swipe (left,
  // or down) tucks the box away to the round button, until you pick a bird or a new one sings
  const showBirds = on => { birds.classList.toggle('hidden', !on); rec.classList.toggle('on', on); };
  const tuck = on => { S.tucked = on; rec.classList.toggle('hidden', on); openBtn.classList.toggle('hidden', !on); };
  let swipe = null;
  rec.addEventListener('pointerdown', e => { swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, gone: false, x3: !!e.target.closest('.x3'), slow: !!e.target.closest('.slow3') }; rec.setPointerCapture?.(e.pointerId); });
  rec.addEventListener('pointermove', e => {
    if (swipe?.id !== e.pointerId || swipe.gone) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (dx < -40 || dy > 30 || (S.lefty && dx > 40)) { swipe.gone = true; showBirds(false); tuck(true); }
  });
  rec.addEventListener('pointerup', e => {
    const s = swipe; swipe = null; if (s?.id !== e.pointerId || s.gone) return;
    audio.unlock();
    if (s.x3) { showBirds(false); tuck(true); return; }
    // slow practice: the bird's phrase loops at half speed, the next note lit on the strip
    if (s.slow) { S.practice = !S.practice; rec.classList.toggle('practice', S.practice); onPractice?.(S.practice); return; }
    showBirds(birds.classList.contains('hidden'));
  });
  rec.addEventListener('pointercancel', () => { swipe = null; });
  openBtn.addEventListener('click', () => { audio.unlock(); showBirds(true); });
  birds.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { showBirds(false); return; }
    const b = e.target.closest('[data-sp]'); if (!b) return;
    audio.unlock(); showBirds(false); tuck(false); onPick(b.dataset.sp === 'none' ? null : +b.dataset.sp);
  });
  for (const el of [root, callBtn]) el.addEventListener('contextmenu', e => e.preventDefault());

  // a little sound-wave mark for a bird singing within earshot
  const NEAR = '<svg class="near3" viewBox="0 0 16 16" aria-label="singing nearby"><path d="M5 5 Q7.5 8 5 11 M8.5 3 Q12.5 8 8.5 13" fill="none" stroke-width="1.8" stroke-linecap="round"/><circle cx="2.6" cy="8" r="1.6"/></svg>';
  function setBirds(list, learned, picked, nearby) {
    const key = list.map(s => s.id + (learned.has(s.id) ? '' : '?') + (nearby.has(s.id) ? '*' : '')).join() + '/' + (picked?.id ?? -1);
    if (key === S.species) return;
    S.species = key;
    birds.innerHTML = `<header><span>Imitate a bird</span><button data-close aria-label="Close">✕</button></header><div class="cards3">`
      + list.map(sp => `<button data-sp="${sp.id}" class="${learned.has(sp.id) ? '' : 'heard'}${picked === sp ? ' on' : ''}" title="${learned.has(sp.id) ? sp.name : sp.name + ': heard, not learned'}">${nearby.has(sp.id) ? NEAR : ''}<img src="${songbirdPic(sp, 64)}" alt=""><span>${sp.name}</span></button>`).join('')
      + (picked ? '<button data-sp="none" class="stop"><span>Sing as yourself</span></button>' : '') + '</div>'
      + (list.length ? '' : '<p>No songs yet. Perch near a singing bird and listen.</p>');
    S.idle = list.length ? `${learned.size} known` : 'Listen to the birds';
    openBtn.innerHTML = picked ? `<img src="${songbirdPic(picked, 64)}" alt="">` : glyph('w');
  }
  // the song box: the bird, its name (or a cheer for a moment), and the score, one glyph per
  // syllable at its pitch; the bird's own half of a duet is dimmed. With no bird, an invitation.
  const setName = () => { recName.textContent = S.cheer || S.name; rec.classList.toggle('cheer', !!S.cheer); };
  function setScore(sc) {
    const key = sc ? [sc.sp.id, sc.title, sc.done, sc.bird, sc.state, sc.hidden].join() : S.idle;
    if (key === S.score) return;
    // a new bird to copy brings a tucked-away box back
    if (S.tucked && sc && sc.sp.id !== S.scoreSp) tuck(false);
    S.score = key; S.scoreSp = sc?.sp.id; rec.classList.toggle('idle', !sc);
    S.name = sc ? sc.title : 'Imitate a bird'; setName();
    recWords.textContent = sc?.words || '';
    recPic.innerHTML = sc ? `<img src="${songbirdPic(sc.sp, 64)}" alt="">` : glyph('w');
    if (!sc || sc.hidden) { score.innerHTML = `<small>${sc ? sc.note : S.idle}</small>`; return; }
    score.innerHTML = sc.sp.notes.map((n, i) => {
      const st = i < sc.bird ? 'bird' : i < sc.done ? 'done' : i === sc.done ? (sc.state === 'wrong' ? 'next wrong' : 'next') : '';
      return `<span class="${st}" style="--note:${NOTE_COLS[n]};--lane:${n}">${glyph(sc.sp.kinds[i])}</span>`;
    }).join('');
  }

  // hold Call to call louder: it goes on release, or by itself at full strength once held long
  // enough. The button swells as it fills.
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
    get open() { return S.open; },
    get kind() { return S.kind; },
    setKind,
    // per frame: whether the controls are out, the birds you know, who you imitate, the score
    update({ available, known, learned, picked, sc, nearby = new Set(), lefty, resting }) {
      root.classList.toggle('lefty', lefty); S.lefty = lefty;
      callBtn.classList.toggle('rest', resting);
      if (!!available !== S.open) {
        S.open = !!available; root.classList.toggle('hidden', !S.open); ui.classList.toggle('singing3', S.open);
        S.finger = S.slide = null; kinds.classList.remove('slide');
        if (S.open) place(); else showBirds(false);
      }
      if (!S.open) return;
      setBirds(known, learned, picked, nearby); setScore(sc);
    },
    glow(lane) { if (S.open) flash(bands[lane], 'glow'); },
    // light the band and the kind to sing next (practice), or none (-1)
    hint(lane, kind) {
      const key = lane + (kind || ''); if (key === S.hint) return; S.hint = key;
      bands.forEach((b, i) => b.classList.toggle('next', i === lane));
      for (const d of segs) d.classList.toggle('next', lane >= 0 && d.dataset.kind === kind);
    },
    get practice() { return !!S.practice; },
    openBirds() { audio.unlock(); showBirds(true); },
    cheer(text) {
      // in the song box's name line for a moment: one line of news at a time
      S.cheer = text; setName(); flash(rec, 'pop');
      clearTimeout(cheerTimer); cheerTimer = setTimeout(() => { S.cheer = ''; setName(); }, 2600);
    },
    // where a control sits on screen (for test scripts)
    lanePt(lane) { const r = bands[lane].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    kindPt(k) { const r = kinds.querySelector(`[data-kind=${k}]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
