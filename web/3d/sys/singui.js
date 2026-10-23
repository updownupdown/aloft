// Singing from a perch, and the hawk's call. While the hawk sits (or stands near a singing
// songbird), Sing waits bottom left: the notes and the word (and the
// picture of a bird beside you that could teach you). Tap it and the song controls open, in black
// frames so the note colours stand out:
//   right edge  the note pad, five rows from low (bottom) to high, each its own colour. The row
//               is the pitch and the touch is the kind of syllable: swipe up for a note sliding
//               up, down for one sliding down, right for a steady whistle, left for a trill, and
//               tap for a chip. Each touch sings one syllable, the row answering in its own way,
//               and two thumbs can sing.
//   left edge   the rail, from under the menu button down: your own bird (sing as yourself), the
//               logos of the birds singing near by in the order of their names (the one you sing
//               as ringed in its state's colour; an amber dot on one that could teach you a song;
//               tap one to learn from it or imitate it), and at the bottom a button to see every
//               bird.
//   bottom left out from under the rail, one black card. Along the top: the bird you sing as,
//               what you are doing (Learning, Imitating, Free song; Learned, Answered for a
//               moment) and X to stop singing. Then the song's name (tap it for
//               the next song you know of that bird) and theirs over yours: the bird's score (each
//               note's arrow at its pitch, a question mark for a note not found yet, the note being
//               sung or due on a round grey ground) and under it what you sang this try, each note
//               ringed by how it went. The birds' list fills the height of the screen: a row a
//               bird, its songs beside it (tap one to imitate it), and along the bottom Nearby
//               (only birds singing within earshot; on by default), Sing as yourself and Call.
// While you learn, each note the bird beside you sings lights its row on the pad, with the bird's
// picture in it and a ring spreading out: the row is given, the touch is yours to find. Each note
// you sing lights its row green if right, amber if the row is right but not the touch, red if the
// row is wrong.
// Pick a bird and you sing in its voice, imitating it: play its score through and a bird of that
// kind answers (once you have learned it). Each syllable sung, yours or a songbird's, rises from
// its beak as a little coloured drawing of its kind. Left-handed, the sides swap. Everything sits
// above the canvas, so a thumb on it never reaches the wings; the look is all in songs.css
// (classes and the --note colours), so a restyle need not touch this file. Birds are drawn as
// their little flat logos (birdlogos.js).
// The Call button screams: hold it longer to call louder.

export const NOTE_COLS = ['#5a3f86', '#3e7c88', '#608842', '#c49234', '#b04e3a'];
// the same notes lighter, to draw on black and on the sky
const NOTE_LIT = ['#a98be6', '#5fc0cf', '#8fcf5a', '#f2c14e', '#f0745a'];
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
// a touch on the pad: a path shorter than MOVE px is a tap; otherwise a swipe, its way the one it
// has gone furthest, once it is SWIPE px from where it began or on release
const MOVE = 10, SWIPE = 30;

import { birdLogo } from '../birdlogos.js';
import { project } from '../shot.js';
import { icon, ICONS, birdIcon } from '../icons.js';
import { BIRD } from '../hawk.js';
// the Sing button: two notes
const NOTES = '<path d="M9 17.5V6l10-2v11.5"/><path d="M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>';
// the button that opens every bird: a list
const LIST = '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="17.5" r=".9" fill="currentColor"/>';
const svg24 = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const css = new URL('./songs.css', import.meta.url).href;
if (!document.querySelector(`link[href="${css}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: css }));

export function createSingUI(ui, { audio, voice, onSyll, onPick, onCall, onNext, store }) {
  ui.insertAdjacentHTML('beforeend', `<div class="rise3"></div><div class="sing3 hidden">
      <div class="notepad3">${NOTE_COLS.map((c, i) => `<i data-lane="${i}" style="--note:${c};--lit:${NOTE_LIT[i]}"></i>`).reverse().join('')}</div>
      <div class="sgrail3"><button class="sgyou3" aria-label="Sing as yourself">${birdIcon(BIRD)}</button><div class="sgbirds3"></div><button class="sgmore3" aria-label="Every bird">${svg24(LIST)}</button></div>
      <div class="sgleft3">
        <button class="sgplate3" aria-label="Sing"><span class="sgtog3">${svg24(NOTES)}</span><b>Sing</b><span class="sghint3"></span></button>
        <div class="songcard3">
          <div class="sghead3"><b class="sgwho3"></b><em class="sgstate3"></em><button class="sgclose3" aria-label="Stop singing">${svg24(ICONS.done)}</button></div>
          <button class="sgsong3"></button>
          <div class="sgrow3"><span class="sglogo3"></span><span class="score3"></span></div>
          <div class="sgrow3 mine"><span class="sgme3">You</span><span class="score3 mine3"></span></div>
          <p class="sgsay3"></p>
        </div>
      </div>
      <div class="birds3"><button class="sgless3" aria-label="Close">${svg24(ICONS.done)}</button><div class="cards3"></div>
        <div class="sgbar3"><button class="sgnear3" role="switch"><span class="sw3"><i></i></span><span>Nearby</span></button><button class="sgself3">Sing as yourself</button><button class="sgcall3" aria-label="Call">${birdIcon(BIRD)}</button></div>
      </div>
    </div>
    <button class="call3" aria-label="Call" title="Call">${birdIcon(BIRD)}</button>`);
  const root = [...ui.querySelectorAll('.sing3')].at(-1), q = s => root.querySelector(s);
  const pad = q('.notepad3'), card = q('.songcard3'), score = q('.score3'), cards = q('.cards3'), plate = q('.sgplate3');
  const who = q('.sgwho3'), stateEl = q('.sgstate3'), songEl = q('.sgsong3'), logo = q('.sglogo3'), hint = q('.sghint3'), mine = q('.mine3'), railBirds = q('.sgbirds3'), you = q('.sgyou3');
  const callBtn = [...ui.querySelectorAll('.call3')].at(-1), rise = [...ui.querySelectorAll('.rise3')].at(-1), nearBtn = q('.sgnear3'), listCall = q('.sgcall3');
  const rows = [...pad.children].sort((a, b) => a.dataset.lane - b.dataset.lane);
  const S = { ready: false, on: false, kind: 'r', species: '', score: '', mode: '', near: store.get('singNearby', true) };
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

  // ---- open and close: the Sing plate, the birds ------------------------------------------------
  const setOn = on => {
    S.on = on; root.classList.toggle('on', on);
    if (!on) { big(false); touches.clear(); rows.forEach(r => r.classList.remove('down')); }
  };
  const big = on => root.classList.toggle('big', on);
  plate.addEventListener('click', () => { audio.unlock(); setOn(true); });
  q('.sgclose3').addEventListener('click', () => setOn(false));
  // the rail: tap a bird to learn from it or imitate it, or yourself
  railBirds.addEventListener('click', e => { const b = e.target.closest('[data-sp]'); if (b) { audio.unlock(); onPick(+b.dataset.sp, null); } });
  you.addEventListener('click', () => { audio.unlock(); onPick(null); });
  songEl.addEventListener('click', () => { audio.unlock(); onNext?.(); });
  for (const el of [q('.sgmore3'), who]) el.addEventListener('click', () => { if (performance.now() - S.shut < 400) return; audio.unlock(); big(true); });
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
    audio.unlock(); big(false); onPick(+b.dataset.sp, b.dataset.k === undefined ? null : +b.dataset.k);
  });
  q('.sgself3').addEventListener('click', () => { audio.unlock(); big(false); onPick(null); });
  const showNear = () => { nearBtn.classList.toggle('on', S.near); nearBtn.setAttribute('aria-checked', S.near); };
  nearBtn.addEventListener('click', () => { S.near = !S.near; store.set('singNearby', S.near); showNear(); S.species = ''; S.redraw?.(); });
  showNear();
  for (const el of [root, callBtn]) el.addEventListener('contextmenu', e => e.preventDefault());

  // ---- the birds you know, and the score -------------------------------------------------------
  // a little sound-wave mark for a bird singing within earshot
  const NEAR = '<svg class="near3" viewBox="0 0 16 16" aria-label="singing nearby"><path d="M5 5 Q7.5 8 5 11 M8.5 3 Q12.5 8 8.5 13" fill="none" stroke-width="1.8" stroke-linecap="round"/><circle cx="2.6" cy="8" r="1.6"/></svg>';
  // a song's notes, small, each at its pitch
  const mini = g => `<span class="mini3">${g.notes.map((n, i) => `<i style="--note:${NOTE_LIT[n]};--lane:${n}">${glyph(g.tap ? 'c' : g.kinds[i])}</i>`).join('')}</span>`;
  // a row a bird: its picture and name (tap: imitate the first song you know, or just its voice),
  // then each of its songs (tap a known one to imitate it; a question mark for one not learned)
  function setBirds(list, learned, picked, pickedK, nearby, knownK) {
    const shown = S.near ? list.filter(s => nearby.has(s.id)) : list;
    const key = shown.map(s => s.id + (learned.has(s.id) ? '' : '?') + (nearby.has(s.id) ? '*' : '') + knownK(s).join('.')).join() + '/' + (picked?.id ?? -1) + '.' + pickedK + S.near;
    if (key === S.species) return;
    S.species = key;
    cards.innerHTML = shown.map(sp => {
      const ks = knownK(sp), on = picked === sp;
      const songs = sp.songs.map(g => ks.includes(g.k)
        ? `<button class="bsong3${on && pickedK === g.k ? ' on' : ''}" data-sp="${sp.id}" data-k="${g.k}"><b>${g.title}</b>${mini(g)}</button>`
        : '<span class="bsong3 q" title="A song you have not learned yet"><b>?</b></span>').join('');
      return `<div class="brow3${learned.has(sp.id) ? '' : ' heard'}${on ? ' on' : ''}"><button class="bwho3" data-sp="${sp.id}" title="${learned.has(sp.id) ? sp.name : sp.name + ': heard, not learned'}">${birdLogo(sp)}<span>${sp.name}</span>${nearby.has(sp.id) ? NEAR : ''}</button><div class="bsongs3">${songs}</div></div>`;
    }).join('') || `<p>${S.near ? (list.length ? 'No bird you know is singing nearby. Turn off Nearby to see them all.' : 'No birds singing nearby.') : 'No songs yet. Perch near a singing bird and listen.'}</p>`;
  }
  // the rail: a logo a bird singing near by, the one you sing as ringed in its state's colour, an
  // amber dot on one that could teach you
  function setRail(list, mode) {
    const key = list.map(r => r.sp.id + r.state + (r.on ? '*' : '')).join() + mode;
    if (key === S.rail) return; S.rail = key;
    const top = railBirds.scrollTop;
    railBirds.innerHTML = list.map(r => `<button data-sp="${r.sp.id}" class="${r.state}${r.on ? ' on' : ''}" aria-label="${r.sp.name}" title="${r.sp.name}">${birdLogo(r.sp)}</button>`).join('');
    railBirds.scrollTop = top;
    you.classList.toggle('on', mode === 'free');
  }
  // the top of the card: the bird you sing as and what you are doing; off, the bird beside you
  // that could teach you
  function setMode(m) {
    const key = m.kind + m.state + (m.who?.id ?? '') + (m.teacher?.id ?? '');
    if (key === S.mode) return; S.mode = key;
    card.dataset.mode = m.kind;
    who.textContent = m.who ? m.who.name : 'Your own voice';
    stateEl.textContent = m.state;
    hint.innerHTML = m.teacher ? birdLogo(m.teacher) : '';
  }
  // the rest of the card: the song's name, then theirs over yours. Theirs: the bird's score, found
  // notes in their colours, the rest question marks, the note being sung or due on a round grey
  // ground. Yours: each note you sang this try, at its pitch, ringed green, blue, orange or red
  // for how it went (it fades two seconds after)
  const span = (lane, kind, cls = '', extra = '') => `<span class="${cls}" style="--note:${NOTE_LIT[lane]};--lane:${lane}${extra}">${glyph(kind)}</span>`;
  function setScore(sc) {
    const sp = sc.sp, key = [sp?.id, sp?.dkey, sp?.k, sc.song, sc.many, sc.seen, sc.at, sc.learn, BIRD, sc.mine.map(m => m.lane + m.kind + (m.r || '')).join('')].join();
    if (key === S.score) return;
    S.score = key;
    // when each note of this try was marked, so a redraw carries on each mark's fade where it was
    const now = performance.now() / 1000;
    S.marks = sc.mine.map((m, i) => S.marks?.[i] && S.mine?.[i] === m ? S.marks[i] : now); S.mine = sc.mine.slice();
    logo.innerHTML = sp ? birdLogo(sp) : '';
    songEl.textContent = sp ? sc.song : 'Sing anything you like';
    songEl.classList.toggle('many', !!sc.many);
    card.classList.toggle('free', !sp);
    score.innerHTML = !sp ? '' : sp.notes.map((n, i) => {
      const shown = i < sc.seen;
      return `<span class="${shown ? '' : 'q'}${i === sc.at ? ' at' : ''}" style="--note:${shown ? NOTE_LIT[n] : '#d8dee3'};--lane:${shown ? n : 0}">${glyph(shown ? (sp.tap ? 'c' : sp.kinds[i]) : 'q')}</span>`;
    }).join('');
    mine.innerHTML = sc.mine.map((m, i) => span(m.lane, m.kind, m.r ? 'r-' + m.r : '', m.r ? `;--md:${(S.marks[i] - now).toFixed(2)}s` : '')).join('');
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

  // ---- Call (top right, and in the birds' list): hold to call louder. It goes on release, or by
  // itself at full strength once held long enough; the button swells as it fills.
  const HOLD = 1.5;
  function holdToCall(btn) {
    let from = null, timer = 0;
    const go = () => {
      if (from === null) return;
      const k = Math.min(1, (performance.now() - from) / 1000 / HOLD);
      from = null; clearTimeout(timer); btn.style.transform = ''; btn.style.transition = '';
      onCall(k);
    };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); audio.unlock(); if (btn.classList.contains('rest')) return;
      from = performance.now(); btn.style.transition = `transform ${HOLD}s ease-out`; btn.style.transform = 'scale(1.3)';
      timer = setTimeout(go, HOLD * 1000);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, go);
  }
  holdToCall(callBtn); holdToCall(listCall);

  return {
    // the controls are out (Sing tapped, and the hawk can sing here)
    get open() { return S.ready && S.on; },
    // the hawk can sing here (the Sing plate shows)
    get ready() { return S.ready; },
    // the list of birds is open
    get listing() { return S.ready && S.on && root.classList.contains('big'); },
    // a line about the song (who answers, an echo, a young bird listening) at the foot of the card,
    // instead of on the message line; false when the card is not showing
    say(msg, secs = 4) {
      if (!(S.ready && S.on) || root.classList.contains('big')) return false;
      const el = card.querySelector('.sgsay3'); el.textContent = msg; el.classList.add('show');
      clearTimeout(el.t); el.t = setTimeout(() => el.classList.remove('show'), secs * 1000);
      return true;
    },
    sing(on) { setOn(on); },
    // the kind the keys 1 to 5 sing (keys 6 to 0 choose it)
    get kind() { return S.kind; },
    setKind(k) { S.kind = k; },
    // per frame: whether the hawk can sing, the birds you know, who you imitate, the plate, the score
    update({ available, known, learned, picked, pickedK = 0, sc, mode, rail = [], nearby = new Set(), lefty, resting, knownK }) {
      root.classList.toggle('lefty', lefty); S.lefty = lefty;
      callBtn.classList.toggle('rest', resting); listCall.classList.toggle('rest', resting);
      if (callBtn.dataset.bird !== BIRD) { callBtn.dataset.bird = BIRD; callBtn.innerHTML = listCall.innerHTML = you.innerHTML = birdIcon(BIRD); }   // Call shows the bird you fly
      if (!!available !== S.ready) {
        S.ready = !!available; root.classList.toggle('hidden', !S.ready); ui.classList.toggle('singing3', S.ready);
        if (!S.ready) big(false);
      }
      if (!S.ready) return;
      S.redraw = () => setBirds(known, learned, picked, pickedK, nearby, knownK);
      S.redraw(); setMode(mode); setScore(sc); setRail(rail, mode.kind);
    },
    // a row lit: a song you know played back
    glow(lane) { if (S.ready && S.on) flash(rows[lane], 'glow'); },
    // the bird you learn from sang this note: its row lights, with the bird's picture in it and a
    // ring spreading out
    teach(lane, sp) {
      if (!S.ready || !S.on) return;
      const r = rows[lane];
      if (r.dataset.sp !== String(sp.id)) { r.dataset.sp = sp.id; r.querySelector('.tlogo3')?.remove(); r.insertAdjacentHTML('beforeend', `<span class="tlogo3">${birdLogo(sp)}</span>`); }
      flash(r, 'teach');
    },
    // how a note you sang went, on its row: 'yes' (right), 'half' (right row, wrong touch), 'no'
    mark(lane, how) { if (!S.ready || !S.on) return; rows[lane].classList.remove('yes', 'half', 'no'); flash(rows[lane], how); },
    // a syllable rising from a beak at world point p (the scene S3 gives the camera)
    rise: riseAt,
    openBirds() { audio.unlock(); setOn(true); big(true); },
    // where a row sits on screen (for test scripts)
    lanePt(lane) { const r = rows[lane].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
