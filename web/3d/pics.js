// Pictures of the game's own low-poly birds, for the menus and the song picker: one still of a mesh
// (pos, normal, colour, colour per vertex, as shapes.js builds them), lit like the bird lab and
// framed to fit, made once on a small canvas of its own and kept as an image URL.
import { program, perspective, lookAt, mul } from './gl.js';
import { VS, FS } from './birdlab.js';
import { birdShape } from './sys/songbirds.js';

let gl = null, P, vao, buf, cv;
const cache = new Map(), ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const SUN = (() => { const v = [.35, .85, .4], l = Math.hypot(...v); return v.map(x => x / l); })();

function init() {
  cv = document.createElement('canvas');
  gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return false;
  P = program(gl, VS, FS); vao = gl.createVertexArray(); buf = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (const [loc, size, off] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 3, 36]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 48, off); }
  gl.enable(gl.DEPTH_TEST);
  return true;
}

// a still of a mesh, w x h pixels, seen from `from` (a direction, nose of the bird along +x)
export function still(key, tris, { w = 128, h = 96, from = [.55, .32, .78] } = {}) {
  if (cache.has(key)) return cache.get(key);
  if (!gl && !init()) return '';
  // frame the mesh: its bounding sphere fills the view
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < tris.length; i += 12) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], tris[i + k]); hi[k] = Math.max(hi[k], tris[i + k]); }
  const c = lo.map((v, k) => (v + hi[k]) / 2), r = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2, l = Math.hypot(...from);
  const fov = .5, d = r / Math.sin(fov / 2) * .92, eye = c.map((v, k) => v + from[k] / l * d);
  cv.width = w; cv.height = h;
  gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(P.p);
  gl.uniformMatrix4fv(P.u.uVP, false, mul(perspective(fov, w / h, d * .05, d * 4), lookAt(eye, c, [0, 1, 0])));
  gl.uniformMatrix4fv(P.u.uModel, false, ID); gl.uniform3fv(P.u.uSun, SUN);
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, tris, gl.STATIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, tris.length / 12);
  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

// a songbird (songs.js SPECIES) sitting, from the front three-quarter; px is the width
export function songbirdPic(sp, px = 128) {
  return still(`sb${sp.id}:${px}`, birdShape(sp, 'fold'), { w: px, h: Math.round(px * .75) });
}
