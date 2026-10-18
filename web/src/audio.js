// All sound is synthesised with Web Audio: no files to download.
const PITCH = [880, 988, 1109, 1319, 1480]; // A major pentatonic, one per staff line (low to high)

export function createAudio() {
  const A = { ctx: null, on: true, wind: null, rain: null };
  let noiseBuf = null;

  A.unlock = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = A.ctx = new AC();
    A.master = ctx.createGain(); A.master.gain.value = A.on ? .8 : 0; A.master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = last * .97 + w * .03; d[i] = w * .5 + last * 4; }
    A.wind = loop('lowpass', 420, .7); A.rain = loop('highpass', 2500, .3);
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
  // continuous beds, called every frame
  A.ambience = (windAmt, rainAmt) => {
    if (!A.ctx) return; const t = A.ctx.currentTime;
    A.wind.g.gain.setTargetAtTime(.04 + windAmt * .22, t, .3); A.wind.fl.frequency.setTargetAtTime(300 + windAmt * 900, t, .3);
    A.rain.g.gain.setTargetAtTime(rainAmt * .12, t, .5);
  };
  function burst({ f = 800, type = 'bandpass', q = 1, dur = .2, vol = .3, f2 = null, delay = 0 }) {
    if (!A.ctx) return; const ctx = A.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .2); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(fl).connect(g).connect(A.master); src.start(t, Math.random()); src.stop(t + dur + .05);
  }
  function tone({ f, f2 = null, dur = .15, vol = .2, type = 'sine', delay = 0, vib = 0 }) {
    if (!A.ctx) return; const ctx = A.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 28; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(A.master); o.start(t); o.stop(t + dur + .05);
  }
  A.flap = () => burst({ f: 420, f2: 260, q: .8, dur: .22, vol: .35 });
  A.splash = big => { burst({ f: 1800, f2: 500, q: .7, dur: big ? .6 : .35, vol: big ? .45 : .25 }); };
  A.thump = () => { burst({ f: 180, type: 'lowpass', dur: .25, vol: .5 }); };
  A.rustle = () => { burst({ f: 3200, q: .6, dur: .3, vol: .15 }); burst({ f: 2400, q: .6, dur: .2, vol: .1, delay: .08 }); };
  A.drink = () => { tone({ f: 620, f2: 380, dur: .12, vol: .18 }); tone({ f: 760, f2: 500, dur: .1, vol: .12, delay: .1 }); };
  A.eat = () => { tone({ f: 300, f2: 180, dur: .08, vol: .25, type: 'triangle' }); burst({ f: 1500, q: 2, dur: .06, vol: .15, delay: .02 }); };
  A.ring = () => { [0, 2, 4].forEach((n, i) => tone({ f: PITCH[n] / 2, dur: .9, vol: .12, delay: i * .07, type: 'triangle' })); };
  A.thunder = d => { burst({ f: 120, type: 'lowpass', dur: 2.6, vol: .7, delay: d }); burst({ f: 60, type: 'lowpass', dur: 3.2, vol: .5, delay: d + .2 }); };
  A.learned = () => { [0, 1, 2, 3, 4].forEach((n, i) => tone({ f: PITCH[n], f2: PITCH[n] * 1.06, dur: .3, vol: .1, delay: i * .09 })); };
  // a songbird note: a quick upward chirp with a little trill; `voice` shapes it per species
  A.note = (lane, voice = 0, vol = .16) => {
    const f = PITCH[lane];
    if (voice % 3 === 0) tone({ f: f * .92, f2: f * 1.08, dur: .22, vol, vib: 0 });
    else if (voice % 3 === 1) tone({ f, f2: f * .9, dur: .26, vol, vib: f * .03 });
    else { tone({ f: f * .96, f2: f * 1.04, dur: .1, vol }); tone({ f: f * .98, f2: f * 1.05, dur: .1, vol: vol * .8, delay: .11 }); }
  };
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
export const NOTE_HZ = PITCH;
