// Singing from a perch, and the hawk's call. Whenever the hawk sits (or a songbird is close
// while it stands), pigment pools open at the sides. Up the right edge, the five song notes in a
// ladder, lowest at the bottom, each its own colour: touch one to sing it, slide across to sing
// each you cross. Up the left side, the songbirds you have heard, each pooled in its breast
// colour with a dot of its cap (paler until you learn its song): touch one and the hawk sings
// that bird's song in its voice. Left-handed, the sides swap. The next note of a song you are
// copying wears a red ring; a pool brightens while the songbird sings that note.
// The pools sit above the canvas, so a thumb on them never reaches the wings; a thumb anywhere
// else still flaps you off the branch.
// The Call button (top right) screams: hold it longer to call louder.

export const NOTE_COLS = ['#2f4a74', '#3e7c88', '#608842', '#c49234', '#b04e3a'];
const GAP = 46, BTN = 38;

const css = new URL('./songs.css', import.meta.url).href;
if (!document.querySelector(`link[href="${css}"]`)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: css }));

const rgb = c => `rgb(${c.join(',')})`;
// a pool is a hexagon in two facets of its colour (low poly, like the world), with a chip of the
// bird's cap colour when it has one
const poolBg = (col, dot) => (dot ? `linear-gradient(135deg, transparent 0 58%, ${dot} 58% 76%, transparent 76%), ` : '') +
  `linear-gradient(150deg, color-mix(in srgb, ${col} 80%, #fff) 0 50%, ${col} 50% 100%)`;

export function createSingUI(ui, { audio, voice, onNote, onMimic, onCall }) {
  ui.insertAdjacentHTML('beforeend', `<div class="sing3 hidden"><div class="notes3"></div><div class="calls3"></div><div class="dots3"></div></div>
    <p class="cheer3"></p><button class="call3" aria-label="Hawk call">Call</button>`);
  const root = ui.querySelector('.sing3'), notes = root.querySelector('.notes3'), calls = root.querySelector('.calls3'), dots = root.querySelector('.dots3');
  const cheer = ui.querySelector('.cheer3'), callBtn = ui.querySelector('.call3');
  const S = { open: false, finger: null, next: -1, lefty: false, species: '', key: '' };
  let cheerTimer = 0;

  const noteBtns = NOTE_COLS.map((col, lane) => {
    const el = document.createElement('button'); el.className = 'pool3'; el.style.background = poolBg(col);
    el.setAttribute('aria-label', `Note ${lane + 1}`); el.dataset.lane = lane; notes.append(el); return el;
  });
  const flash = (el, cls = 'hit') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function sound(lane) { flash(noteBtns[lane]); audio.note(lane, voice(), .18); onNote(lane); }

  // touch a pool to sing it; slide on and each pool the finger reaches sings in turn
  const laneAt = (x, y) => {
    let best = -1, bd = BTN * .8;
    noteBtns.forEach((el, i) => { const r = el.getBoundingClientRect(), d = Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  notes.addEventListener('pointerdown', e => {
    const lane = laneAt(e.clientX, e.clientY); if (lane < 0) return;
    e.preventDefault(); e.target.setPointerCapture?.(e.pointerId); audio.unlock();
    S.finger = { id: e.pointerId, lane }; sound(lane);
  });
  notes.addEventListener('pointermove', e => {
    const f = S.finger; if (f?.id !== e.pointerId) return;
    const lane = laneAt(e.clientX, e.clientY);
    if (lane >= 0 && lane !== f.lane) { f.lane = lane; sound(lane); }
  });
  const up = e => { if (S.finger?.id === e.pointerId) S.finger = null; };
  notes.addEventListener('pointerup', up); notes.addEventListener('pointercancel', up);
  calls.addEventListener('pointerdown', e => {
    const el = e.target.closest('.pool3'); if (!el) return;
    e.preventDefault(); audio.unlock(); flash(el); onMimic(+el.dataset.sp);
  });
  for (const el of [root, callBtn]) { el.addEventListener('contextmenu', e => e.preventDefault()); el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); }

  // the songbirds you have heard or learned, one pool each, in field-guide order
  function setSpecies(list, learned) {
    const key = list.map(s => s.id + (learned.has(s.id) ? '' : '?')).join();
    if (key === S.species) return;
    S.species = key; calls.textContent = '';
    for (const sp of list) {
      const el = document.createElement('button'); el.className = 'pool3'; el.dataset.sp = sp.id;
      el.style.background = poolBg(rgb(sp.cols.breast), rgb(sp.cols.cap)); el.setAttribute('aria-label', `Sing like the ${sp.name}`);
      el.title = sp.name; el.classList.toggle('heard', !learned.has(sp.id));
      calls.append(el);
    }
    S.key = '';
  }

  // the notes stand in a ladder up the right edge, each step a little inward like notes on a
  // stave; the birds fill the other side in columns from the edge inward, bottom up
  function layout() {
    const key = [innerWidth, innerHeight, S.lefty, S.species].join();
    if (key === S.key) return;
    S.key = key;
    const bottom = innerHeight - 30 - BTN / 2, top = Math.min(120, innerHeight * .28), edge = 20 + BTN / 2;
    const ns = S.lefty ? -1 : 1, at = (el, x, y) => { el.style.left = `${x - BTN / 2}px`; el.style.top = `${y - BTN / 2}px`; };
    const step = Math.min(64, (bottom - top) / (noteBtns.length - 1));
    noteBtns.forEach((el, i) => at(el, ns > 0 ? innerWidth - edge - i * 8 : edge + i * 8, bottom - i * step));
    const birds = [...calls.children], rows = Math.max(1, Math.floor((bottom - top) / GAP) + 1);
    birds.forEach((el, i) => {
      const c = Math.floor(i / rows), r = i % rows, x = edge + c * GAP;
      at(el, ns > 0 ? x : innerWidth - x, bottom - r * GAP);
    });
  }

  function setOpen(o) {
    if (o === S.open) return;
    S.open = o; S.finger = null; root.classList.toggle('hidden', !o);
    if (o) { S.key = ''; layout(); }
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
    // per frame: whether the pools are out, the next note to copy, and the songs you know
    update({ available, next = -1, known, learned, lefty, resting }) {
      S.lefty = lefty; setSpecies(known, learned); setOpen(!!available);
      callBtn.classList.toggle('rest', resting);
      if (!S.open) return;
      layout();
      if (next !== S.next) { noteBtns.forEach((el, i) => el.classList.toggle('next', i === next)); S.next = next; }
    },
    // one dot per note of the song being copied; in a duet the bird's half is hollow
    progress(total, done, state, bird = 0) {
      let html = '';
      for (let i = 0; i < total; i++) html += `<i class="${i < bird ? 'bird' : i < done ? (state || 'on') : ''}"></i>`;
      if (dots.innerHTML !== html) dots.innerHTML = html;
    },
    glow(lane) { if (S.open) flash(noteBtns[lane], 'glow'); },
    cheer(text) {
      cheer.textContent = text; cheer.classList.remove('show'); void cheer.offsetWidth; cheer.classList.add('show');
      if (S.open) for (const el of noteBtns) flash(el, 'glow');
      clearTimeout(cheerTimer); cheerTimer = setTimeout(() => cheer.classList.remove('show'), 2600);
    },
    // where a pool sits on screen (for test scripts)
    lanePt(lane) { const r = noteBtns[lane].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
