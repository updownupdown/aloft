// The bird lab: every species side by side, flying through the hawk's poses (glide, flap, bank,
// stoop, flare, perched) over faceted hills, in one canvas cut into cells.
import { program, perspective, lookAt, mul, basis } from './gl.js';
import { buildHawk, HAWK_SCALE } from './hawk.js';
import { BIRDS, buildBird } from './birds.js';

export const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
uniform mat4 uVP, uModel; out vec3 vNrm, vCol, vColB;
void main() { vNrm = mat3(uModel) * aNrm; vCol = aCol; vColB = aColB; gl_Position = uVP * uModel * vec4(aPos, 1.); }`;
export const FS = `#version 300 es
precision highp float; in vec3 vNrm, vCol, vColB; out vec4 frag;
uniform vec3 uSun;
void main() {
  vec3 n = normalize(vNrm), col = vCol;
  if (!gl_FrontFacing) { n = -n; col = vColB; }
  float wrap = max((dot(n, uSun) + .3) / 1.3, 0.);
  vec3 amb = mix(vec3(.42, .4, .36), vec3(.62, .68, .74), n.y * .5 + .5);
  float g = .965 + .05 * fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
  frag = vec4(col * (amb + vec3(1., .95, .85) * wrap * .75) * g, 1.);
}`;
// the backdrop: sky to haze, then two ranges of faceted hills
const BG_VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUv; void main() { vUv = aP * .5 + .5; gl_Position = vec4(aP, .999, 1.); }`;
const BG_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 frag; uniform float uSeed, uShift;
float h(float x, float s) { float i = floor(x), f = fract(x); float a = fract(sin((i + s) * 91.7) * 4375.5), b = fract(sin((i + 1. + s) * 91.7) * 4375.5); return mix(a, b, f); }
void main() {
  vec3 c = mix(vec3(.93, .9, .82), vec3(.58, .72, .84), smoothstep(.25, 1., vUv.y));
  float x = vUv.x * 5. + uShift;
  float far = .3 + h(x * .8, uSeed) * .14, near = .12 + h(x * 1.3 + 7., uSeed + 3.) * .12;
  if (vUv.y < far) c = mix(vec3(.62, .7, .62), vec3(.7, .76, .7), step(.5, fract(x * .8)));
  if (vUv.y < near) c = mix(vec3(.47, .58, .42), vec3(.53, .63, .46), step(.5, fract(x * 1.3 + 7.)));
  float g = .965 + .05 * fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
  frag = vec4(c * g, 1.);
}`;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// the hawk's wing beat (camera.js), so every bird is posed exactly as the game would pose it
function beat(t0, glide) {
  const D = .42, ph = t0 / D;
  if (ph >= 1 || ph < 0) return [glide, 0];
  const fa = ph < .28 ? lerp(glide, 1.05, smooth(0, 1, ph / .28)) : ph < .72 ? lerp(1.05, -.8, smooth(0, 1, (ph - .28) / .44)) : lerp(-.8, glide, smooth(0, 1, (ph - .72) / .28));
  const hand = ph < .28 ? -.35 : ph < .72 ? .45 * Math.sin((ph - .28) / .44 * Math.PI) : -.2 * (1 - (ph - .72) / .28);
  return [fa, hand];
}

export const MODES = { cycle: 'Cycle', glide: 'Glide', flap: 'Flap', bank: 'Bank', stoop: 'Stoop', flare: 'Land', perch: 'Perched' };
const CYCLE = [['glide', 3], ['flap', 2.5], ['bank', 3], ['stoop', 2.5], ['flare', 2.5], ['perch', 3]];

// a pose and the body's roll and pitch for a mode at time t
export function poseAt(mode, t) {
  if (mode === 'cycle') {
    const total = CYCLE.reduce((s, c) => s + c[1], 0); let u = t % total;
    for (const [m, d] of CYCLE) { if (u < d) return poseAt(m, u); u -= d; }
  }
  const glide = .1 + Math.sin(t * 1.7) * .025;
  const base = { flapL: glide, flapR: glide, handL: 0, handR: 0, fold: 0, flare: 0, legs: 0, tail: .2, tailPitch: 0, t, tailRed: 1 };
  if (mode === 'glide') return { pose: base, roll: Math.sin(t * .6) * .12, pitch: 0 };
  // the Settings card: hanging in the air on the breeze, now and then a few wing beats
  if (mode === 'hover') {
    const u = t % 5.5, flaps = u < 1.26, [f, h] = flaps ? beat(u % .42, glide) : [glide, 0];
    return { pose: { ...base, flapL: f, flapR: f, handL: h, handR: h, tail: .35 + Math.sin(t * .7) * .1 }, roll: Math.sin(t * .5) * .1, pitch: .06 + Math.sin(t * .4) * .03 };
  }
  if (mode === 'flap') {
    const [f, h] = beat((t % .9), glide);
    return { pose: { ...base, flapL: f, flapR: f, handL: h, handR: h }, roll: 0, pitch: .1 };
  }
  if (mode === 'bank') return { pose: { ...base, tail: .55 }, roll: -.7 + Math.sin(t * .8) * .15, pitch: 0 };
  // the moves How to play shows: climb, dive, one wing leading, steering a stoop, circling in lift
  if (mode === 'climb') return { pose: { ...base, tail: .5, tailPitch: .2 }, roll: 0, pitch: .45 + Math.sin(t * .9) * .05 };
  if (mode === 'dive') return { pose: { ...base, flapL: glide - .06, flapR: glide - .06, fold: .3 }, roll: 0, pitch: -.45 };
  if (mode === 'lead') { const [f, h] = beat((t % 1.1), glide); return { pose: { ...base, flapL: f, handL: h, flapR: glide + (f - glide) * .35 }, roll: -.25, pitch: .05 }; }
  if (mode === 'steer') return { pose: { ...base, flapL: glide - .12, flapR: glide - .12, fold: .75 }, roll: Math.sin(t * 1.6) * .5, pitch: -.7 };
  if (mode === 'circle') return { pose: { ...base, tail: .8 }, roll: -.4, pitch: .05, spin: t * .7 };
  // the wing shapes How to play adds (2026-10-22): soaring spread wide, a fast glide folded halfway,
  // a zoom climb folded, and a barrel roll
  if (mode === 'soar') return { pose: { ...base, flapL: .16, flapR: .16, flare: .45, tail: .9 }, roll: -.25 + Math.sin(t * .5) * .08, pitch: .04, spin: t * .5 };
  if (mode === 'fast') return { pose: { ...base, flapL: glide - .06, flapR: glide - .06, fold: .45 }, roll: Math.sin(t * .6) * .08, pitch: -.12 };
  if (mode === 'zoom') return { pose: { ...base, flapL: glide - .08, flapR: glide - .08, fold: .55, tail: .4 }, roll: 0, pitch: .55 };
  if (mode === 'barrel') { const u = (t % 2.6) / 1.4, e = u < 1 ? u * u * (3 - 2 * u) : 1; return { pose: { ...base, tail: .5 }, roll: -e * Math.PI * 2, pitch: .05 }; }
  if (mode === 'stoop') return { pose: { ...base, flapL: glide - .12, flapR: glide - .12, fold: .75 }, roll: 0, pitch: -.7 };
  if (mode === 'flare') return { pose: { ...base, flapL: .35, flapR: .35, flare: 1, legs: .9, tail: 1, tailPitch: .3 }, roll: 0, pitch: .45 };
  return { pose: { ...base, flapL: .05, flapR: .05, fold: 1, flare: 0, legs: 1, tail: .05 }, roll: 0, pitch: .4, still: true };
}

// getMode(cell) names each cell's mode; active() false skips drawing (a menu that is shut)
export function startLab(canvas, cells, getMode, { active = () => true, eye = [0, .8, 1.75] } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return false;
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST);
  const P = program(gl, VS, FS), B = program(gl, BG_VS, BG_FS);
  const vao = gl.createVertexArray(), vbuf = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  for (const [loc, size, off] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 3, 36]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 48, off); }
  const bgVao = gl.createVertexArray(); gl.bindVertexArray(bgVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const sun = (() => { const v = [.4, .8, .45], l = Math.hypot(...v); return v.map(x => x / l); })();
  const t0 = performance.now();

  function frame() {
    if (!active()) { requestAnimationFrame(frame); return; }
    const dpr = Math.min(2, devicePixelRatio || 1), W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const cr = canvas.getBoundingClientRect(), t = (performance.now() - t0) / 1000;
    gl.scissor(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    cells.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < cr.top || r.top > cr.bottom || r.width < 2) return;
      const x = Math.round((r.left - cr.left) * dpr), y = Math.round((cr.bottom - r.bottom) * dpr), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      gl.viewport(x, y, w, h); gl.scissor(x, y, w, h);
      gl.useProgram(B.p); gl.uniform1f(B.u.uSeed, i * 5.3); gl.uniform1f(B.u.uShift, t * .15);
      gl.bindVertexArray(bgVao); gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.enable(gl.DEPTH_TEST);

      const id = el.dataset.bird || 'hawk', { pose, roll, pitch, still, spin = 0 } = poseAt(getMode(el), t + i * .37);
      const tris = id === 'hawk' ? buildHawk(pose) : buildBird(id, pose);
      // the bird faces a three-quarter view and the camera drifts round it
      const yaw = 2.1 + Math.sin(t * .25 + i) * .45 + spin, f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      const r0 = [Math.cos(yaw), 0, Math.sin(yaw)], u0 = [r0[1] * f[2] - r0[2] * f[1], r0[2] * f[0] - r0[0] * f[2], r0[0] * f[1] - r0[1] * f[0]];
      const c = Math.cos(roll), s = Math.sin(roll);
      const rr = [r0[0] * c - u0[0] * s, r0[1] * c - u0[1] * s, r0[2] * c - u0[2] * s], uu = [u0[0] * c + r0[0] * s, u0[1] * c + r0[1] * s, u0[2] * c + r0[2] * s];
      const bob = still ? 0 : Math.sin(t * 1.3 + i) * .03, model = basis([0, bob, 0], [-rr[0], -rr[1], -rr[2]], uu, f, HAWK_SCALE);
      const view = lookAt(eye, [0, -.04, 0], [0, 1, 0]), vp = mul(perspective(.75, w / h, .05, 50), view);
      gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.uniformMatrix4fv(P.u.uModel, false, model); gl.uniform3fv(P.u.uSun, sun);
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf); gl.bufferData(gl.ARRAY_BUFFER, tris, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, tris.length / 12);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return true;
}

export const LAB_BIRDS = ['hawk', ...Object.keys(BIRDS)];
export const nameOf = id => id === 'hawk' ? 'Red-tailed hawk' : BIRDS[id].name;
