// All sound is synthesised with Web Audio: no files to download.
// Everything that has a pitch (songbirds, the hawk's singing voice, the music) shares one
// key, A, so singing in tune sits inside the music. (It used to drift with the hour; that made
// songs too hard to keep up with, so setKey is left for the console only.)
import { createBirdVoice, loadVoice } from './birdvoice.js';

const BASE = [880, 988, 1109, 1319, 1480]; // A major pentatonic, one per staff line (low to high)
const KEYS = { day: 0, dusk: -2, night: -5, dawn: 5 };   // semitones from A

export function createAudio() {
  const A = { ctx: null, on: true, wind: null, rain: null, key: 0 };
  let noiseBuf = null;
  const keyMul = () => Math.pow(2, A.key / 12);
  A.hz = st => BASE[0] * Math.pow(2, (st + A.key) / 12);   // a pitch on the singing string, in semitones above the lowest song note
  A.setKey = period => { A.key = KEYS[period] ?? 0; };

  A.unlock = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended' && !document.hidden) A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = A.ctx = new AC();
    A.master = ctx.createGain(); A.master.gain.value = A.on ? .8 : 0;
    // fog (and anything else that should dull the world) closes this filter
    A.muffleLp = ctx.createBiquadFilter(); A.muffleLp.type = 'lowpass'; A.muffleLp.frequency.value = 20000;
    A.master.connect(A.muffleLp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = last * .97 + w * .03; d[i] = w * .5 + last * 4; }
    A.wind = loop('lowpass', 420, .7); A.rain = loop('highpass', 2500, .3);
    // the stoop whistle: air over the wings near top speed
    A.whistle = loop('bandpass', 2600, 9);
    // water tumbling near a waterfall
    A.babble = loop('bandpass', 1500, .8);
  };
  function loop(type, f, q) {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(fl).connect(g).connect(A.master); src.start();
    return { g, fl };
  }
  // variometer: soft beeps when the air is rising, faster and higher for stronger lift
  let nextBeep = 0;
  A.vario = lift => {
    if (!A.ctx || lift < 5) return; const t = A.ctx.currentTime;
    if (t < nextBeep) return;
    const k = Math.min(1, lift / 50);
    tone({ f: 520 + k * 420, f2: 560 + k * 480, dur: .09, vol: .045 + .04 * k, type: 'sine' });
    nextBeep = t + .55 - .35 * k;
  };
  // the app hidden or the screen off: everything stops (music included, which shares the
  // context) until it is shown again
  A.suspend = () => { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = () => { if (A.ctx && A.ctx.state !== 'running' && !document.hidden) A.ctx.resume(); };
  A.setOn = on => { A.on = on; if (A.master) A.master.gain.setTargetAtTime(on ? .8 : 0, A.ctx.currentTime, .05); };
  // continuous beds, called every frame. `scene` says where the hawk is: the biome, whether a
  // waterfall or a night pond is near, so the wind sighs in pines, surges over the cliffs,
  // water babbles and frogs call. Height mixes it: low down the streams, frogs and insects
  // are close; high up they fade and there is only the wind (and the music).
  // Night has its season: spring peepers and frogs, summer crickets, autumn katydids, and
  // near silence over winter snow (`scene.night`, `scene.sea`).
  let nextFrog = 0, nextBug = 0;
  A.ambience = (windAmt, rainAmt, scene = {}) => {
    if (!A.ctx) return; const t = A.ctx.currentTime;
    const pines = scene.bio === 'forest' ? 1 : 0, surf = scene.bio === 'cliffs' || scene.bio === 'mountains' ? 1 : 0;
    const high = Math.min(1, Math.max(0, ((scene.height ?? 0) - 50) / 250)), low = 1 - high;
    const sigh = .5 + .5 * Math.sin(t * (surf ? .45 : .25) + Math.sin(t * .11));   // a slow swell
    const wg = .04 + windAmt * .22 + pines * .05 * sigh * low + surf * .09 * sigh + high * .06;
    A.wind.g.gain.setTargetAtTime(wg, t, .3);
    A.wind.fl.frequency.setTargetAtTime(300 + windAmt * 900 - pines * 120 + surf * 200 * sigh, t, .3);
    A.rain.g.gain.setTargetAtTime(rainAmt * .12, t, .5);
    A.whistle.g.gain.setTargetAtTime((scene.stoop || 0) * .07, t, .15);
    A.whistle.fl.frequency.setTargetAtTime(2200 + (scene.stoop || 0) * 900, t, .15);
    A.babble.g.gain.setTargetAtTime((scene.falls || 0) * .09 * (.8 + .2 * Math.sin(t * 6.3)) * (.4 + .6 * low), t, .25);
    A.muffleLp.frequency.setTargetAtTime(20000 - (scene.fog || 0) * 18200, t, .4);
    const frogs = (scene.frogs || 0) * low, sea = scene.sea || {};
    if (frogs > 0 && t > nextFrog) {
      // a chorus of frogs: short low croaks from the reeds; in spring the high peepers too
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) croak(frogs * (.5 + Math.random() * .5), i * (.1 + Math.random() * .2));
      if ((sea.spring || 0) > .3) for (let i = 0; i < 2; i++) tone({ f: 2700 + Math.random() * 300, f2: 3100, dur: .09, vol: .03 * frogs * sea.spring, delay: .3 + i * (.4 + Math.random() * .5) });
      nextFrog = t + .6 + Math.random() * 2.2;
    }
    const bugs = (scene.night || 0) * low * (1 - (sea.winter || 0)) * (1 - rainAmt), sum = sea.summer || 0, aut = sea.autumn || 0;
    if (bugs > .05 && t > nextBug) {
      if (sum > .2) cricket(bugs * sum);
      if (aut > .2) katydid(bugs * aut, Math.random() * .5);
      nextBug = t + .5 + Math.random() * .7;
    }
  };
  // a field cricket: three quick pure chirps, high
  function cricket(vol) { const f = 4300 + Math.random() * 300; for (let k = 0; k < 3; k++) tone({ f, dur: .025, vol: .022 * vol, delay: k * .045, vib: 60, vibF: 90 }); }
  // a katydid: a rasp of noise in three beats, "ka-ty-did"
  function katydid(vol, delay) { for (let k = 0; k < 3; k++) burst({ f: 5200, q: 4, dur: .06, vol: .05 * vol, delay: delay + k * .11 }); }
  function burst({ f = 800, type = 'bandpass', q = 1, dur = .2, vol = .3, f2 = null, delay = 0 }) {
    if (!A.ctx) return; const ctx = A.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .2); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(fl).connect(g).connect(A.master); src.start(t, Math.random()); src.stop(t + dur + .05);
  }
  function tone({ f, f2 = null, dur = .15, vol = .2, type = 'sine', delay = 0, vib = 0, vibF = 28, lp = 0 }) {
    if (!A.ctx) return; const ctx = A.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibF; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl).connect(g); } else o.connect(g);
    g.connect(A.master); o.start(t); o.stop(t + dur + .05);
  }
  A.tone = tone; A.burst = burst;   // for creatures whose calls live with them (encounters.js)

  // a frog: a pulsed low croak
  function croak(vol, delay) {
    for (let k = 0; k < 4; k++) tone({ f: 170 + Math.random() * 60, f2: 140, dur: .06, vol: .05 * vol, type: 'sawtooth', delay: delay + k * .07, lp: 700 });
  }
  A.flap = () => burst({ f: 420, f2: 260, q: .8, dur: .22, vol: .35 });
  A.splash = big => { burst({ f: 1800, f2: 500, q: .7, dur: big ? .6 : .35, vol: big ? .45 : .25 }); };
  A.thump = (vol = .5) => { burst({ f: 180, type: 'lowpass', dur: .25, vol }); };
  A.rustle = (vol = 1) => { burst({ f: 3200, q: .6, dur: .3, vol: .15 * vol }); burst({ f: 2400, q: .6, dur: .2, vol: .1 * vol, delay: .08 }); };
  A.drink = () => { tone({ f: 620, f2: 380, dur: .12, vol: .18 }); tone({ f: 760, f2: 500, dur: .1, vol: .12, delay: .1 }); };
  A.eat = () => { tone({ f: 300, f2: 180, dur: .08, vol: .25, type: 'triangle' }); burst({ f: 1500, q: 2, dur: .06, vol: .15, delay: .02 }); };
  A.ring = () => { [0, 2, 4].forEach((n, i) => tone({ f: BASE[n] * keyMul() / 2, dur: .9, vol: .12, delay: i * .07, type: 'triangle' })); };
  // thunder arrives after its flash by the time sound takes to cross the distance (km): far
  // storms rumble low and soft, a near one cracks first
  A.thunder = (d, km = 2) => {
    const v = Math.max(.25, 1 - km / 5);
    if (km < 1.2) burst({ f: 900, f2: 200, type: 'lowpass', dur: .5, vol: .5 * v, delay: d });
    burst({ f: 120 + 200 * v, type: 'lowpass', dur: 2.6 + km * .4, vol: .7 * v, delay: d }); burst({ f: 60, type: 'lowpass', dur: 3.2 + km * .5, vol: .5 * v, delay: d + .2 });
  };
  A.learned = () => { [0, 1, 2, 3, 4].forEach((n, i) => tone({ f: BASE[n] * keyMul(), f2: BASE[n] * keyMul() * 1.06, dur: .3, vol: .1, delay: i * .09 })); };
  // a feather earned: a soft rising pair of notes
  A.feather = () => { tone({ f: BASE[2] * keyMul() / 2, dur: .5, vol: .1, type: 'triangle' }); tone({ f: BASE[4] * keyMul() / 2, dur: .9, vol: .1, type: 'triangle', delay: .18 }); };
  // The far hawk calls through a short valley echo, so it hangs in the air a moment.
  let birdBus = null;
  function bus() {
    if (birdBus) return birdBus;
    const ctx = A.ctx, g = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
    dl.delayTime.value = .19; fb.gain.value = .24; lp.type = 'lowpass'; lp.frequency.value = 3600; wet.gain.value = .32;
    g.connect(A.master); g.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(A.master);
    return (birdBus = g);
  }
  // The red-tail's scream, "kee-eeeee-arr": a hoarse rising onset, a long rasping hold, then
  // the drop. The rasp is a fast wobble in pitch; a band of breath noise rides on top.
  // `far` is another hawk answering from across the valley, softer and echoing.
  // `echo` is the call coming back off a cliff: { delay, vol }, softer and duller.
  // `gain` scales the whole call (the player's call is louder the longer the button is held).
  A.scream = (far = false, echo = null, gain = 1) => {
    if (!A.ctx) return;
    if (echo) far = true;
    const ctx = A.ctx, t = ctx.currentTime + (echo ? echo.delay : far ? 1.1 + Math.random() * .6 : 0), vol = (echo ? .17 * echo.vol : far ? .06 : .17) * gain, k = far && !echo ? .97 : 1;
    const env = ctx.createGain(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2.2; lp.type = 'lowpass'; lp.frequency.value = far ? 1900 : 5200;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + .07); env.gain.linearRampToValueAtTime(vol * .85, t + .7);
    env.gain.linearRampToValueAtTime(vol * .7, t + 1.0); env.gain.exponentialRampToValueAtTime(.0008, t + 1.35);
    const pitch = (o, m) => {
      o.frequency.setValueAtTime(2300 * k * m, t); o.frequency.exponentialRampToValueAtTime(3050 * k * m, t + .12);
      o.frequency.exponentialRampToValueAtTime(2750 * k * m, t + .75); o.frequency.exponentialRampToValueAtTime(1550 * k * m, t + 1.3);
    };
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), rasp = ctx.createOscillator(), rg = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; g2.gain.value = .9; pitch(o, 1); pitch(o2, 1);
    bp.frequency.setValueAtTime(2900, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 1.3);
    rasp.frequency.value = 62; rg.gain.value = 110; rasp.connect(rg); rg.connect(o.frequency); rg.connect(o2.frequency);
    o.connect(bp).connect(env); o2.connect(g2).connect(env); env.connect(lp).connect(far ? bus() : A.master);
    if (!far) { const send = ctx.createGain(); send.gain.value = .3; lp.connect(send).connect(bus()); }
    for (const x of [o, o2, rasp]) { x.start(t); x.stop(t + 1.4); }
    burst({ f: 3200, f2: 1900, q: 1.6, dur: 1.2, vol: vol * .45, delay: t - ctx.currentTime });
  };
  // The other birds you can fly as call in their own voices, through the same paths as the
  // scream: `far` answers from across the valley, `echo` comes back off a cliff, `gain` is how
  // long the button was held. `A.call(bird, ...)` picks the voice (the hawk screams).
  function callAt(far, echo, gain, near) {
    if (echo) far = true;
    const ctx = A.ctx, t = ctx.currentTime + (echo ? echo.delay : far ? 1.1 + Math.random() * .6 : 0);
    const vol = (echo ? near * echo.vol : far ? near * .35 : near) * gain;
    const out = ctx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = far ? 1900 : 6000;
    out.connect(far ? bus() : A.master);
    if (!far) { const send = ctx.createGain(); send.gain.value = .3; out.connect(send).connect(bus()); }
    return { ctx, t, vol, out, k: far && !echo ? .97 : 1 };
  }
  // one syllable: a voice sliding f -> f2 (-> f3), with a rasp (a fast wobble in pitch), through
  // a band (bp), and breath noise (a band of noise at bf) on the same envelope
  function syl(v, { at = 0, dur, f, f2 = f, f3 = 0, type = 'sawtooth', vol = 1, rasp = 0, raspF = 60, bp = 0, q = 2, breath = 0, bf = 3000 }) {
    const { ctx, out, k } = v, t = v.t + at, g = ctx.createGain(), peak = v.vol * vol;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(.03, dur * .2));
    g.gain.setValueAtTime(peak, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    const o = ctx.createOscillator(), run = [o]; o.type = type; o.frequency.setValueAtTime(f * k, t);
    if (f3) { o.frequency.exponentialRampToValueAtTime(f2 * k, t + dur * .35); o.frequency.exponentialRampToValueAtTime(f3 * k, t + dur); }
    else o.frequency.exponentialRampToValueAtTime(f2 * k, t + dur);
    if (rasp) { const r = ctx.createOscillator(), rg = ctx.createGain(); r.frequency.value = raspF; rg.gain.value = rasp; r.connect(rg).connect(o.frequency); run.push(r); }
    let node = o;
    if (bp) { const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = bp; fl.Q.value = q; node = node.connect(fl); }
    node.connect(g).connect(out);
    if (breath) {
      const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noiseBuf; fl.type = 'bandpass'; fl.frequency.value = bf; fl.Q.value = 1.4; ng.gain.value = breath;
      n.connect(fl).connect(ng).connect(g); n.start(t, Math.random()); n.stop(t + dur + .05);
    }
    for (const x of run) { x.start(t); x.stop(t + dur + .05); }
  }
  const CALLS = {
    // the osprey: a run of clear, piercing whistles, "kyew-kyew-kyew", quickening and rising
    osprey(v) {
      let at = 0;
      for (let i = 0; i < 7; i++) {
        const up = 1 + i * .035;
        syl(v, { at, dur: .11, f: 2350 * up, f2: 1850 * up, type: 'triangle', vol: .55 + i * .07, rasp: 25, raspF: 48, breath: .25, bf: 3400 });
        at += .2 - i * .012;
      }
    },
    // the barn owl: no hoot, a long hissing shriek, "shhrreeeee", that sags at the end
    owl(v) {
      syl(v, { dur: 1.9, f: 1300, f2: 1650, f3: 1050, vol: .9, rasp: 320, raspF: 92, bp: 3600, q: .8, breath: 5, bf: 4200 });
      syl(v, { dur: 1.7, f: 2600, f2: 3200, f3: 2300, type: 'sine', vol: .12, rasp: 140, raspF: 92 });
    },
    // the raven: two or three deep, rolling croaks, "prruk ... kraa", far lower than a crow
    raven(v) {
      const n = 2 + (Math.random() < .5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        syl(v, { at: i * .5, dur: .34, f: 430 - i * 15, f2: 470 - i * 15, f3: 330, vol: 1, rasp: 70, raspF: 34, bp: 950, q: 1.1, breath: .6, bf: 1300 });
      }
    },
  };
  const NEAR = { osprey: .3, owl: .15, raven: .5 };
  A.call = (bird, far = false, echo = null, gain = 1) => {
    if (!A.ctx) return;
    if (!CALLS[bird]) return A.scream(far, echo, gain);
    CALLS[bird](callAt(far, echo, gain, NEAR[bird]));
  };
  // the fledgling's thin answering peep
  A.peep = () => { tone({ f: 3100, f2: 2600, dur: .22, vol: .07, vib: 40, vibF: 30, delay: .8 }); tone({ f: 3300, f2: 2700, dur: .2, vol: .06, vib: 40, vibF: 30, delay: 1.1 }); };
  // crows: a harsh caw or two
  A.caw = (vol = 1) => { for (let k = 0; k < 1 + (Math.random() < .5 ? 1 : 0); k++) { tone({ f: 620, f2: 480, dur: .17, vol: .09 * vol, type: 'sawtooth', delay: k * .32, lp: 1600, vib: 30, vibF: 24 }); burst({ f: 1100, f2: 700, q: 1.5, dur: .2, vol: .12 * vol, delay: k * .32 }); } };
  // the heron's croak as it lifts off, and a deer's snort
  A.heron = () => { tone({ f: 330, f2: 240, dur: .35, vol: .08, type: 'sawtooth', lp: 1100, vib: 24, vibF: 18 }); burst({ f: 900, q: 1, dur: .35, vol: .1 }); };
  A.snort = () => burst({ f: 700, f2: 300, type: 'lowpass', dur: .18, vol: .25 });
  // A songbird note on one of the five song pitches, in that species' own voice (a `kind` of
  // syllable, w c t b, shapes it; see birdvoice.js) (birdvoice.js:
  // 0 chickadee, 1 robin, 2 warbler, 3 wren, 4 thrush, 5 finch, 6 owl, 7 lark), sung with the
  // engine, pitch and space picked in the bird song lab.
  A.note = (lane, voice = 0, vol = .16, kind = null) => {
    if (!A.ctx) return;
    birds().sing(BASE[lane] * keyMul(), voice, vol, kind);
  };
  let BV = null;
  const birds = () => BV || (BV = createBirdVoice(A.ctx, A.master, noiseBuf), BV.set(loadVoice()), BV);
  A.setBirdVoice = v => { if (BV) BV.set(v); };
  // a red squirrel's scolding chatter: a quick string of dry ticks
  A.chatter = () => { for (let k = 0; k < 7; k++) burst({ f: 3400 + Math.random() * 600, q: 6, dur: .045, vol: .09, delay: k * .07 + (k > 3 ? .12 : 0) }); };
  // the hawk's own voice for the singing string: one sustained whistle that follows the finger,
  // with a little vibrato that grows the longer a note is held
  let V = null;
  A.voice = (f, on) => {
    if (!A.ctx) return; const ctx = A.ctx, t = ctx.currentTime;
    if (!V) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), g = ctx.createGain();
      const l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o2.type = 'sine'; g2.gain.value = .12; g.gain.value = 0; l.frequency.value = 5.5; lg.gain.value = 0;
      l.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      o.connect(g); o2.connect(g2).connect(g); g.connect(A.master); o.start(); o2.start(); l.start();
      V = { o, o2, g, lg, on: false };
    }
    if (on) {
      V.o.frequency.setTargetAtTime(f, t, V.on ? .02 : .001); V.o2.frequency.setTargetAtTime(f * 2, t, V.on ? .02 : .001);
      if (!V.on) { V.g.gain.setTargetAtTime(.13, t, .03); V.lg.gain.cancelScheduledValues(t); V.lg.gain.setValueAtTime(0, t); V.lg.gain.linearRampToValueAtTime(f * .007, t + .9); }
    } else if (V.on) { V.g.gain.setTargetAtTime(0, t, .06); V.lg.gain.cancelScheduledValues(t); V.lg.gain.setValueAtTime(0, t); }
    V.on = on;
  };
  return A;
}
