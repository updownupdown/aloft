// Generative music, in four styles that can be switched in Settings. All of them play in the
// shared key (audio.key), so the songbirds and the hawk's voice sit inside them, and all go
// through one soft filter and valley echo. Day is brighter, night lower and sparser, storms
// go minor and quiet.
//   valley: long bowed chords, a few slow piano notes between long silences, learned songs
//   loops:  tape loops of different lengths, one soft piano note each, drifting in and out of phase
//   harp:   a wind harp: overtones of one low string swell and fade, stronger the faster you fly
//   kalimba: a gentle plucked pattern whose pace follows your speed and whose tune climbs with you
export const MUSIC_MODES = [['valley', 'Valley'], ['loops', 'Tape loops'], ['harp', 'Wind harp'], ['kalimba', 'Kalimba']];
const ROOT = 220; // A3
const CHORDS = { day: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], dark: [[-3, 0, 4], [-7, -3, 0], [5, 8, 12], [-5, -2, 2]] };
const SCALE = { day: [0, 2, 4, 7, 9, 12, 14, 16], dark: [0, 3, 5, 7, 10, 12, 15] };
const LANE = [12, 14, 16, 19, 21]; // a learned song's staff lines, an octave above the root
// a pentatonic ladder for the kalimba and the loops (day major, night minor), several octaves deep
const ladder = mode => { const s = mode === 'day' ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10], out = []; for (let o = -12; o <= 24; o += 12) for (const n of s) out.push(n + o); return out; };
// the loops: [length in seconds, step on the ladder]; the lengths share no common beat
const LOOPS = [[17.8, 5], [20.1, 7], [23.3, 8], [25.9, 10], [29.7, 12], [31.9, 9], [37.1, 3]];
// kalimba rhythms over 16 steps: busier by day
const PATTERN = { day: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], dark: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0] };

export function createMusic(audio) {
  const M = { on: false, mode: 'valley', out: null, next: 0, chordT: 0, chord: 0, motifT: 6, phrase: 2, loops: [], harpT: 0, step: 0, stepT: 0, walk: 6 };
  const hz = st => ROOT * Math.pow(2, (st + audio.key) / 12);
  function ensure() {
    if (M.out || !audio.ctx) return !!M.out;
    const ctx = audio.ctx;
    M.out = ctx.createGain(); M.out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    // a soft echo makes the sparse notes feel like they are in a valley
    const dl = ctx.createDelay(1); dl.delayTime.value = .42; const fb = ctx.createGain(); fb.gain.value = .32;
    M.out.connect(lp); lp.connect(audio.master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(audio.master);
    M.out.gain.setTargetAtTime(M.on ? 1 : 0, ctx.currentTime, 1.5);
    M.lp = lp; M.next = ctx.currentTime + 1;
    return true;
  }
  M.setOn = on => { M.on = on; if (M.out) M.out.gain.setTargetAtTime(on ? 1 : 0, audio.ctx.currentTime, .8); };
  // a new style starts from silence: the old one's scheduled notes ring out and nothing more is queued
  M.setMode = mode => {
    if (mode === M.mode) return; M.mode = mode;
    const now = audio.ctx ? audio.ctx.currentTime : 0;
    M.loops = []; M.chordT = now; M.next = now + .5; M.phrase = 2; M.harpT = now + .5; M.stepT = now + .5;
  };
  // a bowed string section: two slightly detuned saws per note, softened, swelling in slowly
  // with a gentle vibrato, and fading as slowly
  function strings(freqs, t, dur, vol) {
    const ctx = audio.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(950, t + dur * .45); lp.frequency.linearRampToValueAtTime(420, t + dur); lp.Q.value = .3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .4); g.gain.setValueAtTime(vol, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
    l.frequency.value = 4.6; lg.gain.value = 5; l.connect(lg);
    for (const f of freqs) for (const det of [-6, 5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + (Math.random() - .5) * 3;
      lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + .1);
    }
    lp.connect(g).connect(M.out); l.start(t); l.stop(t + dur + .1);
  }
  function pluck(f, t, vol) {
    const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0008, t + 2.2);
    o.connect(g).connect(M.out); o.start(t); o.stop(t + 2.3);
  }
  // a felt-piano note: a round fundamental, a brighter second partial that fades first, a long tail
  function piano(f, t, vol) {
    const ctx = audio.ctx;
    for (const [m, v, d, type] of [[1, 1, 5, 'sine'], [2, .35, 1.6, 'sine'], [3, .08, .7, 'triangle']]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f * m; o.detune.value = (Math.random() - .5) * 6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + .008); g.gain.exponentialRampToValueAtTime(.0006, t + d);
      o.connect(g).connect(M.out); o.start(t); o.stop(t + d + .05);
    }
  }
  // a kalimba tine: a sine with the tine's high, inharmonic ring that dies almost at once
  function tine(f, t, vol) {
    const ctx = audio.ctx;
    for (const [m, v, d] of [[1, 1, 1.4], [5.4, .22, .12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + d);
      o.connect(g).connect(M.out); o.start(t); o.stop(t + d + .05);
    }
  }
  // a wind-harp partial: one overtone of the low string, swelling in and dying away slowly
  function swell(f, t, vol, dur) {
    const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; l.frequency.value = 4 + Math.random() * 2; lg.gain.value = f * .003;
    l.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(M.out); o.start(t); o.stop(t + dur + .1); l.start(t); l.stop(t + dur + .1);
  }
  // a note the hawk held in tune on the string joins the music: the same note, an octave
  // down, plucked through the valley echo
  M.echo = lane => { if (M.on && ensure()) pluck(hz(LANE[lane]) / 2, audio.ctx.currentTime + .05, .04); };

  // Valley, after A Winged Victory for the Sullen: long bowed chords that swell in and out of
  // each other, now and then a held rest, and a felt piano that plays a few slow notes, then
  // falls silent for a long while
  function valley(now, { night, storm, learned, species }, mode) {
    const vol = .02 * (1 - storm * .4), dark = night > .7;
    if (now > M.chordT - .5) {
      const t = Math.max(now, M.chordT), chords = CHORDS[mode];
      if (Math.random() < .2) M.chordT = t + 6 + Math.random() * 8;   // the strings rest
      else {
        M.chord = (M.chord + 1 + (Math.random() < .3 ? 1 : 0)) % chords.length;
        const dur = 16 + Math.random() * 10, ch = chords[M.chord].map(hz);
        strings(ch, t, dur, vol);
        if (Math.random() < .6) strings([ch[0] / 2], t + dur * .15, dur * .85, vol * .9);   // a low cello under it
        M.chordT = t + dur * .72;   // the next chord swells in as this one fades
      }
    }
    if (now > M.next - .2) {
      const t = Math.max(now, M.next);
      if (M.phrase <= 0) {
        // a long quiet stretch, then a new phrase of a few notes
        M.phrase = 2 + Math.floor(Math.random() * 3);
        M.next = t + (dark ? 30 : 18) + Math.random() * 28; return;
      }
      M.phrase--; M.motifT--;
      if (M.motifT <= 0 && learned.size) {
        // a phrase from a learned song, played slow and low
        const ids = [...learned], sp = species[ids[(Math.random() * ids.length) | 0]];
        sp.notes.forEach((n, i) => piano(hz(LANE[n]) / 2, t + i * 1.1, .035));
        M.motifT = 8 + Math.random() * 6; M.phrase = 0; M.next = t + sp.notes.length * 1.1 + 4; return;
      }
      const sc = SCALE[mode], base = dark ? -12 : 0;
      if (Math.random() < .8 - storm * .4) piano(hz(base + sc[(Math.random() * sc.length) | 0]), t, .04 * (1 - storm * .5));
      M.next = t + 3.5 + Math.random() * 4;
    }
  }
  function loops(now, { night, storm }, mode) {
    if (!M.loops.length) M.loops = LOOPS.map(([len, step], i) => ({ len, step, next: now + 1 + i * 2.3 + Math.random() * 3 }));
    const lad = ladder(mode), vol = .05 * (1 - storm * .4), down = night > .7 ? 5 : 0;
    for (const L of M.loops) {
      if (now < L.next - .2) continue;
      const t = Math.max(now, L.next);
      // at night the highest loops rest, so it thins out
      if (!(night > .7 && L.step > 9)) piano(hz(lad[Math.max(0, L.step - down)]), t, vol);
      L.next = t + L.len;
    }
  }
  function harp(now, { night, storm, speed = 0, wind = 0, height = 0 }) {
    if (now < M.harpT - .2) return;
    const t = Math.max(now, M.harpT);
    // the faster and higher the air, the more the string sings and the higher it reaches
    const drive = Math.min(1, speed / 200 * .7 + Math.abs(wind) / 40 * .3 + storm * .3), reach = 3 + Math.round(drive * 6 + Math.min(1, height / 600) * 3);
    const n = 2 + Math.floor(Math.random() ** 1.6 * (reach - 1)), dur = 4 + Math.random() * 4;
    swell(hz(-24) * n, t, (.022 + .03 * drive) / Math.sqrt(n) * (night > .7 ? .7 : 1), dur);
    if (Math.random() < .25) swell(hz(-24), t, .02, dur * 1.4);   // the string itself, now and then
    M.harpT = t + (1.6 - drive * .9) + Math.random() * 1.6;
  }
  function kalimba(now, { night, storm, speed = 0, height = 0 }, mode) {
    if (now < M.stepT - .1) return;
    const t = Math.max(now, M.stepT), s = Math.min(1, speed / 180), dark = night > .7 || storm > .5;
    const pat = PATTERN[dark ? 'dark' : 'day'], lad = ladder(mode);
    // the tune wanders a step or two at a time, pulled toward a height on the ladder that follows yours
    const home = 5 + Math.round(Math.min(1, height / 500) * 6);
    if (pat[M.step]) {
      M.walk += Math.round((Math.random() - .5) * 3) + Math.sign(home - M.walk) * (Math.random() < .3 ? 1 : 0);
      M.walk = Math.max(2, Math.min(lad.length - 1, M.walk));
      tine(hz(lad[M.walk]), t, .05 * (1 - storm * .4));
    }
    if (M.step % 8 === 0) tine(hz(lad[M.walk % 5]) / 2, t, .035);   // a low root under every half bar
    M.step = (M.step + 1) % 16;
    M.stepT = t + (dark ? .36 : .3) - .1 * s;
  }
  // called every frame with the state of the world and the hawk
  M.update = (dt, w) => {
    if (!M.on || !ensure()) return;
    const now = audio.ctx.currentTime, mode = w.storm > .5 || w.night > .7 ? 'dark' : 'day';
    M.lp.frequency.setTargetAtTime(700 + 900 * (1 - w.night) * (1 - w.storm * .6) + (M.mode === 'harp' ? 600 : 0), now, 2);
    if (M.mode === 'loops') loops(now, w, mode);
    else if (M.mode === 'harp') harp(now, w);
    else if (M.mode === 'kalimba') kalimba(now, w, mode);
    else valley(now, w, mode);
  };
  return M;
}
