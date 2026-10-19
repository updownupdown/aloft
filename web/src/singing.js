// Singing from a perch. A button at the top centre opens a string down the right edge (it takes
// the place of the right thumb strip) with five fixed notes on it, pools of pale pigment. Touch a
// pool and the hawk sings that note; slide along the string and each pool you cross sounds.
// The next note to sing is tinted red, and a pool brightens in the bird's own colour while it
// sings that note or when you sing it. Your finger is a drop of indigo on the string.
import { wash, ellP } from './paint.js';
import { C, mix } from './util.js';

const PAD = 30;
const INK = [58, 36, 24], POOL = [156, 192, 219], NEXT = [168, 72, 58], INDIGO = [47, 74, 116];

export function createSinging({ audio, onNote, onToggle }) {
  const root = document.getElementById('ui');
  const btn = document.createElement('button'); btn.className = 'sing-btn hidden';
  const dots = document.createElement('div'); dots.className = 'sing-dots hidden';
  const strip = document.createElement('div'); strip.className = 'sing-strip hidden';
  const cheer = document.createElement('div'); cheer.className = 'sing-cheer'; let cheerTimer = 0;
  const cv = document.createElement('canvas'); strip.append(cv);
  root.append(btn, dots, cheer, strip);

  const S = { open: false, finger: null, glow: [0, 0, 0, 0, 0], hit: [0, 0, 0, 0, 0], col: [184, 83, 47], label: '', next: -1 };
  // the five notes sit evenly down the string, highest at the top
  const yAt = (lane, h) => PAD + (4 - lane) / 4 * (h - PAD * 2);
  const laneAt = y => { const r = strip.getBoundingClientRect(); return Math.max(0, Math.min(4, Math.round(4 - (y - r.top - PAD) / (r.height - PAD * 2) * 4))); };
  function sound(lane) { S.hit[lane] = 1; audio.note(lane, 1, .18); onNote(lane, 0); }

  btn.addEventListener('click', () => setOpen(!S.open));
  strip.addEventListener('pointerdown', e => {
    e.preventDefault(); strip.setPointerCapture?.(e.pointerId); audio.unlock?.();
    S.finger = { id: e.pointerId, lane: laneAt(e.clientY) }; sound(S.finger.lane);
  });
  strip.addEventListener('pointermove', e => {
    const f = S.finger; if (f?.id !== e.pointerId) return;
    // sliding on, a new note sounds once the finger is well into its pool (no flicker at the edges)
    const r = strip.getBoundingClientRect(), pos = 4 - (e.clientY - r.top - PAD) / (r.height - PAD * 2) * 4;
    const lane = Math.max(0, Math.min(4, Math.round(pos)));
    if (lane !== f.lane && Math.abs(pos - lane) < .3) { f.lane = lane; sound(lane); }
  });
  const up = e => { if (S.finger?.id === e.pointerId) S.finger = null; };
  strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  strip.addEventListener('contextmenu', e => e.preventDefault());

  function setOpen(o) {
    if (o === S.open) return;
    S.open = o; S.finger = null;
    strip.classList.toggle('hidden', !o); dots.classList.toggle('hidden', !o);
    btn.textContent = o ? 'Done' : S.label; btn.classList.toggle('on', o);
    onToggle?.(o);
  }

  // per frame: which button to offer, the finger's pitch, and the string drawing
  function update(dt, { available, label, color, next = -1 }) {
    S.label = label; if (color) S.col = color; S.next = next;
    if (!available && S.open) setOpen(false);
    btn.classList.toggle('hidden', !available);
    if (!S.open) { if (btn.textContent !== label) btn.textContent = label; return; }
    for (let i = 0; i < 5; i++) { S.glow[i] = Math.max(0, S.glow[i] - dt * 2.2); S.hit[i] = Math.max(0, S.hit[i] - dt * 2.5); }
    draw();
  }

  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = strip.clientWidth, h = strip.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'), cx = w * .5, f = S.finger;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    // the five pools of pigment, one per song note (multiply on a clear canvas paints them straight on)
    for (let i = 0; i < 5; i++) {
      const y = yAt(i, h), g = Math.max(S.glow[i], S.hit[i]), base = i === S.next ? NEXT : POOL;
      wash(x, ellP(cx, y, 19 + 4 * g, 8.5 + 2 * g, 0, 14), g > .02 ? mix(base, S.col, g) : base, (i === S.next ? .46 : .38) + .35 * g, { passes: 2, amp: 1.6, seed: 11 + i, rim: .35, rimW: .8 });
    }
    // the string, trembling while it sounds
    x.strokeStyle = C(INK, .7); x.lineWidth = 1.2; x.beginPath();
    for (let y = 8; y <= h - 8; y += 6) { const wob = f ? Math.sin(y * .25 + performance.now() * .05) * .9 * Math.min(1, Math.abs(y - yAt(f.lane, h)) / 60) : 0; y === 8 ? x.moveTo(cx + wob, y) : x.lineTo(cx + wob, y); }
    x.stroke();
    // your finger: a drop of indigo on the string, in the pool it is sounding
    if (f) {
      const y = yAt(f.lane, h);
      x.fillStyle = C(INDIGO, .2); x.beginPath(); x.arc(cx, y, 20, 0, Math.PI * 2); x.fill();
      x.fillStyle = C(INDIGO, .85); x.beginPath(); x.arc(cx, y, 9, 0, Math.PI * 2); x.fill();
      x.strokeStyle = C(INDIGO, .9); x.lineWidth = .8; x.beginPath(); x.arc(cx, y, 9.6, 0, Math.PI * 2); x.stroke();
    }
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
    glow(lane) { S.glow[lane] = 1; },
    // a finished song: a line under the button and every pool on the string lights up
    cheer(text) {
      cheer.textContent = text; cheer.classList.remove('show'); void cheer.offsetWidth; cheer.classList.add('show');
      S.hit = [1, 1, 1, 1, 1]; S.glow = [1, 1, 1, 1, 1];
      clearTimeout(cheerTimer); cheerTimer = setTimeout(() => cheer.classList.remove('show'), 2600);
    },
    // where a lane sits on screen (for test scripts)
    lanePt(lane) { const r = strip.getBoundingClientRect(); return [r.left + r.width / 2, r.top + yAt(lane, r.height)]; },
  };
}
