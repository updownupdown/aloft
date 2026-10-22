// Draws a 3D frame: sky, ground chunks, instanced trees and rings, the hawk and its shadow,
// water, thermal motes. One lit shader with two-sided faces, hemisphere light, haze toward the
// horizon colour and a paper grain, so it stays in Aloft's palette at very little cost.
import { program, mesh, perspective, lookAt, mul, basis, IDENT } from './gl.js';
import { CHUNK, chunkMesh, cellsFor, treesNear, ringsNear, height, normalAt, thermalsNear, thermalCentre, TREE, perchesOf, env, WORLD } from './world.js';
import { ring, cloud, TREE_LOOKS } from './shapes.js';
import { buildHawk, HAWK_SCALE } from './hawk.js';

// instanced shapes that are cloud: see-through when the camera is close or inside
const CLOUDY = new Set(['cloud', 'storm', 'puff', 'lens', 'devil']);
// instanced shapes that hoar frost whitens (the plants and stones; not the animals)
const FROSTY = new Set(['tuft', 'scrub', 'bush', 'reeds', 'stone', 'flowerY', 'flowerW', 'flowerP', 'hay', 'hayLaid', 'bale', 'barrel']);
const COMMON_FS = `
uniform vec3 uCam, uSun, uSunCol, uSkyAmb, uGndAmb, uFogCol, uFocus;
uniform vec3 uZenith;
uniform float uFogDen, uDither, uSeek, uCut, uFade, uWater, uLift, uTime;
uniform vec4 uShadeC[8], uFrost; uniform vec2 uFrostDir;
in vec3 vPos, vNrm, vCol, vColB; in float vLeaf, vFade, vGone;
out vec4 frag;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// The water is drawn here, on whatever lies under it (the ground, a fish, the hawk's feet), not
// as a plane of its own: where the view ray crosses the surface (P) it takes the surface's look,
// seen through as much as the water is shallow (depth). No second surface, so nothing can fight
// at the shoreline, and no extra pass over the screen. The look is painted: flat bands of colour
// from the shallows out to the deep, a white line where it meets the shore, the sky faintly in it
// at a low angle. No wave noise, so it costs only a few sums per water pixel.
vec4 waterAt(vec3 P, float depth) {
  vec3 v = normalize(uCam - P), lit = uSkyAmb + uSunCol * .6;
  float fr = .25 + .75 * pow(1. - max(v.y, 0.), 3.);
  vec3 sky = mix(uFogCol, uZenith, pow(max(v.y, 0.), .55));
  float foam = 1. - smoothstep(.04, .2, depth), band = floor(smoothstep(0., 3.5, depth) * 4.) / 3.;
  vec3 c = mix(vec3(.42, .66, .62), vec3(.16, .32, .42), band) * lit;
  c = mix(c, sky, .12 + fr * .2);
  return vec4(mix(c, vec3(.95) * lit, foam * .8), mix(.55, 1., smoothstep(0., .6, depth)));
}
// the drifting clouds' shadows (sys/air.js S.shadeC: x, z, radius, depth): soft discs that take
// some of the sun off whatever is under them
float sunlit(vec3 p) {
  if (p.y > 260.) return 1.;
  float s = 0.;
  for (int i = 0; i < 8; i++) { vec4 c = uShadeC[i]; if (c.z <= 0.) break; s = max(s, c.w * smoothstep(c.z, c.z * .55, length(p.xz - c.xy))); }   // nearest first; none left, stop
  return 1. - s;
}
// hoar frost (sys/skydays.js S.frost: amount, the melt line, where it is measured from): white
// where the line hasn't passed; it goes first from ground facing the sun and nearer the sun's side
vec3 frosted(vec3 col, vec3 n, vec3 p) {
  float v = dot(p.xz - uFrost.zw, uFrostDir) / 300. + dot(n, uSun) * .8 + (h21(floor(p.xz * .7)) - .5) * .12;
  return mix(col, vec3(.88, .92, .97), uFrost.x * smoothstep(uFrost.y + .05, uFrost.y - .05, v) * .85);
}
vec3 shade(vec3 col, vec3 n, float sun) {
  float d = dot(n, uSun), wrap = max((d + .3) / 1.3, 0.);
  vec3 amb = mix(uGndAmb, uSkyAmb, n.y * .5 + .5);
  return col * (amb + uSunCol * wrap * sun);
}
vec3 haze(vec3 c, vec3 p) {
  // the haze lies low: high ground thins it, so far hills and peaks stand out on the skyline
  float d = length(p - uCam) * mix(1., .2, smoothstep(20., 250., p.y));
  float f = 1. - exp(-pow(d * uFogDen, 1.6));
  return mix(c, uFogCol, f);
}
float grain() { return .965 + .05 * h21(floor(gl_FragCoord.xy)); }
`;
const LIT_FS = `#version 300 es
precision highp float;
${COMMON_FS}
void main() {
#ifndef SOLID
  // far tiles give way to the near ground inside uCut metres
  if (uCut > 0. && length(vPos.xz - uCam.xz) < uCut) discard;
  // trees changing detail (uFade 1 the near mesh, 2 the far one) dissolve through each other
  // on an ordered dither, by vFade (0 near .. 1 far)
  if (uFade > .5) {
    ivec2 q = ivec2(gl_FragCoord.xy) & 3; int i = q.x + q.y * 4;
    float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    float h = (bayer[i] + .5) / 16.;
    if (uFade < 1.5 ? h < vFade : h >= vFade) discard;
    if (h < vGone) discard;   // at the edge of the view, full size, dissolving in
  }
  // clouds (uDither 2) are drawn blended, at most half there, thinning as the camera nears and
  // almost gone inside one
  float alpha = 1.;
  if (uDither > 1.5) {
    alpha = mix(.06, .5, smoothstep(8., 90., length(vPos - uCam)));
  } else if (uDither > .5) {
    vec3 ab = uFocus - uCam, ap = vPos - uCam; float t = clamp(dot(ap, ab) / dot(ab, ab), 0., 1.);
    float dl = length(ap - ab * t), dc = length(ap), dh = length(vPos - uFocus);
    // uSeek (flaring to land, or perched) thins the leaves more and from farther off, to find a perch
    float e = uSeek, k;
    if (vLeaf > .5) {   // leaves, marked by the vertex shader before the autumn turn
      // foliage thins the nearer the camera comes, down to a light screen; it opens wide on the
      // line to the hawk and round the hawk itself, so leaves never hide it
      float near = mix(.28 - .18 * e, 1., smoothstep(6. + 6. * e, 32. + 38. * e, dc));
      float line = smoothstep(2.5 + 4. * e, 8. + 14. * e, dl) + step(.98, t);
      float round = mix(.1, 1., smoothstep(3. + 4. * e, 12. + 18. * e, dh));
      k = min(near, min(line, round));
    } else {
      // trunks and limbs stay solid so you can see what to land on, except one right between the
      // camera and the hawk, or brushing the lens; what is under the hawk (its perch) always shows
      k = max(min(smoothstep(.45, 1.3, dl) + step(.96, t), smoothstep(.8, 2.2, dc)), .1);
      k = mix(k, 1., smoothstep(uFocus.y + .2, uFocus.y - .6, vPos.y) * (1. - smoothstep(2., 4., dh)));
    }
    if (k < .99) {
      // an ordered 4x4 dither reads as a soft screen rather than noise
      ivec2 q = ivec2(gl_FragCoord.xy) & 3;
      int i = q.x + q.y * 4;
      float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      if ((bayer[i] + .5) / 16. > k) discard;
    }
  }
#else
  // SOLID: the same shader with no discard anywhere, so the GPU can drop hidden pixels before
  // shading them (early depth; a discard in a shader turns that off for everything it draws)
  float alpha = 1.;
#endif
  vec3 n = normalize(vNrm), col = vCol;
  if (!gl_FrontFacing) { n = -n; col = vColB; }
  if (uFrost.x > 0. && uDither < 1.5 && vPos.y + uLift > uWater) col = frosted(col, n, vPos);
  vec3 c = shade(col, n, sunlit(vPos)), hp = vPos;
  // under the water (uLift: the far tiles are sunk a little under the near ground)
  float y = vPos.y + uLift;
  if (y < uWater && uDither < 1.5) {
    if (uCam.y > uWater + .02) {
      vec3 dir = vPos - uCam; hp = uCam + dir * ((uWater - uCam.y) / dir.y);
      vec4 w = waterAt(hp, uWater - y);
      c = mix(c, w.rgb, w.a);
    } else c = mix(c, vec3(.15, .3, .38) * (uSkyAmb + uSunCol * .5), .6);   // the camera itself under
  }
  frag = vec4(haze(c, hp) * grain(), alpha);
}`;
const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
uniform mat4 uVP, uModel;
out vec3 vPos, vNrm, vCol, vColB; out float vLeaf, vFade, vGone;
void main() {
  vec4 w = uModel * vec4(aPos, 1.);
  vPos = w.xyz; vNrm = mat3(uModel) * aNrm; vCol = aCol; vColB = aColB; vLeaf = 0.; vFade = 0.; vGone = 0.;
  gl_Position = uVP * w;
}`;
const INST_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
layout(location=4) in vec4 iA; layout(location=5) in vec4 iB;
uniform mat4 uVP; uniform float uTime, uSway, uSnowLine; uniform vec3 uAutumn;

out vec3 vPos, vNrm, vCol, vColB; out float vLeaf, vFade, vGone;
void main() {
  // trees carry their detail fade in the phase's fraction (render.js updateTrees): tenths are
  // how far from near to far (vFade), hundredths how far dissolved at the edge of the view (vGone)
  float fr = fract(iB.w); vFade = floor(fr * 10.) / 9.; vGone = floor(fract(fr * 10.) * 10.) / 9.;
  float c = cos(iB.x), s = sin(iB.x);
  float leafy = step(aCol.r * 1.05, aCol.g);
  vec3 p = aPos * iA.w;
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  // a turn past 1.5 means bare (winter broadleaves): the leaves fold to nothing on the trunk's axis
  p.xz *= 1. - step(1.5, iB.z) * leafy;
  float sway = sin(uTime * 1.1 + iB.w) * aPos.y * aPos.y * uSway * iA.w;
  p.x += sway; p.z += sway * .6;
  vPos = p + iA.xyz;
  vec3 n = aNrm; n.xz = vec2(c * n.x - s * n.z, s * n.x + c * n.z); vNrm = n;
  // leaves (greenish vertices) take a per-tree tint and the season's turn
  vec3 col = aCol * (.88 + iB.y * .24);
  col = mix(col, uAutumn * (.85 + iB.y * .3), leafy * clamp(iB.z, 0., 1.));
  // snow lies on the upturned leaves and needles above the snowline (world.js env.snow)
  col = mix(col, vec3(.93, .95, .98), leafy * smoothstep(uSnowLine - 8., uSnowLine + 12., vPos.y) * smoothstep(.05, .45, n.y) * .85);
  vCol = col; vColB = col; vLeaf = leafy;
  gl_Position = uVP * vec4(vPos, 1.);
}`;
const SKY_VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vP;
void main() { vP = aP; gl_Position = vec4(aP, 1., 1.); }   // at the back: drawn last, where depth is still clear`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vP; out vec4 frag;
uniform mat4 uInvVP; uniform vec3 uZenith, uHorizon, uSun, uSunCol, uCloud; uniform float uNight, uTime, uAurora;
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
  float cl = 0.;
  if (d.y > .02) {
    vec2 q = d.xz / (d.y + .08) * 1.6 + vec2(uTime * .004, 0.);
    float n = vn(q) * .6 + vn(q * 2.3 + 7.) * .3 + vn(q * 5.1 + 3.) * .1;
    cl = smoothstep(.52, .78, n) * smoothstep(.02, .25, d.y);
    c = mix(c, uCloud, cl * .3);   // only faint high haze: the clouds themselves are meshes (sys/air.js)
    if (uNight > 0.) { vec2 g = floor(d.xz / (d.y + .3) * 140.); float st = step(.996, h21(g)) * (1. - cl) * smoothstep(.05, .3, d.y);
      c += vec3(st) * uNight * (.6 + .4 * sin(uTime * 2. + h21(g + 3.) * 40.)); }
  }
  // northern lights: thin curtains high in the north, added to the sky (stars show through). The
  // view ray is stepped up through a layer of sky; where it meets a curtain's wavy line it glows,
  // green at the foot, fading to violet and nothing at the top, in fine vertical rays
  if (uAurora > .01 && d.y > .03) {
    vec3 au = vec3(0.); float jit = h21(gl_FragCoord.xy * .37);
    for (int i = 0; i < 16; i++) {
      float k = (float(i) + jit) / 16.;
      vec2 p = d.xz / d.y * (1. + k * 1.4);
      for (int j = 0; j < 2; j++) {
        float o = float(j), w = p.y + 2.4 + o * 1.3 + sin(p.x * .45 + o * 2. + uTime * .04) * .7 + sin(p.x * 1.3 - uTime * .07 + o) * .25;
        float ray = .45 + .55 * vn(vec2(p.x * 9. + o * 5. + uTime * .15, k * .6));
        float glow = exp(-w * w * 6.) * ray * smoothstep(0., .18, k) * pow(1. - k, 1.6) * (1. - o * .4);
        au += mix(vec3(.25, 1., .55), vec3(.6, .35, 1.), k) * glow;
      }
    }
    c += au * uAurora * .2 * smoothstep(.03, .15, d.y) * (1. - cl);
  }
  c *= .965 + .05 * h21(floor(gl_FragCoord.xy));
  frag = vec4(c, 1.);
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

// The far version of a tree should look like the near one from afar: scale its leaf colours so
// their lit average (by area, over a ring of sun directions) matches the near mesh's, or a dark
// crown turns pale as it changes detail
function toneMatch(near, far) {
  const SUNS = Array.from({ length: 8 }, (_, i) => [Math.cos(i * .785) * .77, .64, Math.sin(i * .785) * .77]);
  const lit = d => {
    const sum = [0, 0, 0]; let area = 0;
    for (let o = 0; o < d.length; o += 36) {
      const r = d[o + 6], g = d[o + 7], b = d[o + 8]; if (!(g > r * 1.05)) continue;
      const ux = d[o + 12] - d[o], uy = d[o + 13] - d[o + 1], uz = d[o + 14] - d[o + 2], vx = d[o + 24] - d[o], vy = d[o + 25] - d[o + 1], vz = d[o + 26] - d[o + 2];
      const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); if (!a) continue;
      const nx = d[o + 3], ny = d[o + 4], nz = d[o + 5];
      let L = 0; for (const s of SUNS) L += Math.max((nx * s[0] + ny * s[1] + nz * s[2] + .3) / 1.3, 0);
      L = L / SUNS.length + .35 + .25 * (ny * .5 + .5);
      sum[0] += r * L * a; sum[1] += g * L * a; sum[2] += b * L * a; area += a;
    }
    return area ? sum.map(v => v / area) : null;
  };
  // faces wound against their normals would be lit from behind (the shader flips back faces)
  far = far.slice();
  for (let o = 0; o < far.length; o += 36) {
    const ux = far[o + 12] - far[o], uy = far[o + 13] - far[o + 1], uz = far[o + 14] - far[o + 2], vx = far[o + 24] - far[o], vy = far[o + 25] - far[o + 1], vz = far[o + 26] - far[o + 2];
    if ((uy * vz - uz * vy) * far[o + 3] + (uz * vx - ux * vz) * far[o + 4] + (ux * vy - uy * vx) * far[o + 5] < 0) {
      const t = far.slice(o + 12, o + 24); far.copyWithin(o + 12, o + 24, o + 36); far.set(t, o + 24);
    }
  }
  // and as wide: scale the far mesh across to the near one's reach
  const reach = d => { let m = 0; for (let o = 0; o < d.length; o += 12) m = Math.max(m, Math.hypot(d[o], d[o + 2])); return m; };
  const wk = reach(near) / (reach(far) || 1);
  if (Math.abs(wk - 1) > .03) for (let o = 0; o < far.length; o += 12) { far[o] *= wk; far[o + 2] *= wk; }
  const n = lit(near), f = lit(far); if (!n || !f) return far;
  const k = n.map((v, i) => Math.min(2, Math.max(.5, v / (f[i] || 1)))), out = far.slice();
  for (let o = 0; o < out.length; o += 12) if (out[o + 7] > out[o + 6] * 1.05) for (let c = 0; c < 3; c++) { out[o + 6 + c] *= k[c]; out[o + 9 + c] *= k[c]; }
  return out;
}

export function createRenderer(gl) {
  const lit = program(gl, LIT_VS, LIT_FS), inst = program(gl, INST_VS, LIT_FS), sky = program(gl, SKY_VS, SKY_FS);
  const SOLID_FS = LIT_FS.replace('precision highp float;', 'precision highp float;\n#define SOLID');
  const solid = program(gl, LIT_VS, SOLID_FS), solidInst = program(gl, INST_VS, SOLID_FS);
  const flat = program(gl, FLAT_VS, FLAT_FS);
  const tri = mesh(gl, new Float32Array([-1, -1, 3, -1, -1, 3]), [[0, 2]]);
  // one pair of meshes (near, far) per tree look (shapes.js TREE_LOOKS; a tree's look ?? kind)
  const kinds = TREE_LOOKS.map((L, i) => {
    const nd = L.near(), fd = toneMatch(nd, L.far ? L.far() : lod(i));
    return { near: mesh(gl, nd, LAYOUT, { instLayout: ILAYOUT }), far: mesh(gl, fd, LAYOUT, { instLayout: ILAYOUT }), autumn: L.autumn };
  });
  // instanced shapes by name; systems register their own with R.shape(name, triangles)
  const shapes = new Map();
  const shape = (key, data) => { const old = shapes.get(key); if (old) { gl.deleteBuffer(old.buf); gl.deleteBuffer(old.ibuf); gl.deleteVertexArray(old.vao); } shapes.set(key, mesh(gl, data, LAYOUT, { instLayout: ILAYOUT })); };
  shape('ring', ring()); shape('cloud', cloud());
  const hawk = mesh(gl, new Float32Array(12), LAYOUT, { dynamic: true });
  const fx = mesh(gl, new Float32Array(7), [[0, 3], [1, 4]], { dynamic: true });
  // per-frame data goes up through one reused Float32Array, not a new one each time (less garbage
  // for the collector to sweep, which costs battery too)
  let scratch = new Float32Array(1 << 16);
  const upload = (buf, d) => {
    let f = d;
    if (!(d instanceof Float32Array)) { if (scratch.length < d.length) scratch = new Float32Array(d.length * 1.5 | 0); scratch.set(d); f = scratch.subarray(0, d.length); }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW);
  };
  const chunks = new Map();
  const R = { chunks, view: 520, treeView: 360, nearTrees: 110, stats: { chunks: 0, trees: 0, tris: 0 }, treeAt: null };
  gl.disable(gl.CULL_FACE);

  // Ground chunks are built in a Worker (chunkwork.js) when it can run; jobs go out nearest first,
  // a few at a time, and a chunk is swapped in only when its new mesh is ready. Missing ground
  // close by is built here at once, so a jump never shows a hole. R.dropChunks marks every chunk
  // stale (gen) and they are rebuilt in place, the old mesh drawn until the new one arrives.
  let gen = 0, worker = null;
  const busy = new Map();   // key -> gen of a job in flight
  try {
    worker = new Worker(new URL('./chunkwork.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => {
      const { k, cx, cz, cells, gen: g, data, far: isFar } = e.data;
      if (isFar) { farBusy.delete(k); if (g === gen) placeFar(k, cx, cz, data); return; }
      busy.delete(k);
      if (g !== gen) return;   // the season (or the detail) changed while it was built
      place(k, cx, cz, cells, data);
    };
    worker.onerror = () => { worker = null; busy.clear(); };
  } catch { worker = null; }
  function place(k, cx, cz, cells, data) {
    const old = chunks.get(k); if (old) { gl.deleteBuffer(old.m.buf); gl.deleteVertexArray(old.m.vao); }
    let y0 = 1e9, y1 = -1e9;   // its height range, for culling against the view
    for (let i = 1; i < data.length; i += 12) { const y = data[i]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    chunks.set(k, { cx, cz, cells, gen, y0, y1, m: mesh(gl, data, LAYOUT) });
  }
  // Far tiles: past the near ground, out to FAR_VIEW, the land in big coarse tiles (FAR_TILE
  // metres, FAR_CELLS a side) sunk a little under the near ground, which they give way to inside
  // the near view (uCut). The haze thins over high ground, so it is the far hills and peaks that show.
  const FAR_TILE = 384, FAR_CELLS = 12, FAR_DROP = 2;
  R.farView = 2400;
  const far = new Map(), farBusy = new Set();
  function placeFar(k, tx, tz, data) {
    const old = far.get(k); if (old) { gl.deleteBuffer(old.m.buf); gl.deleteVertexArray(old.m.vao); }
    let y0 = 1e9, y1 = -1e9;
    for (let i = 1; i < data.length; i += 12) { const y = data[i]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    far.set(k, { tx, tz, gen, y0, y1, m: mesh(gl, data, LAYOUT) });
  }
  function updateFar(cam, near) {
    const fv = R.farView, r = Math.ceil(fv / FAR_TILE), cx = Math.floor(cam[0] / FAR_TILE), cz = Math.floor(cam[2] / FAR_TILE), want = [];
    const span = (a, b, c) => Math.max(a - c, 0, c - b);   // distance from c to the span [a, b]
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const tx = cx + i, tz = cz + j, x0 = tx * FAR_TILE, z0 = tz * FAR_TILE;
      const dn = Math.hypot(span(x0, x0 + FAR_TILE, cam[0]), span(z0, z0 + FAR_TILE, cam[2])), df = Math.hypot(Math.max(Math.abs(x0 - cam[0]), Math.abs(x0 + FAR_TILE - cam[0])), Math.max(Math.abs(z0 - cam[2]), Math.abs(z0 + FAR_TILE - cam[2])));
      const k = tx + ',' + tz, t = far.get(k);
      if (dn > fv || df < near * .9) { if (t) { gl.deleteBuffer(t.m.buf); gl.deleteVertexArray(t.m.vao); far.delete(k); } continue; }
      if ((!t || t.gen !== gen) && !farBusy.has(k)) want.push([dn, tx, tz, k]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz, k] of want) {
      if (farBusy.size >= 2) break;
      if (worker) { farBusy.add(k); worker.postMessage({ k, cx: tx, cz: tz, cells: FAR_CELLS, size: FAR_TILE, drop: FAR_DROP, far: true, gen, seed: WORLD.seed, snow: env.snow, season: env.season, seasonDay: env.seasonDay }); }
      else { placeFar(k, tx, tz, chunkMesh(tx, tz, FAR_CELLS, FAR_TILE, FAR_DROP)); break; }
    }
  }
  function updateChunks(cam, budget = 2) {
    const view = Math.min(R.view, R.fogView || 1e9);
    const r = Math.ceil(view / CHUNK), ccx = Math.floor(cam[0] / CHUNK), ccz = Math.floor(cam[2] / CHUNK);
    const want = [], finer = [];
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const cx = ccx + i, cz = ccz + j, d = Math.hypot((cx + .5) * CHUNK - cam[0], (cz + .5) * CHUNK - cam[2]);
      if (d > view + CHUNK) continue;
      const k = cx + ',' + cz, c = chunks.get(k), cells = cellsFor(d);
      if (!c) want.push([d, cx, cz, k, cells]);
      else if (c.cells !== cells || c.gen !== gen) finer.push([d, cx, cz, k, cells]);   // near chunks get finer cells (world.js cellsFor); stale ones are redone
    }
    want.sort((a, b) => a[0] - b[0]); finer.sort((a, b) => a[0] - b[0]);
    const build = ([, cx, cz, k, cells]) => place(k, cx, cz, cells, chunkMesh(cx, cz, cells));
    if (worker) {
      // a hole close by can't wait for the worker
      for (const w of want) if (w[0] < CHUNK * 1.5 && !busy.has(w[3])) { build(w); budget--; if (budget <= 0) break; }
      for (const w of [...want, ...finer]) {
        if (busy.size >= 4) break;
        if (busy.get(w[3]) === gen || (chunks.get(w[3])?.cells === w[4] && chunks.get(w[3])?.gen === gen)) continue;
        busy.set(w[3], gen);
        worker.postMessage({ k: w[3], cx: w[1], cz: w[2], cells: w[4], gen, seed: WORLD.seed, snow: env.snow, season: env.season, seasonDay: env.seasonDay });
      }
    } else {
      for (let n = 0; n < Math.min(budget, want.length); n++) build(want[n]);
      // one re-detail a frame, once nothing is missing (a fine chunk takes a few ms to build)
      if (!want.length && finer.length) build(finer[0]);
    }
    for (const [k, c] of chunks) {
      if (Math.hypot((c.cx + .5) * CHUNK - cam[0], (c.cz + .5) * CHUNK - cam[2]) > view + CHUNK * 3) {
        gl.deleteBuffer(c.m.buf); gl.deleteVertexArray(c.m.vao); chunks.delete(k);
      }
    }
    updateFar(cam, view);
    return want.length;
  }
  // tree instances are rebuilt when the hawk has moved a little: near ones detailed, far ones simple
  // and only those in front of the camera (a cone a little wider than the view), re-sorted when the
  // view turns; the list round the hawk is fetched again only after it moves
  // Trees change detail across a band (TREE_BAND metres round R.nearTrees) drawn twice, the near
  // mesh dissolving into the far one on a dither, and dissolve in at full size over the last
  // TREE_EDGE metres of the view (never scaled, so nothing seems to grow), so none pops; the buckets are redone every few metres to keep it smooth
  const TREE_BAND = 26, TREE_EDGE = 45;
  let treeFrom = null, treeAt = null, treeAll = [], treeYaw = 0, treeSteep = false;
  function updateTrees(p, season) {
    const v = R.viewInfo, tv = Math.min(R.treeView, (R.fogView || 1e9) * .85);
    const moved = !treeFrom || Math.hypot(p[0] - treeFrom[0], p[2] - treeFrom[2]) >= 20 || treeFrom[3] !== season.key || treeFrom[4] !== season.bare || treeFrom[5] !== tv;
    const stepped = !treeAt || Math.hypot(p[0] - treeAt[0], p[2] - treeAt[1]) >= 4;
    let yaw = treeYaw, steep = treeSteep;
    if (v) { yaw = Math.atan2(v.f[0], -v.f[2]); steep = v.f[1] < -.55; }
    const turned = Math.abs(Math.atan2(Math.sin(yaw - treeYaw), Math.cos(yaw - treeYaw))) > .3 || steep !== treeSteep;
    if (!moved && !turned && !stepped) return;
    if (moved) { treeFrom = [p[0], 0, p[2], season.key, season.bare, tv]; treeAll = treesNear(p[0], p[2], tv + 22); }
    treeAt = [p[0], p[2]]; treeYaw = yaw; treeSteep = steep;
    const lo = R.nearTrees - TREE_BAND / 2, hi = R.nearTrees + TREE_BAND / 2;
    const buckets = kinds.map(() => [[], []]);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), cone = v && !steep ? Math.cos(Math.min(Math.PI, Math.atan(Math.tan(v.fov / 2) * v.aspect) + .75)) : -2;
    const cx = v ? v.cam[0] : p[0], cz = v ? v.cam[2] : p[2];
    let drawn = 0;
    for (const t of treeAll) {
      const d = Math.hypot(t.x - p[0], t.z - p[2]); if (d > tv) continue;
      const dx = t.x - cx, dz = t.z - cz, dc = Math.hypot(dx, dz);
      if (dc > 40 && (dx * fx + dz * fz) / dc < cone) continue;   // well off to the side or behind
      const k = t.look ?? t.kind, turn = season.bare && kinds[k].autumn >= .5 ? 2 : season.autumn * (.5 + t.tint) * kinds[k].autumn;   // 2: bare
      const f = Math.round(Math.min(1, Math.max(0, (d - lo) / (hi - lo))) * 9), g = Math.round(Math.min(1, Math.max(0, (d - tv + TREE_EDGE) / TREE_EDGE)) * 9);
      const ph = Math.floor(Math.abs(t.id)) % 97 + f * .1 + g * .01 + .005;
      if (f < 9) buckets[k][0].push(t.x, t.y, t.z, t.s, t.yaw, t.tint, turn, ph);
      if (f > 0) buckets[k][1].push(t.x, t.y, t.z, t.s, t.yaw, t.tint, turn, ph);
      drawn++;
    }
    R.stats.trees = drawn;
    for (let k = 0; k < kinds.length; k++) for (let l = 0; l < 2; l++) {
      const m = l ? kinds[k].far : kinds[k].near, data = buckets[k][l];
      upload(m.ibuf, data); m.icount = data.length / 8;
    }
  }

  function setLight(P, S) {
    gl.uniform3fv(P.u.uCam, S.cam); gl.uniform3fv(P.u.uSun, S.sun); gl.uniform3fv(P.u.uSunCol, S.sunCol);
    gl.uniform3fv(P.u.uSkyAmb, S.skyAmb); gl.uniform3fv(P.u.uGndAmb, S.gndAmb); gl.uniform3fv(P.u.uFogCol, S.horizon);
    gl.uniform1f(P.u.uFogDen, S.fogDen); gl.uniform3fv(P.u.uFocus, S.focus); gl.uniform1f(P.u.uDither, 0); gl.uniform1f(P.u.uCut, 0); gl.uniform1f(P.u.uFade, 0); gl.uniform1f(P.u.uWater, S.water ?? 0); gl.uniform1f(P.u.uLift, 0); gl.uniform3fv(P.u.uZenith, S.zenith); gl.uniform1f(P.u.uTime, S.time); if (P.u.uSeek) gl.uniform1f(P.u.uSeek, S.seek || 0);
    gl.uniform4fv(P.u.uShadeC, shadeC(S)); gl.uniform4fv(P.u.uFrost, S.frost || NOFROST); gl.uniform2fv(P.u.uFrostDir, S.frostDir || [1, 0]);
  }
  // the cloud shadows as 8 vec4s (unused ones radius 0)
  const SHADE = new Float32Array(32), NOFROST = [0, 0, 0, 0];
  function shadeC(S) {
    SHADE.fill(0);
    (S.shadeC || []).slice(0, 8).forEach((c, i) => SHADE.set(c, i * 4));
    return SHADE;
  }

  R.draw = (S, W, cw, ch) => {
    const w = cw, h = ch;
    gl.viewport(0, 0, w, h);
    const proj = perspective(S.fov, w / h, .15, R.farView + 300), view = lookAt(S.cam, S.look, S.camUp);
    const vp = mul(proj, view);
    R.vp = vp;
    { const fx = S.look[0] - S.cam[0], fy = S.look[1] - S.cam[1], fz = S.look[2] - S.cam[2], l = Math.hypot(fx, fy, fz) || 1; R.viewInfo = { cam: S.cam, f: [fx / l, fy / l, fz / l], fov: S.fov, aspect: w / h }; }
    let tris = 0;
    const pf = R.prof;   // perf.js: each pass timed on the GPU, when that is on
    // Solid things first, nearest first, in the shaders with no discard (SOLID), so the GPU can skip
    // shading whatever ends up hidden; then what needs discard (far land, trees); the sky last, only
    // where nothing was drawn; then the see-through things. Same picture, less shading.
    gl.clearColor(S.horizon[0], S.horizon[1], S.horizon[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    const P = planes(vp);
    // hawk
    pf?.pass('hawk');
    gl.useProgram(solid.p); setLight(solid, S); gl.uniformMatrix4fv(solid.u.uVP, false, vp);
    gl.uniform4fv(solid.u.uFrost, NOFROST);   // no hoar frost on the hawk
    const hm = buildHawk(S.pose);
    gl.bindBuffer(gl.ARRAY_BUFFER, hawk.buf); gl.bufferData(gl.ARRAY_BUFFER, hm, gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(solid.u.uModel, false, basis(S.hawk.p, S.hawk.r, S.hawk.u, S.hawk.f, HAWK_SCALE));
    gl.bindVertexArray(hawk.vao); gl.drawArrays(gl.TRIANGLES, 0, hm.length / 12); tris += hm.length / 36;
    gl.uniformMatrix4fv(solid.u.uModel, false, IDENT); gl.uniform4fv(solid.u.uFrost, S.frost || NOFROST);

    // props: anything instanced that a system adds (rings, mice, flora, marks...)
    gl.useProgram(solidInst.p); setLight(solidInst, S);
    gl.uniformMatrix4fv(solidInst.u.uVP, false, vp); gl.uniform1f(solidInst.u.uTime, S.time); gl.uniform3fv(solidInst.u.uAutumn, S.autumnCol); gl.uniform1f(solidInst.u.uSnowLine, S.snowLine ?? 999);
    gl.uniform1f(solidInst.u.uSway, 0);
    const prop = key => {
      const d = S.props[key], m = shapes.get(key); if (!m || !d.length) return;
      upload(m.ibuf, d);
      gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, d.length / 8); tris += m.count / 3 * d.length / 8;
    };
    for (const key in S.props) if (!CLOUDY.has(key)) { pf?.pass(R.propPasses ? key : 'props'); if (S.frost) gl.uniform4fv(solidInst.u.uFrost, FROSTY.has(key) ? S.frost : NOFROST); prop(key); }

    // ground: only the chunks inside the view (their box against the frustum's sides), nearest first
    pf?.pass('ground');
    gl.useProgram(solid.p);
    const near = [];
    for (const c of chunks.values()) {
      if (!boxIn(P, c.cx * CHUNK, c.y0 - 3, c.cz * CHUNK, (c.cx + 1) * CHUNK, c.y1, (c.cz + 1) * CHUNK)) continue;
      near.push(c); c.d = ((c.cx + .5) * CHUNK - S.cam[0]) ** 2 + ((c.cz + .5) * CHUNK - S.cam[2]) ** 2;
    }
    near.sort((a, q) => a.d - q.d);
    for (const c of near) { gl.bindVertexArray(c.m.vao); gl.drawArrays(gl.TRIANGLES, 0, c.m.count); tris += c.m.count / 3; }
    R.stats.chunks = near.length;
    pf?.pass('far land');
    gl.useProgram(lit.p); setLight(lit, S);
    gl.uniformMatrix4fv(lit.u.uVP, false, vp); gl.uniformMatrix4fv(lit.u.uModel, false, IDENT);
    gl.uniform1f(lit.u.uCut, Math.min(R.view, R.fogView || 1e9)); gl.uniform1f(lit.u.uLift, FAR_DROP);
    let nf = 0;
    for (const t of far.values()) {
      if (!boxIn(P, t.tx * FAR_TILE, t.y0 - 30, t.tz * FAR_TILE, (t.tx + 1) * FAR_TILE, t.y1, (t.tz + 1) * FAR_TILE)) continue;
      gl.bindVertexArray(t.m.vao); gl.drawArrays(gl.TRIANGLES, 0, t.m.count); tris += t.m.count / 3; nf++;
    }
    gl.uniform1f(lit.u.uCut, 0); gl.uniform1f(lit.u.uLift, 0); R.stats.far = nf + '/' + far.size;

    // trees
    pf?.pass('trees');
    gl.useProgram(inst.p); setLight(inst, S);
    gl.uniformMatrix4fv(inst.u.uVP, false, vp); gl.uniform1f(inst.u.uTime, S.time); gl.uniform3fv(inst.u.uAutumn, S.autumnCol); gl.uniform1f(inst.u.uSnowLine, S.snowLine ?? 999);
    gl.uniform1f(inst.u.uSway, .012 + S.wind * .02); gl.uniform1f(inst.u.uDither, 1);
    for (const k of kinds) for (const m of [k.near, k.far]) {
      if (!m.icount) continue;
      gl.uniform1f(inst.u.uFade, m === k.near ? 1 : 2);
      gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.icount); tris += m.count / 3 * m.icount;
    }
    gl.uniform1f(inst.u.uDither, 0); gl.uniform1f(inst.u.uSway, 0); gl.uniform1f(inst.u.uFade, 0);

    // sky, just where nothing else is (it sits at the very back of the depth range)
    pf?.pass('sky');
    gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
    gl.useProgram(sky.p);
    gl.uniformMatrix4fv(sky.u.uInvVP, false, invert(vp));
    gl.uniform3fv(sky.u.uZenith, S.zenith); gl.uniform3fv(sky.u.uHorizon, S.horizon); gl.uniform3fv(sky.u.uSun, S.sun);
    gl.uniform3fv(sky.u.uSunCol, S.sunCol); gl.uniform3fv(sky.u.uCloud, S.cloud); gl.uniform1f(sky.u.uNight, S.night); gl.uniform1f(sky.u.uTime, S.time); gl.uniform1f(sky.u.uAurora, S.aurora || 0);
    gl.bindVertexArray(tri.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.depthFunc(gl.LESS);

    // clouds last, see-through (at most half there), over everything solid: first their depth
    // alone, then their colour on just that nearest skin, so a cloud's inner faces never show
    pf?.pass('clouds');
    gl.useProgram(inst.p);
    gl.uniform1f(inst.u.uDither, 2);
    gl.colorMask(false, false, false, false);
    for (const key in S.props) if (CLOUDY.has(key)) prop(key);
    gl.colorMask(true, true, true, true); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const key in S.props) if (CLOUDY.has(key)) prop(key);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS);

    gl.uniform1f(inst.u.uDither, 0);
    // see-through bits: shadow, water, motes
    pf?.pass('shadow, foam');
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
      upload(fx.buf, S.ribbon);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.TRIANGLES, 0, S.ribbon.length / 7);
    }
    // the water itself is drawn in the lit shader (waterAt); on it, strips laid on its surface (river foam)
    if (S.surface?.length) {
      gl.useProgram(flat.p); gl.uniform1f(flat.u.uPoints, 0);
      upload(fx.buf, S.surface);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.TRIANGLES, 0, S.surface.length / 7);
    }
    pf?.pass('motes');
    if (S.motes.length) {
      gl.useProgram(flat.p); gl.uniform1f(flat.u.uPoints, 1);
      upload(fx.buf, S.motes);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.POINTS, 0, S.motes.length / 7);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    pf?.pass(null);
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

  // rebuild every ground chunk (after the snowline, the season or the detail changes): each is redone
  // in place, the old one drawn until its new mesh is ready
  R.dropChunks = () => { gen++; };
  R.updateChunks = updateChunks; R.updateTrees = updateTrees; R.shape = shape;
  return R;
}

// the view's four sides (left, right, bottom, top) as planes from a column-major view-projection
function planes(m) {
  const P = [];
  for (const [i, sg] of [[0, 1], [0, -1], [1, 1], [1, -1]]) P.push([m[3] + sg * m[i], m[7] + sg * m[4 + i], m[11] + sg * m[8 + i], m[15] + sg * m[12 + i]]);
  return P;
}
// is a box at least partly inside every plane
function boxIn(P, x0, y0, z0, x1, y1, z1) {
  for (const [a, b, c, d] of P) if (a * (a > 0 ? x1 : x0) + b * (b > 0 ? y1 : y0) + c * (c > 0 ? z1 : z0) + d < 0) return false;
  return true;
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
