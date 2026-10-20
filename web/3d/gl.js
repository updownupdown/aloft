// Small WebGL2 helpers and 4x4 matrix maths (column-major, like GL). No library.
export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  return gl;
}

export function program(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

// A vertex array from interleaved float data. `layout` is [[location, size], ...].
export function mesh(gl, data, layout, { dynamic = false, instances = null, instLayout = null } = {}) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  const stride = layout.reduce((s, l) => s + l[1], 0) * 4;
  let off = 0;
  for (const [loc, size] of layout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); off += size * 4; }
  const m = { vao, buf, count: data.length / (stride / 4), ibuf: null, icount: 0 };
  if (instLayout) {
    m.ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf);
    const istride = instLayout.reduce((s, l) => s + l[1], 0) * 4; let ioff = 0;
    for (const [loc, size] of instLayout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, istride, ioff); gl.vertexAttribDivisor(loc, 1); ioff += size * 4; }
    if (instances) { gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW); m.icount = instances.length / (istride / 4); }
    m.istride = istride / 4;
  }
  gl.bindVertexArray(null);
  return m;
}
export function updateMesh(gl, m, data) { gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); m.count = data.length / (m.stride || 10); }

// ---- matrices --------------------------------------------------------------------------
export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function lookAt(e, c, up) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}
export function mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
  }
  return o;
}
// model matrix from a position and three basis vectors (right, up, forward)
export function basis(p, r, u, f, s = 1) {
  return new Float32Array([r[0] * s, r[1] * s, r[2] * s, 0, u[0] * s, u[1] * s, u[2] * s, 0, f[0] * s, f[1] * s, f[2] * s, 0, p[0], p[1], p[2], 1]);
}
export const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
