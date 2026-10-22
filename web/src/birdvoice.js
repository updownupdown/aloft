// Songbird voices. Every call is built from a species template of short elements (whistles,
// sweeps, trill notes), each a pitch contour with a fast swell, rendered by one of several
// engines and placed in a space. A saved pick under aloft.birdVoice (from the old bird song lab)
// is still read; otherwise the game sings in DEFAULT_VOICE.
//   whistle: the first voices, long smooth sine glides (kept to compare against)
//   natural: fast frequency sweeps with a little overtone, the way small birds actually sing
//   syrinx:  natural, plus the second side of the syrinx singing its own quieter line
//   breathy: the contour carried by a narrow band of air noise, like a far, soft recording
export const ENGINES = [['whistle', 'Whistle (as before)'], ['natural', 'Natural'], ['syrinx', 'Two-voice syrinx'], ['breathy', 'Breathy']];
export const PITCHES = [[1, 'As before'], [2, 'An octave up'], [4, 'Two octaves up']];
export const SPACES = [['dry', 'Dry'], ['valley', 'Valley echo'], ['forest', 'Forest']];
export const DEFAULT_VOICE = { engine: 'natural', octave: 2, space: 'forest', far: false };
const KEY = 'aloft.birdVoice';
export function loadVoice() { try { return { ...DEFAULT_VOICE, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_VOICE }; } }
export function saveVoice(v) { try { localStorage.setItem(KEY, JSON.stringify({ engine: v.engine, octave: v.octave, space: v.space, far: v.far })); } catch { /* private mode */ } }

// The elements of one song note per voice (0 chickadee, 1 robin, 2 warbler, 3 wren, 4 thrush,
// 5 finch, 6 owl, 7 lark, 8 cardinal, 9 meadowlark, 10 red-winged blackbird, 11 mourning dove,
// 12 blue jay, 13 song sparrow, 14 white-throated sparrow, 15 veery): when it starts, how long,
// and its pitch path as [0..1, multiple]. Flags: soft (a muffled low voice), harsh (a rasp of
// overtones), pure (a clean whistle, no overtones), dual (a second voice that far above).
// Most sing in the chosen register; the owl and the dove keep their own, low ones.
const NV = 24;   // voices, one per species
// notes start this far ahead of now, so their attack is never already past when the audio thread
// gets to it (on a phone a late start cut the attack: a click)
const LEAD = .02;
const REG = { 6: .25, 11: .5, 18: .5, 23: .3 };
function template(voice, rnd) {
  const rep = (n, gap, dur, c, o = {}) => Array.from({ length: n }, (_, i) => ({ at: i * gap, dur, c: typeof c === 'function' ? c(i) : c, v: 1 - i * (o.fade || 0), ...o }));
  switch (voice % NV) {
    case 0: return [{ at: 0, dur: .26, c: [[0, 1.02], [.15, 1], [1, .97]], atk: .02 }];
    case 1: return [{ at: 0, dur: .11, c: [[0, .82], [.45, 1.12], [1, .94]] }, { at: .13, dur: .05, c: [[0, 1.05], [1, .9]], v: .5 }];
    case 2: return rep(4, .04, .028, [[0, 1.18], [1, .88]], { fade: .08 });
    case 3: return rep(4, .04, .028, i => i % 2 ? [[0, 1.12], [1, .88]] : [[0, .9], [1, 1.12]]);
    case 4: return [{ at: 0, dur: .025, c: [[0, .85], [1, 1]], v: .5 }, { at: .022, dur: .3, c: [[0, 1], [1, 1.01]], vib: .012, vibF: 6, atk: .02 }];
    case 5: return rep(3, .06, .045, [[0, 1.22], [1, .86]], { am: .5, amF: 85 });
    case 6: return [{ at: 0, dur: .38, c: [[0, 1.03], [.3, 1], [1, .95]], atk: .06, soft: true }];
    case 7: return rep(4, .03, .024, () => [[0, 1 + (rnd() - .5) * .3], [1, 1 + (rnd() - .5) * .3]]);
    // a cardinal's loud slurred "cheer", sweeping down
    case 8: return [{ at: 0, dur: .2, c: [[0, 1.28], [.6, .92], [1, .84]], atk: .01, pure: true }];
    // a meadowlark's flute: a rounded note that lifts a little, then falls away
    case 9: return [{ at: 0, dur: .2, c: [[0, .97], [.3, 1.03], [1, .9]], atk: .015, vib: .006, vibF: 11 }];
    // a red-winged blackbird's "konk-la-ree": a hard chuck, then a buzzing trill
    case 10: return [{ at: 0, dur: .05, c: [[0, .9], [1, 1.05]], harsh: true, v: .8 }, { at: .055, dur: .13, c: [[0, 1.02], [1, 1.04]], am: .85, amF: 48, harsh: true }];
    // a mourning dove's soft coo, swelling and sinking
    case 11: return [{ at: 0, dur: .42, c: [[0, .94], [.3, 1.03], [1, .9]], atk: .09, soft: true }];
    // a blue jay's harsh "jay": a falling rasp
    case 12: return [{ at: 0, dur: .19, c: [[0, 1.12], [.4, 1.02], [1, .8]], atk: .01, harsh: true, am: .5, amF: 92 }];
    // a song sparrow's crisp chips with a little buzz behind
    case 13: return [...rep(2, .045, .03, [[0, 1.16], [1, .94]]), { at: .09, dur: .06, c: [[0, 1], [1, .97]], am: .7, amF: 70, v: .6 }];
    // a white-throated sparrow's pure, held whistle ("old Sam Peabody")
    case 14: return [{ at: 0, dur: .34, c: [[0, 1], [1, .995]], atk: .04, pure: true }];
    // a cactus wren's harsh low "char"
    case 16: return [{ at: 0, dur: .09, c: [[0, 1], [1, .94]], atk: .006, harsh: true, am: .6, amF: 62 }];
    // a canyon wren's sweet whistle, each one sliding down
    case 17: return [{ at: 0, dur: .1, c: [[0, 1.1], [1, .9]], atk: .01, pure: true }];
    // a ptarmigan's dry croak: a low rattle
    case 18: return rep(3, .05, .045, [[0, 1], [1, .9]], { harsh: true, am: .7, amF: 40 });
    // a dipper's bright bubbling note
    case 19: return rep(3, .035, .03, i => [[0, 1.1 - i * .03], [1, .96]]);
    // a bellbird's struck bell: a pure ring with a bell's high partial, dying away slowly
    case 20: return [{ at: 0, dur: .7, c: [[0, 1], [1, .995]], atk: .003, pure: true, dual: 2.76 }];
    // a nightingale's full whistle, swelling, with a fast shiver
    case 21: return [{ at: 0, dur: .22, c: [[0, .95], [.5, 1.05], [1, 1]], atk: .05, vib: .01, vibF: 30 }];
    // a whip-poor-will's quick slurred whistle
    case 22: return [{ at: 0, dur: .16, c: [[0, .9], [.4, 1.15], [1, 1.05]], atk: .01, pure: true }];
    // a tawny owl's hoot, low and wavering
    case 23: return [{ at: 0, dur: .5, c: [[0, 1], [.2, 1.02], [1, .97]], atk: .05, soft: true, vib: .02, vibF: 18 }];
    // a veery's breezy downward spiral, two voices at once
    case 15:
    default: return rep(3, .055, .07, i => [[0, 1.06 - i * .03], [1, .96 - i * .03]], { dual: 1.19, fade: .2 });
  }
}

export function createBirdVoice(ctx, dest, noiseBuf) {
  const V = { ...DEFAULT_VOICE };
  // the spaces: a dry path, a short valley echo, and a forest of soft reflections
  const input = ctx.createGain(), dry = ctx.createGain(), farLp = ctx.createBiquadFilter();
  farLp.type = 'lowpass'; farLp.frequency.value = 20000;
  input.connect(farLp); farLp.connect(dry); dry.connect(dest);
  const echo = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), elp = ctx.createBiquadFilter();
  dl.delayTime.value = .19; fb.gain.value = .26; elp.type = 'lowpass'; elp.frequency.value = 3600;
  farLp.connect(echo); echo.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(dest);
  const forest = ctx.createGain(), conv = ctx.createConvolver();
  conv.buffer = forestIR(ctx); farLp.connect(forest); forest.connect(conv); conv.connect(dest);
  // a rock-walled place (a canyon, a fjord, under sea cliffs): a long echo off the far wall,
  // coming back two or three times, duller each time. `place` 0..1 fades it in.
  const wall = ctx.createGain(), wdl = ctx.createDelay(1.5), wfb = ctx.createGain(), wlp = ctx.createBiquadFilter();
  wall.gain.value = 0; wdl.delayTime.value = .42; wfb.gain.value = .42; wlp.type = 'lowpass'; wlp.frequency.value = 2400;
  farLp.connect(wall); wall.connect(wdl); wdl.connect(wlp); wlp.connect(wfb); wfb.connect(wdl); wlp.connect(dest);
  const wallRev = ctx.createGain(); wallRev.gain.value = 0; farLp.connect(wallRev); wallRev.connect(conv);
  V.place = k => { const t = ctx.currentTime; wall.gain.setTargetAtTime(.55 * k, t, .3); wallRev.gain.setTargetAtTime(.45 * k, t, .3); };
  V.set = o => {
    Object.assign(V, o);
    const t = ctx.currentTime, far = V.far ? 1 : 0;
    echo.gain.setTargetAtTime(V.space === 'valley' ? .35 + far * .2 : 0, t, .02);
    forest.gain.setTargetAtTime(V.space === 'forest' ? .5 + far * .4 : 0, t, .02);
    dry.gain.setTargetAtTime(far ? .45 : 1, t, .02);
    farLp.frequency.setTargetAtTime(far ? 2600 : 20000, t, .02);
  };
  V.set({});

  // one element: a contour over `dur`, in the chosen engine
  function element(t, e, f, vol) {
    const env = ctx.createGain(), atk = e.atk ?? Math.min(.006, e.dur * .2), end = t + e.dur;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + atk); env.gain.exponentialRampToValueAtTime(.0004, end);
    let out = env;
    if (e.am) {
      const am = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      am.gain.value = 1 - e.am / 2; l.frequency.value = e.amF; lg.gain.value = e.am / 2;
      l.connect(lg).connect(am.gain); am.connect(env); l.start(t); l.stop(end + .02); out = am;
    }
    if (e.soft) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; env.connect(lp).connect(input); } else env.connect(input);
    const glide = (param, m) => { param.setValueAtTime(f * e.c[0][1] * m, t); for (let i = 1; i < e.c.length; i++) param.exponentialRampToValueAtTime(f * e.c[i][1] * m, t + e.dur * e.c[i][0]); };
    const tone = (m, g, type = 'sine') => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; og.gain.value = g; glide(o.frequency, m);
      if (e.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = e.vibF; lg.gain.value = f * e.vib * m; l.connect(lg).connect(o.frequency); l.start(t); l.stop(end + .02); }
      o.connect(og).connect(out); o.start(t); o.stop(end + .02);
    };
    if (V.engine === 'breathy') {
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      src.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = 28; ng.gain.value = 4.5; glide(bp.frequency, 1);
      src.connect(bp).connect(ng).connect(out); src.start(t, Math.random()); src.stop(end + .02);
      tone(1, .3);
      return;
    }
    if (e.pure) tone(1, 1.1);
    else if (e.harsh) { tone(1, .8); tone(2, .45); tone(3, .3); tone(4, .15); }
    else { tone(1, 1); tone(2, e.soft ? .22 : .1); }   // (a third partial at 2.5% was inaudible, and a third more oscillators)
    if (e.dual) tone(e.dual, .45);
    // the other side of the syrinx: a quieter line a fifth (thrush) or a third above, drifting a little
    if (V.engine === 'syrinx') tone(e.vib ? 1.5 : 1.26 + (Math.random() - .5) * .02, .32);
  }
  // the first, slower whistle voices, kept for comparison
  function whistle(t, f, voice, vol) {
    const syll = (path, dur, o = {}) => element(t + (o.at || 0), { at: 0, dur, c: path.map((m, i) => [i / (path.length - 1), m]), atk: o.atk ?? .015, vib: o.vib, vibF: o.vibF, am: o.trill, amF: o.trillF }, f, vol);
    switch (voice % 8) {
      case 0: return syll([1.03, 1, .985], .34, { atk: .03 });
      case 1: return syll([.86, 1.07, .98], .22, { vib: .01, vibF: 9 });
      case 2: return syll([.93, 1.05], .25, { trill: .9, trillF: 36 });
      case 3: for (let k = 0; k < 3; k++) syll([1.1, .93], .05, { at: k * .055, atk: .005 }); return;
      case 4: return syll([.97, 1, 1.005], .4, { vib: .012, vibF: 5.5, atk: .04 });
      case 5: return syll([1.12, .92], .16, { trill: .55, trillF: 72 });
      case 6: return syll([1.03 / 4, 1 / 4, .96 / 4], .5, { atk: .09 });
      default: return syll([.9, 1.1, .95, 1.06], .21, { vib: .035, vibF: 21 });
    }
  }
  // one syllable of a kind (u sliding up, d sliding down, r a steady whistle, l a trill or buzz,
  // c a chip) in a species' voice. Where the species' own note already has that shape (OWN), it
  // sings that; the rest share shapes, coloured by the voice's register and roughness.
  const OWN = { r: new Set([0, 4, 6, 9, 11, 14, 20, 21, 23]), d: new Set([8, 12, 17]), u: new Set([22]) }, ROUGH = new Set([10, 12, 16, 18]);
  function kindTemplate(kind, voice) {
    const rough = ROUGH.has(voice % NV), soft = !!REG[voice % NV], tone = { pure: !rough, harsh: rough, soft };
    switch (kind) {
      case 'c': return [{ at: 0, dur: .05, c: [[0, 1.25], [1, .86]], atk: .004, harsh: rough }];
      case 'u': return [{ at: 0, dur: .2, c: [[0, .84], [.7, 1.1], [1, 1.14]], atk: .015, ...tone }];
      case 'd': return [{ at: 0, dur: .2, c: [[0, 1.18], [.3, 1.12], [1, .86]], atk: .01, ...tone }];
      case 'l': return rough
        ? [{ at: 0, dur: .24, c: [[0, 1.04], [.5, 1], [1, .96]], atk: .01, am: .9, amF: 88, harsh: true, soft }]
        : Array.from({ length: 6 }, (_, i) => ({ at: i * .045, dur: .032, c: i % 2 ? [[0, 1.1], [1, .92]] : [[0, .94], [1, 1.08]], v: 1 - i * .06, soft }));
      default: return [{ at: 0, dur: .24, c: [[0, .99], [.3, 1.01], [1, .99]], atk: .02, ...tone }];
    }
  }
  // one song note at pitch f (the game's pitch for that note), in a species' voice; `kind` picks
  // a syllable shape (left out: the species' own note, as the bird song lab plays it)
  V.sing = (f, voice = 0, vol = .16, kind = null) => {
    if (kind && !OWN[kind]?.has(voice % NV)) {
      const t = ctx.currentTime + LEAD, prev = V.engine, reg = REG[voice % NV], pitch = (reg ? f * reg : f * V.octave) * (1 + (Math.random() - .5) * .03);
      if (V.engine === 'whistle') V.engine = 'natural';
      for (const e of kindTemplate(kind, voice)) element(t + e.at, e, pitch, vol * (e.v ?? 1) * (reg ? 1.3 : 1.1));
      V.engine = prev; return;
    }
    const t = ctx.currentTime + LEAD, prev = V.engine;
    if (V.engine === 'whistle' && voice % NV < 8) { V.engine = 'natural'; whistle(t, f, voice, vol * .85); V.engine = prev; return; }
    // a little variation every time: no bird sings a note exactly the same twice
    const j = 1 + (Math.random() - .5) * .03, reg = REG[voice % NV], pitch = reg ? f * reg * j : f * V.octave * j, rnd = Math.random;
    if (V.engine === 'whistle') V.engine = 'natural';
    for (const e of template(voice, rnd)) element(t + e.at * (1 + (rnd() - .5) * .1), e, pitch, vol * (e.v ?? 1) * (reg ? 1.3 : 1.1));
    V.engine = prev;
  };
  return V;
}

// a forest's reverb: soft early reflections, then a decaying tail that loses its highs
function forestIR(ctx) {
  const n = Math.floor(ctx.sampleRate * 1.6), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) {
      const s = i / ctx.sampleRate, k = Math.min(1, s * 40);
      lp += (Math.random() * 2 - 1 - lp) * (.5 - .4 * Math.min(1, s / 1.2));
      d[i] = lp * k * Math.exp(-s * 3.4) * .6;
    }
    for (const at of [.013, .021, .034, .047]) d[Math.floor(at * ctx.sampleRate) + ch * 7] += .35;
  }
  return buf;
}
