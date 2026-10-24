// Frame cost: where each frame's milliseconds go, smoothed, for Settings > Advanced > Frame cost
// (dev.js draws G.perf). The main thread's work is timed per system and per core step with
// performance.now(). The GPU's is timed per render pass when the browser offers timer queries
// (EXT_disjoint_timer_query_webgl2); without them, "Measure the GPU" (P.deep) waits for the GPU
// to finish each pass, which slows the game while on but gives each pass's time.
//   G.perf = { frame, cpu, gpu, gpuHow, groups: { Core: {}, Systems: {}, 'Render passes': {} } }
const K = .05;   // smoothing: about the last 20 frames

export function createPerf(gl) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const P = { frame: 0, cpu: 0, gpu: null, gpuHow: ext ? 'timer queries' : 'off', deep: false, groups: { Core: {}, Systems: {}, 'Render passes': {} } };
  const acc = new Map();   // 'group\tname' -> ms this frame
  const ema = (g, n, ms) => { const o = P.groups[g]; o[n] = o[n] == null ? ms : o[n] + (ms - o[n]) * K; };
  let t = 0, f0 = 0, last = 0;
  P.begin = () => { t = f0 = performance.now(); };
  // time since the last lap, added to this frame's total for (group, name)
  P.lap = (g, n) => { const t1 = performance.now(), k = g + '\t' + n; acc.set(k, (acc.get(k) || 0) + t1 - t); t = t1; };
  P.end = () => {
    const now = performance.now();
    for (const [k, ms] of acc) { const i = k.indexOf('\t'); ema(k.slice(0, i), k.slice(i + 1), ms); }
    acc.clear();
    P.cpu += (now - f0 - P.cpu) * K;
    if (last) P.frame += (now - last - P.frame) * K;
    last = now;
  };

  // render passes, in order: pass(name) closes the one before; pass(null) closes the last
  const queries = [], pending = [], got = {};   // a pool, [name, query] waiting on the GPU, the frame so far
  let open = null, tp = 0, sum = 0;
  P.pass = name => {
    if (ext) {
      if (open) gl.endQuery(ext.TIME_ELAPSED_EXT);
      if (name) { const q = queries.pop() || gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); pending.push([name, q]); }
    } else if (P.deep) {
      gl.finish(); const t1 = performance.now();
      if (open) { const ms = t1 - tp; ema('Render passes', open, ms); sum += ms; }
      tp = t1;
      if (!name) { P.gpu = P.gpu == null ? sum : P.gpu + (sum - P.gpu) * K; sum = 0; }
    }
    open = name;
  };
  // read the timer queries the GPU has answered (a frame or two late)
  P.poll = () => {
    if (!ext) { P.gpuHow = P.deep ? 'waiting on each pass (slower while on)' : 'off'; return; }
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { for (const [, q] of pending.splice(0)) queries.push(q); return; }
    const frame = got;
    while (pending.length && gl.getQueryParameter(pending[0][1], gl.QUERY_RESULT_AVAILABLE)) {
      const [name, q] = pending.shift();
      frame[name] = (frame[name] || 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      queries.push(q);
      if (name === 'motes') {   // the last pass of a frame
        let s = 0; for (const n in frame) { ema('Render passes', n, frame[n]); s += frame[n]; delete frame[n]; }
        P.gpu = P.gpu == null ? s : P.gpu + (s - P.gpu) * K;
      }
    }
    if (pending.length > 200) for (const [, q] of pending.splice(0)) queries.push(q);   // never answered: start over
  };
  return P;
}
