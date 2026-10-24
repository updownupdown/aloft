// Looks behind Settings > Graphics > Ultra (app.js): P real shadows and T mirror reflections, each
// compiling a #define into the shaders (render.js R.relook). The look tests are all settled
// (James, 10-24): A to D, smooth shading and land detail were tried and taken out; the grain is
// Paper. ?look=shadows (or ?look=all) tries the Ultra ones for one visit without Ultra.

export const LOOKS = [
  { id: 'shadows', letter: 'P', def: 'L_SHADOW', ultra: true, label: 'Real shadows' },
  { id: 'reflect', letter: 'T', def: 'L_REFLECT', ultra: true, label: 'Mirror reflections' },
];

export function createLooks(G, R) {
  const q = new URLSearchParams(location.search).get('look'), forced = q ? new Set(q.split(',')) : null;
  R.look = {};
  const ultra = () => G.gfx?.preset === 'ultra';
  for (const L of LOOKS) R.look[L.id] = forced ? forced.has('all') || forced.has(L.id) || forced.has(L.letter) : ultra();
  R.relook?.();
  G.on('gfx', () => {
    if (forced) return;
    let changed = false;
    for (const L of LOOKS) if (R.look[L.id] !== ultra()) { R.look[L.id] = ultra(); changed = true; }
    if (changed) { R.relook?.(); G.emit('look', R.look); }
  });
}

// The colour grade, shared by every shader that writes the screen (render.js, clouds.js): a soft
// shoulder on the highlights, a warm lift in the shadows, and a tint for the time of day (uGradeT)
export const GRADE_GLSL = `
uniform vec3 uGradeT;
// the grain over everything: white noise on every screen pixel, a paper grain (James, 10-24:
// Paper). uGrain.y is its strength (render.js: a little stronger on dense phone screens)
float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
uniform vec4 uGrain;
float grain() { return 1. + (gh(floor(gl_FragCoord.xy)) - .5) * uGrain.y; }
vec3 grade(vec3 c) {
  c = c * (1. + c * .12) / (1. + c * .32);
  float l = dot(c, vec3(.3, .55, .15));
  c = mix(c, c * vec3(1.04, 1., .93) + vec3(.014, .009, 0.), 1. - smoothstep(.1, .5, l));
  c *= uGradeT * 1.07;
  return c;
}`;
const DAY = [1.015, 1, .975], GOLD = [1.07, .99, .86], NIGHT = [.93, .98, 1.06];
// the tint: a touch warm by day, golden with the sun low, cool at night
export function gradeTint(S) {
  const el = (S.sunSky || S.sun)[1], gold = Math.max(0, 1 - Math.abs(el - .06) / .22), n = S.night || 0;
  return DAY.map((v, k) => { const g = v + (GOLD[k] - v) * gold; return g + (NIGHT[k] - g) * n; });
}
