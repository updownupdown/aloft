// Clouds and mist as soft volumes instead of see-through polygons (Settings > Picture > Clouds;
// the polygons stay as the fallback, 'poly').
// A cloud is a few lobes: ellipsoids whose density falls from 1 at the core to 0 at the rim
// (1 - r²). It is drawn on the inside of a box round its lobes, and each pixel adds up how much
// cloud its view ray passes through, exactly: the integral of a lobe along a line is a cubic, so
// there are no steps to march. A cloud thins at its edges and thickens in its heart, has no
// inner faces, and can be flown into. The box's far faces carry the depth test, so a pixel only
// draws where the whole stretch of ray inside the box is in front of the land.
// Lit from the lobe the ray meets first, the way the polygons are: a bright sunny side, a grey
// flat base, a silver rim against the sun. Styles: 'soft' (smooth light), 'facet' (the normal
// snapped to a few directions, so the light falls in low-poly facets on a soft-edged cloud),
// 'billow' (the rim broken up by a drifting 3D noise).
// Mist (fog lying in the valleys, sea fog, the sea of cloud) is a height layer worked into every
// lit pixel's haze (render.js COMMON_FS mist()): even fog up to a lumpy top, thinning above, the
// amount along the view ray integrated exactly; and over the sky where the camera is in it.
import { program, mesh } from './gl.js';
import { GRADE_GLSL } from './look.js';

// lobes [x, y, z, rx, ry, rz] in each shape's own units (the instance scales and yaws it), laid
// as the polygon shapes' blobs are (shapes.js cloud, weather.js storm and puff, faunashapes.js
// lens); base: the flat underside (local y), sigma: how thick a metre of core is, col: lit, under
export const KINDS = {
  cloud: { base: -.06, sigma: .085, col: [.98, .97, .95], under: [.8, .81, .85],
    lobes: [[0, .35, 0, .65, .55, .65], ...[1, 2, 3, 4, 5, 6].map(i => { const a = i / 7 * Math.PI * 2; return [Math.cos(a) * .55, .1, Math.sin(a) * .55 * .7, .5 + (i % 3) * .06, .45, .5 + (i % 2) * .08]; })] },
  storm: { base: -.05, sigma: .06, col: [.78, .78, .8], under: [.36, .37, .42],
    lobes: [
      ...Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2, r = i ? .6 : 0; return [Math.cos(a) * r, .15, Math.sin(a) * r, .5, .3, .5]; }),
      ...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + .3; return [Math.cos(a) * .35, .65 + i * .08, Math.sin(a) * .35, .45, .4, .45]; }),
      ...Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2; return [.3 + Math.cos(a) * .7, 1.35, Math.sin(a) * .55, .55, .15, .42]; })] },
  lens: { base: -9, sigma: .07, col: [.98, .96, .94], under: [.82, .8, .84],
    lobes: [[0, 0, 0, 1.7, .16, 1], [.1, .13, 0, 1.2, .09, .71], [-.05, -.1, .05, 1.2, .1, .8]] },
  puff: { base: -9, sigma: .06, col: [.97, .96, .94], under: [.86, .86, .88],
    lobes: [[0, 0, 0, .7, .22, .7], [.45, .05, .2, .45, .18, .45], [-.4, .04, -.25, .5, .2, .5]] },
  // the look tests (look.js G, H): a ring of mist (sys/rings.js, its radius the scale), a rain shaft
  // hanging from a cloud's base to the ground (sys/weather.js, its height the scale)
  ringv: { base: -9, sigma: .16, col: [1, 1, .98], under: [.92, .92, .94],
    lobes: Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2, w = .17 + .05 * Math.sin(i * 2.3); return [Math.cos(a), Math.sin(a), Math.sin(i * 1.7) * .05, w, w, w * .9]; }) },
  shaft: { base: -9, sigma: .022, col: [.66, .68, .74], under: [.55, .57, .63],
    lobes: [[0, .5, 0, .09, .52, .09], [.05, .34, .04, .07, .36, .07], [-.04, .62, -.03, .08, .42, .08], [.02, .15, -.05, .06, .2, .06]] },
};
const MAXL = 24;
export const STYLES = ['poly', 'soft', 'facet', 'billow'];

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=4) in vec4 iA; layout(location=5) in vec4 iB;
uniform mat4 uVP;
out vec3 vPos; flat out vec4 vI; flat out vec3 vY;
void main() {
  float c = cos(iB.x), s = sin(iB.x);
  vec3 p = aPos * iA.w; p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  vPos = p + iA.xyz; vI = iA; vY = vec3(c, s, iB.y);
  gl_Position = uVP * vec4(vPos, 1.);
}`;
const FS = `#version 300 es
precision highp float; precision highp sampler3D;
uniform vec3 uCam, uSun, uSunCol, uSkyAmb, uGndAmb, uFogCol, uCol, uUnder;
uniform float uFogDen, uTime, uStyle;
uniform vec4 uFlash;   // lightning inside the clouds (look.js H): where, how bright
#ifdef L_POST
uniform sampler2D uDepth; uniform vec2 uDSize, uNF; uniform vec3 uFwd;   // the world's depth (look.js Q): the clouds stop at the land
#endif
${GRADE_GLSL}
uniform vec4 uK;   // lobes, base, sigma, the light's strength (0 at night .. 1)
uniform vec4 uC[${MAXL}], uR[${MAXL}];
uniform sampler3D uNoise;
in vec3 vPos; flat in vec4 vI; flat in vec3 vY;
out vec4 frag;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 rd = normalize(vPos - uCam), o = (uCam - vI.xyz) / vI.w;
  float c = vY.x, s = vY.y;
  // into the cloud's own frame (unyawed, unscaled: a local t is vI.w metres)
  vec3 lo = vec3(c * o.x + s * o.z, o.y, -s * o.x + c * o.z), ld = vec3(c * rd.x + s * rd.z, rd.y, -s * rd.x + c * rd.z);
  float tA = 0., tB = length(vPos - uCam) / vI.w + 1e-3;
#ifdef L_POST
  { float z = texture(uDepth, gl_FragCoord.xy / uDSize).r * 2. - 1., lin = 2. * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x));
    tB = min(tB, lin / max(dot(rd, uFwd), .05) / vI.w); }
#endif
  // a flat base: only cloud above it
  bool fromBelow = false;
  if (abs(ld.y) > 1e-5) { float tb = (uK.y - lo.y) / ld.y; if (ld.y > 0.) { fromBelow = tb > 0.; tA = max(tA, tb); } else tB = min(tB, tb); }
  else if (lo.y < uK.y) discard;
  if (tB <= tA) discard;
  float tau = 0., tn = 1e9, wsum = 0.; vec3 n = vec3(0.);
  int N = int(uK.x);
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= N) break;
    vec3 iv = uR[i].xyz, q = (lo - uC[i].xyz) * iv, e = ld * iv;
    float a = dot(e, e), b = dot(q, e), cc = dot(q, q) - 1., h = b * b - a * cc;
    if (h <= 0.) continue;
    h = sqrt(h);
    float t1 = max((-b - h) / a, tA), t2 = min((-b + h) / a, tB);
    if (t2 <= t1) continue;
    // the integral of 1 - |q + e t|² from t1 to t2
    float I = -(cc * (t2 - t1) + b * (t2 * t2 - t1 * t1) + a * (t2 * t2 * t2 - t1 * t1 * t1) / 3.);
    tau += I;
    // the lobe's outward normal where the ray goes in; the nearer lobes show
    vec3 nl = (fromBelow && t1 <= tA + 1e-4) ? vec3(0., -1., 0.) : normalize((q + e * t1) * iv);
    float w = I * exp(-(t1 - tA) * 3.);
    n += nl * w; wsum += w; tn = min(tn, t1);
  }
  if (tau <= 1e-5) discard;
  n = normalize(n / wsum);
  bool facets = uStyle > .5 && uStyle < 1.5;
  if (facets) n = normalize(floor(n * 1.15 + .5) + n * .2);   // snapped to a few ways, in the cloud's own frame, so they turn with it
  // back to the world's frame
  n = vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z);
  vec3 hit = uCam + rd * (tn * vI.w);
  float od = tau * vI.w * uK.z * (.7 + vY.z * .6);   // the optical depth, thicker for a denser tint
  float alpha = 1. - exp(-od);
  vec3 lp = lo + ld * tn;   // where the ray goes in, in the cloud's frame
  float nz = .5;
  if (uStyle > 1.5) {
    // billows: a slow 3D noise eats into the thin rim and mottles the light
    vec3 np = hit / 46. + vec3(uTime * .004, uTime * .002, 0.);
    nz = texture(uNoise, np).r * .65 + texture(uNoise, np * 2.7 + .3).r * .35;
    alpha = smoothstep(nz * .55, nz * .55 + .45, alpha);
    n = normalize(n + (vec3(texture(uNoise, np + vec3(.31, 0., 0.)).r, 0., texture(uNoise, np + vec3(0., 0., .53)).r) - .5) * .8);
  }
  if (alpha < .004) discard;
  // light: wrapped sun, the sky's and the ground's ambient, a grey base and a darker heart
  float d = dot(n, uSun), wrap = max((d + .45) / 1.45, 0.);
  if (facets) wrap = floor(wrap * 4. + .5) / 4.;
  float low = smoothstep(uK.y + .55, uK.y, lp.y);
  vec3 col = mix(uCol, uUnder, low * .65 + (1. - exp(-od * .35)) * .2);
  // (light scatters about inside a cloud, so even its shaded side and base take much of the
  // sun, and the sky's light from every side; inside one it is an even bright grey)
  float inside = step(tA, 1e-4) * step(tn, 1e-4);
  wrap = mix(wrap, .55, inside);
  vec3 lit = col * (uSkyAmb * 1.1 + uGndAmb * .15 + uSunCol * (.4 + .6 * wrap));
  // the silver rim: thin cloud between you and the sun glows
  float rim = pow(max(dot(rd, uSun), 0.), 5.) * exp(-od * .9);
  lit += uSunCol * rim * .7 * uK.w;
  if (uStyle > 1.5) lit *= .93 + .14 * nz;
#ifdef L_WEATHER
  lit += vec3(.85, .88, 1.) * uFlash.w * exp(-length(hit - uFlash.xyz) / 380.) * 1.6;
#endif
  // inside a cloud the first few metres stay thin, so you can still see your wings
  alpha *= mix(1., .9, inside);
  // haze toward the horizon, as the land has
  float hd = length(hit - uCam) * mix(1., .2, smoothstep(20., 250., hit.y));
  lit = mix(lit, uFogCol, 1. - exp(-pow(hd * uFogDen, 1.6)));
  lit = grade(lit) * (.965 + .05 * h21(floor(gl_FragCoord.xy)));
  frag = vec4(lit * alpha, alpha);
}`;
// the mist over the sky: drawn at the back like the sky, only where the camera is in or under it
const MIST_VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vP;
void main() { vP = aP; gl_Position = vec4(aP, 1., 1.); }`;
const MIST_FS = `#version 300 es
precision highp float;
in vec2 vP; out vec4 frag;
uniform mat4 uInvVP; uniform vec3 uCam, uMistCol; uniform vec4 uMist;
${GRADE_GLSL}
void main() {
  vec4 a = uInvVP * vec4(vP, -1., 1.), b = uInvVP * vec4(vP, 1., 1.);
  vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  float u = max(uMist.x - uCam.y, 0.), R = uMist.z;
  // from the camera up out of the layer, through its soft top (render.js mist())
  float tau = uMist.y * (u < R ? u * u / (2. * R) : u - R * .5) / max(d.y, .02);
  if (d.y < 0.) tau = uMist.y * 2000.;
  float k = 1. - exp(-tau);
  frag = vec4(grade(uMistCol) * k, k);
}`;

// a 32³ tiling value noise, two octaves (for the billows)
function noise3(gl) {
  const N = 32, g = new Float32Array(N * N * N), d = new Uint8Array(N * N * N);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y, z, P) => g[((x % P + P) % P) * (N / P) + ((y % P + P) % P) * (N / P) * N + ((z % P + P) % P) * (N / P) * N * N];
  const sm = t => t * t * (3 - 2 * t);
  const vn = (x, y, z, P) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
    let v = 0;
    for (let k = 0; k < 8; k++) { const ox = k & 1, oy = k >> 1 & 1, oz = k >> 2; v += at(xi + ox, yi + oy, zi + oz, P) * (ox ? fx : 1 - fx) * (oy ? fy : 1 - fy) * (oz ? fz : 1 - fz); }
    return v;
  };
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    d[x + y * N + z * N * N] = Math.round((vn(x / 4, y / 4, z / 4, 8) * .65 + vn(x / 2, y / 2, z / 2, 16) * .35) * 255);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, N, N, N, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

// the box round each kind's lobes, as triangles in render.js's vertex layout (12 floats)
function box(lobes, base) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const [x, y, z, a, b, c] of lobes) { const p = [x, y, z], r = [a, b, c]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - r[k]); hi[k] = Math.max(hi[k], p[k] + r[k]); } }
  lo[1] = Math.max(lo[1], base - .02);
  for (let k = 0; k < 3; k++) { const m = (hi[k] - lo[k]) * .02; lo[k] -= m; hi[k] += m; }
  const P = i => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]];
  const F = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]], out = [];
  // wound clockwise seen from outside, so culling back faces keeps the far, inner side
  const v = p => out.push(...p, 0, 1, 0, 1, 1, 1, 1, 1, 1);
  for (const [a, b, c, d] of F) { v(P(a)); v(P(b)); v(P(c)); v(P(a)); v(P(c)); v(P(d)); }
  return new Float32Array(out);
}

export function createClouds(gl) {
  let prog = program(gl, VS, FS), mistP = program(gl, MIST_VS, MIST_FS);
  const tex = noise3(gl);
  const LAYOUT = [[0, 3], [1, 3], [2, 3], [3, 3]], ILAYOUT = [[4, 4], [5, 4]];
  const kinds = {};
  for (const [k, K] of Object.entries(KINDS)) {
    const C = new Float32Array(MAXL * 4), Rr = new Float32Array(MAXL * 4);
    K.lobes.forEach(([x, y, z, a, b, c], i) => { C.set([x, y, z, 0], i * 4); Rr.set([1 / a, 1 / b, 1 / c, 0], i * 4); });
    kinds[k] = { K, C, Rr, m: mesh(gl, box(K.lobes, K.base), LAYOUT, { instLayout: ILAYOUT }) };
  }
  let sorted = new Float32Array(1024);
  const CL = {
    has: key => !!kinds[key],
    // built again with the look tests' #defines (render.js compile)
    relook(d) {
      gl.deleteProgram(prog.p); gl.deleteProgram(mistP.p);
      const D = src => src.replace('#version 300 es', '#version 300 es\n' + d);
      prog = program(gl, VS, D(FS)); mistP = program(gl, MIST_VS, D(MIST_FS));
    },
    // the volumes, after everything solid and the sky; props: S.props (the same 8 floats a cloud
    // instance has always had)
    // (flip: drawn mirrored, look.js T, so the boxes' inside is the other winding; post: the world's
    // depth to stop at, look.js Q)
    draw(S, vp, props, style, flip = false, post = null) {
      const list = [];
      for (const key in props) if (kinds[key]) { const d = props[key]; for (let i = 0; i < d.length; i += 8) list.push([key, i, (d[i] - S.cam[0]) ** 2 + (d[i + 1] - S.cam[1]) ** 2 + (d[i + 2] - S.cam[2]) ** 2]); }
      if (!list.length) return 0;
      // farthest first, so nearer clouds lay over farther ones; runs of one kind go in one draw
      list.sort((a, b) => b[2] - a[2]);
      gl.useProgram(prog.p);
      const u = prog.u;
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCam, S.cam); gl.uniform3fv(u.uSun, S.sun); gl.uniform3fv(u.uSunCol, S.sunCol);
      gl.uniform3fv(u.uSkyAmb, S.skyAmb); gl.uniform3fv(u.uGndAmb, S.gndAmb); gl.uniform3fv(u.uFogCol, S.horizon); gl.uniform1f(u.uFogDen, S.fogDen);
      gl.uniform1f(u.uTime, S.time); gl.uniform1f(u.uStyle, STYLES.indexOf(style) - 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, tex); gl.uniform1i(u.uNoise, 0);
      if (u.uGradeT) gl.uniform3fv(u.uGradeT, S.gradeT || [1, 1, 1]);
      if (u.uFlash) gl.uniform4fv(u.uFlash, S.flash || [0, 0, 0, 0]);
      if (u.uDepth) gl.uniform1i(u.uDepth, 1);   // (never on the noise's unit)
      if (post && u.uDepth) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, post.tex); gl.uniform1i(u.uDepth, 1); gl.activeTexture(gl.TEXTURE0); gl.uniform2fv(u.uDSize, post.size); gl.uniform2fv(u.uNF, post.nf); gl.uniform3fv(u.uFwd, post.fwd); }
      // the inside of each box: its far faces, tested against the land's depth
      gl.enable(gl.CULL_FACE); gl.cullFace(flip ? gl.FRONT : gl.BACK);   // (box() winds its faces inward)
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      const tint = S.cloud || [1, 1, 1], day = S.daylight ?? 1;
      let tris = 0;
      for (let i = 0; i < list.length;) {
        const key = list[i][0]; let j = i;
        while (j < list.length && list[j][0] === key) j++;
        const n = (j - i) * 8; if (sorted.length < n) sorted = new Float32Array(n * 2);
        const d = props[key];
        for (let q = i; q < j; q++) sorted.set(d.subarray ? d.subarray(list[q][1], list[q][1] + 8) : d.slice(list[q][1], list[q][1] + 8), (q - i) * 8);
        const { K, C, Rr, m } = kinds[key];
        gl.uniform4fv(u.uC, C); gl.uniform4fv(u.uR, Rr); gl.uniform4f(u.uK, K.lobes.length, K.base, K.sigma, day);
        gl.uniform3fv(u.uCol, K.col.map((v, k) => v * (.55 + .45 * tint[k]))); gl.uniform3fv(u.uUnder, K.under.map((v, k) => v * (.55 + .45 * tint[k])));
        gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf); gl.bufferData(gl.ARRAY_BUFFER, sorted.subarray(0, n), gl.DYNAMIC_DRAW);
        gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, j - i); tris += m.count / 3 * (j - i);
        i = j;
      }
      gl.disable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS);
      return tris;
    },
    // the mist over the sky (where nothing solid was drawn), when the camera is in or near it
    sky(S, inv, tri) {
      const M = S.mistU; if (!M || M[1] <= 0 || S.cam[1] > M[0] + M[3]) return;
      gl.useProgram(mistP.p);
      gl.uniformMatrix4fv(mistP.u.uInvVP, false, inv); gl.uniform3fv(mistP.u.uCam, S.cam); gl.uniform3fv(mistP.u.uMistCol, S.mistCol); gl.uniform4fv(mistP.u.uMist, M);
      if (mistP.u.uGradeT) gl.uniform3fv(mistP.u.uGradeT, S.gradeT || [1, 1, 1]);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.bindVertexArray(tri.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS);
    },
  };
  return CL;
}

// The mist layer for this frame from what the systems asked for (S.mists: [top, density, lump]):
// the densest wins, its top the highest of those near it. Sets S.mistU (top, density, the thinning
// above in metres, the lumps of the top) and S.mistCol (white lit by the sky and sun).
export function mistOf(S) {
  const L = S.mists; S.mistU = [0, 0, 8, 0];
  if (!L?.length) return;
  let best = L[0];
  for (const m of L) if (m[1] > best[1]) best = m;
  S.mistU = [best[0], best[1], best[3] ?? 7, best[2] ?? 8];
  const day = S.daylight ?? 1, c = S.cloud || [1, 1, 1];
  S.mistCol = [0, 1, 2].map(k => Math.min(1, c[k] * (S.skyAmb[k] * .75 + S.sunCol[k] * .55) * (.6 + .4 * day) + S.horizon[k] * .15));
}
