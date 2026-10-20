// Looks: the frame is drawn into a texture and finished by one full-screen pass, per style.
//   plain        flat low-poly, haze, paper grain (no extra pass)
//   wash         Wet Wash in 3D: pigment pooling at edges, granulation, paper, light left bare
//   ink          pen and ink on cream paper: outlines, cross-hatched shadow, a sepia wash
//   cel          storybook cel: hard light bands, bold ink outlines, rich colour
//   layers       flat bands of distance, a banded sky, silhouettes in the near ground
//   woodblock    a Japanese woodblock print: a few flat inks, a dark keyline, wood grain, the sky graded
//   gouache      opaque gouache: colour laid in flat dabs (a Kuwahara filter), brush texture, matte
import { program, mesh } from './gl.js';

export const STYLES = [
  ['plain', 'Low poly'], ['wash', 'Watercolour'], ['ink', 'Pen and ink'], ['cel', 'Storybook cel'], ['layers', 'Layers'], ['woodblock', 'Woodblock print'], ['gouache', 'Gouache'],
];
export const STYLE_ID = Object.fromEntries(STYLES.map(([k], i) => [k, i]));

const VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUv;
void main() { vUv = aP * .5 + .5; gl_Position = vec4(aP, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform sampler2D uTex, uDepth; uniform vec2 uPx; uniform int uStyle; uniform float uNear, uFar, uScale;
uniform vec3 uPaper, uInk;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float lin(vec2 uv) { float d = texture(uDepth, uv).r * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - d * (uFar - uNear)); }
// how much the depth jumps around this pixel, relative to its distance: object outlines
float edge(vec2 uv, float w) {
  float c = lin(uv), e = 0.;
  e += abs(lin(uv + vec2(uPx.x, 0) * w) - c); e += abs(lin(uv - vec2(uPx.x, 0) * w) - c);
  e += abs(lin(uv + vec2(0, uPx.y) * w) - c); e += abs(lin(uv - vec2(0, uPx.y) * w) - c);
  return e / c;
}
float lum(vec3 c) { return dot(c, vec3(.3, .59, .11)); }
float colEdge(vec2 uv, float w) {
  float c = lum(texture(uTex, uv).rgb);
  return abs(lum(texture(uTex, uv + vec2(uPx.x, 0) * w).rgb) - c) + abs(lum(texture(uTex, uv + vec2(0, uPx.y) * w).rgb) - c);
}
// cold-pressed paper: fibres and a slow mottle
float paper(vec2 fc) { return .93 + .045 * vn(fc / 2.2) + .035 * vn(fc / 23. + 5.) - .02 * vn(fc / 90.); }
void main() {
  vec2 uv = vUv, fc = gl_FragCoord.xy / uScale;
  vec3 c;
  if (uStyle == 1) {
    // watercolour: the image wavers a touch where wet edges ran, pigment pools at edges,
    // granulates in the darks, and the brightest passages lift to bare paper
    vec2 wob = (vec2(vn(fc / 30.), vn(fc / 30. + 9.)) - .5) * uPx * 9.;
    c = texture(uTex, uv + wob).rgb;
    c = mix(uPaper, c, .8);                                         // dilute washes over paper
    c = floor(c * 7. + vn(fc / 18.) * .8) / 7. * .35 + c * .65;     // laid in a few washes
    float e = min(1., edge(uv + wob, 2.) * 7. + colEdge(uv + wob, 2.) * 2.);
    c = mix(c, c * c * 1.2, smoothstep(.06, .5, e) * .8);           // pigment pooled at the edges
    float L = lum(c), g = vn(fc / 2.4) * .5 + vn(fc / 6.5) * .5;
    c *= 1. - (1. - L) * (g - .5) * .55;                             // granulation in the darks
    c *= .93 + .14 * vn(fc / 70. + 3.);                              // blooms and back-runs
    c *= mix(vec3(1.), vec3(1.05, 1., .9), vn(fc / 160.));
    c = mix(c, uPaper, smoothstep(.72, .95, L) * .7);                // light is bare paper
    c *= paper(fc);
  } else if (uStyle == 2) {
    // pen and ink: outlines, hatching that thickens into the shadows, a thin sepia wash
    c = texture(uTex, uv).rgb;
    float L = lum(c), e = edge(uv, 1.) * 8. + colEdge(uv, 1.) * 1.2;
    float j = (vn(fc / 6.) - .5) * 2.5;
    float h1 = step(.62, fract((fc.x + fc.y + j) / 5.)), h2 = step(.62, fract((fc.x - fc.y + j) / 5.)), h3 = step(.7, fract((fc.y + j) / 3.5));
    float ink = smoothstep(.25, .6, e) * .9;
    ink = max(ink, h1 * smoothstep(.62, .5, L) * .7);
    ink = max(ink, h2 * smoothstep(.45, .33, L) * .75);
    ink = max(ink, h3 * smoothstep(.28, .18, L) * .8);
    vec3 wash = mix(uInk, uPaper, .55 + .45 * smoothstep(.1, .85, L));
    c = mix(wash, uInk, ink) * paper(fc);
  } else if (uStyle == 3) {
    // cel: bolder colour and a dark outline round every shape
    c = texture(uTex, uv).rgb;
    c = clamp(mix(vec3(lum(c)), c, 1.3), 0., 1.);
    float e = edge(uv, 1.6) * 7.;
    c = mix(c, c * .22 + uInk * .1, smoothstep(.35, .7, e));
  } else if (uStyle == 5) {
    // woodblock: each ink a flat block, printed on soft paper with the grain of the wood showing
    // through, a dark keyline cut round shapes and slightly out of register
    vec2 reg = uPx * vec2(1.5, -1.), q = uPx * 1.5;
    c = (texture(uTex, uv).rgb * 2. + texture(uTex, uv + q).rgb + texture(uTex, uv - q).rgb
      + texture(uTex, uv + vec2(q.x, -q.y)).rgb + texture(uTex, uv - vec2(q.x, -q.y)).rgb) / 6.;   // soften grain before cutting tones
    float L = lum(c);
    vec3 ch = clamp(mix(vec3(L), c, 1.6), 0., 1.) / max(L, .05);     // hue, richer
    float t = floor(L * 4. + .5) / 4. * .9 + .08;                    // a few printed tones
    c = clamp(ch * t, 0., 1.);
    c = mix(c, c * vec3(.86, .95, 1.12), .5);                        // cooler, Prussian-leaning
    float far = smoothstep(.9, 1., lin(uv) / uFar * 1.1);           // sky: graded darker indigo at the top (bokashi)
    c = mix(c, mix(c, vec3(.16, .25, .45), smoothstep(.55, 1., uv.y) * .75), far);
    float grain = vn(vec2(fc.x / 40., fc.y / 2.5) + vn(fc / 60.) * 3.);
    c *= .9 + .12 * grain;                                           // wood grain in the flats
    float e = edge(uv + reg, 1.2) * 8. + colEdge(uv + reg, 1.2) * .5;
    c = mix(c, uInk * .6, smoothstep(.35, .65, e) * .95);            // keyline
    c = mix(c, uPaper, .08) * paper(fc);
  } else if (uStyle == 6) {
    // gouache: a Kuwahara filter flattens colour into dabs (the calmest of four corners wins),
    // then a brush texture, a touch of chalky white and a matte finish
    vec2 d = uPx * 2.6;
    float ang = vn(fc / 26.) * 6.283;                                // the brush drags paint a little, this way and that
    uv += vec2(cos(ang), sin(ang)) * uPx * 2.5 * vn(fc / 7. + 4.);
    vec3 m[4]; float v[4];
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(k == 1 || k == 3 ? 1. : -1., k > 1 ? 1. : -1.);
      vec3 s = vec3(0.), s2 = vec3(0.);
      for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) { vec3 q = texture(uTex, uv + o * vec2(i, j) * d).rgb; s += q; s2 += q * q; }
      m[k] = s / 9.; vec3 var = s2 / 9. - m[k] * m[k]; v[k] = var.r + var.g + var.b;
    }
    c = m[0]; float best = v[0];
    for (int k = 1; k < 4; k++) if (v[k] < best) { best = v[k]; c = m[k]; }
    c = clamp(mix(vec3(lum(c)), c, 1.25), 0., 1.);                   // pigment straight from the tube
    float sa = vn(fc / 45. + 7.) * 6.283;                            // brush marks: short dabs whose direction wanders
    vec2 sp = mat2(cos(sa), sin(sa), -sin(sa), cos(sa)) * fc;
    float stroke = vn(vec2(sp.x / 9., sp.y / 2.2)) - .5;
    c *= 1. + stroke * .1;
    c = mix(c, vec3(lum(c)) * vec3(1.04, 1., .93) + .06, .1);        // opaque, chalky
    c = mix(c, uPaper * 1.02, smoothstep(.7, .9, lum(c)) * .35);     // highlights laid on in light paint
    float e = edge(uv, 1.5) * 6.;
    c = mix(c, c * .78, smoothstep(.4, .9, e) * .6);                 // a soft darker edge where one dab meets another
    c *= .96 + .04 * vn(fc / 1.8);
  } else {
    c = texture(uTex, uv).rgb;
    float v = length(uv - .5); c *= 1. - v * v * .35;   // layers: a soft vignette
  }
  frag = vec4(c, 1.);
}`;

export function createPost(gl) {
  const prog = program(gl, VS, FS), tri = mesh(gl, new Float32Array([-1, -1, 3, -1, -1, 3]), [[0, 2]]);
  let fbo = null, tex = null, depth = null, w = 0, h = 0, filter = 0;
  const P = { w: 0, h: 0 };
  // the target the scene is drawn into, sized for the style
  P.begin = (cw, ch, style) => {
    const tw = Math.max(1, cw), th = Math.max(1, ch), f = gl.LINEAR;
    if (!fbo || tw !== w || th !== h || f !== filter) {
      if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); gl.deleteTexture(depth); }
      w = tw; h = th; filter = f;
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [k2, v] of [[gl.TEXTURE_MIN_FILTER, f], [gl.TEXTURE_MAG_FILTER, f], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k2, v);
      depth = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      for (const [k2, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k2, v);
      fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    P.w = w; P.h = h;
    return [w, h];
  };
  P.end = (cw, ch, style, near, far, scale) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, depth); gl.uniform1i(prog.u.uDepth, 1);
    gl.uniform2f(prog.u.uPx, 1 / w, 1 / h); gl.uniform1i(prog.u.uStyle, STYLE_ID[style]);
    gl.uniform1f(prog.u.uNear, near); gl.uniform1f(prog.u.uFar, far); gl.uniform1f(prog.u.uScale, scale);
    gl.uniform3f(prog.u.uPaper, .965, .945, .9); gl.uniform3f(prog.u.uInk, .23, .14, .09);
    gl.bindVertexArray(tri.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
  };
  return P;
}
