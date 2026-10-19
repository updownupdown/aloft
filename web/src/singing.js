// Singing from a perch: whenever the hawk sits on a branch (or a songbird is close), two half
// rings of pigment pools open around the joysticks. Around the right stick, the five song notes,
// low to high, each its own colour: touch one to sing it, slide across to sing each you cross.
// Around the left stick, the songbirds you know, each pooled in its breast colour with a dot of
// its cap: touch one and the hawk sings that bird's song, and the bird answers. (Left-handed,
// the rings swap.) The next note of a song you are copying wears a red ring; a pool brightens
// while the songbird sings that note. The pools are painted once into images, so the rings cost
// nothing per frame.
import { wash, circP } from './paint.js';

export const NOTE_COLS = [[47, 74, 116], [62, 124, 136], [96, 136, 66], [196, 146, 52], [176, 78, 58]];
const SPAN = 110 * Math.PI / 180, GAP = 40, BTN = 34;

const pools = new Map();
function pool(col, dot) {
  const key = col.join() + (dot ? '/' + dot.join() : '');
  if (pools.has(key)) return pools.get(key);
  const cv = document.createElement('canvas'), s = 2 * BTN, r = s / 2, x = cv.getContext('2d');
  cv.width = cv.height = s;
  wash(x, circP(r, r, r * .8, 16), col, .55, { passes: 3, amp: r * .05, seed: col[0] + col[2], rim: .6, rimW: 2 });
  if (dot) wash(x, circP(r + r * .18, r - r * .22, r * .26, 10), dot, .7, { passes: 2, amp: r * .03, seed: 4, rim: .3 });
  const url = `url(${cv.toDataURL()})`; pools.set(key, url); return url;
}

export function createSinging({ audio, sticks, onNote, onMimic, onToggle }) {
  const root = document.getElementById('ui');
  const dots = document.createElement('div'); dots.className = 'sing-dots hidden';
  const cheer = document.createElement('div'); cheer.className = 'sing-cheer'; let cheerTimer = 0;
  const notes = document.createElement('div'); notes.className = 'song-ring notes hidden';
  const calls = document.createElement('div'); calls.className = 'song-ring calls hidden';
  root.append(dots, cheer, notes, calls);

  const S = { open: false, finger: null, next: -1, lefty: false, species: '', key: '' };
  const noteBtns = NOTE_COLS.map((col, lane) => {
    const el = document.createElement('button'); el.className = 'pool'; el.style.backgroundImage = pool(col);
    el.setAttribute('aria-label', `Note ${lane + 1}`); el.dataset.lane = lane; notes.append(el); return el;
  });
  const flash = (el, cls = 'hit') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function sound(lane) { flash(noteBtns[lane]); audio.note(lane, 1, .18); onNote(lane, 0); }

  // touch a pool to sing it; slide on and each pool the finger reaches sings in turn
  const laneAt = (x, y) => {
    let best = -1, bd = BTN * .75;
    noteBtns.forEach((el, i) => { const r = el.getBoundingClientRect(), d = Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  notes.addEventListener('pointerdown', e => {
    const lane = laneAt(e.clientX, e.clientY); if (lane < 0) return;
    e.preventDefault(); e.stopPropagation(); notes.setPointerCapture?.(e.pointerId); audio.unlock?.();
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
    const el = e.target.closest('.pool'); if (!el) return;
    e.preventDefault(); e.stopPropagation(); audio.unlock?.(); flash(el);
    onMimic(+el.dataset.sp);
  });
  for (const r of [notes, calls]) r.addEventListener('contextmenu', e => e.preventDefault());

  // the songbirds you know, one pool each, in the order you learned them
  function setSpecies(list) {
    const key = list.map(s => s.id).join();
    if (key === S.species) return;
    S.species = key; calls.textContent = '';
    for (const sp of list) {
      const el = document.createElement('button'); el.className = 'pool'; el.dataset.sp = sp.id;
      el.style.backgroundImage = pool(sp.cols.breast, sp.cols.cap); el.setAttribute('aria-label', `Sing like the ${sp.name}`);
      const name = document.createElement('span'); name.textContent = sp.name; el.append(name);
      calls.append(el);
    }
    S.key = '';
  }

  // lay the pools out on half circles round the sticks, rising from the outer side to the top
  function layout() {
    const key = [innerWidth, innerHeight, S.lefty, S.species].join();
    if (key === S.key) return;
    S.key = key;
    const place = (ring, side, btns) => {
      const r = sticks.el(side).getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let rho = r.width / 2 + 28, i = 0;
      // the left ring opens rightward and up, the right one leftward and up
      const a0 = side === 'L' ? -10 * Math.PI / 180 : Math.PI + 10 * Math.PI / 180, dir = side === 'L' ? 1 : -1;
      while (i < btns.length) {
        const n = Math.max(2, Math.floor(SPAN * rho / GAP) + 1), take = Math.min(n, btns.length - i);
        for (let k = 0; k < take; k++, i++) {
          const a = a0 + dir * SPAN * (take > 1 ? k / (n - 1) : 0);
          btns[i].style.left = `${cx + Math.cos(a) * rho - BTN / 2}px`; btns[i].style.top = `${cy - Math.sin(a) * rho - BTN / 2}px`;
        }
        rho += ring === calls ? GAP + 8 : GAP;
      }
    };
    const ns = S.lefty ? 'L' : 'R';
    place(notes, ns, noteBtns); place(calls, ns === 'L' ? 'R' : 'L', [...calls.children]);
  }

  function setOpen(o) {
    if (o === S.open) return;
    S.open = o; S.finger = null;
    for (const el of [notes, calls, dots]) el.classList.toggle('hidden', !o);
    if (o) { S.key = ''; layout(); }
    onToggle?.(o);
  }

  // per frame: whether the rings are out, the next note to sing, and the songs you know
  function update(dt, { available, next = -1, known = [], lefty = false }) {
    S.lefty = lefty; setSpecies(known);
    setOpen(!!available);
    if (!S.open) return;
    layout();
    if (next !== S.next) { noteBtns.forEach((el, i) => el.classList.toggle('next', i === next)); S.next = next; }
  }

  // progress under the button: one dot per note of the song being copied, or per note sung.
  // In a duet the first `bird` notes were the songbird's, shown hollow; yours follow.
  function progress(total, done, state, bird = 0) {
    let html = '';
    for (let i = 0; i < total; i++) html += `<i class="${i < bird ? 'bird' : i < done ? (state === 'wrong' ? 'wrong' : state === 'done' ? 'done' : 'on') : ''}"></i>`;
    if (dots.innerHTML !== html) dots.innerHTML = html;
  }

  return {
    update, progress, setOpen,
    get open() { return S.open; },
    glow(lane) { if (S.open) flash(noteBtns[lane], 'glow'); },
    // a finished song: a line at the top and every pool brightens
    cheer(text) {
      cheer.textContent = text; cheer.classList.remove('show'); void cheer.offsetWidth; cheer.classList.add('show');
      for (const el of noteBtns) flash(el, 'glow');
      clearTimeout(cheerTimer); cheerTimer = setTimeout(() => cheer.classList.remove('show'), 2600);
    },
    // where a pool sits on screen (for test scripts)
    lanePt(lane) { const r = noteBtns[lane].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    callPt(id) { const el = calls.querySelector(`[data-sp="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  };
}
