// Rain (James, 10-24: the rain study's A with C, and B far off in a downpour): thousands of short,
// thin, faint drops at every depth round the camera, each placed by the GPU from its own number
// (no per-drop work here), streaked along how it moves past the lens; and in a downpour, veils of
// long faint streaks far off, thicker in bands that drift with the wind. Where the rain lands
// (rings on the water, splashes on the ground) is render.js waterAt and sys/weather.js.
// S.rainU: { k (0..1 the drizzle), veil (0..1), col, wind [x, z] m/s }.
import { program } from './gl.js';

const RAIN = { near: 26, height: 14, n: 3600, fall: 8.5, far: [170, 900], farN: 5000, farLen: 22, period: 600 };

const VS = `#version 300 es
uniform mat4 uVP; uniform vec3 uCam, uO, uVel; uniform vec2 uWind;
uniform float uTime, uR, uR0, uY, uY0, uY1, uLen, uA, uFar, uFog;
out float vA;
float h(float n, float s) { return fract(sin(n * 12.9898 + s * 78.233) * 43758.5453); }
float hh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float id = float(gl_VertexID / 2), end = float(gl_VertexID % 2);
  vec3 fall = vec3(uWind.x, -${RAIN.fall.toFixed(1)}, uWind.y), rel;
  if (uFar < .5) {
    // the near drops: a box round the camera they fall through and wrap round in, so each stays
    // put in the world as you fly
    vec3 s = vec3(h(id, 1.), h(id, 3.), h(id, 2.)) * vec3(2. * uR, 2. * uY, 2. * uR) + fall * uTime;
    rel = mod(s - uCam + vec3(uR, uY, uR), vec3(2. * uR, 2. * uY, 2. * uR)) - vec3(uR, uY, uR);
  } else {
    // the far veils: a ring round the camera, from the ground up past it
    float a = h(id, 1.) * 6.2832, r = mix(uR0, uR, sqrt(h(id, 2.)));
    float y = uY0 + mod(h(id, 3.) * (uY1 - uY0) + fall.y * uTime, uY1 - uY0);
    rel = vec3(cos(a) * r, y - uCam.y, sin(a) * r);
  }
  // the streak: how the drop moves past the lens over about a thirtieth of a second
  vec3 v = fall - uVel, st = uFar < .5 ? v * min(.034, 1.2 / max(length(v), .1)) : normalize(fall) * uLen;
  vec3 p = uCam + rel - st * end;
  float d = length(rel);
  float a = uA * (.35 + .65 * h(id, 4.));
  if (uFar < .5) a *= smoothstep(.8, 3., d) * (1. - smoothstep(uR * .6, uR, d));   // none brushing the lens, fading out at the box's edge
  else {
    vec2 w = (uCam.xz + rel.xz) / 320. - uWind * uTime * .004;
    a *= smoothstep(.35, .75, vn(w) * .7 + vn(w * 2.7 + 5.) * .3);                  // thicker in bands
    a *= exp(-d * uFog) * smoothstep(uR0, uR0 * 1.5, d) * (1. - smoothstep(uR * .8, uR, d));
  }
  vA = a;
  gl_Position = uVP * vec4(p - uO, 1.);
}`;
const FS = `#version 300 es
precision mediump float;
in float vA; out vec4 frag; uniform vec3 uCol;
void main() { frag = vec4(uCol, vA); }`;

export function createRain(gl) {
  const P = program(gl, VS, FS), vao = gl.createVertexArray();
  let last = null, vel = [0, 0, 0];
  return {
    // drawn among the see-through things (render.js, before the motes), blended, depth tested, not written
    draw(S, vpO, O, pf) {
      const U = S.rainU;
      const cam = S.cam;
      // the camera's own speed, eased (the streaks lean with it)
      if (last) { const dt = Math.max(1 / 240, S.time - last.t); if (dt < .5 && Math.abs(cam[0] - last.c[0]) + Math.abs(cam[2] - last.c[2]) < 200) {
        for (let k = 0; k < 3; k++) vel[k] += ((cam[k] - last.c[k]) / dt - vel[k]) * Math.min(1, dt * 5);
        const sp = Math.hypot(...vel); if (sp > 30) for (let k = 0; k < 3; k++) vel[k] *= 30 / sp;   // (a jump is not a speed)
      } }
      last = { t: S.time, c: [...cam] };
      if (!U || (U.k < .01 && U.veil < .01)) return 0;
      pf?.pass('rain');
      gl.useProgram(P.p); gl.bindVertexArray(vao);
      const u = P.u, t = S.time % RAIN.period;
      gl.uniformMatrix4fv(u.uVP, false, vpO); gl.uniform3fv(u.uCam, cam); gl.uniform3fv(u.uO, O); gl.uniform3fv(u.uVel, vel);
      gl.uniform2fv(u.uWind, U.wind); gl.uniform1f(u.uTime, t); gl.uniform3fv(u.uCol, U.col);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      let n = 0;
      if (U.k > .01) {
        const N = Math.round(RAIN.n * Math.min(1, U.k * 1.3));
        gl.uniform1f(u.uFar, 0); gl.uniform1f(u.uR, RAIN.near); gl.uniform1f(u.uY, RAIN.height); gl.uniform1f(u.uA, .16 + .22 * U.k);
        gl.drawArrays(gl.LINES, 0, N * 2); n += N;
      }
      if (U.veil > .01) {
        const N = Math.round(RAIN.farN * U.veil);
        gl.uniform1f(u.uFar, 1); gl.uniform1f(u.uR0, RAIN.far[0]); gl.uniform1f(u.uR, RAIN.far[1]); gl.uniform1f(u.uLen, RAIN.farLen);
        gl.uniform1f(u.uY0, Math.max(0, cam[1] - 500)); gl.uniform1f(u.uY1, Math.max(cam[1] + 160, 420)); gl.uniform1f(u.uA, .3 * U.veil); gl.uniform1f(u.uFog, (S.fogDen || .004) * .45);
        gl.drawArrays(gl.LINES, 0, N * 2); n += N;
      }
      return n;   // (blending stays on, depth unwritten: the motes come next, render.js)
    },
  };
}
