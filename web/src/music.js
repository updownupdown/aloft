// Generative music: Valley, after A Winged Victory for the Sullen. It plays in the shared key
// (audio.key), so the songbirds and the hawk's voice sit inside it. Day is brighter, night lower
// and sparser, storms go minor and quiet.
// What it is made of, taken from their records: long bowed chords that swell in and out of each
// other over a low pedal note; a soft felt piano that repeats a slow two-note figure from the
// chord (one note, then the next a second later, then a long breath) for a while and then rests;
// a slow rise and fall over minutes; everything dark (little above 1 kHz), slightly wavering as
// on tape, in a big, long room. Now and then the piano plays a phrase of a song you learned.
// The music lab (musiclab.html) tunes the numbers; what is kept there is saved under
// aloft.musicTune and the game plays it.
const ROOT = 220; // A3
const CHORDS = { day: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], dark: [[-3, 0, 4], [-7, -3, 0], [5, 8, 12], [-5, -2, 2]] };
const LANE = [12, 14, 16, 19, 21]; // a learned song's staff lines, an octave above the root

// Valley's tuning: every number the music lab can change
export const VALLEY_TUNE = {
  chordLen: 18, chordVar: 10, overlap: .72, rest: .15, strings: .014, cello: .7, pedal: .5, bright: 780,
  piano: .09, pianoOct: 0, figure: 4.2, pair: 1.05, run: 8, quiet: 20, arc: 300,
  echo: .18, echoTime: .42, room: .5,
};
export function loadTune() {
  try { return { ...VALLEY_TUNE, ...JSON.parse(localStorage.getItem('aloft.musicTune') || '{}') }; } catch { return { ...VALLEY_TUNE }; }
}

export function createMusic(audio) {
  const M = { tune: loadTune(), on: false, mode: 'valley', out: null, next: 0, chordT: 0, chord: 0, motifT: 4, left: 0, fig: [], t0: 0 };
  const hz = st => ROOT * Math.pow(2, (st + audio.key) / 12);
  let noise = null, pianoBus = null;
  function ensure() {
    if (M.out || !audio.ctx) return !!M.out;
    const ctx = audio.ctx, T = M.tune;
    M.out = ctx.createGain(); M.out.gain.value = 0;
    // tape: a delay that wavers a fraction of a millisecond, so the whole mix sways a little in pitch
    const wow = ctx.createDelay(.05), wl = ctx.createOscillator(), wg = ctx.createGain();
    wow.delayTime.value = .012; wl.frequency.value = .37; wg.gain.value = .0007; wl.connect(wg).connect(wow.delayTime); wl.start();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = .3;
    const dl = ctx.createDelay(1.5); dl.delayTime.value = T.echoTime; const fb = ctx.createGain(); fb.gain.value = T.echo;
    const rv = ctx.createConvolver(), wet = ctx.createGain(); rv.buffer = roomIR(ctx); wet.gain.value = T.room;
    M.out.connect(wow).connect(lp);
    lp.connect(audio.master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(audio.master);
    lp.connect(wet); wet.connect(rv); rv.connect(audio.master);
    // the piano's own soundboard: a short bright ring under each note, before the room
    pianoBus = ctx.createGain(); const board = ctx.createConvolver(), bw = ctx.createGain();
    board.buffer = boardIR(ctx); bw.gain.value = .35;
    pianoBus.connect(M.out); pianoBus.connect(board); board.connect(bw).connect(M.out);
    M.out.gain.setTargetAtTime(M.on ? 1 : 0, ctx.currentTime, 1.5);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    M.lp = lp; M.dl = dl; M.fb = fb; M.wet = wet; M.next = ctx.currentTime + 2; M.t0 = ctx.currentTime;
    return true;
  }
  M.setTune = o => {
    Object.assign(M.tune, o);
    if (M.dl) {
      const t = audio.ctx.currentTime;
      M.dl.delayTime.setTargetAtTime(M.tune.echoTime, t, .1); M.fb.gain.setTargetAtTime(M.tune.echo, t, .1); M.wet.gain.setTargetAtTime(M.tune.room, t, .3);
    }
  };
  M.log = () => {};   // the lab listens here: what Valley just played
  M.setOn = on => { M.on = on; if (M.out) M.out.gain.setTargetAtTime(on ? 1 : 0, audio.ctx.currentTime, .8); };
  M.setMode = () => {};   // one style now (older saves still call this)

  // ---- the strings ---------------------------------------------------------------------------
  // an oscillator whose pitch wanders a few cents, slowly, as a played note does
  function voice(f, det, t, end, out, drift = 4) {
    const ctx = audio.ctx, o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    l.frequency.value = .08 + Math.random() * .22; lg.gain.value = drift; l.connect(lg).connect(o.detune);
    o.connect(out); o.start(t); o.stop(end + .1); l.start(t); l.stop(end + .1);
    return o;
  }
  // a bowed section: three detuned saws per note, each wandering on its own, through a filter that
  // opens with the swell and a wooden body (a hump in the low mids, the fizz rolled off), with a
  // vibrato that comes in only once the note is sounding and a breath of rosin as the bows bite
  function strings(freqs, t, dur, vol, bright) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), hs = ctx.createBiquadFilter(), g = ctx.createGain();
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = .4; lp.frequency.setValueAtTime(320, t); lp.frequency.linearRampToValueAtTime(bright, t + dur * .45); lp.frequency.linearRampToValueAtTime(380, t + dur);
    body.type = 'peaking'; body.frequency.value = 260; body.Q.value = 1; body.gain.value = 5;
    hs.type = 'highshelf'; hs.frequency.value = 2200; hs.gain.value = -12;
    vib.frequency.value = 4.4 + Math.random() * .6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(5, t + dur * .5); vib.connect(vg);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * .7, t + dur * .4); g.gain.setValueAtTime(vol * .7, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const f of freqs) for (const det of [-8, 0, 7]) vg.connect(voice(f, det + (Math.random() - .5) * 4, t, t + dur, lp).detune);
    lp.connect(body).connect(hs).connect(g).connect(M.out); vib.start(t); vib.stop(t + dur + .1);
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = noise; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.2;
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vol * .3, t + dur * .3); ng.gain.linearRampToValueAtTime(0, t + dur * .55);
    src.connect(bp).connect(ng).connect(M.out); src.start(t, Math.random()); src.stop(t + dur * .55 + .05);
  }
  // the pedal: the tonic two octaves down, a soft organ-like hum that holds under many chords
  function pedal(f, t, dur, vol) {
    const ctx = audio.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .3); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const [m, type, v] of [[1, 'triangle', 1], [2, 'sine', .35], [1.002, 'sine', .6]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v;
      o.connect(og).connect(lp); o.start(t); o.stop(t + dur + .1);
    }
    lp.connect(g).connect(M.out);
  }

  // ---- the piano -----------------------------------------------------------------------------
  // a felt piano, soft and dark as on their records: nearly all fundamental, a little octave and
  // twelfth, partials a touch sharp of whole multiples as on a real string; each of the lower ones
  // three strings a cent apart that beat slowly; a quick first fall then a long, quiet ring (as a
  // struck string does); the felt's soft thump; a soundboard and the room behind. `v` 0..1 is how
  // hard it is played: harder is louder and a little brighter.
  function piano(f, t, vol, v = .6) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    const ring = Math.max(2.5, 9 - Math.log2(f / 110) * 2.2);   // low notes ring longer
    lp.type = 'lowpass'; lp.Q.value = .2;
    lp.frequency.setValueAtTime(Math.min(3000, f * (2.2 + 2.5 * v)), t); lp.frequency.setTargetAtTime(Math.min(1400, f * 1.6), t + .05, .6);
    g.gain.value = vol * (.55 + .6 * v); lp.connect(g).connect(pianoBus);
    for (const [n, a] of [[1, 1], [2, .3], [3, .07], [4, .025]]) {
      const fn = f * n * Math.sqrt(1 + .00035 * n * n), d = ring / (1 + (n - 1) * .9);
      for (const det of n <= 2 ? [-.9, 0, .8] : [0]) {
        const o = ctx.createOscillator(), og = ctx.createGain(), k = a / (n <= 2 ? 3 : 1);
        o.frequency.value = fn; o.detune.value = det + (Math.random() - .5) * .6;
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(k, t + .011);
        og.gain.setTargetAtTime(k * .3, t + .011, .22);            // the prompt sound falls away
        og.gain.setTargetAtTime(0, t + .5, d / 4.5);                // then the long aftersound
        o.connect(og).connect(lp); o.start(t); o.stop(t + .5 + d + .1);
      }
    }
    // the hammer's felt: a soft low thump of noise under the pitch
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = noise; bp.type = 'lowpass'; bp.frequency.value = Math.min(900, f * 2);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vol * .25 * v, t + .004); ng.gain.setTargetAtTime(0, t + .006, .018);
    src.connect(bp).connect(ng).connect(pianoBus); src.start(t, Math.random()); src.stop(t + .15);
  }
  // a note the hawk held in tune on the string joins the music: the same note, an octave down,
  // touched softly on the piano
  M.echo = lane => { if (M.on && ensure()) piano(hz(LANE[lane]) / 2, audio.ctx.currentTime + .05, M.tune.piano * .8, .35); };

  // the slow figure: two notes of the chord, high then lower a breath later (sometimes a third),
  // played softly, a little louder on the first
  function figure(chord, mode) {
    const up = M.tune.pianoOct * 12 + 12, top = chord[2] + up, mid = chord[1] + up, low = chord[0] + up;
    const shapes = [[top, mid], [top, low], [mid, low], [top + 12, top], [top, mid, low]];
    return mode === 'dark' ? shapes[(Math.random() * 3) | 0].map(n => n - 12) : shapes[(Math.random() * shapes.length) | 0];
  }

  function valley(now, { night, storm, learned, species }, mode) {
    const T = M.tune, dark = night > .7;
    // the slow rise and fall: louder, brighter and busier at the top of each arc
    const arc = .5 - .5 * Math.cos((now - M.t0) / T.arc * Math.PI * 2), quiet = 1 - storm * .4;
    if (now > M.chordT - .5) {
      const t = Math.max(now, M.chordT), chords = CHORDS[mode];
      if (Math.random() < T.rest) { const r = 6 + Math.random() * 8; M.chordT = t + r; M.log(`the strings rest for ${Math.round(r)} s`); }
      else {
        M.chord = (M.chord + 1 + (Math.random() < .3 ? 1 : 0)) % chords.length;
        const ch = chords[M.chord], dur = T.chordLen + Math.random() * T.chordVar, vol = T.strings * quiet * (.7 + .6 * arc);
        strings(ch.map(hz), t, dur, vol, T.bright + arc * 450 - night * 250);
        const cello = Math.random() < T.cello;
        if (cello) strings([hz(ch[0]) / 2], t + dur * .1, dur * .9, vol * .95, T.bright * .7);
        if (Math.random() < T.pedal) pedal(hz(chords[0][0]) / 4, t, dur * 1.6, vol * 2.2);
        M.chordT = t + dur * T.overlap;   // the next chord swells in as this one fades
        M.log(`a chord for ${Math.round(dur)} s${cello ? ', a cello under it' : ''}`);
      }
    }
    if (now > M.next - .2) {
      const t = Math.max(now, M.next), vol = T.piano * quiet;
      if (M.left <= 0) {
        // a rest, then a new run of the figure (longer rests at night and in the low of the arc)
        if (M.fig.length) {
          const q = T.quiet * (dark ? 1.6 : 1) * (1.3 - arc * .6) * (.6 + Math.random() * .8);
          M.fig = []; M.next = t + q; M.log(`the piano rests for ${Math.round(q)} s`); return;
        }
        M.left = Math.round(T.run * (.6 + Math.random() * .8) * (.7 + arc * .6));
      }
      M.motifT--;
      if (M.motifT <= 0 && learned.size) {
        // a phrase from a learned song, slow and low
        const ids = [...learned], sp = species[ids[(Math.random() * ids.length) | 0]];
        sp.notes.forEach((n, i) => piano(hz(LANE[n] + T.pianoOct * 12) / 2, t + i * T.pair, vol * .9, .45 + (i === 0 ? .1 : 0)));
        M.motifT = 14 + Math.random() * 10; M.left = 0; M.fig = [1];
        M.next = t + sp.notes.length * T.pair + T.figure; M.log(`the piano plays the ${sp.name}'s song`); return;
      }
      // the figure changes with the chord, and holds a while between
      if (!M.fig.length || M.figChord !== M.chord || Math.random() < .15) { M.fig = figure(CHORDS[mode][M.chord], mode); M.figChord = M.chord; }
      M.fig.forEach((n, i) => piano(hz(n), t + i * T.pair * (1 + (Math.random() - .5) * .06), vol * (i ? .8 : 1), (.35 + arc * .35) * (i ? .85 : 1)));
      M.left--;
      M.next = t + T.figure * (1 + (Math.random() - .5) * .08) * (dark ? 1.2 : 1);
      M.log(`the piano figure (${M.left} more)`);
    }
  }
  // the lab's buttons: start the next chord, or the piano, now
  M.skip = what => { const now = audio.ctx?.currentTime ?? 0; if (what === 'chord') M.chordT = now; else { M.next = now; if (M.left <= 0) { M.fig = []; M.left = 0; } } };
  // called every frame with the state of the world and the hawk
  M.update = (dt, w) => {
    if (!M.on || !ensure()) return;
    const now = audio.ctx.currentTime, mode = w.storm > .5 || w.night > .7 ? 'dark' : 'day';
    M.lp.frequency.setTargetAtTime(1100 + 900 * (1 - w.night) * (1 - w.storm * .6), now, 2);
    valley(now, w, mode);
  };
  return M;
}

// a big room: early reflections, then a long tail (about five seconds) that darkens as it dies
function roomIR(ctx) {
  const n = Math.floor(ctx.sampleRate * 5.5), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) {
      const s = i / ctx.sampleRate, k = Math.min(1, s * 18);
      lp += (Math.random() * 2 - 1 - lp) * (.45 - .4 * Math.min(1, s / 4));
      d[i] = lp * k * Math.exp(-s * 1.25) * .45;
    }
    for (const at of [.023, .037, .051, .071]) d[Math.floor(at * ctx.sampleRate) + ch * 13] += .2;
  }
  return buf;
}
// a piano's soundboard and case: a short, fairly bright ring
function boardIR(ctx) {
  const n = Math.floor(ctx.sampleRate * .45), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const s = i / ctx.sampleRate; lp += (Math.random() * 2 - 1 - lp) * .35; d[i] = lp * Math.exp(-s * 9) * .5; }
  }
  return buf;
}
