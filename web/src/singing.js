// Singing from a perch. A button at the top centre opens a fretless string down the right edge:
// slide a finger up and down it and the hawk's voice follows, continuously, like a violin with
// no frets. A note counts once it is held in tune (within a third of a semitone) for a moment.
// The five song pitches are pools of pale pigment on the string; the next note to sing is tinted
// red, and a pool brightens in the bird's own colour while it sings that note or when you land it.
// Your voice is a drop of indigo that bleeds into the pool as you hold the note, and the path
// you have sung drifts off to the right as it ages, so a steady note draws a straight line.
// Pitches come from the shared key (audio.hz), so the string follows the music through the day.
import { wash, ellP } from './paint.js';
import { C, mix } from './util.js';

const LANES = [0, 2, 4, 7, 9];          // semitones above the lowest song note
const LO = -3, HI = 13;                  // the string's range in semitones
const TOL = .5, HOLD = .12;              // how close, and for how long, a note must be held
const INK = [58, 36, 24], POOL = [156, 192, 219], NEXT = [168, 72, 58], INDIGO = [47, 74, 116];
const TRAIL_S = 1.4;                     // how long the sung path stays on the strip

export function createSinging({ audio, onNote, onToggle }) {
  const root = document.getElementById('ui');
  const btn = document.createElement('button'); btn.className = 'sing-btn hidden';
  const dots = document.createElement('div'); dots.className = 'sing-dots hidden';
  const strip = document.createElement('div'); strip.className = 'sing-strip hidden';
  const cheer = document.createElement('div'); cheer.className = 'sing-cheer'; let cheerTimer = 0;
  const cv = document.createElement('canvas'); strip.append(cv);
  root.append(btn, dots, cheer, strip);

  const S = { open: false, finger: null, stable: null, glow: [0, 0, 0, 0, 0], hit: [0, 0, 0, 0, 0], col: [184, 83, 47], label: '', next: -1, trail: [] };
  const semiAt = y => { const r = strip.getBoundingClientRect(), pad = 26; return HI - (y - r.top - pad) / (r.height - pad * 2) * (HI - LO); };
  const yAt = (st, h, pad = 26) => pad + (HI - st) / (HI - LO) * (h - pad * 2);
  const hz = st => audio.hz(st);

  btn.addEventListener('click', () => setOpen(!S.open));
  strip.addEventListener('pointerdown', e => { e.preventDefault(); strip.setPointerCapture?.(e.pointerId); audio.unlock?.(); S.finger = { id: e.pointerId, st: semiAt(e.clientY) }; });
  strip.addEventListener('pointermove', e => { if (S.finger?.id === e.pointerId) S.finger.st = semiAt(e.clientY); });
  const up = e => { if (S.finger?.id === e.pointerId) { S.finger = null; S.stable = null; } };
  strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  strip.addEventListener('contextmenu', e => e.preventDefault());

  function setOpen(o) {
    if (o === S.open) return;
    S.open = o; S.finger = null; S.stable = null; S.trail = []; audio.voice(0, false);
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
    const f = S.finger, now = performance.now() / 1000;
    audio.voice(f ? hz(f.st) : 0, !!f);
    if (f) {
      S.trail.push([now, f.st]);
      let lane = -1;
      for (let i = 0; i < 5; i++) if (Math.abs(f.st - LANES[i]) < TOL) lane = i;
      if (lane < 0) S.stable = null;
      else if (S.stable?.lane !== lane) S.stable = { lane, t: 0, done: false };
      else if (!S.stable.done && (S.stable.t += dt) >= HOLD) { S.stable.done = true; S.hit[lane] = 1; onNote(lane, Math.abs(f.st - LANES[lane]) / TOL); }
    }
    while (S.trail.length && now - S.trail[0][0] > TRAIL_S) S.trail.shift();
    draw(now);
  }

  function draw(now) {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = strip.clientWidth, h = strip.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'), cx = w * .5, f = S.finger;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    // the five pools of pigment, one per song note (multiply on a clear canvas paints them straight on)
    for (let i = 0; i < 5; i++) {
      const y = yAt(LANES[i], h), g = Math.max(S.glow[i], S.hit[i]), base = i === S.next ? NEXT : POOL;
      wash(x, ellP(cx, y, 19 + 4 * g, 8.5 + 2 * g, 0, 14), g > .02 ? mix(base, S.col, g) : base, (i === S.next ? .46 : .38) + .35 * g, { passes: 2, amp: 1.6, seed: 11 + i, rim: .35, rimW: .8 });
    }
    // the string, trembling while it sounds
    x.strokeStyle = C(INK, .7); x.lineWidth = 1.2; x.beginPath();
    for (let y = 8; y <= h - 8; y += 6) { const wob = f ? Math.sin(y * .25 + performance.now() * .05) * .9 * Math.min(1, Math.abs(y - yAt(f.st, h)) / 60) : 0; y === 8 ? x.moveTo(cx + wob, y) : x.lineTo(cx + wob, y); }
    x.stroke();
    // what you have sung so far drifts right as it ages: a held note is a straight line, a wobble shows
    if (S.trail.length > 1) {
      x.strokeStyle = C(INDIGO, .45); x.lineWidth = 1; x.setLineDash([2, 3]); x.beginPath();
      S.trail.forEach(([t, st], i) => { const px = cx + 9 + (now - t) * 26, py = yAt(st, h); i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.stroke(); x.setLineDash([]);
    }
    // your voice: a drop of indigo on the string, bleeding into the pool as you hold the note
    if (f) {
      const y = yAt(f.st, h), held = S.stable ? Math.min(1, S.stable.t / HOLD) : 0;
      if (S.stable) { x.fillStyle = C(INDIGO, .12 + .22 * held); x.beginPath(); x.arc(cx, y, 12 + 10 * held, 0, Math.PI * 2); x.fill(); }
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
    lanePt(lane) { const r = strip.getBoundingClientRect(); return [r.left + r.width / 2, r.top + yAt(LANES[lane], r.height)]; },
  };
}
