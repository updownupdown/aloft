// Generative music: Valley, after A Winged Victory for the Sullen. It plays in the shared key
// (audio.key), so the songbirds and the hawk's voice sit inside it. Night is lower and sparser,
// storms go minor and quiet.
// What it is made of, taken from their records ("A Symphony Pathetique", "We Played Some Open
// Chords...", "A Minor Fifth Is Made of Phantoms"):
// - a low tonic drone that holds for minutes, under everything;
// - slow bowed chords that swell in and out of each other, voiced wide (the root low, the rest
//   close together in the middle, with 7ths, 9ths and seconds rubbing), wandering through the
//   key with a borrowed chord now and then;
// - a felted piano, soft and nearly pure: a low open fifth, then a single high note of the melody
//   a second later; or the chord rolled slowly upward; now and then a grace note before a melody
//   note. The melody steps along from note to note; nothing is played twice in a row;
// - a slow rise and fall over minutes; everything dark, wavering a little as on tape, in a warm
//   room (the piano drier and closer than the strings). Now and then the piano plays a phrase of
//   a song you learned, and a few moments of a flight get a soft answer (M.moment).
// The music lab (musiclab.html) tunes the numbers; what is kept there is saved under
// aloft.musicTune2 (new with this Valley, so a tune kept for the old one does not carry over)
// and the game plays it.
const ROOT = 220; // A3: semitones below are relative to it
const LANE = [12, 14, 16, 19, 21]; // a learned song's staff lines, an octave above the root

// the chords: bass (the cello's note) and the voicing above it, in semitones from A3, and where
// each may go next. Day is A major with its lydian and borrowed colours, dark is A minor.
const CHORDS = {
  day: [
    { name: 'A add9', bass: -12, up: [-5, 2, 4, 11], next: [1, 2, 4, 6, 7] },
    { name: 'F#m9', bass: -15, up: [-5, 0, 4, 11], next: [2, 5, 3] },
    { name: 'D maj9', bass: -19, up: [-3, 0, 4, 7], next: [0, 3, 6, 5] },
    { name: 'E sus4 add9', bass: -17, up: [-3, 0, 2, 7], next: [0, 1, 7] },
    { name: 'C#m7', bass: -20, up: [-5, -1, 2, 4], next: [2, 1, 5] },
    { name: 'Bm11', bass: -22, up: [-7, 0, 4, 7], next: [3, 0, 2] },
    { name: 'F maj7', bass: -16, up: [-5, 0, 3, 7], next: [7, 0, 2] },
    { name: 'G 6/9', bass: -14, up: [-5, 0, 2, 5], next: [0, 2] },
  ],
  dark: [
    { name: 'Am add9', bass: -12, up: [-5, 0, 2, 3], next: [1, 2, 3, 5] },
    { name: 'F maj7', bass: -16, up: [-5, 0, 3, 7], next: [0, 3, 4] },
    { name: 'Dm9', bass: -19, up: [-4, 0, 3, 7], next: [0, 4, 5] },
    { name: 'C maj7', bass: -21, up: [-5, -2, 2, 7], next: [1, 4, 0] },
    { name: 'Em7', bass: -17, up: [-2, 2, 5, 7], next: [0, 1] },
    { name: 'G sus2', bass: -14, up: [-7, -2, 0, 5], next: [0, 3] },
  ],
};

// Valley's tuning: every number the music lab can change
export const VALLEY_TUNE = {
  chordLen: 20, chordVar: 10, overlap: .75, rest: .08, strings: .014, cello: .75, drone: .6, violins: .7, bright: 1150,
  piano: .04, gesture: 5, pair: 1.15, roll: .55, grace: .15, run: 6, quiet: 18, arc: 300, room: .45, pianoRoom: .16,
};
export function loadTune() {
  try { return { ...VALLEY_TUNE, ...JSON.parse(localStorage.getItem('aloft.musicTune2') || '{}') }; } catch { return { ...VALLEY_TUNE }; }
}

export function createMusic(audio) {
  const M = { tune: loadTune(), on: false, out: null, next: 0, chordT: 0, droneT: 0, chord: 0, motifT: 4, left: 0, resting: false, mel: 19, t0: 0, momentT: -1e9 };
  const hz = st => ROOT * Math.pow(2, (st + audio.key) / 12);
  let noise = null, pianoBus = null;
  function ensure() {
    if (M.out || !audio.ctx) return !!M.out;
    const ctx = audio.ctx, T = M.tune;
    M.out = ctx.createGain(); M.out.gain.value = 0;
    // tape: a delay that wavers a fraction of a millisecond, so the whole mix sways a little in pitch
    const wow = ctx.createDelay(.05), wl = ctx.createOscillator(), wg = ctx.createGain();
    wow.delayTime.value = .012; wl.frequency.value = .37; wg.gain.value = .0006; wl.connect(wg).connect(wow.delayTime); wl.start();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = .3;
    const rv = ctx.createConvolver(); rv.buffer = roomIR(ctx);
    M.wet = ctx.createGain(); M.wet.gain.value = T.room;
    M.out.connect(wow).connect(lp); lp.connect(audio.musicBus || audio.master);
    // the strings (M.out) fill the room; the piano sits closer, with less of it
    lp.connect(M.wet); M.wet.connect(rv); rv.connect(audio.musicBus || audio.master);
    pianoBus = ctx.createGain(); M.pwet = ctx.createGain(); M.pwet.gain.value = T.pianoRoom;
    const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 2400; plp.Q.value = .2;
    pianoBus.connect(plp); plp.connect(audio.musicBus || audio.master); plp.connect(M.pwet); M.pwet.connect(rv);
    M.pgain = pianoBus;
    pianoBus.gain.value = 0;
    M.out.gain.setTargetAtTime(M.on ? 1 : 0, ctx.currentTime, 1.5); pianoBus.gain.setTargetAtTime(M.on ? 1 : 0, ctx.currentTime, 1.5);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    M.lp = lp; M.next = ctx.currentTime + 6; M.chordT = ctx.currentTime + .5; M.droneT = ctx.currentTime; M.t0 = ctx.currentTime;
    return true;
  }
  M.setTune = o => {
    Object.assign(M.tune, o);
    if (M.wet) { const t = audio.ctx.currentTime; M.wet.gain.setTargetAtTime(M.tune.room, t, .3); M.pwet.gain.setTargetAtTime(M.tune.pianoRoom, t, .3); }
  };
  M.log = () => {};   // the lab listens here: what Valley just played
  M.setOn = on => {
    M.on = on;
    if (M.out) for (const g of [M.out, M.pgain]) g.gain.setTargetAtTime(on && !M.menu ? 1 : 0, audio.ctx.currentTime, .8);
  };
  M.hush = 0;          // 0..1: the hush after snow, an eclipse (set from the moments system): softer
  // with the menu open the music fades away slowly (about fifteen seconds), and comes back more
  // quickly when it closes
  M.hold = on => {
    if (!!on === !!M.menu) return;
    M.menu = !!on;
    if (M.out && M.on) for (const g of [M.out, M.pgain]) g.gain.setTargetAtTime(M.menu ? 0 : 1, audio.ctx.currentTime, M.menu ? 5 : 1.5);
  };
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
  // vibrato that comes in only once the note is sounding and a breath of rosin as the bows bite.
  // Each note swells on its own a moment apart, so a chord blooms rather than switches on.
  function strings(freqs, t, dur, vol, bright) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), hs = ctx.createBiquadFilter();
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = .4; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(bright, t + dur * .45); lp.frequency.linearRampToValueAtTime(360, t + dur);
    body.type = 'peaking'; body.frequency.value = 260; body.Q.value = 1; body.gain.value = 5;
    hs.type = 'highshelf'; hs.frequency.value = 2400; hs.gain.value = -8;
    vib.frequency.value = 4.4 + Math.random() * .6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(4, t + dur * .5); vib.connect(vg);
    freqs.forEach((f, i) => {
      const g = ctx.createGain(), s = t + i * dur * .04 * Math.random(), v = vol;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(v * .7, s + dur * .4); g.gain.setValueAtTime(v * .7, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
      for (const det of [-8, 0, 7]) vg.connect(voice(f, det + (Math.random() - .5) * 4, s, t + dur, g).detune);
      g.connect(lp);
    });
    lp.connect(body).connect(hs).connect(M.out); vib.start(t); vib.stop(t + dur + .1);
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = noise; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = .8;
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vol * .12, t + dur * .3); ng.gain.linearRampToValueAtTime(0, t + dur * .55);
    src.connect(bp).connect(ng).connect(M.out); src.start(t, Math.random()); src.stop(t + dur * .55 + .05);
  }
  // the drone: the home note low down (and its octave), a soft bowed hum that holds for minutes
  function drone(f, t, dur, vol) {
    const ctx = audio.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = .3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(14, dur * .25)); g.gain.setValueAtTime(vol, t + dur * .75); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const [m, det, v] of [[1, -5, .5], [1, 4, .5], [2, 0, .35]]) voice(f * m, det, t, t + dur, (() => { const og = ctx.createGain(); og.gain.value = v; og.connect(lp); return og; })(), 3);
    lp.connect(g).connect(M.out);
    // and an octave below it, felt more than heard (on headphones)
    const sub = ctx.createOscillator(), sg = ctx.createGain(); sub.frequency.value = f / 2; sg.gain.value = .45;
    sub.connect(sg).connect(g); sub.start(t); sub.stop(t + dur + .1);
  }

  // ---- the piano -----------------------------------------------------------------------------
  // a felted upright, soft and warm as on their records: nearly a pure tone (the octave 20-30 dB
  // under the fundamental on high notes, a little more of it low down), partials a touch sharp as
  // on a real string, the lower ones three strings a cent apart that beat slowly; a soft felt
  // attack, a quick first fall then a quiet ring that dies within a few seconds; the hammer's
  // thump, muffled. `v` 0..1 is how hard it is played: harder is louder and a shade brighter.
  // `light`: one string per partial (no slow beating), for the soft echoes of your own notes,
  // which can come several a second and would otherwise swamp a phone's audio thread.
  function piano(f, t, vol, v = .5, light = false) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    const oct = Math.log2(f / 220);                                       // 0 at A3
    const ring = Math.max(1.2, 2.4 - oct * .6);                           // the aftersound's time constant
    const tone = Math.min(.32, Math.max(.06, .16 - oct * .07)) * (.7 + .6 * v); // how much octave
    lp.type = 'lowpass'; lp.Q.value = .1;
    lp.frequency.setValueAtTime(Math.min(2200, f * (2 + 2 * v)), t); lp.frequency.setTargetAtTime(Math.min(1200, f * 1.4), t + .03, .35);
    g.gain.value = vol * (.35 + .8 * v); lp.connect(g).connect(pianoBus);
    for (const [n, a] of [[1, 1], [2, tone], [3, tone * tone * 1.5], [4, tone * tone * tone * 2]]) {
      if (light && n > 3) break;
      const fn = f * n * Math.sqrt(1 + .0003 * n * n), d = ring / (1 + (n - 1) * .8), dets = n <= 2 && !light ? [-.8, 0, .7] : [0];
      for (const det of dets) {
        const o = ctx.createOscillator(), og = ctx.createGain(), k = a / dets.length;
        o.frequency.value = fn; o.detune.value = det + (Math.random() - .5) * .5;
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(k, t + .014 + .01 * (1 - v));
        og.gain.setTargetAtTime(k * .32, t + .02, .1);             // the prompt sound falls away
        og.gain.setTargetAtTime(0, t + .3, d);                      // then a quiet, short ring
        o.connect(og).connect(lp); o.start(t); o.stop(t + .3 + d * 4.5);
      }
    }
    // the hammer's felt: a soft, dark thump under the pitch
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = noise; bp.type = 'lowpass'; bp.frequency.value = Math.min(500, f * 1.2);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vol * .12 * v, t + .006); ng.gain.setTargetAtTime(0, t + .008, .02);
    src.connect(bp).connect(ng).connect(pianoBus); src.start(t, Math.random()); src.stop(t + .15);
  }
  // a note the hawk held in tune on the string joins the music: the same note, an octave down,
  // touched softly on the piano
  // (at most one every 0.3 s, so a quick run of notes does not crowd the audio thread)
  let echoT = -1;
  M.echo = lane => {
    if (!M.on || !ensure()) return;
    const now = audio.ctx.currentTime; if (now - echoT < .3) return; echoT = now;
    piano(hz(LANE[lane]) / 2, now + .05, M.tune.piano * .7, .3, true);
  };

  // ---- what the piano plays ------------------------------------------------------------------
  // the melody: high up (B4 to C#6), stepping from where it was to a note of the chord or one of
  // its colours, never the same note twice running
  function melodyNote(ch) {
    const pool = [];
    for (const n of [...ch.up, ch.bass]) for (let k = n; k <= 28; k += 12) if (k >= 14) pool.push(k);
    const opts = [...new Set(pool)].filter(n => n !== M.mel && Math.abs(n - M.mel) <= 5);
    const pick = opts.length ? opts[(Math.random() * opts.length) | 0] : pool[(Math.random() * pool.length) | 0];
    M.mel = pick;
    return pick;
  }
  // one gesture of the piano, chosen to suit the moment; returns how long it takes
  function gesture(t, ch, vol, arc, dark) {
    const T = M.tune, b = ch.bass + 12, r = Math.random();
    if (r < .55) {
      // the low open fifth, then a melody note a second later (sometimes a grace note into it)
      const v = .3 + arc * .25;
      piano(hz(b), t, vol * .9, v); piano(hz(b + 7), t + .02, vol * .75, v * .9);
      const m = melodyNote(ch) - (dark ? 12 : 0), at = t + T.pair * (.94 + Math.random() * .12);
      if (Math.random() < T.grace) piano(hz(m + (Math.random() < .5 ? 2 : -1)), at - .11, vol * .45, v * .7);
      piano(hz(m), at, vol, v + .1);
      M.log(`the piano: a low fifth, then a high note`);
      return T.pair + .5;
    }
    if (r < .85) {
      // the chord rolled slowly upward, ending on a melody note
      const notes = [b, ...ch.up.filter(n => n > b).slice(0, 2 + ((Math.random() * 2) | 0)), melodyNote(ch) - (dark ? 12 : 0)];
      notes.forEach((n, i) => piano(hz(n), t + i * T.roll * (1 + (Math.random() - .5) * .1), vol * (.75 + i * .06), .28 + arc * .2 + i * .03));
      M.log(`the piano rolls the chord up`);
      return notes.length * T.roll + .5;
    }
    // just the melody, two notes stepping on (never the same one)
    const a = melodyNote(ch), c = melodyNote(ch);
    piano(hz(a - (dark ? 12 : 0)), t, vol * .9, .38 + arc * .2); piano(hz(c - (dark ? 12 : 0)), t + T.pair * 1.3, vol * .8, .34 + arc * .2);
    M.log(`the piano: two notes of the melody`);
    return T.pair * 1.3 + .5;
  }

  function valley(now, { night, storm, learned, species }, mode) {
    const T = M.tune, dark = night > .7, set = CHORDS[mode];
    // the slow rise and fall: louder, brighter and busier at the top of each arc
    const arc = .5 - .5 * Math.cos((now - M.t0) / T.arc * Math.PI * 2), quiet = (1 - storm * .4) * (1 - M.hush * .6);
    if (now > M.droneT - .5 && Math.random() < T.drone) {
      const dur = 90 + Math.random() * 60;
      drone(hz(-24), Math.max(now, M.droneT), dur, T.strings * 1.6 * quiet);
      M.droneT = Math.max(now, M.droneT) + dur * .8; M.log(`a drone on the home note for ${Math.round(dur)} s`);
    } else if (now > M.droneT - .5) M.droneT = now + 30;
    if (now > M.chordT - .5) {
      const t = Math.max(now, M.chordT);
      if (M.chord >= set.length) M.chord = 0;
      if (Math.random() < T.rest) { const r = 6 + Math.random() * 8; M.chordT = t + r; M.log(`the strings rest for ${Math.round(r)} s`); }
      else {
        const nx = set[M.chord].next; M.chord = nx[(Math.random() * nx.length) | 0];
        const ch = set[M.chord], dur = T.chordLen + Math.random() * T.chordVar, vol = T.strings * quiet * (.7 + .6 * arc);
        strings(ch.up.map(hz), t, dur, vol, T.bright + arc * 400 - night * 250);
        // high violins: the top of the chord an octave up, thin and quiet, as the arc climbs
        if (arc > .45 && Math.random() < T.violins) strings([hz(ch.up[ch.up.length - 1] + 12), hz(ch.up[ch.up.length - 2] + 12)], t + dur * .15, dur * .8, vol * .35, T.bright * 1.6);
        const cello = Math.random() < T.cello;
        if (cello) strings([hz(ch.bass)], t + dur * .08, dur * .92, vol * .9, T.bright * .65);
        M.chordT = t + dur * T.overlap;   // the next chord swells in as this one fades
        M.log(`${ch.name} for ${Math.round(dur)} s${cello ? ', a cello under it' : ''}`);
      }
    }
    if (now > M.next - .2) {
      const t = Math.max(now, M.next), vol = T.piano * quiet * (.8 + .4 * arc), ch = set[Math.min(M.chord, set.length - 1)];
      if (M.left <= 0) {
        // a rest, then a new run (longer rests at night and in the low of the arc)
        if (!M.resting) {
          const q = T.quiet * (dark ? 1.6 : 1) * (1.3 - arc * .6) * (.6 + Math.random() * .8);
          M.resting = true; M.next = t + q; M.log(`the piano rests for ${Math.round(q)} s`); return;
        }
        M.resting = false; M.left = Math.round(T.run * (.6 + Math.random() * .8) * (.7 + arc * .6));
      }
      M.motifT--;
      if (M.motifT <= 0 && learned.size) {
        // a phrase from a learned song, slow and soft, in the melody's register
        const ids = [...learned], sp = species[ids[(Math.random() * ids.length) | 0]];
        sp.notes.forEach((n, i) => piano(hz(LANE[n] - (dark ? 12 : 0)), t + i * T.roll * 1.3, vol * .85, .32 + (i === 0 ? .08 : 0)));
        M.motifT = 14 + Math.random() * 10; M.left = 0;
        M.next = t + sp.notes.length * T.roll * 1.3 + T.gesture; M.log(`the piano plays the ${sp.name}'s song`); return;
      }
      const len = gesture(t, ch, vol, arc, dark);
      M.left--;
      M.next = t + Math.max(len + 1.5, T.gesture * (.8 + Math.random() * .5)) * (dark ? 1.25 : 1);
    }
  }
  // a moment of the flight answered: a soft rolled chord rising into a high note, at most every
  // couple of minutes and not every time (first light, out of a thermal, a high perch, a long glide)
  M.moment = (what, chance = .6) => {
    if (!M.on || !ensure()) return false;
    const now = audio.ctx.currentTime;
    if (now - M.momentT < 120 || Math.random() > chance) return false;
    M.momentT = now;
    const ch = CHORDS.day[M.chord] || CHORDS.day[0], vol = M.tune.piano * .9, t = now + .3;
    const notes = [ch.bass + 24, ...ch.up.map(n => n + 12).filter(n => n > ch.bass + 24).slice(0, 2)];
    notes.forEach((n, i) => piano(hz(n), t + i * .42, vol * (.7 + i * .08), .3 + i * .04));
    piano(hz(melodyNote(ch)), t + notes.length * .42 + .25, vol, .42);
    M.next = Math.max(M.next, t + notes.length * .42 + 4);
    M.log(`the piano answers: ${what}`);
    return true;
  };
  // the lab's buttons: start the next chord, or the piano, now
  M.skip = what => { const now = audio.ctx?.currentTime ?? 0; if (what === 'chord') M.chordT = now; else { M.next = now; M.resting = false; if (M.left <= 0) M.left = 1; } };
  // called every frame with the state of the world and the hawk
  M.update = (dt, w) => {
    if (!M.on || !ensure()) return;
    const now = audio.ctx.currentTime, mode = w.storm > .5 ? 'dark' : 'day';
    M.lp.frequency.setTargetAtTime(1500 + 2000 * (1 - w.night * .7) * (1 - w.storm * .6), now, 2);
    valley(now, w, mode);
  };
  return M;
}

// a warm room: soft early reflections, then a long tail (about five seconds) that darkens as it dies
function roomIR(ctx) {
  const n = Math.floor(ctx.sampleRate * 5.5), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const s = i / ctx.sampleRate, k = Math.min(1, s * 12);
      lp += (Math.random() * 2 - 1 - lp) * (.3 - .26 * Math.min(1, s / 3)); lp2 += (lp - lp2) * .5;
      d[i] = lp2 * k * Math.exp(-s * 1.2) * .6;
    }
  }
  return buf;
}
