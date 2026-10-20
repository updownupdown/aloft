// Draws a 3D frame: sky, ground chunks, instanced trees and rings, the hawk and its shadow,
// water, thermal motes. One lit shader with two-sided faces, hemisphere light, haze toward the
// horizon colour and a paper grain, so it stays in Aloft's palette at very little cost.
import { program, mesh, perspective, lookAt, mul, basis, IDENT } from './gl.js';
import { CHUNK, chunkMesh, treesNear, ringsNear, height, normalAt, thermalsNear, thermalCentre, TREE, perchesOf } from './world.js';
import { ring, cloud, TREE_LOOKS } from './shapes.js';
import { buildHawk, HAWK_SCALE } from './hawk.js';

// instanced shapes that are cloud: see-through when the camera is close or inside
const CLOUDY = new Set(['cloud', 'storm', 'puff', 'lens']);
const COMMON_FS = `
uniform vec3 uCam, uSun, uSunCol, uSkyAmb, uGndAmb, uFogCol, uFocus;
uniform float uFogDen, uDither;
in vec3 vPos, vNrm, vCol, vColB; in float vLeaf;
out vec4 frag;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 shade(vec3 col, vec3 n) {
  float d = dot(n, uSun), wrap = max((d + .3) / 1.3, 0.);
  vec3 amb = mix(uGndAmb, uSkyAmb, n.y * .5 + .5);
  return col * (amb + uSunCol * wrap);
}
vec3 haze(vec3 c) {
  float d = length(vPos - uCam);
  float f = 1. - exp(-pow(d * uFogDen, 1.6));
  return mix(c, uFogCol, f);
}
float grain() { return .965 + .05 * h21(floor(gl_FragCoord.xy)); }
`;
const LIT_FS = `#version 300 es
precision highp float;
${COMMON_FS}
void main() {
  if (uDither > 1.5) {
    // clouds: thin to a screen as the camera nears them, almost gone inside one
    float k = mix(.08, 1., smoothstep(10., 90., length(vPos - uCam)));
    ivec2 q = ivec2(gl_FragCoord.xy) & 3; int i = q.x + q.y * 4;
    float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    if (k < .99 && (bayer[i] + .5) / 16. > k) discard;
  } else if (uDither > .5) {
    // see-through near the camera, on a wide line to the hawk and round the hawk itself, so
    // leaves never hide it and you can see the gaps you are flying into
    vec3 ab = uFocus - uCam, ap = vPos - uCam; float t = clamp(dot(ap, ab) / dot(ab, ab), 0., 1.);
    float dl = length(ap - ab * t), dc = length(ap), dh = length(vPos - uFocus);
    float k = min(min(smoothstep(3.5, 10., dl) + step(.98, t), smoothstep(6., 18., dc)), mix(.12, 1., smoothstep(3., 15., dh)));
    // only leaves go see-through: trunks and limbs stay solid so you can see what to land on
    if (k < .99 && vLeaf > .5) {   // leaves, marked by the vertex shader before the autumn turn
      // an ordered 4x4 dither reads as a soft screen rather than noise
      ivec2 q = ivec2(gl_FragCoord.xy) & 3;
      int i = q.x + q.y * 4;
      float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      if ((bayer[i] + .5) / 16. > k) discard;
    }
  }
  vec3 n = normalize(vNrm), col = vCol;
  if (!gl_FrontFacing) { n = -n; col = vColB; }
  vec3 c = shade(col, n);
  if (vPos.y < 0.) c = mix(c, vec3(.16, .3, .36) * (uSkyAmb + uSunCol * .5), clamp(-vPos.y / 5., 0., .85));
  frag = vec4(haze(c) * grain(), 1.);
}`;
const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
uniform mat4 uVP, uModel;
out vec3 vPos, vNrm, vCol, vColB; out float vLeaf;
void main() {
  vec4 w = uModel * vec4(aPos, 1.);
  vPos = w.xyz; vNrm = mat3(uModel) * aNrm; vCol = aCol; vColB = aColB; vLeaf = 0.;
  gl_Position = uVP * w;
}`;
const INST_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
layout(location=4) in vec4 iA; layout(location=5) in vec4 iB;
uniform mat4 uVP; uniform float uTime, uSway; uniform vec3 uAutumn;

out vec3 vPos, vNrm, vCol, vColB; out float vLeaf;
void main() {
  float c = cos(iB.x), s = sin(iB.x);
  vec3 p = aPos * iA.w;
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  float sway = sin(uTime * 1.1 + iB.w) * aPos.y * aPos.y * uSway * iA.w;
  p.x += sway; p.z += sway * .6;
  vPos = p + iA.xyz;
  vec3 n = aNrm; n.xz = vec2(c * n.x - s * n.z, s * n.x + c * n.z); vNrm = n;
  // leaves (greenish vertices) take a per-tree tint and the season's turn
  float leafy = step(aCol.r * 1.05, aCol.g);
  vec3 col = aCol * (.88 + iB.y * .24);
  col = mix(col, uAutumn * (.85 + iB.y * .3), leafy * clamp(iB.z, 0., 1.));
  vCol = col; vColB = col; vLeaf = leafy;
  gl_Position = uVP * vec4(vPos, 1.);
}`;
const SKY_VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vP;
void main() { vP = aP; gl_Position = vec4(aP, .9999, 1.); }`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vP; out vec4 frag;
uniform mat4 uInvVP; uniform vec3 uZenith, uHorizon, uSun, uSunCol, uCloud; uniform float uNight, uTime;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec4 a = uInvVP * vec4(vP, -1., 1.), b = uInvVP * vec4(vP, 1., 1.);
  vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  float up = max(d.y, 0.);
  vec3 c = mix(uHorizon, uZenith, pow(up, .55));
  float sd = max(dot(d, uSun), 0.);
  c += uSunCol * (pow(sd, 12.) * .25 + pow(sd, 900.) * 1.2) * (1. - uNight * .6);
  if (d.y > .02) {
    vec2 q = d.xz / (d.y + .08) * 1.6 + vec2(uTime * .004, 0.);
    float n = vn(q) * .6 + vn(q * 2.3 + 7.) * .3 + vn(q * 5.1 + 3.) * .1;
    float cl = smoothstep(.52, .78, n) * smoothstep(.02, .25, d.y);
    c = mix(c, uCloud, cl * .3);   // only faint high haze: the clouds themselves are meshes (sys/air.js)
    if (uNight > 0.) { vec2 g = floor(d.xz / (d.y + .3) * 140.); float st = step(.996, h21(g)) * (1. - cl) * smoothstep(.05, .3, d.y);
      c += vec3(st) * uNight * (.6 + .4 * sin(uTime * 2. + h21(g + 3.) * 40.)); }
  }
  c *= .965 + .05 * h21(floor(gl_FragCoord.xy));
  frag = vec4(c, 1.);
}`;
const WATER_VS = `#version 300 es
layout(location=0) in vec2 aP; uniform mat4 uVP; uniform vec3 uCam; out vec3 vPos;
void main() { vPos = vec3(aP.x * 900. + uCam.x, 0., aP.y * 900. + uCam.z); gl_Position = uVP * vec4(vPos, 1.); }`;
const WATER_FS = `#version 300 es
precision highp float;
in vec3 vPos; out vec4 frag;
uniform vec3 uCam, uZenith, uHorizon, uSun, uSunCol, uFogCol, uSkyAmb; uniform float uFogDen, uTime;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 q = vPos.xz * .35;
  float e = .2, t = uTime * .6;
  float n0 = vn(q + t) + vn(q * 2.1 - t);
  vec3 nrm = normalize(vec3(n0 - vn(q + vec2(e, 0) + t) - vn((q + vec2(e, 0)) * 2.1 - t), 1.6, n0 - vn(q + vec2(0, e) + t) - vn((q + vec2(0, e)) * 2.1 - t)));
  vec3 v = normalize(uCam - vPos);
  float fr = .25 + .75 * pow(1. - max(dot(v, nrm), 0.), 3.);
  vec3 r = reflect(-v, nrm);
  vec3 sky = mix(uHorizon, uZenith, pow(max(r.y, 0.), .55));
  vec3 deep = vec3(.18, .34, .4) * (uSkyAmb + uSunCol * .6);
  vec3 c = mix(deep, sky, fr) + uSunCol * pow(max(dot(r, uSun), 0.), 120.) * .8;
  float d = length(vPos - uCam);
  c = mix(c, uFogCol, 1. - exp(-pow(d * uFogDen, 1.6)));
  c *= .965 + .05 * h21(floor(gl_FragCoord.xy));
  frag = vec4(c, mix(.72, .95, fr));
}`;
const FLAT_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform float uPx; out vec4 vC;
void main() { gl_Position = uVP * vec4(aP, 1.); vC = aC; gl_PointSize = uPx * aC.a * 2. / gl_Position.w; }`;
const FLAT_FS = `#version 300 es
precision highp float; in vec4 vC; out vec4 frag; uniform float uPoints;
void main() { float a = 1.; if (uPoints > .5) { vec2 d = gl_PointCoord - .5; a = smoothstep(.5, .2, length(d)); }
  frag = vec4(vC.rgb, a * (uPoints > .5 ? .8 : vC.a)); }`;

const LAYOUT = [[0, 3], [1, 3], [2, 3], [3, 3]], ILAYOUT = [[4, 4], [5, 4]];

// a far, cheap version of each tree for the distance
function lod(kind) {
  const a = [], push = (p, n, c) => a.push(...p, ...n, ...c, ...c);
  const ring = (y, r, n, off = 0) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * 6.283 + off) * r, y, Math.sin(i / n * 6.283 + off) * r]);
  const leaf = kind ? [.24, .39, .27] : [.37, .54, .27], tip = kind ? [0, 1, 0] : [0, .98, 0];
  const base = kind ? ring(.16, .27, 5) : ring(.5, .36, 5), mid = kind ? null : ring(.72, .36, 5, .6);
  for (let i = 0; i < 5; i++) {
    const p = base[i], q = base[(i + 1) % 5];
    if (kind) { push(p, [p[0], .5, p[2]], leaf); push(q, [q[0], .5, q[2]], leaf); push(tip, [0, 1, 0], leaf); }
    else {
      const m = mid[i], m2 = mid[(i + 1) % 5];
      push(p, [p[0], -.3, p[2]], leaf); push(q, [q[0], -.3, q[2]], leaf); push(m, [m[0], .2, m[2]], leaf);
      push(q, [q[0], -.3, q[2]], leaf); push(m2, [m2[0], .2, m2[2]], leaf); push(m, [m[0], .2, m[2]], leaf);
      push(m, [m[0], .3, m[2]], leaf); push(m2, [m2[0], .3, m2[2]], leaf); push(tip, [0, 1, 0], leaf);
    }
    push([0, 0, 0], [1, 0, 0], [.36, .27, .2]); push([0, kind ? .2 : .5, 0], [1, 0, 0], [.36, .27, .2]); push([.04, kind ? .2 : .5, 0], [1, 0, 0], [.36, .27, .2]);
  }
  return new Float32Array(a);
}

export function createRenderer(gl) {
  const lit = program(gl, LIT_VS, LIT_FS), inst = program(gl, INST_VS, LIT_FS), sky = program(gl, SKY_VS, SKY_FS);
  const water = program(gl, WATER_VS, WATER_FS), flat = program(gl, FLAT_VS, FLAT_FS);
  const tri = mesh(gl, new Float32Array([-1, -1, 3, -1, -1, 3]), [[0, 2]]);
  const plane = mesh(gl, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), [[0, 2]]);
  // one pair of meshes (near, far) per tree look (shapes.js TREE_LOOKS; a tree's look ?? kind)
  const kinds = TREE_LOOKS.map((L, i) => ({ near: mesh(gl, L.near(), LAYOUT, { instLayout: ILAYOUT }), far: mesh(gl, L.far ? L.far() : lod(i), LAYOUT, { instLayout: ILAYOUT }), autumn: L.autumn }));
  // instanced shapes by name; systems register their own with R.shape(name, triangles)
  const shapes = new Map();
  const shape = (key, data) => { const old = shapes.get(key); if (old) { gl.deleteBuffer(old.buf); gl.deleteBuffer(old.ibuf); gl.deleteVertexArray(old.vao); } shapes.set(key, mesh(gl, data, LAYOUT, { instLayout: ILAYOUT })); };
  shape('ring', ring()); shape('cloud', cloud());
  const hawk = mesh(gl, new Float32Array(12), LAYOUT, { dynamic: true });
  const fx = mesh(gl, new Float32Array(7), [[0, 3], [1, 4]], { dynamic: true });
  const chunks = new Map();
  const R = { chunks, view: 520, treeView: 360, nearTrees: 110, stats: { chunks: 0, trees: 0, tris: 0 }, treeAt: null };
  gl.disable(gl.CULL_FACE);

  function updateChunks(cam, budget = 2) {
    const r = Math.ceil(R.view / CHUNK), ccx = Math.floor(cam[0] / CHUNK), ccz = Math.floor(cam[2] / CHUNK);
    const want = [];
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const cx = ccx + i, cz = ccz + j, d = Math.hypot((cx + .5) * CHUNK - cam[0], (cz + .5) * CHUNK - cam[2]);
      if (d > R.view + CHUNK) continue;
      const k = cx + ',' + cz;
      if (!chunks.has(k)) want.push([d, cx, cz, k]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let n = 0; n < Math.min(budget, want.length); n++) {
      const [, cx, cz, k] = want[n];
      chunks.set(k, { cx, cz, m: mesh(gl, chunkMesh(cx, cz), LAYOUT) });
    }
    for (const [k, c] of chunks) {
      if (Math.hypot((c.cx + .5) * CHUNK - cam[0], (c.cz + .5) * CHUNK - cam[2]) > R.view + CHUNK * 3) {
        gl.deleteBuffer(c.m.buf); gl.deleteVertexArray(c.m.vao); chunks.delete(k);
      }
    }
    return want.length;
  }
  // tree instances are rebuilt when the hawk has moved a little: near ones detailed, far ones simple
  let treeFrom = null;
  function updateTrees(p, season) {
    if (treeFrom && Math.hypot(p[0] - treeFrom[0], p[2] - treeFrom[2]) < 20 && treeFrom[3] === season.key) return;
    treeFrom = [p[0], 0, p[2], season.key];
    const all = treesNear(p[0], p[2], R.treeView), buckets = kinds.map(() => [[], []]);
    for (const t of all) {
      const d = Math.hypot(t.x - p[0], t.z - p[2]); if (d > R.treeView) continue;
      const k = t.look ?? t.kind, turn = season.autumn * (.5 + t.tint) * kinds[k].autumn;
      buckets[k][d < R.nearTrees ? 0 : 1].push(t.x, t.y, t.z, t.s, t.yaw, t.tint, turn, t.id % 97);
    }
    R.stats.trees = all.length;
    for (let k = 0; k < kinds.length; k++) for (let l = 0; l < 2; l++) {
      const m = l ? kinds[k].far : kinds[k].near, data = new Float32Array(buckets[k][l]);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); m.icount = data.length / 8;
    }
  }

  function setLight(P, S) {
    gl.uniform3fv(P.u.uCam, S.cam); gl.uniform3fv(P.u.uSun, S.sun); gl.uniform3fv(P.u.uSunCol, S.sunCol);
    gl.uniform3fv(P.u.uSkyAmb, S.skyAmb); gl.uniform3fv(P.u.uGndAmb, S.gndAmb); gl.uniform3fv(P.u.uFogCol, S.horizon);
    gl.uniform1f(P.u.uFogDen, S.fogDen); gl.uniform3fv(P.u.uFocus, S.focus); gl.uniform1f(P.u.uDither, 0);
  }

  R.draw = (S, W, cw, ch) => {
    const w = cw, h = ch;
    gl.viewport(0, 0, w, h);
    const proj = perspective(S.fov, w / h, .15, 1400), view = lookAt(S.cam, S.look, S.camUp);
    const vp = mul(proj, view);
    R.vp = vp;
    let tris = 0;
    // sky
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(sky.p);
    const inv = invert(vp);
    gl.uniformMatrix4fv(sky.u.uInvVP, false, inv);
    gl.uniform3fv(sky.u.uZenith, S.zenith); gl.uniform3fv(sky.u.uHorizon, S.horizon); gl.uniform3fv(sky.u.uSun, S.sun);
    gl.uniform3fv(sky.u.uSunCol, S.sunCol); gl.uniform3fv(sky.u.uCloud, S.cloud); gl.uniform1f(sky.u.uNight, S.night); gl.uniform1f(sky.u.uTime, S.time);
    gl.bindVertexArray(tri.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);

    // ground
    gl.useProgram(lit.p); setLight(lit, S);
    gl.uniformMatrix4fv(lit.u.uVP, false, vp); gl.uniformMatrix4fv(lit.u.uModel, false, IDENT);
    const fx_ = S.look[0] - S.cam[0], fz_ = S.look[2] - S.cam[2], fl = Math.hypot(fx_, fz_) || 1;
    let n = 0;
    for (const c of chunks.values()) {
      const dx = (c.cx + .5) * CHUNK - S.cam[0], dz = (c.cz + .5) * CHUNK - S.cam[2];
      if ((dx * fx_ + dz * fz_) / fl < -CHUNK * .9 && S.camHigh < 120) continue;   // behind the camera
      gl.bindVertexArray(c.m.vao); gl.drawArrays(gl.TRIANGLES, 0, c.m.count); n++; tris += c.m.count / 3;
    }
    R.stats.chunks = n;

    // hawk
    const hm = buildHawk(S.pose);
    gl.bindBuffer(gl.ARRAY_BUFFER, hawk.buf); gl.bufferData(gl.ARRAY_BUFFER, hm, gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(lit.u.uModel, false, basis(S.hawk.p, S.hawk.r, S.hawk.u, S.hawk.f, HAWK_SCALE));
    gl.bindVertexArray(hawk.vao); gl.drawArrays(gl.TRIANGLES, 0, hm.length / 12); tris += hm.length / 36;

    // trees and rings
    gl.useProgram(inst.p); setLight(inst, S);
    gl.uniformMatrix4fv(inst.u.uVP, false, vp); gl.uniform1f(inst.u.uTime, S.time); gl.uniform3fv(inst.u.uAutumn, S.autumnCol);
    gl.uniform1f(inst.u.uSway, .012 + S.wind * .02); gl.uniform1f(inst.u.uDither, 1);
    for (const k of kinds) for (const m of [k.near, k.far]) {
      if (!m.icount) continue;
      gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.icount); tris += m.count / 3 * m.icount;
    }
    gl.uniform1f(inst.u.uDither, 0); gl.uniform1f(inst.u.uSway, 0);
    // props: anything instanced that a system adds (rings, clouds, mice, marks...)
    for (const key in S.props) {
      const d = S.props[key], m = shapes.get(key); if (!m || !d.length) continue;
      gl.uniform1f(inst.u.uDither, CLOUDY.has(key) ? 2 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf); gl.bufferData(gl.ARRAY_BUFFER, d instanceof Float32Array ? d : new Float32Array(d), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, d.length / 8); tris += m.count / 3 * d.length / 8;
    }

    gl.uniform1f(inst.u.uDither, 0);
    // see-through bits: shadow, water, motes
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.useProgram(flat.p); gl.uniformMatrix4fv(flat.u.uVP, false, vp); gl.uniform1f(flat.u.uPx, h * .9);
    const sh = shadowVerts(S);
    if (sh) {
      gl.uniform1f(flat.u.uPoints, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
      gl.bindBuffer(gl.ARRAY_BUFFER, fx.buf); gl.bufferData(gl.ARRAY_BUFFER, sh, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.TRIANGLES, 0, sh.length / 7);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // ribbons: thin see-through strips a system lays in the world (the aim line), 7 floats a vertex
    if (S.ribbon?.length) {
      gl.uniform1f(flat.u.uPoints, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, fx.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(S.ribbon), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.TRIANGLES, 0, S.ribbon.length / 7);
    }
    gl.useProgram(water.p);
    gl.uniformMatrix4fv(water.u.uVP, false, vp); gl.uniform3fv(water.u.uCam, S.cam);
    gl.uniform3fv(water.u.uZenith, S.zenith); gl.uniform3fv(water.u.uHorizon, S.horizon); gl.uniform3fv(water.u.uSun, S.sun);
    gl.uniform3fv(water.u.uSunCol, S.sunCol); gl.uniform3fv(water.u.uFogCol, S.horizon); gl.uniform3fv(water.u.uSkyAmb, S.skyAmb);
    gl.uniform1f(water.u.uFogDen, S.fogDen); gl.uniform1f(water.u.uTime, S.time);
    gl.bindVertexArray(plane.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (S.motes.length) {
      gl.useProgram(flat.p); gl.uniform1f(flat.u.uPoints, 1);
      const md = new Float32Array(S.motes);
      gl.bindBuffer(gl.ARRAY_BUFFER, fx.buf); gl.bufferData(gl.ARRAY_BUFFER, md, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.POINTS, 0, md.length / 7);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    R.stats.tris = tris | 0;
  };

  // a soft dark patch on the ground under the hawk, fading with height: the cue for landing
  function shadowVerts(S) {
    const p = S.hawk.p, g = Math.max(height(p[0], p[2]), 0), above = p[1] - g;
    if (above > 45 || above < -1) return null;
    const a = .38 * (1 - above / 45), n = g > 0 ? normalAt(p[0], p[2]) : [0, 1, 0];
    const out = [], N = 10, rad = .55 + above * .01;
    const tx = [n[1], -n[0], 0], tl = Math.hypot(...tx) || 1; tx[0] /= tl; tx[1] /= tl;
    const tz = [n[1] * tx[2] - n[2] * tx[1], n[2] * tx[0] - n[0] * tx[2], n[0] * tx[1] - n[1] * tx[0]];
    const f = S.hawk.f, span = S.pose.fold > .7 ? .6 : 1.4;
    const at = (ang, r) => {
      const lx = Math.cos(ang) * r * span, lz = Math.sin(ang) * r;   // stretched across the wings
      const wx = lx * -f[2] + lz * f[0], wz = lx * f[0] + lz * f[2];
      return [p[0] + wx, g + .06 + (wx * -n[0] - wz * n[2]) / Math.max(n[1], .3), p[2] + wz];
    };
    void tz;
    const c = [p[0], g + .06, p[2]];
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283;
      out.push(...c, .1, .08, .06, a, ...at(a0, rad), .1, .08, .06, 0, ...at(a1, rad), .1, .08, .06, 0);
    }
    return new Float32Array(out);
  }

  // free every ground chunk so it is rebuilt (after the snowline or the season changes the colours)
  R.dropChunks = () => { for (const c of chunks.values()) { gl.deleteBuffer(c.m.buf); gl.deleteVertexArray(c.m.vao); } chunks.clear(); };
  R.updateChunks = updateChunks; R.updateTrees = updateTrees; R.shape = shape;
  return R;
}

function invert(m) {
  const a = m, o = new Float32Array(16);
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
  const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
  const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
  o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
  o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
  o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
  o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
  return o;
}
export { thermalsNear, thermalCentre, TREE, perchesOf, ringsNear };
