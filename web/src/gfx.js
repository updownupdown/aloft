// Graphics settings and the performance overlay. Each switch turns off one costly layer, so a
// slow phone can trade a little of the look for speed, and so we can find what costs the most.
// Saved under aloft.gfx; a URL like ?gfx=paper:0,res:1,fps:1 overrides them for one visit.
export const GFX_INFO = [
  ['fps', 'Frame rate', false],
  ['paper', 'Paper texture', true],
  ['clouds', 'Clouds', true],
  ['mist', 'Distance mist', true],
  ['hills', 'Far hills', true],
  ['thermals', 'Thermal columns', true],
  ['streaks', 'Wind flecks', true],
  ['weather', 'Rain and snow', true],
];
export const RES_OPTS = ['auto', .5, .75, 1, 1.25, 1.5, 2];
// the look (watercolour, or one of the simple styles in simple.js) and a cap on frames a second
export const STYLE_OPTS = ['wash', 'cut', 'ink', 'pixel', 'shadow'];
export const CAP_OPTS = ['max', 60, 45, 30];
export const GFX = { res: 'auto', style: 'wash', cap: 'max' };
for (const [k, , d] of GFX_INFO) GFX[k] = d;

export function loadGfx(store) {
  Object.assign(GFX, store.get('gfx', {}));
  const q = new URLSearchParams(location.search).get('gfx');
  if (q) for (const kv of q.split(',')) {
    const [k, v] = kv.split(':');
    if (k === 'res') GFX.res = v === 'auto' ? 'auto' : +v;
    else if (k === 'style') GFX.style = STYLE_OPTS.includes(v) ? v : 'wash';
    else if (k === 'cap') GFX.cap = v === 'max' ? 'max' : +v;
    else if (k in GFX) GFX[k] = v !== '0';
  }
}
export function saveGfx(store) { store.set('gfx', GFX); }

// timing collected by the game loop, shown by the overlay and copied by "Copy debug info"
export const stats = { frames: [], js: [], step: [], draw: [], sprites: 0, repaints: 0, res: 0, canvas: '' };
const push = (a, v) => { a.push(v); if (a.length > 240) a.shift(); };
export function record(frameMs, stepMs, drawMs) { push(stats.frames, frameMs); push(stats.step, stepMs); push(stats.draw, drawMs); push(stats.js, stepMs + drawMs); }
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const last = (a, n) => a.slice(-n);
export function summary() {
  const f = last(stats.frames, 120), sorted = f.slice().sort((a, b) => a - b);
  return {
    fps: f.length ? 1000 / avg(f) : 0, frame: avg(f), worst: sorted[Math.floor(sorted.length * .95)] || 0,
    js: avg(last(stats.js, 120)), step: avg(last(stats.step, 120)), draw: avg(last(stats.draw, 120)),
    res: stats.res, canvas: stats.canvas, sprites: stats.sprites, style: GFX.style,
  };
}

let el = null, timer = 0;
export function overlay(on) {
  if (!on) { el?.remove(); el = null; clearInterval(timer); timer = 0; return; }
  if (el) return;
  el = document.createElement('div'); el.className = 'perf';
  const txt = document.createElement('div'), graph = document.createElement('canvas');
  graph.width = 240; graph.height = 40;
  el.append(txt, graph); document.getElementById('ui').append(el);
  timer = setInterval(() => {
    const s = summary();
    txt.textContent = `${s.fps.toFixed(0)} fps · ${s.frame.toFixed(1)} ms (slowest 5%: ${s.worst.toFixed(0)}) · script ${s.js.toFixed(1)} ms (update ${s.step.toFixed(1)}, draw ${s.draw.toFixed(1)}) · res ${s.res.toFixed(2)}, ${s.canvas} · sprites ${s.sprites}, ${stats.repaints * 2} new/s`;
    stats.repaints = 0;
    // frame times as bars (green under 18 ms, amber under 34, red above), script time as a dark tick
    const g = graph.getContext('2d'), f = last(stats.frames, 120), js = last(stats.js, 120);
    g.clearRect(0, 0, 240, 40);
    g.fillStyle = 'rgba(58,36,24,.2)'; g.fillRect(0, 40 - 16.7, 240, 1); g.fillRect(0, 40 - 33.3, 240, 1);
    f.forEach((v, i) => { g.fillStyle = v > 34 ? '#b8532f' : v > 18 ? '#d9a040' : '#6f9a86'; g.fillRect(i * 2, 40 - Math.min(40, v), 2, Math.min(40, v)); });
    g.fillStyle = 'rgba(58,36,24,.7)'; js.forEach((v, i) => g.fillRect(i * 2, 40 - Math.min(40, v), 2, 1.5));
  }, 500);
}
export function debugInfo() {
  return JSON.stringify({ ...summary(), gfx: GFX, ua: navigator.userAgent, dpr: devicePixelRatio, screen: [innerWidth, innerHeight], frames: stats.frames.slice(-60).map(v => Math.round(v)) });
}
