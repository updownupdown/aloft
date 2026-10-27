// A reverb a phone can afford. A convolver's work grows with its impulse's length and doubles for
// stereo, and the music's long stereo room was most of the audio thread's work (10-27: the
// crackle and the sound cutting out). So one mono convolution, spread to both ears by sending
// the right a few milliseconds later. `fill(d, rate)` writes the mono impulse.
export function monoVerb(ctx, secs, fill) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate);
  fill(buf.getChannelData(0), ctx.sampleRate);
  const conv = ctx.createConvolver(); conv.channelCount = 1; conv.channelCountMode = 'explicit'; conv.buffer = buf;
  const late = ctx.createDelay(.05), out = ctx.createChannelMerger(2);
  late.delayTime.value = .013;
  conv.connect(out, 0, 0); conv.connect(late).connect(out, 0, 1);
  return { input: conv, out };
}
