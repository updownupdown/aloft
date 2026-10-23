// The Map tab's globe: the Earth as a ball you spin with a finger, drawn by one small WebGL
// shader from two textures baked once: the land (each texel's place on the strip, from the
// lat/lon grid in earthdata.js, coloured by sea depth and biome) and the fog (the cells the hawk
// has seen, splatted soft). A view is { lat, lon, R }: the point in the middle and the ball's
// radius in CSS pixels; project()/unproject() go between lat/lon and the screen for the markers.
import { LL, EARTH, CELL } from './earthdata.js';
import { coastDist, earthBiome, latLon } from './earth.js';
import { program } from './gl.js';

const TW = 2048, TH = 1024, FW = 2048, FH = 1024;
const D = Math.PI / 180;
// the land's colours on the map, by biome (flat, soft, the world's low poly palette)
const HEX = {
  ice: 'eef3f5', tundra: 'aab39b', taiga: '587250', birch: '82a05f', forest: '5f8448', meadow: '9fb867', lakeland: '7fa461',
  moor: '948d68', coast: 'a9b877', cliffs: '9c9b82', fjord: '6e8668', mountains: '948f80', alpine: 'cfd1ca', sequoia: '4f6d40',
  redwood: '58723f', steppe: 'c4b97f', maquis: '9c9d5f', desert: 'e3cb92', canyon: 'c98b5b', badlands: 'bb8361', saltflat: 'ede7d8',
  savanna: 'c9b56c', rainforest: '427240', swamp: '627c50', marsh: '7d9662', karst: '81a068', volcano: '5d5752',
};
const RGB = Object.fromEntries(Object.entries(HEX).map(([k, h]) => [k, [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))]));
const SHALLOW = [104, 158, 176], DEEP = [38, 84, 112], ICE = RGB.ice;

// the biome colours on the 500 m cell grid, once, so a texel only blends four of them
let grid = null;
function biomeGrid() {
  if (grid) return grid;
  const nx = CELL.nx, nz = CELL.nz, g = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const c = RGB[earthBiome(EARTH.X0 + (i + .5) * CELL.step, EARTH.Z0 + (j + .5) * CELL.step)] || RGB.meadow, k = (j * nx + i) * 3;
    g[k] = c[0]; g[k + 1] = c[1]; g[k + 2] = c[2];
  }
  return (grid = g);
}
// the land texture: every texel's place on the strip, found by laying each cell of the lat/lon grid
// on the texture as two triangles and blending the strip's x, z across them. The land's colour is
// blended between the four nearest biome cells so their edges are soft. ~0.2 s, so it bakes
// once when the menu first opens (prebake), before the map is shown
let landPx = null;
export const prebake = () => { landPx ||= bakeLand(); };
function bakeLand() {
  const px = new Uint8Array(TW * TH * 4), g = biomeGrid(), nx = CELL.nx, nz = CELL.nz, st = CELL.step;
  new Uint32Array(px.buffer).fill(new Uint32Array(new Uint8Array([...ICE, 255]).buffer)[0]);   // past the strip: the polar ice
  const put = (u, v, x, z) => {
    const d = coastDist(x, z), k = (v * TW + ((u % TW) + TW) % TW) * 4;
    let r, gg, bb;
    if (d < 0) { const t = Math.min(1, -d / 2600); r = SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * t; gg = SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * t; bb = SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * t; }
    else {
      const cu = (x - EARTH.X0) / st - .5, cv = Math.min(nz - 1.001, Math.max(0, (z - EARTH.Z0) / st - .5));
      const i = Math.floor(cu), j = Math.floor(cv), fx = cu - i, fz = cv - j;
      const i0 = ((i % nx) + nx) % nx, i1 = (i0 + 1) % nx, a = (j * nx + i0) * 3, b = (j * nx + i1) * 3, c = ((j + 1) * nx + i0) * 3, e = ((j + 1) * nx + i1) * 3;
      const w0 = (1 - fx) * (1 - fz), w1 = fx * (1 - fz), w2 = (1 - fx) * fz, w3 = fx * fz;
      r = g[a] * w0 + g[b] * w1 + g[c] * w2 + g[e] * w3; gg = g[a + 1] * w0 + g[b + 1] * w1 + g[c + 1] * w2 + g[e + 1] * w3; bb = g[a + 2] * w0 + g[b + 2] * w1 + g[c + 2] * w2 + g[e + 2] * w3;
      if (d < 70) { const t = .5 + d / 140; r = SHALLOW[0] + (r - SHALLOW[0]) * t; gg = SHALLOW[1] + (gg - SHALLOW[1]) * t; bb = SHALLOW[2] + (bb - SHALLOW[2]) * t; }   // a soft shore
    }
    px[k] = r; px[k + 1] = gg; px[k + 2] = bb;
  };
  const corner = (i, j, ref) => {
    const n = j * LL.nx + ((i % LL.nx) + LL.nx) % LL.nx;
    let lon = LL.lon[n];
    if (ref != null) lon += 360 * Math.round((ref - lon) / 360);
    return { u: (lon + 180) / 360 * TW, v: (90 - LL.lat[n]) / 180 * TH, lon, x: EARTH.X0 + i * LL.step, z: EARTH.Z0 + j * LL.step };
  };
  const tri = (a, b, c) => {
    const u0 = Math.floor(Math.min(a.u, b.u, c.u)), u1 = Math.ceil(Math.max(a.u, b.u, c.u));
    const v0 = Math.max(0, Math.floor(Math.min(a.v, b.v, c.v))), v1 = Math.min(TH - 1, Math.ceil(Math.max(a.v, b.v, c.v)));
    const det = (b.v - c.v) * (a.u - c.u) + (c.u - b.u) * (a.v - c.v);
    if (Math.abs(det) < 1e-9) return;
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) {
      const pu = u + .5, pv = v + .5;
      const l1 = ((b.v - c.v) * (pu - c.u) + (c.u - b.u) * (pv - c.v)) / det, l2 = ((c.v - a.v) * (pu - c.u) + (a.u - c.u) * (pv - c.v)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      put(u, v, l1 * a.x + l2 * b.x + l3 * c.x, l1 * a.z + l2 * b.z + l3 * c.z);
    }
  };
  for (let j = 0; j < LL.nz - 1; j++) for (let i = 0; i < LL.nx; i++) {
    const a = corner(i, j), b = corner(i + 1, j, a.lon), c = corner(i, j + 1, a.lon), d = corner(i + 1, j + 1, a.lon);
    tri(a, b, c); tri(b, d, c);
  }
  return px;
}

const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D land, fog; uniform vec2 C; uniform float R, veil; uniform mat3 M;
out vec4 o;
const float PI = 3.14159265;
void main() {
  vec2 p = (gl_FragCoord.xy - C) / R; float r = length(p), aa = 1.5 / R;
  vec3 bg = mix(vec3(.10, .14, .18), vec3(.16, .22, .28), clamp(1. - gl_FragCoord.y / (C.y * 2.), 0., 1.) * .5);
  float halo = r > 1. ? exp(-(r - 1.) * R / 14.) * .55 : 0.;
  if (r > 1. + aa) { o = vec4(bg + vec3(.45, .65, .85) * halo, 1.); return; }
  vec3 v = vec3(p, sqrt(max(0., 1. - r * r))), w = M * v;
  float lat = asin(clamp(w.y, -1., 1.)), lon = atan(w.x, w.z);
  vec2 uv = vec2(lon / (2. * PI) + .5, .5 - lat / PI);
  vec2 dx = dFdx(uv), dy = dFdy(uv); dx.x -= round(dx.x); dy.x -= round(dy.x);   // no seam where lon wraps
  vec3 c = textureGrad(land, uv, dx, dy).rgb;
  float seen = textureGrad(fog, uv, dx, dy).r;
  c *= mix(1. - veil, 1., smoothstep(.0, .6, seen));
  // light from the upper left, a little darker at the rim, and a faint line every 30 degrees
  float l = .62 + .42 * max(0., dot(v, normalize(vec3(-.45, .55, .7))));
  c *= l * (.8 + .2 * v.z);
  vec2 g = abs(fract(vec2(lat, lon) / (PI / 6.) + .5) - .5) / fwidth(vec2(lat, lon) / (PI / 6.));
  c = mix(c, vec3(1.), (1. - smoothstep(0., 1., min(g.x, g.y))) * .08);
  c += vec3(.45, .65, .85) * pow(1. - v.z, 3.) * .35;   // the air at the edge
  o = vec4(mix(c, bg + vec3(.45, .65, .85) * .55, smoothstep(1. - aa, 1. + aa, r)), 1.);
}`;

export function createGlobe(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return null;
  const P = program(gl, VS, FS);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (w, h, fmt, ifmt, data) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  };
  let land = null;
  const fogPx = new Uint8Array(FW * FH);
  const fogTex = tex(FW, FH, gl.RED, gl.R8, fogPx);
  const M = new Float32Array(9);

  const G = {
    // the view -> world turn: spin about the pole to the centre's longitude, tip to its latitude
    turn(V) {
      const ca = Math.cos(V.lat * D), sa = Math.sin(V.lat * D), co = Math.cos(V.lon * D), so = Math.sin(V.lon * D);
      // Ry(lon) * Rx(-lat), column-major
      M.set([co, 0, -so, -so * sa, ca, -co * sa, so * ca, sa, co * ca]);
      return M;
    },
    // the fog from a list of seen places: each(fn) calls fn(x, z) once per seen cell
    fog(each) {
      fogPx.fill(0);
      each((x, z) => {
        const [lat, lon] = latLon(x, z), u = Math.floor((lon + 180) / 360 * FW), v = Math.floor((90 - lat) / 180 * FH);
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {   // a soft round dab
          const vv = v + j, a = 255 * Math.max(0, 1 - Math.hypot(i, j) / 2.6), k = vv * FW + ((u + i) % FW + FW) % FW;
          if (vv >= 0 && vv < FH && a > fogPx[k]) fogPx[k] = a;
        }
      });
      gl.bindTexture(gl.TEXTURE_2D, fogTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FW, FH, gl.RED, gl.UNSIGNED_BYTE, fogPx);
      gl.generateMipmap(gl.TEXTURE_2D);
    },
    draw(V, w, h, dpr, veil = .42) {
      if (!land) { prebake(); land = tex(TW, TH, gl.RGBA, gl.RGBA8, landPx); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(P.p); gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, land); gl.uniform1i(P.u.land, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fogTex); gl.uniform1i(P.u.fog, 1);
      gl.uniform2f(P.u.C, w / 2 * dpr, h / 2 * dpr); gl.uniform1f(P.u.R, V.R * dpr); gl.uniform1f(P.u.veil, veil);
      gl.uniformMatrix3fv(P.u.M, false, G.turn(V));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // [sx, sy, front] in CSS pixels; front is false on the far side of the ball
    project(V, w, h, lat, lon) {
      const m = G.turn(V), ca = Math.cos(lat * D), X = ca * Math.sin(lon * D), Y = Math.sin(lat * D), Z = ca * Math.cos(lon * D);
      // view = M^T world
      const vx = m[0] * X + m[1] * Y + m[2] * Z, vy = m[3] * X + m[4] * Y + m[5] * Z, vz = m[6] * X + m[7] * Y + m[8] * Z;
      return [w / 2 + vx * V.R, h / 2 - vy * V.R, vz > .02];
    },
    // [lat, lon] under a screen point, or null off the ball
    unproject(V, w, h, sx, sy) {
      const px = (sx - w / 2) / V.R, py = (h / 2 - sy) / V.R, r2 = px * px + py * py;
      if (r2 > 1) return null;
      const m = G.turn(V), pz = Math.sqrt(1 - r2);
      const X = m[0] * px + m[3] * py + m[6] * pz, Y = m[1] * px + m[4] * py + m[7] * pz, Z = m[2] * px + m[5] * py + m[8] * pz;
      return [Math.asin(Math.max(-1, Math.min(1, Y))) / D, Math.atan2(X, Z) / D];
    },
  };
  return G;
}
