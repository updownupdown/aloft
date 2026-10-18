// Singing from a perch. A button at the top centre opens a fretless string down the right edge:
// slide a finger up and down it and the hawk's voice follows, continuously, like a violin with
// no frets. A note counts once it is held in tune (within a third of a semitone) for a moment.
// The five song pitches are faint ticks on the string; they glow as a songbird sings them.
import { NOTE_HZ } from './audio.js';

const LANES = [0, 2, 4, 7, 9];          // semitones above the lowest song note
const LO = -3, HI = 13;                  // the string's range in semitones
const TOL = .33, HOLD = .16;             // how close, and for how long, a note must be held

export function createSinging({ audio, onNote, onToggle }) {
  const root = document.getElementById('ui');
  const btn = document.createElement('button'); btn.className = 'sing-btn hidden';
  const dots = document.createElement('div'); dots.className = 'sing-dots hidden';
  const strip = document.createElement('div'); strip.className = 'sing-strip hidden';
  const cv = document.createElement('canvas'); strip.append(cv);
  root.append(btn, dots, strip);

  const S = { open: false, finger: null, stable: null, glow: [0, 0, 0, 0, 0], hit: [0, 0, 0, 0, 0], col: '#b8532f', label: '' };
  const semiAt = y => { const r = strip.getBoundingClientRect(), pad = 26; return HI - (y - r.top - pad) / (r.height - pad * 2) * (HI - LO); };
  const yAt = (st, h, pad = 26) => pad + (HI - st) / (HI - LO) * (h - pad * 2);
  const hz = st => NOTE_HZ[0] * Math.pow(2, st / 12);

  btn.addEventListener('click', () => setOpen(!S.open));
  strip.addEventListener('pointerdown', e => { e.preventDefault(); strip.setPointerCapture?.(e.pointerId); audio.unlock?.(); S.finger = { id: e.pointerId, st: semiAt(e.clientY) }; });
  strip.addEventListener('pointermove', e => { if (S.finger?.id === e.pointerId) S.finger.st = semiAt(e.clientY); });
  const up = e => { if (S.finger?.id === e.pointerId) { S.finger = null; S.stable = null; } };
  strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  strip.addEventListener('contextmenu', e => e.preventDefault());

  function setOpen(o) {
    if (o === S.open) return;
    S.open = o; S.finger = null; S.stable = null; audio.voice(0, false);
    strip.classList.toggle('hidden', !o); dots.classList.toggle('hidden', !o);
    btn.textContent = o ? 'Done' : S.label; btn.classList.toggle('on', o);
    onToggle?.(o);
  }

  // per frame: which button to offer, the finger's pitch, and the string drawing
  function update(dt, { available, label, color }) {
    S.label = label; if (color) S.col = color;
    if (!available && S.open) setOpen(false);
    btn.classList.toggle('hidden', !available);
    if (!S.open) { if (btn.textContent !== label) btn.textContent = label; return; }
    for (let i = 0; i < 5; i++) { S.glow[i] = Math.max(0, S.glow[i] - dt * 2.2); S.hit[i] = Math.max(0, S.hit[i] - dt * 2.5); }
    const f = S.finger;
    audio.voice(f ? hz(f.st) : 0, !!f);
    if (f) {
      let lane = -1;
      for (let i = 0; i < 5; i++) if (Math.abs(f.st - LANES[i]) < TOL) lane = i;
      if (lane < 0) S.stable = null;
      else if (S.stable?.lane !== lane) S.stable = { lane, t: 0, done: false };
      else if (!S.stable.done && (S.stable.t += dt) >= HOLD) { S.stable.done = true; S.hit[lane] = 1; onNote(lane); }
    }
    draw();
  }

  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = strip.clientWidth, h = strip.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'), cx = w * .5;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const ink = 'rgba(58,36,24,', f = S.finger;
    // the string, trembling while it sounds
    x.strokeStyle = ink + '.55)'; x.lineWidth = 1.2; x.beginPath();
    for (let y = 8; y <= h - 8; y += 6) { const wob = f ? Math.sin(y * .25 + performance.now() * .05) * .9 * Math.min(1, Math.abs(y - yAt(f.st, h)) / 60) : 0; y === 8 ? x.moveTo(cx + wob, y) : x.lineTo(cx + wob, y); }
    x.stroke();
    for (let i = 0; i < 5; i++) {
      const y = yAt(LANES[i], h), g = Math.max(S.glow[i], S.hit[i]);
      x.strokeStyle = ink + (.28 + .5 * g) + ')'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(cx - 10 - g * 6, y); x.lineTo(cx - 4, y); x.moveTo(cx + 4, y); x.lineTo(cx + 10 + g * 6, y); x.stroke();
      if (g > .02) { x.fillStyle = S.col; x.globalAlpha = g * .8; x.beginPath(); x.arc(cx, y, 4 + g * 3, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
    }
    if (f) {
      const y = yAt(f.st, h), inTune = !!S.stable, held = S.stable ? Math.min(1, S.stable.t / HOLD) : 0;
      x.strokeStyle = ink + '.7)'; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, y, 13, 0, Math.PI * 2); x.stroke();
      if (inTune) { x.fillStyle = S.col; x.globalAlpha = .35 + .5 * held; x.beginPath(); x.arc(cx, y, 13 * held, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
    }
  }

  // progress under the button: one dot per note of the song being copied, or per note sung
  function progress(total, done, state) {
    let html = '';
    for (let i = 0; i < total; i++) html += `<i class="${i < done ? (state === 'wrong' ? 'wrong' : state === 'done' ? 'done' : 'on') : ''}"></i>`;
    if (dots.innerHTML !== html) dots.innerHTML = html;
  }

  return {
    update, progress, setOpen,
    get open() { return S.open; },
    glow(lane) { S.glow[lane] = 1; },
    // where a lane sits on screen (for test scripts)
    lanePt(lane) { const r = strip.getBoundingClientRect(); return [r.left + r.width / 2, r.top + yAt(LANES[lane], r.height)]; },
  };
}
