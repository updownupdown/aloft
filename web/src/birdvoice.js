// Songbird voices. Every call is built from a species template of short elements (whistles,
// sweeps, trill notes), each a pitch contour with a fast swell, rendered by one of several
// engines and placed in a space. The bird song lab (lab.html) plays them side by side and saves
// the pick under aloft.birdVoice; the game reads the same key.
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
// 5 finch, 6 owl, 7 lark): when it starts, how long, and its pitch path as [0..1, multiple].
function template(voice, rnd) {
  const rep = (n, gap, dur, c, o = {}) => Array.from({ length: n }, (_, i) => ({ at: i * gap, dur, c: typeof c === 'function' ? c(i) : c, v: 1 - i * (o.fade || 0), ...o }));
  switch (voice % 8) {
    case 0: return [{ at: 0, dur: .26, c: [[0, 1.02], [.15, 1], [1, .97]], atk: .02 }];
    case 1: return [{ at: 0, dur: .11, c: [[0, .82], [.45, 1.12], [1, .94]] }, { at: .13, dur: .05, c: [[0, 1.05], [1, .9]], v: .5 }];
    case 2: return rep(4, .04, .028, [[0, 1.18], [1, .88]], { fade: .08 });
    case 3: return rep(4, .04, .028, i => i % 2 ? [[0, 1.12], [1, .88]] : [[0, .9], [1, 1.12]]);
    case 4: return [{ at: 0, dur: .025, c: [[0, .85], [1, 1]], v: .5 }, { at: .022, dur: .3, c: [[0, 1], [1, 1.01]], vib: .012, vibF: 6, atk: .02 }];
    case 5: return rep(3, .06, .045, [[0, 1.22], [1, .86]], { am: .5, amF: 85 });
    case 6: return [{ at: 0, dur: .38, c: [[0, 1.03], [.3, 1], [1, .95]], atk: .06, owl: true }];
    default: return rep(4, .03, .024, () => [[0, 1 + (rnd() - .5) * .3], [1, 1 + (rnd() - .5) * .3]]);
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
    if (e.owl) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; env.connect(lp).connect(input); } else env.connect(input);
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
    tone(1, 1); tone(2, e.owl ? .22 : .1); tone(3, .025);
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
  // one song note at pitch f (the game's pitch for that note), in a species' voice
  V.sing = (f, voice = 0, vol = .16) => {
    const t = ctx.currentTime + .005, prev = V.engine;
    if (V.engine === 'whistle') { V.engine = 'natural'; whistle(t, f, voice, vol * .85); V.engine = prev; return; }
    // a little variation every time: no bird sings a note exactly the same twice
    const j = 1 + (Math.random() - .5) * .03, owl = voice % 8 === 6, pitch = owl ? f / 4 * j : f * V.octave * j, rnd = Math.random;
    for (const e of template(voice, rnd)) element(t + e.at * (1 + (rnd() - .5) * .1), e, pitch, vol * (e.v ?? 1) * (owl ? 1.3 : 1.1));
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
