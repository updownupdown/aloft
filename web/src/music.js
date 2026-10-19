// Generative music: a slow pad that drifts through a few chords, with sparse pentatonic
// notes on top. Day is bright and a little busier, night is low and sparse, storms go
// minor and quiet, and phrases from songs you have learned drift through now and then.
// It plays in the shared key (audio.key), so the songbirds and the hawk's voice sit inside it.
const ROOT = 220; // A3
const CHORDS = { day: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], dark: [[-3, 0, 4], [-7, -3, 0], [5, 8, 12], [-5, -2, 2]] };
const SCALE = { day: [0, 2, 4, 7, 9, 12, 14, 16], dark: [0, 3, 5, 7, 10, 12, 15] };
const LANE = [12, 14, 16, 19, 21]; // a learned song's staff lines, an octave above the root

export function createMusic(audio) {
  const M = { on: false, out: null, next: 0, chordT: 0, chord: 0, pads: [], motifT: 20 };
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
  function pad(freqs, t, dur, vol) {
    const ctx = audio.ctx;
    for (const f of freqs) for (const det of [-4, 4]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f / 2; o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(M.out); o.start(t); o.stop(t + dur + .1);
    }
  }
  function pluck(f, t, vol) {
    const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0008, t + 2.2);
    o.connect(g).connect(M.out); o.start(t); o.stop(t + 2.3);
  }
  // a note the hawk held in tune on the string joins the music: the same note, an octave
  // down, plucked through the valley echo
  M.echo = lane => { if (M.on && ensure()) pluck(hz(LANE[lane]) / 2, audio.ctx.currentTime + .05, .04); };
  // called every frame with the state of the world
  M.update = (dt, { night, storm, learned, species }) => {
    if (!M.on || !ensure()) return;
    const ctx = audio.ctx, now = ctx.currentTime, mode = storm > .5 || night > .7 ? 'dark' : 'day';
    M.lp.frequency.setTargetAtTime(700 + 900 * (1 - night) * (1 - storm * .6), now, 2);
    const vol = .028 * (1 - storm * .4);
    if (now > M.chordT - .5) {
      const chords = CHORDS[mode]; M.chord = (M.chord + 1 + (Math.random() < .3 ? 1 : 0)) % chords.length;
      const dur = 9 + Math.random() * 4; pad(chords[M.chord].map(hz), Math.max(now, M.chordT), dur + 2, vol);
      M.chordT = Math.max(now, M.chordT) + dur;
    }
    if (now > M.next - .2) {
      const t = Math.max(now, M.next);
      M.motifT -= 1;
      if (M.motifT <= 0 && learned.size) {
        // a phrase from a learned song, played slow
        const ids = [...learned], sp = species[ids[(Math.random() * ids.length) | 0]];
        sp.notes.forEach((n, i) => pluck(hz(LANE[n]) / (night > .7 ? 2 : 1), t + i * .45, .05));
        M.motifT = 14 + Math.random() * 10; M.next = t + sp.notes.length * .45 + 3; return;
      }
      const sc = SCALE[mode], base = night > .7 ? 0 : 12;
      if (Math.random() < .75 - storm * .3) pluck(hz(base + sc[(Math.random() * sc.length) | 0]), t, .045 * (1 - storm * .5));
      M.next = t + (night > .7 ? 2.4 : 1.3) + Math.random() * (night > .7 ? 3 : 1.8);
    }
  };
  return M;
}
