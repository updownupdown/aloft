// All sound is synthesised with Web Audio: no files to download.
// Everything that has a pitch (songbirds, the hawk's singing voice, the music) shares one
// key, A, so singing in tune sits inside the music. (It used to drift with the hour; that made
// songs too hard to keep up with, so setKey is left for the console only.)
const BASE = [880, 988, 1109, 1319, 1480]; // A major pentatonic, one per staff line (low to high)
const KEYS = { day: 0, dusk: -2, night: -5, dawn: 5 };   // semitones from A

export function createAudio() {
  const A = { ctx: null, on: true, wind: null, rain: null, key: 0 };
  let noiseBuf = null;
  const keyMul = () => Math.pow(2, A.key / 12);
  A.hz = st => BASE[0] * Math.pow(2, (st + A.key) / 12);   // a pitch on the singing string, in semitones above the lowest song note
  A.setKey = period => { A.key = KEYS[period] ?? 0; };

  A.unlock = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = A.ctx = new AC();
    A.master = ctx.createGain(); A.master.gain.value = A.on ? .8 : 0; A.master.connect(ctx.destination);
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
  A.setOn = on => { A.on = on; if (A.master) A.master.gain.setTargetAtTime(on ? .8 : 0, A.ctx.currentTime, .05); };
  // continuous beds, called every frame. `scene` says where the hawk is: the biome, whether a
  // waterfall or a night pond is near, so the wind sighs in pines, surges over the cliffs,
  // water babbles and frogs call.
  let nextFrog = 0;
  A.ambience = (windAmt, rainAmt, scene = {}) => {
    if (!A.ctx) return; const t = A.ctx.currentTime;
    const pines = scene.bio === 'forest' ? 1 : 0, surf = scene.bio === 'cliffs' ? 1 : 0;
    const sigh = .5 + .5 * Math.sin(t * (surf ? .45 : .25) + Math.sin(t * .11));   // a slow swell
    const wg = .04 + windAmt * .22 + pines * .05 * sigh + surf * .09 * sigh;
    A.wind.g.gain.setTargetAtTime(wg, t, .3);
    A.wind.fl.frequency.setTargetAtTime(300 + windAmt * 900 - pines * 120 + surf * 200 * sigh, t, .3);
    A.rain.g.gain.setTargetAtTime(rainAmt * .12, t, .5);
    A.whistle.g.gain.setTargetAtTime((scene.stoop || 0) * .07, t, .15);
    A.whistle.fl.frequency.setTargetAtTime(2200 + (scene.stoop || 0) * 900, t, .15);
    A.babble.g.gain.setTargetAtTime((scene.falls || 0) * .09 * (.8 + .2 * Math.sin(t * 6.3)), t, .25);
    if (scene.frogs > 0 && t > nextFrog) {
      // a chorus of frogs: short low croaks, a few at a time, from the reeds
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) croak(scene.frogs * (.5 + Math.random() * .5), i * (.1 + Math.random() * .2));
      nextFrog = t + .6 + Math.random() * 2.2;
    }
  };
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
  A.thunder = d => { burst({ f: 120, type: 'lowpass', dur: 2.6, vol: .7, delay: d }); burst({ f: 60, type: 'lowpass', dur: 3.2, vol: .5, delay: d + .2 }); };
  A.learned = () => { [0, 1, 2, 3, 4].forEach((n, i) => tone({ f: BASE[n] * keyMul(), f2: BASE[n] * keyMul() * 1.06, dur: .3, vol: .1, delay: i * .09 })); };
  // a feather earned: a soft rising pair of notes
  A.feather = () => { tone({ f: BASE[2] * keyMul() / 2, dur: .5, vol: .1, type: 'triangle' }); tone({ f: BASE[4] * keyMul() / 2, dur: .9, vol: .1, type: 'triangle', delay: .18 }); };
  // Songbirds (and the far hawk) sing through a short valley echo of their own, so a call
  // hangs in the air a moment instead of stopping dead.
  let birdBus = null;
  function bus() {
    if (birdBus) return birdBus;
    const ctx = A.ctx, g = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
    dl.delayTime.value = .19; fb.gain.value = .24; lp.type = 'lowpass'; lp.frequency.value = 3600; wet.gain.value = .32;
    g.connect(A.master); g.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(A.master);
    return (birdBus = g);
  }
  // One whistled syllable: a pitch path glided through over `dur`, a soft-edged swell, and
  // optionally a trill (fast tremolo), a vibrato, and a quiet overtone that gives it body.
  function syll({ t, path, dur, vol, trill = 0, trillF = 30, vib = 0, vibF = 6, over = .08, type = 'sine', attack = .015, lp = 0 }) {
    const ctx = A.ctx, out = ctx.createGain(), env = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + Math.min(attack, dur * .3));
    env.gain.linearRampToValueAtTime(vol * .75, t + dur * .7); env.gain.exponentialRampToValueAtTime(.0005, t + dur);
    let dst = env;
    if (trill) {
      const am = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      am.gain.value = 1 - trill / 2; l.frequency.value = trillF; lg.gain.value = trill / 2;
      l.connect(lg).connect(am.gain); am.connect(env); l.start(t); l.stop(t + dur + .05); dst = am;
    }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; env.connect(f).connect(out); } else env.connect(out);
    out.connect(bus());
    [[1, 1], [2, over]].forEach(([m, g]) => {
      if (g <= 0) return;
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = m === 1 ? type : 'sine'; og.gain.value = g;
      o.frequency.setValueAtTime(path[0] * m, t);
      path.forEach((f, i) => { if (i) o.frequency.exponentialRampToValueAtTime(f * m, t + dur * i / (path.length - 1)); });
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibF; lg.gain.value = vib * m; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
      o.connect(og).connect(dst); o.start(t); o.stop(t + dur + .05);
    });
  }
  // The red-tail's scream, "kee-eeeee-arr": a hoarse rising onset, a long rasping hold, then
  // the drop. The rasp is a fast wobble in pitch; a band of breath noise rides on top.
  // `far` is another hawk answering from across the valley, softer and echoing.
  A.scream = (far = false) => {
    if (!A.ctx) return;
    const ctx = A.ctx, t = ctx.currentTime + (far ? 1.1 + Math.random() * .6 : 0), vol = far ? .06 : .17, k = far ? .97 : 1;
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
  // the fledgling's thin answering peep
  A.peep = () => { tone({ f: 3100, f2: 2600, dur: .22, vol: .07, vib: 40, vibF: 30, delay: .8 }); tone({ f: 3300, f2: 2700, dur: .2, vol: .06, vib: 40, vibF: 30, delay: 1.1 }); };
  // crows: a harsh caw or two
  A.caw = (vol = 1) => { for (let k = 0; k < 1 + (Math.random() < .5 ? 1 : 0); k++) { tone({ f: 620, f2: 480, dur: .17, vol: .09 * vol, type: 'sawtooth', delay: k * .32, lp: 1600, vib: 30, vibF: 24 }); burst({ f: 1100, f2: 700, q: 1.5, dur: .2, vol: .12 * vol, delay: k * .32 }); } };
  // the heron's croak as it lifts off, and a deer's snort
  A.heron = () => { tone({ f: 330, f2: 240, dur: .35, vol: .08, type: 'sawtooth', lp: 1100, vib: 24, vibF: 18 }); burst({ f: 900, q: 1, dur: .35, vol: .1 }); };
  A.snort = () => burst({ f: 700, f2: 300, type: 'lowpass', dur: .18, vol: .25 });
  // A songbird note on one of the five song pitches, in that species' own voice:
  // 0 chickadee, a clear falling whistle; 1 robin, a rounded carol; 2 warbler, a quick trill;
  // 3 wren, a bubbly run of chips; 4 thrush, a fluting note with vibrato; 5 finch, a bright
  // buzz; 6 owl, a soft low hoot; 7 lark, a liquid warble.
  A.note = (lane, voice = 0, vol = .16) => {
    if (!A.ctx) return;
    const f = BASE[lane] * keyMul(), t = A.ctx.currentTime, v = vol * .85;
    switch (voice % 8) {
      case 0: syll({ t, path: [f * 1.03, f, f * .985], dur: .34, vol: v, over: .04, attack: .03 }); break;
      case 1: syll({ t, path: [f * .86, f * 1.07, f * .98], dur: .22, vol: v, over: .14, vib: f * .01, vibF: 9 }); break;
      case 2: syll({ t, path: [f * .93, f * 1.05], dur: .25, vol: v, trill: .9, trillF: 36, over: .06 }); break;
      case 3: for (let k = 0; k < 3; k++) syll({ t: t + k * .055, path: [f * 1.1, f * .93], dur: .05, vol: v * (1 - k * .15), over: .1, attack: .005 }); break;
      case 4: syll({ t, path: [f * .97, f, f * 1.005], dur: .4, vol: v, vib: f * .012, vibF: 5.5, over: .26, attack: .04 }); break;
      case 5: syll({ t, path: [f * 1.12, f * .92], dur: .16, vol: v * .8, type: 'triangle', trill: .55, trillF: 72, over: .1, lp: 5200 }); break;
      case 6: syll({ t, path: [f / 4 * 1.03, f / 4, f / 4 * .96], dur: .5, vol: v * 1.3, over: .03, attack: .09, lp: 900 }); break;
      default: syll({ t, path: [f * .9, f * 1.1, f * .95, f * 1.06], dur: .21, vol: v, vib: f * .035, vibF: 21, over: .1 });
    }
  };
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
