// Generative music: Valley. It plays in the shared key (audio.key), so the songbirds and the
// hawk's voice sit inside it, through one soft filter, a valley echo and a long room reverb. Day
// is brighter, night lower and sparser, storms go minor and quiet.
// A bed (a pad of long chords that swell in and out of each other, with rests) under a lead (a
// few slow notes, then a long quiet; now and then a phrase from a song you learned). The music
// lab (musiclab.html) tries other beds and leads as directions (DIRECTIONS) and tunes the numbers;
// what is kept there is saved under aloft.musicTune and the game plays it.
// Every instrument is built to drift a little, the way played ones do: detuned voices that
// wander, a breath or bow noise at the start, partials that are not quite whole multiples.
const ROOT = 220; // A3
const CHORDS = { day: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], dark: [[-3, 0, 4], [-7, -3, 0], [5, 8, 12], [-5, -2, 2]] };
const SCALE = { day: [0, 2, 4, 7, 9, 12, 14, 16], dark: [0, 3, 5, 7, 10, 12, 15] };
const LANE = [12, 14, 16, 19, 21]; // a learned song's staff lines, an octave above the root

// Valley's tuning: every number the music lab can change. `bed`: strings, cello (a low drone
// only), choir, air (breath through the chord) or none; `lead`: piano, pluck (a plucked string),
// flute or none.
export const VALLEY_TUNE = {
  dir: 'A', bed: 'strings', lead: 'piano', chordLen: 16, chordVar: 10, overlap: .72, rest: .2, bedVol: .02, cello: .6, bright: 950,
  voicing: 'close', leadVol: .045, leadOct: 0, phraseMin: 2, phraseMax: 4, noteGap: 3.5, noteVar: 4, quiet: 18, quietVar: 28,
  echo: .26, echoTime: .42, room: .35,
};
// directions to try in the lab: a bed, a lead and the numbers that suit them
export const DIRECTIONS = [
  ['A', 'Valley', 'Bowed strings and a felt piano, as before but warmer and less clean.', {}],
  ['B', 'Mist', 'Breath through the chords, like wind over a bottle; the piano rarer and higher, in a big room.',
    { bed: 'air', bedVol: .05, leadOct: 1, quiet: 26, quietVar: 34, noteGap: 4.5, room: .55, chordLen: 20 }],
  ['C', 'Hearth', 'Only a low cello drone, and a plucked string that plays a little more, like a guitar by a fire.',
    { bed: 'cello', bedVol: .024, lead: 'pluck', leadVol: .07, phraseMin: 3, phraseMax: 6, noteGap: 1.4, noteVar: 1.6, quiet: 14, room: .3 }],
  ['D', 'Hill choir', 'Soft voices singing the chords, and a high plucked harp.',
    { bed: 'choir', bedVol: .022, lead: 'pluck', leadVol: .05, leadOct: 1, noteGap: 2.2, noteVar: 2.5, room: .5, chordLen: 18 }],
  ['E', 'Shepherd', 'A breathy wooden flute plays slow phrases over a drone, now and then a learned song.',
    { bed: 'cello', bedVol: .02, lead: 'flute', leadVol: .065, phraseMin: 3, phraseMax: 5, noteGap: 1.8, noteVar: 1.2, quiet: 22, room: .4 }],
];
export const directionTune = id => ({ ...VALLEY_TUNE, ...(DIRECTIONS.find(d => d[0] === id)?.[3] || {}), dir: id });
// how a chord's three notes are spread: as written, opened out (root, fifth, the third an
// octave up), or suspended (the third swapped for the second)
const VOICE = { close: c => c, open: c => [c[0] - 12, c[2] - 12, c[1]], sus: c => [c[0], c[0] + 2, c[2], c[0] + 12] };
export function loadTune() {
  try {
    const o = JSON.parse(localStorage.getItem('aloft.musicTune') || '{}');
    // older saves: strings and piano volumes had other names
    if (o.strings !== undefined && o.bedVol === undefined) o.bedVol = o.strings;
    if (o.piano !== undefined && o.leadVol === undefined) o.leadVol = o.piano;
    return { ...VALLEY_TUNE, ...o };
  } catch { return { ...VALLEY_TUNE }; }
}

export function createMusic(audio) {
  const M = { tune: loadTune(), on: false, mode: 'valley', out: null, next: 0, chordT: 0, chord: 0, motifT: 6, phrase: 2 };
  const hz = st => ROOT * Math.pow(2, (st + audio.key) / 12);
  let noise = null;
  const plucks = new Map();
  function ensure() {
    if (M.out || !audio.ctx) return !!M.out;
    const ctx = audio.ctx;
    M.out = ctx.createGain(); M.out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    // a soft echo makes the sparse notes feel like they are in a valley, and a long room behind
    const dl = ctx.createDelay(1.5); dl.delayTime.value = M.tune.echoTime; const fb = ctx.createGain(); fb.gain.value = M.tune.echo;
    const rv = ctx.createConvolver(), wet = ctx.createGain(); rv.buffer = roomIR(ctx); wet.gain.value = M.tune.room;
    M.out.connect(lp); lp.connect(audio.master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(audio.master);
    lp.connect(wet); wet.connect(rv); rv.connect(audio.master);
    M.out.gain.setTargetAtTime(M.on ? 1 : 0, ctx.currentTime, 1.5);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    M.lp = lp; M.dl = dl; M.fb = fb; M.wet = wet; M.next = ctx.currentTime + 1;
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

  // ---- small parts -------------------------------------------------------------------------
  // an oscillator whose pitch wanders a few cents, slowly, as a played note does
  function voice(type, f, det, t, end, out, drift = 4) {
    const ctx = audio.ctx, o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = det;
    l.frequency.value = .08 + Math.random() * .22; lg.gain.value = drift; l.connect(lg).connect(o.detune);
    o.connect(out); o.start(t); o.stop(end + .1); l.start(t); l.stop(end + .1);
    return o;
  }
  // a breath of noise through a band: a bow's rosin, a flute's air, a hammer's felt
  function breath(t, dur, f, q, vol, out, atk = .02, env = true) {
    const ctx = audio.ctx, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    if (env) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.linearRampToValueAtTime(0, t + dur); }
    src.connect(bp).connect(g).connect(out); src.start(t, Math.random() * 1.5); src.stop(t + dur + .05);
    return g;
  }
  const swellEnv = (g, t, dur, vol, up = .4) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * up); g.gain.setValueAtTime(vol, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur); };

  // ---- beds --------------------------------------------------------------------------------
  // a bowed section: three detuned saws per note that each wander on their own, through a
  // swelling filter and a wooden body (a hump in the low mids, the fizz rolled off), a vibrato
  // that comes in only once the note is sounding, and a little rosin as the bows bite
  function strings(freqs, t, dur, vol) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), hs = ctx.createBiquadFilter(), g = ctx.createGain();
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = .4; lp.frequency.setValueAtTime(360, t); lp.frequency.linearRampToValueAtTime(M.tune.bright, t + dur * .45); lp.frequency.linearRampToValueAtTime(420, t + dur);
    body.type = 'peaking'; body.frequency.value = 290; body.Q.value = 1.1; body.gain.value = 5;
    hs.type = 'highshelf'; hs.frequency.value = 2600; hs.gain.value = -10;
    vib.frequency.value = 4.4 + Math.random() * .6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(6, t + dur * .5); vib.connect(vg);
    swellEnv(g, t, dur, vol * .7);
    for (const f of freqs) for (const det of [-8, 0, 7]) vg.connect(voice('sawtooth', f, det + (Math.random() - .5) * 4, t, t + dur, lp).detune);
    lp.connect(body).connect(hs).connect(g).connect(M.out); vib.start(t); vib.stop(t + dur + .1);
    breath(t, dur * .5, 2400, 1.2, vol * .5, M.out, dur * .3);
  }
  // voices: two saws per note through the formants of a soft "oo", with a singer's vibrato
  function choir(freqs, t, dur, vol) {
    const ctx = audio.ctx, mix = ctx.createGain(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(9, t + dur * .4); vib.connect(vg);
    for (const f of freqs) for (const det of [-10, 9]) vg.connect(voice('sawtooth', f, det, t, t + dur, mix, 6).detune);
    swellEnv(g, t, dur, vol * 2.4, .35);
    for (const [ff, q, gain] of [[330, 5, 1], [820, 7, .45], [2300, 9, .12]]) {
      const bp = ctx.createBiquadFilter(), fg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; fg.gain.value = gain;
      mix.connect(bp).connect(fg).connect(g);
    }
    g.connect(M.out); vib.start(t); vib.stop(t + dur + .1);
    breath(t, dur, 1600, .8, vol * .25, M.out, dur * .4);
  }
  // air: noise blown through narrow bands at the chord's notes and their octaves
  function air(freqs, t, dur, vol) {
    for (const f of freqs) for (const [m, v] of [[1, 1], [2, .4]]) {
      const g = breath(t, dur, f * m, 38, 0, M.out, 0, false);
      swellEnv(g, t, dur, vol * v * 3, .45);
    }
  }
  function bed(chord, t, dur, vol) {
    const T = M.tune, ch = (VOICE[T.voicing] || VOICE.close)(chord).map(hz);
    if (T.bed === 'strings') strings(ch, t, dur, vol);
    else if (T.bed === 'choir') choir(ch, t, dur, vol);
    else if (T.bed === 'air') air(ch, t, dur, vol);
    // a low cello under it now and then (the cello bed is only that)
    const cello = T.bed === 'cello' || (T.bed !== 'none' && Math.random() < T.cello);
    if (cello) strings([hz(chord[0]) / 2], t + (T.bed === 'cello' ? 0 : dur * .15), dur * (T.bed === 'cello' ? 1 : .85), vol * (T.bed === 'cello' ? 1.3 : .9));
    return cello;
  }

  // ---- leads -------------------------------------------------------------------------------
  // a felt piano: stretched partials (a real string's are a little sharp of whole multiples),
  // the low ones as two strings beating slowly, the high ones dying first, and the thump of felt
  function piano(f, t, vol) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(4200, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.min(1800, f * 3), t + 1.5);
    g.gain.value = vol; lp.connect(g).connect(M.out);
    for (let n = 1; n <= 6; n++) {
      const fn = f * n * Math.sqrt(1 + .0004 * n * n), a = 1 / Math.pow(n, 1.5), d = 5.5 / (1 + (n - 1) * .8);
      for (const det of n <= 2 ? [-1.6, 1.6] : [0]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = fn; o.detune.value = det + (Math.random() - .5) * 2;
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a * (n <= 2 ? .6 : 1), t + .006); og.gain.exponentialRampToValueAtTime(.0004, t + d);
        o.connect(og).connect(lp); o.start(t); o.stop(t + d + .05);
      }
    }
    breath(t, .06, Math.min(1400, f * 3), .9, vol * .35, M.out, .004);
  }
  // a plucked string (Karplus-Strong: a burst of noise ringing round a loop as long as one
  // period, softened a little each time round), worked out once per pitch and kept
  function pluckBuf(f) {
    const key = Math.round(f * 10); if (plucks.has(key)) return plucks.get(key);
    const ctx = audio.ctx, sr = ctx.sampleRate, n = Math.floor(sr * 3), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const p = sr / f, P = Math.floor(p), frac = p - P, loop = new Float32Array(P + 2);
    let lp = 0; for (let i = 0; i < loop.length; i++) { lp += ((Math.random() * 2 - 1) - lp) * .5; loop[i] = lp; }   // a soft, finger-like pluck
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const a = loop[idx], b = loop[(idx + 1) % loop.length], out = a * (1 - frac) + b * frac;
      d[i] = out; loop[idx] = (a + b) * .5 * .996; idx = (idx + 1) % loop.length;
    }
    let peak = 0; for (let i = 0; i < 2000; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak) for (let i = 0; i < n; i++) d[i] /= peak;
    if (plucks.size > 60) plucks.delete(plucks.keys().next().value);
    plucks.set(key, buf); return buf;
  }
  function pluck(f, t, vol) {
    const ctx = audio.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), body = ctx.createBiquadFilter();
    src.buffer = pluckBuf(f); src.playbackRate.value = 1 + (Math.random() - .5) * .002;
    body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 1; body.gain.value = 4;
    g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t + 2.2, .3);
    src.connect(body).connect(g).connect(M.out); src.start(t); src.stop(t + 3);
  }
  // a wooden flute: a breathy tone that scoops up into the note, a vibrato that comes late
  function flute(f, t, vol, dur = 1.6) {
    const ctx = audio.ctx, g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .12); g.gain.setValueAtTime(vol * .9, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
    vib.frequency.value = 5; vg.gain.setValueAtTime(0, t + .3); vg.gain.linearRampToValueAtTime(12, t + dur * .7); vib.connect(vg);
    for (const [m, v] of [[1, 1], [2, .18], [3, .05]]) {
      const og = ctx.createGain(); og.gain.value = v;
      const o = voice('sine', f * m, -25, t, t + dur, og, 3); o.detune.setValueAtTime(-25, t); o.detune.linearRampToValueAtTime(0, t + .1); vg.connect(o.detune);
      og.connect(g);
    }
    g.connect(M.out); vib.start(t); vib.stop(t + dur + .1);
    breath(t, dur, f * 1.02, 6, vol * .9, M.out, .08);
    breath(t, .12, 2800, 1, vol * .4, M.out, .01);
  }
  function lead(f, t, vol) {
    const L = M.tune.lead;
    if (L === 'pluck') pluck(f, t, vol); else if (L === 'flute') flute(f, t, vol * .8); else if (L === 'piano') piano(f, t, vol);
  }
  // a note the hawk held in tune on the string joins the music: the same note, an octave
  // down, plucked through the valley echo
  M.echo = lane => { if (M.on && ensure()) pluck(hz(LANE[lane]) / 2, audio.ctx.currentTime + .05, .05); };

  // Valley, after A Winged Victory for the Sullen: long chords that swell in and out of each
  // other, now and then a held rest, and a lead that plays a few slow notes, then falls silent
  // for a long while
  function valley(now, { night, storm, learned, species }, mode) {
    const T = M.tune, vol = T.bedVol * (1 - storm * .4), dark = night > .7;
    if (now > M.chordT - .5) {
      const t = Math.max(now, M.chordT), chords = CHORDS[mode];
      if (Math.random() < T.rest) { const r = 6 + Math.random() * 8; M.chordT = t + r; M.log(`the ${T.bed} rest for ${Math.round(r)} s`); }
      else if (T.bed !== 'none') {
        M.chord = (M.chord + 1 + (Math.random() < .3 ? 1 : 0)) % chords.length;
        const dur = T.chordLen + Math.random() * T.chordVar, cello = bed(chords[M.chord], t, dur, vol);
        M.chordT = t + dur * T.overlap;   // the next chord swells in as this one fades
        M.log(`a chord for ${Math.round(dur)} s${cello && T.bed !== 'cello' ? ', with a cello' : ''}`);
      } else M.chordT = t + 10;
    }
    if (now > M.next - .2) {
      const t = Math.max(now, M.next);
      if (M.phrase <= 0) {
        // a long quiet stretch, then a new phrase of a few notes
        M.phrase = T.phraseMin + Math.floor(Math.random() * (T.phraseMax - T.phraseMin + 1));
        const q = (dark ? T.quiet * 1.6 : T.quiet) + Math.random() * T.quietVar;
        M.next = t + q; M.log(`the ${T.lead} is quiet for ${Math.round(q)} s`); return;
      }
      M.phrase--; M.motifT--;
      if (M.motifT <= 0 && learned.size) {
        // a phrase from a learned song, played slow and low
        const ids = [...learned], sp = species[ids[(Math.random() * ids.length) | 0]];
        sp.notes.forEach((n, i) => lead(hz(LANE[n] + T.leadOct * 12) / 2, t + i * 1.1, T.leadVol * .9));
        M.motifT = 8 + Math.random() * 6; M.phrase = 0; M.next = t + sp.notes.length * 1.1 + 4; M.log(`the ${T.lead} plays the ${sp.name}'s song`); return;
      }
      const sc = SCALE[mode], base = (dark ? -12 : 0) + T.leadOct * 12;
      if (T.lead !== 'none' && Math.random() < .8 - storm * .4) { lead(hz(base + sc[(Math.random() * sc.length) | 0]), t, T.leadVol * (1 - storm * .5)); M.log(`a ${T.lead} note`); }
      M.next = t + T.noteGap + Math.random() * T.noteVar;
    }
  }
  // the lab's buttons: start the next chord, or the next phrase, now
  M.skip = what => { const now = audio.ctx?.currentTime ?? 0; if (what === 'chord') M.chordT = now; else { M.next = now; if (M.phrase <= 0) M.phrase = 3; } };
  // called every frame with the state of the world and the hawk
  M.update = (dt, w) => {
    if (!M.on || !ensure()) return;
    const now = audio.ctx.currentTime, mode = w.storm > .5 || w.night > .7 ? 'dark' : 'day';
    M.lp.frequency.setTargetAtTime(900 + 1100 * (1 - w.night) * (1 - w.storm * .6), now, 2);
    valley(now, w, mode);
  };
  return M;
}

// a room for the music: a few early reflections, then a long tail that darkens as it dies
function roomIR(ctx) {
  const n = Math.floor(ctx.sampleRate * 3.4), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) {
      const s = i / ctx.sampleRate, k = Math.min(1, s * 25);
      lp += (Math.random() * 2 - 1 - lp) * (.6 - .5 * Math.min(1, s / 2.8));
      d[i] = lp * k * Math.exp(-s * 1.9) * .5;
    }
    for (const at of [.019, .031, .043, .061]) d[Math.floor(at * ctx.sampleRate) + ch * 11] += .25;
  }
  return buf;
}
