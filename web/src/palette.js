// Wet Wash palettes (day, dusk, night) blended by time of day, then greyed by weather.
import { hx, mix, grey, shade, clamp } from './util.js';

const raw = [
  { paper: '#f6f1e6', sky: '#6f9fc4', sky2: '#9ab8d6', horizon: '#e7c99a', sun: '#f3c766', cloudShade: '#9db0c4', far: '#8ea6b8', mid: '#6f9a86', near: '#4c7c5e', ground: '#7a6a4a', pine: '#3f6e55', pineDk: '#2e5542', leaf: '#6a9a62', leafHi: '#9ab86a', leafDk: '#4b7a4a', trunk: '#6d4a36', water: '#6d9cb8', bird: '#6a4530', birdWing: '#5a3a28', birdFar: '#3a2418', tail: '#b8532f', beak: '#d9a040', berry: '#b8324a', worm: '#d98a8a', thermal: '#e9b86a', ring: '#c8783a' },
  { paper: '#f6ead9', sky: '#8a6fa5', sky2: '#e38a6a', horizon: '#f2b276', sun: '#f09a52', cloudShade: '#b58aa0', far: '#a888a0', mid: '#7a6a8a', near: '#4f4a6c', ground: '#6a5060', pine: '#3f3d5e', pineDk: '#2d2b48', leaf: '#5c5a7a', leafHi: '#9a7a8a', leafDk: '#44405f', trunk: '#4d3a40', water: '#b58aa0', bird: '#4a3038', birdWing: '#3d262e', birdFar: '#26161c', tail: '#a8463a', beak: '#e0a060', berry: '#a8304a', worm: '#d08a8a', thermal: '#f0a060', ring: '#e08a50' },
  { paper: '#dfe2e6', sky: '#2d3f6e', sky2: '#3c4f82', horizon: '#7f8fb0', sun: '#e6e8ec', cloudShade: '#5c6a8c', far: '#55668a', mid: '#3f506f', near: '#2c3a55', ground: '#34364a', pine: '#243149', pineDk: '#1a2436', leaf: '#2f4059', leafHi: '#4b5e7a', leafDk: '#222e44', trunk: '#2c2a36', water: '#44557a', bird: '#2a2f45', birdWing: '#222738', birdFar: '#141826', tail: '#5a4062', beak: '#b8a070', berry: '#7a3a5a', worm: '#8a6a80', thermal: '#9aa0c0', ring: '#c0b080' },
];
const PALS = raw.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, hx(v)])));
const keys = Object.keys(PALS[0]);

// time of day key frames: 0 = midnight, .25 = sunrise, .5 = noon, .75 = sunset
const KF = [[0, 2], [.2, 2], [.27, 1], [.34, 0], [.68, 0], [.75, 1], [.82, 2], [1, 2]];

function blendTod(tod) {
  for (let i = 0; i < KF.length - 1; i++) {
    const [t0, a] = KF[i], [t1, b] = KF[i + 1];
    if (tod >= t0 && tod <= t1) {
      const f = t1 === t0 ? 0 : (tod - t0) / (t1 - t0), out = {};
      for (const k of keys) out[k] = mix(PALS[a][k], PALS[b][k], f);
      return out;
    }
  }
  return PALS[2];
}
// seasons: autumn turns the leaves ochre, winter greys the hills and whitens the ground,
// spring brings blossom. `sea` holds 0..1 amounts { autumn, winter, spring }.
const AUT = { leaf: hx('#c08a3a'), leafHi: hx('#d8a848'), leafDk: hx('#a0582e'), near: hx('#7a7a48'), mid: hx('#9a8a62') };
const WIN = { near: hx('#c4c8cc'), mid: hx('#9aa6b0'), far: hx('#aab4c0'), ground: hx('#8a8a90'), leaf: hx('#7a7468'), leafHi: hx('#9a9488'), leafDk: hx('#5e584e'), pine: hx('#4a6458'), sky: hx('#8aa4bc') };
const SPR = { leafHi: hx('#e8a8b8'), leaf: hx('#7aaa62'), near: hx('#5a8c58') };
function seasonal(P, sea, tod) {
  const day = 1 - nightness(tod) * .7;
  const apply = (T, k) => { if (k > 0) for (const key in T) P[key] = mix(P[key], shade(T[key], lerpN(1, day, .8)), k); };
  apply(AUT, sea.autumn * .75); apply(WIN, sea.winter * .7); apply(SPR, sea.spring * .55);
  P.blossom = mix(hx('#f0b8c8'), P.leafHi, .3);
}
const lerpN = (a, b, t) => a + (b - a) * t;
export const SEASONS = ['summer', 'autumn', 'winter', 'spring'];
// s runs 0..4 (summer, autumn, winter, spring); each season holds steady, then blends into the next
export function seasonAmounts(s) {
  const k = c => { let d = ((s - c) % 4 + 4) % 4; d = Math.min(d, 4 - d); return clamp(1.5 - 2 * d, 0, 1); };
  return { summer: k(0), autumn: k(1), winter: k(2), spring: k(3) };
}
// overcast: grey toward the cloud colour; dark: storm dimming
export function palette(tod, overcast, dark, sea = null) {
  const P = blendTod(tod);
  if (sea) seasonal(P, sea, tod);
  if (overcast > 0 || dark > 0) {
    for (const k of keys) {
      if (k === 'paper') { P[k] = shade(grey(P[k], overcast * .5), 1 - dark * .12); continue; }
      P[k] = shade(grey(P[k], overcast * .6), 1 - dark * .25);
    }
  }
  return P;
}
// how dark it is, 0 day to 1 deep night
export function nightness(tod) { const d = Math.abs(tod - .5) * 2; return clamp((d - .55) / .3, 0, 1); }
