// Draws a 3D frame: sky, ground chunks, instanced trees and rings, the hawk and its shadow,
// water, thermal motes. One lit shader with two-sided faces, hemisphere light, haze toward the
// horizon colour and a paper grain, so it stays in Aloft's palette at very little cost.
import { program, mesh, perspective, lookAt, mul, basis, IDENT } from './gl.js';
import { CHUNK, chunkMesh, cellsFor, treesNear, ringsNear, height, normalAt, thermalsNear, thermalCentre, TREE, perchesOf, env, WORLD, WIND } from './world.js';
import { ring, cloud, TREE_LOOKS } from './shapes.js';
import { buildHawk, HAWK_SCALE } from './hawk.js';
import { starPoints, starLines, GAL } from './stars.js';
import { createClouds, mistOf } from './clouds.js';
import { LOOKS, GRADE_GLSL, gradeTint } from './look.js';

// the sky's pole and the stars to steer by, until sys/nightsea.js sets them
const POLE = [0, .64, -.768], NOGAZE = new Float32Array(20), NOMOON = [0, 1, 0, 0], DOWN = [0, -1, 0, 0];
// instanced shapes that are cloud: see-through when the camera is close or inside
const CLOUDY = new Set(['cloud', 'cloudW', 'cloudT', 'cloudP', 'storm', 'puff', 'lens', 'devil', 'ringv']);
// shape -> [its far twin, metres]: the soaring hawks of a kettle (fauna.js) are a few pixels past 70 m
// the wind's way over the water (the swells run along it)
const SEA_D = (() => { const l = Math.hypot(WIND[0], WIND[2]); return [WIND[0] / l, WIND[2] / l]; })(), clamp01 = v => Math.min(1, Math.max(0, v));
// the small plants that sway in the breeze as the trees do (INST_VS), much more for their size
// flat plates lying on the ground (puddles, ice, rain pools, leaf litter): drawn pulled a little
// toward the camera, so the ground under them never shows through in flickering slivers
// shapes shaded round (smooth normals from their middle, INST_VS uRound): rocks and bushes
const ROUND = /^(stone|rock_boulder|rock_tor|scrub|bush|berries|bilberries|gorse|sage|thorn|heath)/;
const DECAL = new Set(['puddle', 'ice', 'pool', 'litter', 'petals']);
const GRASSY = new Set(['tuft', 'tuft1', 'tuft2', 'tuft3', 'flowerY', 'flowerW', 'flowerP', 'reeds', 'hay']);
const LOD = { soar: ['soarFar', 70] };
// the shadow map's size in pixels and its reach round the hawk in metres (look.js P)
const SHADOW_PX = 1024, SHADOW_R = 120;
// what each instanced shape is (uClass in COMMON_FS): animals, buildings, stones
const ANIMAL = /^(mouse|squirrel|marmot|jack|whale|fluke|turtle|crab|lizard|snake|heron|gull|eagle|kestrel|raven|sb|soar|perchbird|sitter|fish|flyfish|hawk|chick|broadwing)/;
const BUILT = /^(ru_|wd_|lm_|fence_)/;
const classOf = key => GRASSY.has(key) ? 3 : key === 'stone' ? 6 : BUILT.test(key) ? 2 : ANIMAL.test(key) ? 1 : 0;
// instanced shapes that hoar frost whitens (the plants and stones; not the animals)
const FROSTY = new Set(['tuft', 'tuft1', 'tuft2', 'tuft3', 'scrub', 'bush', 'gorse', 'sage', 'thorn', 'heath', 'reeds', 'stone', 'flowerY', 'flowerW', 'flowerP', 'hay', 'hayLaid', 'bale', 'barrel']);
const COMMON_FS = `
uniform vec3 uCam, uSun, uSunCol, uSkyAmb, uGndAmb, uFogCol, uFocus;
uniform vec3 uZenith;
uniform float uFogDen, uDither, uSeek, uCut, uFade, uWater, uLift, uTime;
uniform vec4 uShadeC[8], uFrost, uSwell, uMist; uniform vec2 uFrostDir; uniform vec3 uMistCol;
// what is being drawn (0 a prop, 1 an animal, 2 a building, 3 grass and
// flowers, 4 the hawk, 5 the ground, 6 a stone), the wet after rain, snow lying, the screen's size
uniform float uClass, uWet, uSnowLine, uSnowAll, uClip; uniform vec2 uScreen;
in vec3 vPos, vNrm, vCol, vColB; in float vLeaf, vFade, vGone, vLy; in vec4 vCrown;   // (a tree's crown: its middle and size)
out vec4 frag;
${GRADE_GLSL}
#ifdef L_SHADOW
// the shadow map round the hawk (render.js shadowPass): four soft taps, fading out at its edge
uniform mat4 uShadowVP; uniform highp sampler2DShadow uShadowTex;
float shadowAt(vec3 p, vec3 n) {
  vec4 q = uShadowVP * vec4(p + n * .3, 1.); vec3 s = q.xyz / q.w * .5 + .5;
  float edge = 1. - smoothstep(.4, .5, max(abs(s.x - .5), abs(s.y - .5)));
  if (edge <= 0. || s.z >= 1.) return 1.;
  vec2 t = vec2(1. / ${SHADOW_PX}.);
  float k = texture(uShadowTex, vec3(s.xy + t * vec2(-.6, -.6), s.z - .0012)) + texture(uShadowTex, vec3(s.xy + t * vec2(.6, -.6), s.z - .0012))
    + texture(uShadowTex, vec3(s.xy + t * vec2(-.6, .6), s.z - .0012)) + texture(uShadowTex, vec3(s.xy + t * vec2(.6, .6), s.z - .0012));
  return mix(1., .15 + .85 * k / 4., edge);
}
#endif
#ifdef L_REFLECT
uniform sampler2D uRefl;
#endif
// the hills' shadows: eight horizon heights round each spot, baked into the ground's back colour
// (world.js chunkMesh), 0..15 each, three to a channel; the sun is behind a hill when it is lower
float hills(vec3 b) {
  vec3 v = floor(b - 2. + .5);
  float h[8];
  h[0] = mod(v.x, 16.); h[1] = mod(floor(v.x / 16.), 16.); h[2] = floor(v.x / 256.);
  h[3] = mod(v.y, 16.); h[4] = mod(floor(v.y / 16.), 16.); h[5] = floor(v.y / 256.);
  h[6] = mod(v.z, 16.); h[7] = floor(v.z / 16.);
  float az = mod(atan(uSun.z, uSun.x) / 6.2832 * 8. + 8., 8.);
  int i = int(floor(az)); float f = fract(az);
  float a = mix(h[i], h[(i + 1) % 8], f) / 15.; a = a * a * 1.5708;
  return smoothstep(a - .05, a + .15, asin(clamp(uSun.y, -1., 1.)));   // (wide: the heights come in steps, and a narrow edge flipped whole valleys at once)
}
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// value noise repeating every P cells (land detail: read relative to uTile, a 4096 m corner near
// the camera, it carries on seamlessly when the corner moves)
uniform vec2 uTile;
float vnP(vec2 p, float P) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  #define HP(o) h21(mod(i + o, P))
  return mix(mix(HP(vec2(0)), HP(vec2(1, 0)), f.x), mix(HP(vec2(0, 1)), HP(vec2(1, 1)), f.x), f.y);
  #undef HP
}
// the drifting clouds' shadows (sys/air.js S.shadeC: x, z, radius, depth): soft discs that take
// some of the sun off whatever is under them
float sunlit(vec3 p) {
  if (p.y > 260.) return 1.;
  float s = 0.;
  for (int i = 0; i < 8; i++) { vec4 c = uShadeC[i]; if (c.z <= 0.) break; s = max(s, c.w * smoothstep(c.z, c.z * .55, length(p.xz - c.xy))); }   // nearest first; none left, stop
  return 1. - s;
}
// The water is drawn here, on whatever lies under it (the ground, a fish, the hawk's feet), not
// as a plane of its own: where the view ray crosses the surface (P) it takes the surface's look,
// seen through as much as the water is shallow (depth). No second surface, so nothing can fight
// at the shoreline, and no extra pass over the screen. The surface stays flat, but it is shaded as
// low-poly waves: a triangle grid whose corners ride the swell (sys/swells.js, the same phase) and
// a wind chop, so each facet tilts and catches the sky, the sun's glitter and the clouds' shadows
// on its own; whitecaps break on the crests in a wind, and slow slicks and gusts darken the sea.
// uSwell: the wind's way (x, z), the swell's strength here (0 lakes .. 1 the soaring ocean), the wind.
float waveH(vec2 p) {
  vec2 d = uSwell.xy, e = vec2(-d.y, d.x), d1 = normalize(d + e * .55), d2 = normalize(d - e * .6);
  float t = uTime, chop = .14 + .3 * uSwell.w;
  return 1.8 * uSwell.z * sin((dot(p, d) - 12. * t) * .0661)               // the swell: 95 m long, 12 m/s downwind (swells.js)
    + chop * (sin(dot(p, d1) * .45 - t * 2.1) + .7 * sin(dot(p, d2) * .7 - t * 2.6) + .45 * sin(dot(p, e) * 1.3 + t * 3.4));
}
vec4 waterAt(vec3 P, float depth) {
  vec3 v = normalize(uCam - P), lit = uSkyAmb + uSunCol * .6;
  float dist = length(uCam - P), near = 1. - smoothstep(90., 480., dist);
  // the facet under P: a lattice of 6 m triangles laid along the wind, its corners lifted by the waves
  // (past 480 m the facets have settled flat, so the far sea skips the 3 wave samples)
  vec3 n = vec3(0, 1, 0); vec2 i = vec2(0), c1 = vec2(0); float crest = 0.;
  if (near > 0.) {
    vec2 ax = uSwell.xy * 6., bx = (uSwell.xy * .5 + vec2(-uSwell.y, uSwell.x) * .866) * 6.;
    mat2 L = mat2(ax, bx);
    vec2 g = inverse(L) * P.xz, f; i = floor(g); f = g - i; c1 = f.x > f.y ? vec2(1, 0) : vec2(0, 1);
    vec2 a2 = L * i, b2 = L * (i + c1), e2 = L * (i + 1.);
    vec3 A = vec3(a2.x, waveH(a2), a2.y), B = vec3(b2.x, waveH(b2), b2.y), C = vec3(e2.x, waveH(e2), e2.y);
    n = normalize(cross(C - A, B - A)); if (n.y < 0.) n = -n;
    n = normalize(mix(vec3(0, 1, 0), vec3(n.x * 2.2, n.y, n.z * 2.2), near));   // tilts a little steeper to read, and settles with distance
    crest = (A.y + B.y + C.y) / 3.;
  }
  float sun = sunlit(P);
#ifdef L_SHADOW
  sun *= shadowAt(P, vec3(0, 1, 0));
#endif
  vec3 r = reflect(-v, n);
  float fr = .2 + .7 * pow(1. - max(dot(v, n), 0.), 3.);
  vec3 sky = mix(uFogCol, uZenith, pow(max(r.y, 0.), .55));
  // the same glow round the sun the sky has, and the horizon's light low across the water
  sky += uSunCol * (pow(max(dot(r, uSun), 0.), 12.) * .3 + pow(1. - max(r.y, 0.), 8.) * pow(max(dot(normalize(r.xz + 1e-4), normalize(uSun.xz + 1e-4)), 0.), 3.) * .22);
  float mir = .1 + fr * .28;
#ifdef L_REFLECT
  // the world mirrored (render.js reflectPass), rippled by the facets
  sky = mix(sky, texture(uRefl, gl_FragCoord.xy / uScreen + n.xz * .05 * near).rgb, .92); mir = .22 + fr * .55;
#endif
  float band = floor(smoothstep(0., 3.5, depth) * 4.) / 3.;
  // slow patches: wind slicks and darker gusts drifting downwind, so a wide water isn't one colour
  float slick = vn(P.xz / 240. - uSwell.xy * uTime * .02) * .6 + vn(P.xz / 70. + uTime * .03) * .4;
  vec3 c = mix(vec3(.42, .66, .62), mix(vec3(.16, .32, .42), vec3(.13, .27, .4), slick), band) * lit;
  c *= (.86 + .3 * max(dot(n, uSun), 0.)) * (.78 + .22 * sun);
  c = mix(c, sky, mir * (.85 + .3 * slick));
  // the sun's glitter: whole facets flash where they mirror the sun (kept soft)
  c += uSunCol * pow(max(dot(r, uSun), 0.), 90.) * .55 * sun * near;
  // whitecaps on the crests in a wind, a few facets at a time
  float wind = clamp(uSwell.z + uSwell.w - .35, 0., 1.);
  float cap = step(h21(i * 1.7 + c1 * 9. + floor(uTime * .5)), wind * .1) * smoothstep(.8, 1.8, crest) * near;
  float foam = max(1. - smoothstep(.04, .2, depth), cap * .8);
  return vec4(mix(c, vec3(.95) * lit, foam * .8), mix(.3, 1., smoothstep(0., 3.5, depth)));
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
// mist lying low (clouds.js mistOf, uMist: top, density, how deep its soft top is in metres,
// lumps of the top): fog thickening from nothing at a lumpy top to full uMist.z metres under it,
// the amount along the view ray from the camera to p worked out exactly (MF: how much fog lies
// above height y, per metre of height). Seen from above, each lump of the top is lit on the sun's
// side, so a sea of cloud has some shape.
vec3 mist(vec3 c, vec3 p) {
  if (uMist.y <= 0.) return c;
  vec3 rd = p - uCam; float L = length(rd), y0 = uCam.y, y1 = p.y, R = uMist.z;
  vec2 at = p.xz;
  if (y0 > uMist.x && y1 < y0) at = uCam.xz + rd.xz * clamp((y0 - uMist.x) / (y0 - y1), 0., 1.);   // where the ray comes down into it
  float lump = vn(at / 90.) * .7 + vn(at / 31.) * .3, top = uMist.x + (lump - .5) * uMist.w;
  #define MF(y) (max(top - (y), 0.) < R ? max(top - (y), 0.) * max(top - (y), 0.) / (2. * R) : top - (y) - R * .5)
  float dy = y1 - y0, f = abs(dy) > .05 ? (MF(y0) - MF(y1)) / dy : clamp((top - y0) / R, 0., 1.);
  #undef MF
  float k = 1. - exp(-uMist.y * L * max(f, 0.));
  float side = vn((at + uSun.xz * 14.) / 90.) * .7 + vn((at + uSun.xz * 5.) / 31.) * .3 - lump;
  // (seen from above its depths are greyer and its lumps lit on the sun's side; from inside it is
  // the one even colour the mist over the sky has, clouds.js MIST_FS, so the far land meets the sky)
  float above = smoothstep(top - 12., top + 12., y0);   // (eased, not a step: crossing the top turned the whole view at once)
  vec3 m = uMistCol * mix(1., mix(.84, 1., smoothstep(top - 40., top, max(y1, min(y0, top)))) + side * 1.6 + (lump - .5) * .12, above);
  return mix(c, m, k);
}
// the haze's colour along a view direction: warm toward the sun and cool away from it (the sky's
// horizon takes the same, SKY_FS skyBase, so far land fades into the sky it stands against)
// (and the sky's wide glow round a low sun, so the two agree on the skyline)
vec3 hazeCol(vec3 dir) {
  float cs = dot(dir, uSun), toward = pow(max(cs, 0.), 4.), away = pow(max(-cs, 0.), 2.);
  return uFogCol * mix(vec3(1.), vec3(1.07, 1., .88), toward) * mix(vec3(1.), vec3(.97, .99, 1.03), away) + uSunCol * (.08 * toward + pow(max(cs, 0.), 6.) * .2 * smoothstep(-.1, .1, uSun.y));
}
// aerial perspective: far things lose their colour toward the sky's blue; the haze lies low, so
// high ground thins it and far hills and peaks stand out on the skyline
vec3 aerial(vec3 c, vec3 p) {
  vec3 dir = normalize(p - uCam); float dd = length(p - uCam), ap = 1. - exp(-dd * .0006);
  float l = dot(c, vec3(.3, .55, .15)); c = mix(c, mix(vec3(l), uZenith * 1.1, .35), ap * .3);
  float d = dd * mix(1., .2, smoothstep(20., 250., p.y));
  return mix(c, hazeCol(dir), 1. - exp(-pow(d * uFogDen * .7, 1.6)));
}
vec3 haze(vec3 c, vec3 p) {
  // the mist: seen from above it lies under the far haze; from inside, nearer than it. The two
  // orders blend over 30 m round its top, so climbing out of it eases instead of jumping
  float over = uMist.y > 0. ? smoothstep(-15., 15., uCam.y - uMist.x - uMist.w * .5) : 1.;
  vec3 o = over > 0. ? aerial(mist(c, p), p) : c;
  return over < 1. ? mix(mist(aerial(c, p), p), o, over) : o;
}
`;
const LIT_FS = `#version 300 es
precision highp float;
${COMMON_FS}
void main() {
#ifndef SOLID
  // far tiles give way to the near ground inside uCut metres
  if (uCut > 0. && length(vPos.xz - uCam.xz) < uCut) discard;
  float alpha = 1.;
  // trees changing detail (uFade 1 the near mesh, 2 the far one) dissolve through each other by
  // vFade (0 near .. 1 far) as alpha, which the GPU spreads over its samples (alpha to coverage,
  // render.js trees pass)
  if (uFade > .5) {
    alpha = (uFade < 1.5 ? 1. - vFade : vFade) * (1. - vGone);
    if (alpha < .03) discard;
  }
  // clouds (uDither 2) are drawn blended, at most half there, thinning as the camera nears and
  // almost gone inside one
  if (uDither > 1.5) {
    alpha = mix(.06, .5, smoothstep(8., 90., length(vPos - uCam)));
  } else if (uDither > .5) {
    vec3 ab = uFocus - uCam, ap = vPos - uCam; float t = clamp(dot(ap, ab) / dot(ab, ab), 0., 1.);
    float dl = length(ap - ab * t), dc = length(ap), dh = length(vPos - uFocus);
    // uSeek (flaring to land, or perched) thins the leaves more and from farther off, to find a perch
    float e = uSeek, k;
    if (vLeaf > .5) {   // leaves, marked by the vertex shader before the autumn turn
      // foliage thins the nearer the camera comes, down to a light screen; it thins on the line to
      // the hawk and round the hawk itself, so leaves never hide it. Each crown thins as a whole,
      // by its nearest edge (vCrown): opening a hole in it showed its inside faces, like broken polygons
      vec3 cp = vCrown.xyz - uCam; float tc = clamp(dot(cp, ab) / dot(ab, ab), 0., 1.);
      float cl = max(length(cp - ab * tc) - vCrown.w, 0.), cdc = max(length(cp) - vCrown.w, 0.), cdh = max(length(vCrown.xyz - uFocus) - vCrown.w, 0.);
      float near = mix(.28 - .18 * e, 1., smoothstep(6. + 6. * e, 32. + 38. * e, cdc));
      float line = mix(.22, 1., smoothstep(1. + 3. * e, 6. + 12. * e, cl)) + step(.98, tc);
      float round = mix(.3, 1., smoothstep(2. + 3. * e, 10. + 14. * e, cdh));
      k = min(near, min(line, round));
    } else {
      // trunks and limbs stay solid so you can see what to land on, except one right between the
      // camera and the hawk, or brushing the lens; what is under the hawk (its perch) always shows
      k = max(min(smoothstep(.45, 1.3, dl) + step(.96, t), smoothstep(.8, 2.2, dc)), .1);
      k = mix(k, 1., smoothstep(uFocus.y + .2, uFocus.y - .6, vPos.y) * (1. - smoothstep(2., 4., dh)));
    }
    if (k < .99) alpha *= k;   // (alpha to coverage, as above)
  }
#else
  // SOLID: the same shader with no discard anywhere, so the GPU can drop hidden pixels before
  // shading them (early depth; a discard in a shader turns that off for everything it draws)
  float alpha = 1.;
#endif
#ifdef L_REFLECT
  if (uClip > .5 && vPos.y < uWater - .05) discard;   // the mirrored world: only what is above the water
#endif
  vec3 n = normalize(vNrm), col = vCol;
  if (!gl_FrontFacing) { n = -n; col = vColB.r > 1.5 ? vCol : vColB; }   // (the ground's back colour holds its hill shadows, hills())
  float y = vPos.y + uLift;
  // the land's hue drifts over a few hundred metres; the grass and flowers take the same drift
  if (uClass > 4.5 && uClass < 5.5 || uClass > 2.5 && uClass < 3.5) {
    float hd = vn(vPos.xz / 380.) - .5, hd2 = vn(vPos.xz / 95. + 17.) - .5;
    col *= vec3(1. + hd * .12 + hd2 * .04, 1. + hd2 * .05, 1. - hd * .12);
  }
#ifdef L_DETAIL
  // land detail: soft organic patches over the ground, tens of metres across far off (some drier and
  // warmer, some lusher), finer mottling nearer, finest at your feet. The noise repeats every 4096 m
  // (vnP, uTile), so it can be read near the camera at full precision anywhere in the world
  if (uClass > 4.5 && uClass < 5.5 && y > uWater) {
    float dd = length(vPos - uCam);
    vec2 q = vPos.xz - uTile;
    #define F(n) (float(n) / 4096.)
    vec2 w = vec2(vnP(q * F(96), 96.), vnP(q * F(96) + 7., 96.)) * 26.;   // a slow warp: no grid, no rows
    float big = vnP((q + w) * F(150), 150.) * .65 + vnP((q + w) * F(380), 380.) * .35;
    float mid = vnP((q + w * .3) * F(1900), 1900.) * .6 + vnP(q * F(4600), 4600.) * .4;
    float fine = vnP(q * F(15000), 15000.);
    #undef F
    float kb = 1. - smoothstep(300., 900., dd), km = 1. - smoothstep(50., 220., dd), kf = 1. - smoothstep(6., 45., dd);
    col *= 1. + (big - .5) * .34 * kb + (mid - .5) * .24 * km + (fine - .5) * .16 * kf;
    float dry = clamp((big - .5) * 1.6, -1., 1.) * kb;
    col *= dry > 0. ? mix(vec3(1.), vec3(1.07, 1.02, .85), dry) : mix(vec3(1.), vec3(.9, 1.04, .93), -dry);
  }
#endif
  if (uClass > 4.5 && uClass < 5.5 && y > uWater) col *= mix(.7, 1., smoothstep(uWater, uWater + .9, y));   // the wet band of shore
  if (uClass > 1.5 && uClass < 2.5) {
    float side = 1. - abs(n.y), along = dot(vPos.xz, normalize(vec2(-n.z, n.x) + 1e-4));
    col *= 1. - (1. - smoothstep(0., 1.4, vLy)) * .3;                                                  // damp at the foot
    float m = vn(vPos.xz * .9 + vPos.y * .4) * .6 + vn(vPos.xz * 3.1 + vPos.y) * .4;
    col = mix(col, vec3(.33, .42, .22), smoothstep(.52, .72, m) * smoothstep(.45, .9, n.y) * .75);    // moss on what faces up
    float st = vn(vec2(along * 2.2, vPos.y * .12)) * vn(vec2(along * 5.3 + 3., vPos.y * .3));
    col *= 1. - smoothstep(.25, .5, st) * side * .22;                                                  // streaks where the rain ran down
    float iv = vn(vec2(along * 1.4, vPos.y * 1.2)) * .7 + vn(vec2(along * 4., vPos.y * 3.)) * .3;
    col = mix(col, vec3(.21, .33, .16), smoothstep(.6, .66, iv + (1. - smoothstep(0., 3.5, vLy)) * .25 - .1) * side * .9);   // ivy from the ground up
  }
  if (uClass > 1.5 && uClass < 2.5 || uClass > 5.5) col = mix(col, vec3(.93, .95, .98), max(smoothstep(uSnowLine - 8., uSnowLine + 12., vPos.y), uSnowAll) * smoothstep(.35, .7, n.y) * .9);   // snow on roofs and stones
  bool wets = uClass > 4.5 && uClass < 5.5 || uClass > 1.5 && uClass < 2.5 || uClass > 5.5;
  if (wets) col *= 1. - uWet * .22;
  if (uClass > .5 && uClass < 1.5) col *= mix(1.12, .88, smoothstep(-.6, .7, n.y));   // counter-shading: dark backs, pale bellies
  if (uFrost.x > 0. && uDither < 1.5 && y > uWater) col = frosted(col, n, vPos);
  float sun = sunlit(vPos);
#ifdef L_SHADOW
  sun *= shadowAt(vPos, n);
#endif
  if (uClass > 4.5 && uClass < 5.5 && vColB.r > 1.5) sun *= hills(vColB);
  vec3 c = shade(col, n, sun), hp = vPos;
  { vec3 vd = normalize(vPos - uCam); float bk = pow(max(dot(vd, uSun), 0.), 3.) * sun;
    if (vLeaf > .5 || uClass > 3.5 && uClass < 4.5) c += col * uSunCol * bk * .5 * (1. - max(dot(n, uSun), 0.));   // leaves and feathers lit through
    if (uClass > .5 && uClass < 1.5 || uClass > 3.5 && uClass < 4.5) c += uSunCol * pow(1. - abs(dot(n, vd)), 3.) * (.1 + .45 * bk); }   // a rim of light
  if (uClass > .5 && uClass < 1.5 && dot(col, vec3(.333)) < .06) c += vec3(.9) * pow(max(dot(reflect(-uSun, n), normalize(uCam - vPos)), 0.), 16.) * sun + .03;   // a glint in the eye
  if (wets && uWet > 0.) {
    vec3 v = normalize(uCam - vPos), r = reflect(-v, n);
    float fr = pow(1. - max(dot(v, n), 0.), 4.), flat_ = smoothstep(.8, .97, n.y);
    c = mix(c, mix(uFogCol, uZenith, pow(max(r.y, 0.), .55)), uWet * (.08 + .5 * fr) * flat_);
    c += uSunCol * pow(max(dot(r, uSun), 0.), 40.) * uWet * .4 * sun * flat_;
  }
  // under the water (uLift: the far tiles are sunk a little under the near ground)
  if (y < uWater && uDither < 1.5) {
    if (uCam.y > uWater + .02) {
      // caustics on a shallow bottom
      float ca = vn(vPos.xz * .8 + uTime * .35) + vn(vPos.xz * 1.15 - uTime * .28 + 4.);
      c += uSunCol * pow(1. - abs(ca - 1.), 10.) * .2 * (1. - smoothstep(.4, 4., uWater - y)) * (1. - smoothstep(25., 120., length(vPos - uCam))) * sun;
      vec3 dir = vPos - uCam; hp = uCam + dir * ((uWater - uCam.y) / dir.y);
      vec4 w = waterAt(hp, uWater - y);
      c = mix(c, w.rgb, w.a);
    } else c = mix(c, vec3(.15, .3, .38) * (uSkyAmb + uSunCol * .5), .6);   // the camera itself under
  }
  frag = vec4(grade(haze(c, hp)) * grain(), alpha);
}`;
const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
uniform mat4 uVP, uModel; uniform vec3 uO;
out vec3 vPos, vNrm, vCol, vColB; out float vLeaf, vFade, vGone, vLy; out vec4 vCrown;
// positions are taken relative to uO, a point by the camera (render.js R.draw): the world is tens of
// kilometres across, and a float32 there is only good to 2 mm, which near the lens shook every
// edge by a pixel from frame to frame. uModel and uVP are both relative to uO
void main() {
  vec4 w = uModel * vec4(aPos, 1.);
  vPos = w.xyz + uO; vNrm = mat3(uModel) * aNrm; vCol = aCol; vColB = aColB; vLeaf = 0.; vFade = 0.; vGone = 0.; vLy = aPos.y; vCrown = vec4(0.);
  gl_Position = uVP * w;
}`;
const INST_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aColB;
layout(location=4) in vec4 iA; layout(location=5) in vec4 iB;
uniform mat4 uVP; uniform float uTime, uSway, uSnowLine, uRound; uniform vec3 uAutumn, uO, uCtr; uniform vec2 uWindD;

out vec3 vPos, vNrm, vCol, vColB; out float vLeaf, vFade, vGone, vLy; out vec4 vCrown;
void main() {
  vLy = aPos.y * iA.w;
  // trees carry their detail fade in the phase's fraction (render.js updateTrees): tenths are
  // how far from near to far (vFade), hundredths how far dissolved at the edge of the view (vGone)
  float fr = fract(iB.w); vFade = floor(fr * 10.) / 9.; vGone = floor(fract(fr * 10.) * 10.) / 9.;
  float c = cos(iB.x), s = sin(iB.x);
  float leafy = step(aCol.r * 1.05, aCol.g);
  vec3 p = aPos * iA.w;
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  // a turn past 1.5 means bare (winter broadleaves): the leaves fold to nothing on the trunk's axis
  p.xz *= 1. - step(1.5, iB.z) * leafy;
  // sway: each plant's own small rhythm, under waves of breeze rolling across the land downwind
  // (about 50 m apart at 9 m/s), so a meadow or a wood moves together in passing swells, leaning
  // with the wind and easing back
  float wave = sin(dot(iA.xz, uWindD) * .12 - uTime * 1.1 + sin(dot(iA.xz, vec2(-uWindD.y, uWindD.x)) * .05) * 1.5);
  float sway = (.35 * sin(uTime * 1.3 + iB.w + iA.x * .7) + .45 * wave + .35) * aPos.y * aPos.y * uSway * iA.w;
  p.xz += uWindD * sway;
  vec3 rel = p + (iA.xyz - uO);   // (relative to uO, see LIT_VS)
  vPos = rel + uO;
  vec3 n = aNrm;
  // smooth shading (James, 10-24): crowns, bushes and rocks shaded round, as if from their middle
  if (leafy > .5 && uRound < .5) n = normalize(mix(n, normalize(aPos - vec3(0., .62, 0.)), .75));
  else if (uRound > .5) n = normalize(mix(n, normalize(aPos - uCtr), .7));
  n.xz = vec2(c * n.x - s * n.z, s * n.x + c * n.z); vNrm = n;
  // leaves (greenish vertices) take a per-tree tint and the season's turn
  vec3 col = aCol * (.88 + iB.y * .24);
  col = mix(col, uAutumn * (.85 + iB.y * .3), leafy * clamp(iB.z, 0., 1.));
  // snow lies on the upturned leaves and needles above the snowline (world.js env.snowLine)
  col = mix(col, vec3(.93, .95, .98), leafy * smoothstep(uSnowLine - 8., uSnowLine + 12., vPos.y) * smoothstep(.05, .45, n.y) * .85);
  vCol = col; vColB = col; vLeaf = leafy;
  vCrown = vec4(iA.xyz + vec3(0., .62 * iA.w, 0.), .32 * iA.w);
  gl_Position = uVP * vec4(rel, 1.);
}`;
const SKY_VS = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vP;
void main() { vP = aP; gl_Position = vec4(aP, 1., 1.); }   // at the back: drawn last, where depth is still clear`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vP; out vec4 frag;
uniform mat4 uInvVP; uniform vec3 uZenith, uHorizon, uSun, uSunCol, uCloud; uniform float uNight, uTime, uAurora, uStarA, uStarK, uMoonK; uniform vec3 uPole, uGal, uSunSky; uniform vec4 uMoon;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
${GRADE_GLSL}
vec3 skyBase(vec3 d, float up) {
  // the horizon in the haze's own colour for this direction (COMMON_FS hazeCol)
  float ct = dot(d, uSun), toward = pow(max(ct, 0.), 4.), away = pow(max(-ct, 0.), 2.);
  vec3 hz = uHorizon * mix(vec3(1.), vec3(1.07, 1., .88), toward) * mix(vec3(1.), vec3(.97, .99, 1.03), away) + uSunCol * .08 * toward;
  vec3 c = mix(hz, uZenith, pow(up, .55));
  // scattering: bluer away from the sun, a wide warm glow round it (Mie) low down, and
  // with the sun near the horizon the pink Belt of Venus over the blue-grey Earth's shadow opposite
  // (uSunSky: the real sun, also at night)
  vec3 s = uSunSky; float cs = dot(d, s), el = s.y;
  c = mix(c, c * vec3(.92, .97, 1.08), (.5 - .5 * cs) * .5 * up);
  c += uSunCol * pow(max(cs, 0.), 6.) * (1. - up) * .2 * smoothstep(-.1, .1, el);
  float tw = 1. - smoothstep(.04, .28, abs(el + .03)), opp = pow(max(-cs, 0.), 1.5), lum = dot(uHorizon, vec3(.3, .55, .15));
  float belt = smoothstep(.03, .09, d.y) * (1. - smoothstep(.12, .26, d.y)) * opp, shadow = smoothstep(-.01, .02, d.y) * (1. - smoothstep(.03, .08, d.y)) * opp;
  c = mix(c, vec3(.93, .7, .72) * (.45 + .6 * lum), belt * tw * .5);
  c = mix(c, vec3(.44, .48, .62) * (.4 + .6 * lum), shadow * tw * smoothstep(.02, -.06, el) * .55);
  return c;
}
void main() {
  vec4 a = uInvVP * vec4(vP, -1., 1.), b = uInvVP * vec4(vP, 1., 1.);
  vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  float up = max(d.y, 0.);
  vec3 c = skyBase(d, up);
  // the sun's glow from the real sun (uSunSky: uSun turns over to the moonlight as it sets, and the
  // glow went with it in a jump), and a soft one round the moon
  float sd = max(dot(d, uSunSky), 0.);
  c += uSunCol * (pow(sd, 12.) * .25 + pow(sd, 900.) * 1.2) * (1. - uNight);
  c += uSunCol * pow(max(dot(d, uMoon.xyz), 0.), 12.) * .14 * uMoonK;
  float cl = 0.;
  if (d.y > .02) {
    vec2 q = d.xz / (d.y + .08) * 1.6 + vec2(uTime * .004, 0.);
    float n = vn(q) * .6 + vn(q * 2.3 + 7.) * .3 + vn(q * 5.1 + 3.) * .1;
    cl = smoothstep(.52, .78, n) * smoothstep(.02, .25, d.y);
    c = mix(c, uCloud, cl * .3);   // only faint high haze: the clouds themselves are meshes (sys/air.js)
  }
  // the Milky Way: a soft band along the galaxy's plane, on the sky's own sphere (the stars
  // themselves are points, stars.js / STAR_VS, steady as you turn)
  if (uNight > 0. && d.y > -.02) {
    vec3 U = vec3(0., -uPole.z, uPole.y); float ca = cos(uStarA), sa = sin(uStarA);
    float x = dot(d, U), z = -d.x;
    vec3 e = vec3(x * ca + z * sa, dot(d, uPole), x * sa - z * ca);
    float g = dot(e, uGal), mw = exp(-g * g * 22.) * (.55 + .45 * vn(e.xz * 3.1 + 5.) * vn(e.yz * 2.7 + 1.));
    c += vec3(.55, .6, .75) * mw * .07 * uNight * uStarK * (1. - cl) * smoothstep(-.02, .2, d.y);
  }
  // the moon: a lit ball, its bright limb toward the sun, the dark part only faintly lit (earthshine),
  // grey seas on its face
  if (uMoonK > 0.) {
    vec3 m = uMoon.xyz, mr = normalize(cross(m, vec3(0., 1., 0.))), mu = cross(mr, m);
    vec2 uv = vec2(dot(d, mr), dot(d, mu)) / .045; float r = length(uv);
    if (dot(d, m) > 0. && r < 6.) {
      float fw = fwidth(r), disc = 1. - smoothstep(1. - fw, 1. + fw, r);
      vec3 n = vec3(uv, sqrt(max(0., 1. - r * r)));
      vec2 s2 = vec2(0., 1.);   // the sun is down behind you, over the top of the sky: the bright limb is the top (from the sun's place it swung about as the sky raced round in sleep)
      float ph = uMoon.w * 6.2832, lit = smoothstep(-.04, .08, dot(n, vec3(s2 * sin(ph), -cos(ph))));
      float sea = vn(uv * 1.7 + 3.) * .7 + vn(uv * 3.9 + 9.) * .3;
      vec3 face = vec3(.97, .95, .88) * mix(1., .76, smoothstep(.42, .72, sea)) * (.78 + .22 * n.z);
      vec3 dark = c * .9 + vec3(.025, .03, .04);
      c = mix(c, mix(dark, face, lit), disc * uMoonK);
      float full = .5 - .5 * cos(ph);
      c += vec3(.55, .6, .68) * exp(-max(r - 1., 0.) * 1.3) * (1. - disc) * .16 * full * uMoonK;
    }
  }
  // northern lights: thin curtains high in the north, added to the sky (stars show through). The
  // view ray is stepped up through a layer of sky; where it meets a curtain's wavy line it glows,
  // green at the foot, fading to violet and nothing at the top, in fine vertical rays
  if (uAurora > .01 && d.y > .03) {
    vec3 au = vec3(0.);
    // (no screen-space dither in the steps: it stood still on the screen while the sky turned, and shook)
    for (int i = 0; i < 12; i++) {
      float k = (float(i) + .5) / 12.;
      vec2 p = d.xz / d.y * (1. + k * 1.4); float far = smoothstep(3., 9., length(p));   // fine detail fades low down, where it would alias
      for (int j = 0; j < 2; j++) {
        float o = float(j), w = p.y + 2.4 + o * 1.3 + sin(p.x * .45 + o * 2. + uTime * .04) * .7 + sin(p.x * 1.3 - uTime * .07 + o) * .25 * (1. - far);
        float ray = .45 + .55 * mix(vn(vec2(p.x * 4.5 + o * 5. + uTime * .08, k * .6)), .5, far);
        float glow = exp(-w * w * 6.) * ray * smoothstep(0., .18, k) * pow(1. - k, 1.6) * (1. - o * .4) * .8;
        au += mix(vec3(.25, 1., .55), vec3(.6, .35, 1.), k) * glow;
      }
    }
    c += au * (20. / 12.) * uAurora * .2 * smoothstep(.03, .15, d.y) * (1. - cl);
  }
  frag = vec4(grade(c) * grain(), 1.);
}`;
const FLAT_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform vec3 uO; uniform float uPx; out vec4 vC; out float vF;
void main() { gl_Position = uVP * vec4(aP - uO, 1.); vC = aC; gl_PointSize = uPx * aC.a * 2. / gl_Position.w; vF = 1.;
  vF = smoothstep(.6, 5., gl_Position.w);   // motes and ribbons fade as they reach the lens
}`;
const FLAT_FS = `#version 300 es
precision highp float; in vec4 vC; in float vF; out vec4 frag; uniform float uPoints;
${GRADE_GLSL}
void main() { float a = 1.; if (uPoints > .5) { vec2 d = gl_PointCoord - .5;
  a = smoothstep(.5, 0., length(d));
  }
  frag = vec4(grade(vC.rgb), a * (uPoints > .5 ? .8 : vC.a) * vF); }`;

// The stars: steady points on the sky's sphere (stars.js), turned to the world as skyDir() does,
// drawn just behind everything. Only a few of the brightest gently glow, more so low down; a
// constellation you look at brightens (uGaze, sys/nightsea.js) and its lines come in
const STAR_VS = `#version 300 es
layout(location=0) in vec3 aE; layout(location=1) in vec3 aC; layout(location=2) in vec3 aK;
uniform mat4 uVR; uniform vec3 uPole; uniform vec4 uMoon; uniform float uA, uPx, uNight, uTime, uLine, uGaze[20]; out vec3 vC;
void main() {
  float ca = cos(uA), sa = sin(uA), x = aE.x * ca + aE.z * sa, z = aE.x * sa - aE.z * ca;
  vec3 d = vec3(-z, x * -uPole.z + aE.y * uPole.y, x * uPole.y + aE.y * uPole.z);
  gl_Position = uVR * vec4(d, 1.); gl_Position.z = gl_Position.w * .99999;
  float g = aK.y < -.5 ? 0. : uGaze[int(aK.y + .5)], low = 1. - smoothstep(.05, .4, d.y);
  float tw = 1. + aK.z * (.16 + .2 * low) * sin(uTime * (.6 + fract(aE.x * 91.7) * .9) + aE.z * 40.);
  float k = uNight * smoothstep(-.01, .1, d.y) * smoothstep(.9988, .9984, dot(d, uMoon.xyz));   // none in front of the moon
  if (uLine > .5) { vC = vec3(.62, .74, 1.) * .3 * g * k; gl_PointSize = 1.; }
  else { vC = aC * k * tw * (1. + 1.3 * g); gl_PointSize = aK.x * uPx * (1. + .3 * g); }
}`;
const STAR_FS = `#version 300 es
precision highp float; in vec3 vC; out vec4 frag; uniform float uLine;
void main() { float a = 1.; if (uLine < .5) a = 1. - smoothstep(.12, .5, length(gl_PointCoord - .5)); frag = vec4(vC * a, 1.); }`;

// the look tests' passes (look.js): depth alone (the shadow map, P)
const DEPTH_FS = `#version 300 es
precision highp float; out vec4 frag; void main() { frag = vec4(1.); }`;
// O: a far tree as a picture of its near mesh, turned to face the camera
const IMP_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=4) in vec4 iA; layout(location=5) in vec4 iB;
uniform mat4 uVP; uniform vec3 uCam, uO; uniform vec4 uCell; uniform vec2 uSize;
out vec3 vPos, vNrm, vCol, vColB; out float vLeaf, vFade, vGone, vLy; out vec4 vCrown; out vec2 vUV; out float vTint, vTurn;
void main() {
  float fr = fract(iB.w); vFade = floor(fr * 10.) / 9.; vGone = floor(fract(fr * 10.) * 10.) / 9.;
  vec2 f = normalize(uCam.xz - iA.xz + 1e-4); vec3 right = vec3(f.y, 0., -f.x);
  vec3 rel = (iA.xyz - uO) + right * aPos.x * uSize.x * iA.w + vec3(0., aPos.y * uSize.y * iA.w, 0.);
  vPos = rel + uO;
  // a ball's normal across the picture, so the crown takes the light round
  vNrm = normalize(vec3(f.x, 0., f.y) * .8 + right * aPos.x * 1.4 + vec3(0., .55 + (aPos.y - .45) * 1.2, 0.));   // (leaning up, as most of a crown's facets do)
  vCol = vec3(1.); vColB = vCol; vLeaf = 0.; vLy = aPos.y; vCrown = vec4(0.);
  vUV = uCell.xy + vec2(aPos.x + .5, aPos.y) * uCell.zw; vTint = iB.y; vTurn = iB.z;
  gl_Position = uVP * vec4(rel, 1.);
}`;
const IMP_FS = `#version 300 es
precision highp float;
${COMMON_FS}
in vec2 vUV; in float vTint, vTurn; uniform sampler2D uAtlas; uniform vec3 uAutumn;
void main() {
  vec4 t = texture(uAtlas, vUV);
  if (t.a < .5) discard;
  float alpha = 1.;
  ivec2 bq = ivec2(gl_FragCoord.xy) & 3;
  float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  float bh = (bayer[bq.x + bq.y * 4] + .5) / 16.;
  alpha = vFade * (1. - vGone); if (alpha < .03) discard;
  vec3 col = t.rgb / max(t.a, .01);
  float leafy = step(col.r * 1.05, col.g);
  if (vTurn > 1.5 && leafy > .5) discard;   // bare in winter
  col *= .88 + vTint * .24;
  col = mix(col, uAutumn * (.85 + vTint * .3), leafy * clamp(vTurn, 0., 1.));
  col = mix(col, vec3(.93, .95, .98), leafy * smoothstep(uSnowLine - 8., uSnowLine + 12., vPos.y) * .5);
  vec3 n = normalize(vNrm);
  vec3 c = shade(col, n, sunlit(vPos));
  frag = vec4(grade(haze(c, vPos)) * grain(), alpha);
}`;
// the atlas the pictures come from: each look's near mesh, side on, in its plain colours
const ATLAS_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=2) in vec3 aCol; uniform vec2 uBox; out vec3 vC;
void main() { vC = aCol; gl_Position = vec4(aPos.x / uBox.x, aPos.y / uBox.y * 2. - 1., -aPos.z / uBox.x * .5, 1.); }`;
const ATLAS_FS = `#version 300 es
precision highp float; in vec3 vC; out vec4 frag; void main() { frag = vec4(vC, 1.); }`;

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

// how far a tree's wood at height y has swayed (render's INST_VS sway, the same sum in JS), so a
// bird perched on a limb moves with it rather than seeming to slide along it
export function treeSway(t, y, time, wind) {
  const ay = (y - t.y) / t.s, D = SEA_D, ph = Math.floor(Math.abs(t.id)) % 97 + .05;
  const wave = Math.sin((t.x * D[0] + t.z * D[1]) * .12 - time * 1.1 + Math.sin((-t.x * D[1] + t.z * D[0]) * .05) * 1.5);
  const sway = (.35 * Math.sin(time * 1.3 + ph + t.x * .7) + .45 * wave + .35) * ay * ay * (.012 + wind * .02) * t.s;
  return [D[0] * sway, D[1] * sway];
}

export function createRenderer(gl) {
  // the shaders, built again with the look tests' #defines (look.js O-V) whenever one is switched (R.relook)
  let lit, inst, sky, solid, solidInst, flat, stars, depthLit, depthInst, impP;
  const SOLID_FS = LIT_FS.replace('precision highp float;', 'precision highp float;\n#define SOLID');
  function compile() {
    const d = LOOKS.filter(L => L.def && R.look?.[L.id]).map(L => `#define ${L.def}\n`).join(''), D = src => src.replace('#version 300 es', '#version 300 es\n' + d);
    for (const P of [lit, inst, sky, solid, solidInst, flat, stars, depthLit, depthInst, impP]) if (P) gl.deleteProgram(P.p);
    lit = program(gl, D(LIT_VS), D(LIT_FS)); inst = program(gl, D(INST_VS), D(LIT_FS)); sky = program(gl, SKY_VS, D(SKY_FS));
    solid = program(gl, D(LIT_VS), D(SOLID_FS)); solidInst = program(gl, D(INST_VS), D(SOLID_FS));
    flat = program(gl, FLAT_VS, D(FLAT_FS)); stars = program(gl, STAR_VS, STAR_FS);
    depthLit = program(gl, D(LIT_VS), DEPTH_FS); depthInst = program(gl, D(INST_VS), DEPTH_FS);
    impP = program(gl, D(IMP_VS), D(IMP_FS));
    vol?.relook(d);
  }
  const starPts = mesh(gl, starPoints(), [[0, 3], [1, 3], [2, 3]]), starLn = mesh(gl, starLines(), [[0, 3], [2, 3]]);
  const tri = mesh(gl, new Float32Array([-1, -1, 3, -1, -1, 3]), [[0, 2]]);
  // a picture's quad (x across -.5..5, y up 0..1) reading its instances from another mesh's buffer
  function quadOn(ibuf) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, 0, 0, .5, 0, 0, .5, 1, 0, -.5, 0, 0, .5, 1, 0, -.5, 1, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
    for (const [loc, off] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 32, off); gl.vertexAttribDivisor(loc, 1); }
    gl.bindVertexArray(null);
    return { vao };
  }
  // one pair of meshes (near, far) per tree look (shapes.js TREE_LOOKS; a tree's look ?? kind)
  const kinds = TREE_LOOKS.map((L, i) => {
    const nd = L.near(), fd = toneMatch(nd, L.far ? L.far() : lod(i));
    const k = { near: mesh(gl, nd, LAYOUT, { instLayout: ILAYOUT }), far: mesh(gl, fd, LAYOUT, { instLayout: ILAYOUT }), autumn: L.autumn, nearData: nd };
    // the flat trees: the near mesh drawn once into the atlas (impostors()), shown as a picture on a
    // quad beyond R.flatTrees, with instances of their own
    k.plain = mesh(gl, nd, LAYOUT); k.flatBuf = gl.createBuffer(); k.imp = quadOn(k.flatBuf); k.flatN = 0;
    return k;
  });
  // instanced shapes by name; systems register their own with R.shape(name, triangles)
  const shapes = new Map();
  const shape = (key, data) => {
    const old = shapes.get(key); if (old) { gl.deleteBuffer(old.buf); gl.deleteBuffer(old.ibuf); gl.deleteVertexArray(old.vao); }
    const m = mesh(gl, data, LAYOUT, { instLayout: ILAYOUT });
    // how far it reaches from its origin, and across the ground (for culling; its soft patch on
    // the ground)
    let rad = 0, foot = 0;
    for (let o = 0; o < data.length; o += 12) { rad = Math.max(rad, Math.hypot(data[o], data[o + 1], data[o + 2])); foot = Math.max(foot, Math.hypot(data[o], data[o + 2])); }
    m.rad = rad; m.foot = foot;
    let y0 = 1e9, y1 = -1e9; for (let o = 0; o < data.length; o += 12) { y0 = Math.min(y0, data[o + 1]); y1 = Math.max(y1, data[o + 1]); }
    m.ctr = [0, (y0 + y1) * .45, 0];   // (the middle smooth shading rounds it from)
    shapes.set(key, m);
  };
  shape('ring', ring()); shape('cloud', cloud());
  // the clouds as soft volumes (clouds.js), when Settings > Graphics > Clouds isn't Polygons
  const vol = createClouds(gl);
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
  const R = { cloudStyle: 'poly', chunks, view: 520, treeView: 360, nearTrees: 110, flatTrees: 240, stats: { chunks: 0, trees: 0, tris: 0 }, treeAt: null, look: {} };
  compile();
  R.relook = () => { compile(); };
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
      if (worker) { farBusy.add(k); worker.postMessage({ k, cx: tx, cz: tz, cells: FAR_CELLS, size: FAR_TILE, drop: FAR_DROP, far: true, gen, seed: WORLD.seed, yearFrac: env.yearFrac }); }
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
        worker.postMessage({ k: w[3], cx: w[1], cz: w[2], cells: w[4], gen, seed: WORLD.seed, yearFrac: env.yearFrac });
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
  // TREE_EDGE metres of the view (never scaled, so nothing seems to grow), so none pops; the buckets are redone every few metres to keep it smooth.
  // Past R.flatTrees (main.js treeGfx: nearer on Low, farthest on Ultra) the far mesh dissolves the
  // same way, over TREE_BAND * 1.5, into a flat picture of the tree
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
    const flo = R.flatTrees - TREE_BAND * .75, fhi = R.flatTrees + TREE_BAND * .75;
    const buckets = kinds.map(() => [[], [], []]);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), cone = v && !steep ? Math.cos(Math.min(Math.PI, Math.atan(Math.tan(v.fov / 2) * v.aspect) + .75)) : -2;
    const cx = v ? v.cam[0] : p[0], cz = v ? v.cam[2] : p[2];
    let drawn = 0;
    for (const t of treeAll) {
      const d = Math.hypot(t.x - p[0], t.z - p[2]); if (d > tv) continue;
      const dx = t.x - cx, dz = t.z - cz, dc = Math.hypot(dx, dz);
      if (dc > 40 && (dx * fx + dz * fz) / dc < cone) continue;   // well off to the side or behind
      const k = t.look ?? t.kind, turn = season.bare && kinds[k].autumn >= .5 ? 2 : season.autumn * (.5 + t.tint) * kinds[k].autumn;   // 2: bare
      const f = Math.round(Math.min(1, Math.max(0, (d - lo) / (hi - lo))) * 9), g = Math.round(Math.min(1, Math.max(0, (d - tv + TREE_EDGE) / TREE_EDGE)) * 9);
      const fl = Math.round(Math.min(1, Math.max(0, (d - flo) / (fhi - flo))) * 9), id = Math.floor(Math.abs(t.id)) % 97;
      // (the hundredths: how far dissolved, at the view's edge or into the flat picture)
      const ph = id + f * .1 + Math.max(g, fl) * .01 + .005;
      if (f < 9) buckets[k][0].push(t.x, t.y, t.z, t.s, t.yaw, t.tint, turn, ph);
      if (f > 0 && fl < 9) buckets[k][1].push(t.x, t.y, t.z, t.s, t.yaw, t.tint, turn, ph);
      if (fl > 0) buckets[k][2].push(t.x, t.y, t.z, t.s, t.yaw, t.tint, turn, id + .9 + Math.max(g, 9 - fl) * .01 + .005);
      drawn++;
    }
    R.stats.trees = drawn;
    for (let k = 0; k < kinds.length; k++) {
      for (let l = 0; l < 2; l++) { const m = l ? kinds[k].far : kinds[k].near, data = buckets[k][l]; upload(m.ibuf, data); m.icount = data.length / 8; }
      upload(kinds[k].flatBuf, buckets[k][2]); kinds[k].flatN = buckets[k][2].length / 8;
    }
  }

  function setLight(P, S) {
    if (P.u.uO) gl.uniform3fv(P.u.uO, R.O);
    gl.uniform3fv(P.u.uCam, S.cam); gl.uniform3fv(P.u.uSun, S.sun); gl.uniform3fv(P.u.uSunCol, S.sunCol);
    gl.uniform3fv(P.u.uSkyAmb, S.skyAmb); gl.uniform3fv(P.u.uGndAmb, S.gndAmb); gl.uniform3fv(P.u.uFogCol, S.horizon);
    gl.uniform1f(P.u.uFogDen, S.fogDen); gl.uniform3fv(P.u.uFocus, S.focus); gl.uniform1f(P.u.uDither, 0); gl.uniform1f(P.u.uCut, 0); gl.uniform1f(P.u.uFade, 0); gl.uniform1f(P.u.uWater, S.water ?? 0); gl.uniform1f(P.u.uLift, 0); gl.uniform3fv(P.u.uZenith, S.zenith); gl.uniform1f(P.u.uTime, S.time); if (P.u.uSeek) gl.uniform1f(P.u.uSeek, S.seek || 0); if (P.u.uSwell) gl.uniform4fv(P.u.uSwell, [SEA_D[0], SEA_D[1], S.swell ?? 0, clamp01(S.wind ?? .3)]);
    gl.uniform4fv(P.u.uShadeC, shadeC(S)); gl.uniform4fv(P.u.uFrost, S.frost || NOFROST); gl.uniform2fv(P.u.uFrostDir, S.frostDir || [1, 0]);
    gl.uniform4fv(P.u.uMist, S.mistU || NOMIST); gl.uniform3fv(P.u.uMistCol, S.mistCol || ONE3);
    const u = P.u;
    if (u.uGradeT) gl.uniform3fv(u.uGradeT, S.gradeT || ONE3);
    if (u.uGrain) gl.uniform2fv(u.uGrain, S.grain);
    if (u.uClass) gl.uniform1f(u.uClass, 0);
    if (u.uRound) gl.uniform1f(u.uRound, 0);
    if (u.uTile) gl.uniform2f(u.uTile, Math.round(S.cam[0] / 4096) * 4096, Math.round(S.cam[2] / 4096) * 4096);
    if (u.uClip) gl.uniform1f(u.uClip, 0);
    if (u.uWet) gl.uniform1f(u.uWet, S.wet || 0);
    if (u.uSnowAll) gl.uniform1f(u.uSnowAll, env.snow > .5 ? (env.snow - .5) * 1.6 : 0);
    if (u.uSnowLine) gl.uniform1f(u.uSnowLine, S.snowLine ?? 999);
    if (u.uScreen) gl.uniform2f(u.uScreen, R.vw || 1, R.vh || 1);
    if (u.uShadowTex) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(u.uShadowTex, 3); gl.uniformMatrix4fv(u.uShadowVP, false, R.shadowVP || NOSHADOW); gl.activeTexture(gl.TEXTURE0); }
    if (u.uRefl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.reflOn ? refl.tex : blank()); gl.uniform1i(u.uRefl, 2); gl.activeTexture(gl.TEXTURE0); }
  }
  // the cloud shadows as 8 vec4s (unused ones radius 0)
  const SHADE = new Float32Array(32), NOFROST = [0, 0, 0, 0], NOMIST = [0, 0, 8, 0], ONE3 = [1, 1, 1];
  // (a shadow map matrix that puts everything off the map, so nothing is shadowed)
  const NOSHADOW = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 0, 0, 1]);
  function shadeC(S) {
    SHADE.fill(0);
    (S.shadeC || []).slice(0, 8).forEach((c, i) => SHADE.set(c, i * 4));
    return SHADE;
  }

  // ---- the look tests' passes (look.js) ----------------------------------------------------
  // P, the shadow map: the land, trees, props and hawk within SHADOW_R metres of the hawk, drawn
  // from the sun into a depth texture each frame (by day), read back in COMMON_FS shadowAt()
  let shadowFB = null, shadowTex = null;
  function shadowPass(S) {
    if (!shadowFB) {
      shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_PX, SHADOW_PX);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    }
    const sun = S.sun, c = S.hawk.p;
    if (sun[1] < .04) { R.shadowVP = NOSHADOW; return; }
    // snapped to whole texels as the hawk moves, so the edges of shadows don't crawl
    const view = lookAt([c[0] + sun[0] * 400, c[1] + sun[1] * 400, c[2] + sun[2] * 400], c, Math.abs(sun[1]) > .98 ? [1, 0, 0] : [0, 1, 0]);
    const proj = ortho(SHADOW_R, 10, 900), vp = mul(proj, view), tx = 2 / SHADOW_PX;
    const ox = vp[12], oy = vp[13]; vp[12] = Math.round(ox / tx) * tx; vp[13] = Math.round(oy / tx) * tx;
    R.shadowVP = vp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, SHADOW_PX, SHADOW_PX);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
    const P = planes(vp);
    gl.useProgram(depthLit.p); gl.uniformMatrix4fv(depthLit.u.uVP, false, vp);
    gl.uniformMatrix4fv(depthLit.u.uModel, false, basis(S.hawk.p, S.hawk.r, S.hawk.u, S.hawk.f, HAWK_SCALE));
    gl.bindVertexArray(hawk.vao); gl.drawArrays(gl.TRIANGLES, 0, R.hawkMesh.length / 12);
    gl.uniformMatrix4fv(depthLit.u.uModel, false, IDENT);
    for (const ch of chunks.values()) if (boxIn(P, ch.cx * CHUNK, ch.y0 - 3, ch.cz * CHUNK, (ch.cx + 1) * CHUNK, ch.y1, (ch.cz + 1) * CHUNK)) { gl.bindVertexArray(ch.m.vao); gl.drawArrays(gl.TRIANGLES, 0, ch.m.count); }
    gl.useProgram(depthInst.p); gl.uniformMatrix4fv(depthInst.u.uVP, false, vp); gl.uniform1f(depthInst.u.uTime, S.time); gl.uniform2fv(depthInst.u.uWindD, SEA_D); gl.uniform1f(depthInst.u.uSnowLine, 999);
    gl.uniform1f(depthInst.u.uSway, .012 + S.wind * .02);
    for (const k of kinds) for (const m of [k.near, k.far]) if (m.icount) { gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.icount); }
    gl.uniform1f(depthInst.u.uSway, 0);
    S_.props = S.props; S_.swaying = false; S_.grassSway = 0;
    const prop = propOf(depthInst, P);
    for (const key in S.props) if (!CLOUDY.has(key) && !GRASSY.has(key)) prop(key);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  // an orthographic box r wide each way, near to far along the view
  function ortho(r, n, f) { return new Float32Array([1 / r, 0, 0, 0, 0, 1 / r, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1]); }

  // T, mirror reflections: the world above the water drawn mirrored in it, at half size, into a
  // picture the water shows (COMMON_FS waterAt)
  const refl = { fb: null, tex: null, rb: null, w: 0, h: 0 };
  let blankTex = null;
  const blank = () => {
    if (!blankTex) { blankTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blankTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 150, 170, 255])); }
    return blankTex;
  };
  function target(o, w, h, depth = true) {
    if (o.fb && o.w === w && o.h === h) return o;
    if (o.fb) { gl.deleteFramebuffer(o.fb); gl.deleteTexture(o.tex); if (o.rb) gl.deleteRenderbuffer(o.rb); }
    o.w = w; o.h = h;
    o.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, o.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    o.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, o.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, o.tex, 0);
    o.rb = null;
    if (depth) { o.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, o.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, o.rb); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return o;
  }
  function reflectPass(S, vp, vpO, proj, w, h, pf) {
    R.reflOn = false;
    const W = S.water ?? 0; if (S.cam[1] < W + .3) return false;
    pf?.pass('mirror');
    target(refl, Math.max(1, w >> 1), Math.max(1, h >> 1));
    // the view times a mirror in the plane y = W: the same screen place shows the mirrored point
    const M = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * W, 0, 1]), vpm = mul(vp, M), vpmO = mul(vpO, M);
    const m = v => [v[0], 2 * W - v[1], v[2]];
    const SM = Object.assign({}, S, { cam: m(S.cam), focus: m(S.focus), look: m(S.look) });
    gl.bindFramebuffer(gl.FRAMEBUFFER, refl.fb); gl.viewport(0, 0, refl.w, refl.h);
    gl.clearColor(S.horizon[0], S.horizon[1], S.horizon[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    drawWorld(SM, vpmO, proj, planes(vpm), 1, null);
    if (R.cloudStyle !== 'poly') vol.draw(SM, vpm, S.props, R.cloudStyle, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  // O, far-tree pictures: each tree look's near mesh drawn once from the side into an atlas (its
  // plain colours; the shader lights the picture as a ball and tints it as the trees are tinted)
  let imp = null;
  function impostors() {
    if (imp) return imp;
    const was = gl.getParameter(gl.FRAMEBUFFER_BINDING), vpWas = gl.getParameter(gl.VIEWPORT);
    const CW = 128, CH = 256, COLS = 10, rows = Math.ceil(kinds.length / COLS), W = CW * COLS, H = CH * rows;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const A = program(gl, ATLAS_VS, ATLAS_FS); gl.useProgram(A.p); gl.enable(gl.DEPTH_TEST);
    const cells = [], sizes = [];
    kinds.forEach((k, i) => {
      const d = k.nearData; let reach = .01, top = .01;
      for (let o = 0; o < d.length; o += 12) { reach = Math.max(reach, Math.abs(d[o]), Math.abs(d[o + 2])); top = Math.max(top, d[o + 1]); }
      const cx = i % COLS, cy = Math.floor(i / COLS);
      gl.viewport(cx * CW, cy * CH, CW, CH); gl.uniform2f(A.u.uBox, reach, top);
      gl.bindVertexArray(k.plain.vao); gl.drawArrays(gl.TRIANGLES, 0, k.plain.count);
      cells.push([cx * CW / W, cy * CH / H, CW / W, CH / H]); sizes.push([reach * 2, top]);
    });
    gl.deleteProgram(A.p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, was); gl.viewport(...vpWas);
    imp = { tex, cells, sizes };
    return imp;
  }

  // a soft dark patch on the ground under each ruin and animal near by, fading out with distance
  // (far off, the faceted ground pokes through the flat disc and leaves dark slivers; stones get
  // none, their foot is the hollow light's)
  function contactVerts(S) {
    const out = [], cam = S.cam, N = 8;
    let n = 0;
    for (const key in S.props) {
      const k = classOf(key), m = shapes.get(key);
      if (!m || (k !== 1 && k !== 2)) continue;
      const d = S.props[key], reach = k === 1 ? 60 : 110;
      for (let i = 0; i < d.length && n < 160; i += 8) {
        const x = d[i], y = d[i + 1], z = d[i + 2], r = m.foot * d[i + 3] * (k === 2 ? 1.05 : .8);
        const dist = Math.hypot(x - cam[0], z - cam[2]); if (r < .05 || dist > reach) continue;
        const g = height(x, z); if (g < (S.water ?? 0)) continue;
        const above = y - g; if (above > r * 1.5 || above < -r) continue;
        const fade = Math.min(1, (reach - dist) / (reach * .4));
        const a = (k === 2 ? .3 : .34) * fade * (1 - Math.max(0, above) / (r * 1.5)), nn = normalAt(x, z), ny = Math.max(nn[1], .3); n++;
        // laid on the slope's plane
        const at = (ang) => { const dx = Math.cos(ang) * r, dz = Math.sin(ang) * r; return [x + dx, g + .05 - (dx * nn[0] + dz * nn[2]) / ny, z + dz]; };
        for (let q = 0; q < N; q++) out.push(x, g + .05, z, .08, .07, .05, a, ...at(q / N * 6.283), .08, .07, .05, 0, ...at((q + 1) / N * 6.283), .08, .07, .05, 0);
      }
    }
    return out;
  }

  // the props, with their class (uClass); P (the view's planes) culls each instance off screen
  let culled = new Float32Array(4096);
  const propOf = (prog, P) => (key, again = false) => {
    let d = S_.props[key]; const m = shapes.get(key); if (!m || !d.length) return;
    const sw = GRASSY.has(key); if (sw !== S_.swaying) { S_.swaying = sw; gl.uniform1f(prog.u.uSway, sw ? S_.grassSway : 0); }   // the grass and flowers bend in the breeze
    if (prog.u.uClass) gl.uniform1f(prog.u.uClass, classOf(key));
    const round = ROUND.test(key); if (prog.u.uRound) { gl.uniform1f(prog.u.uRound, round ? 1 : 0); if (round) gl.uniform3fv(prog.u.uCtr, m.ctr); }
    let n = d.length / 8;
    if (P && !CLOUDY.has(key)) {
      if (culled.length < d.length) culled = new Float32Array(d.length * 1.5 | 0);
      let o = 0;
      for (let i = 0; i < d.length; i += 8) {
        const r = m.rad * d[i + 3], x = d[i], y = d[i + 1], z = d[i + 2];
        let inside = true; for (const [a, b, c, e] of P) if (a * x + b * y + c * z + e < -r * Math.hypot(a, b, c)) { inside = false; break; }
        if (inside) { for (let k = 0; k < 8; k++) culled[o + k] = d[i + k]; o += 8; }
      }
      if (!o) return;
      d = culled.subarray(0, o); n = o / 8;
    }
    if (!again) upload(m.ibuf, d);   // (the clouds draw twice, depth then colour: one upload)
    const decal = prog !== depthInst && DECAL.has(key); if (decal) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4); }
    gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, n); S_.tris += m.count / 3 * n;
    if (decal) gl.disable(gl.POLYGON_OFFSET_FILL);
  };
  const S_ = { props: null, swaying: false, grassSway: 0, tris: 0 };

  // the solid world: the hawk, the props, the ground, the far land, the trees, the sky (and the
  // stars); once for the screen and, with mirror reflections on (look.js T), once mirrored in the
  // water (clip: only what is above it)
  function drawWorld(S, vp, proj, P, clip, pf) {
    const h = R.vh;
    // hawk
    pf?.pass('hawk');
    gl.useProgram(solid.p); setLight(solid, S); gl.uniformMatrix4fv(solid.u.uVP, false, vp); gl.uniform1f(solid.u.uClip, clip);
    gl.uniform4fv(solid.u.uFrost, NOFROST);   // no hoar frost on the hawk
    gl.uniform1f(solid.u.uClass, 4);
    const hm = R.hawkMesh;
    const hp = S.hawk.p, O = R.O;
    gl.uniformMatrix4fv(solid.u.uModel, false, basis([hp[0] - O[0], hp[1] - O[1], hp[2] - O[2]], S.hawk.r, S.hawk.u, S.hawk.f, HAWK_SCALE));
    gl.bindVertexArray(hawk.vao); gl.drawArrays(gl.TRIANGLES, 0, hm.length / 12); S_.tris += hm.length / 36;
    gl.uniformMatrix4fv(solid.u.uModel, false, R.TO); gl.uniform4fv(solid.u.uFrost, S.frost || NOFROST); gl.uniform1f(solid.u.uClass, 0);

    // props: anything instanced that a system adds (rings, mice, flora, marks...)
    gl.useProgram(solidInst.p); setLight(solidInst, S); gl.uniform1f(solidInst.u.uClip, clip);
    gl.uniformMatrix4fv(solidInst.u.uVP, false, vp); gl.uniform1f(solidInst.u.uTime, S.time); gl.uniform3fv(solidInst.u.uAutumn, S.autumnCol); gl.uniform1f(solidInst.u.uSnowLine, S.snowLine ?? 999);
    gl.uniform1f(solidInst.u.uSway, 0); gl.uniform2fv(solidInst.u.uWindD, SEA_D);
    S_.swaying = false;
    const prop = propOf(solidInst, P);
    for (const key in S.props) if (!CLOUDY.has(key)) { pf?.pass(R.propPasses ? key : 'props'); if (S.frost) gl.uniform4fv(solidInst.u.uFrost, FROSTY.has(key) ? S.frost : NOFROST); prop(key); }
    if (S_.swaying) gl.uniform1f(solidInst.u.uSway, 0);
    gl.uniform1f(solidInst.u.uClass, 0);

    // ground: only the chunks inside the view (their box against the frustum's sides), nearest first
    pf?.pass('ground');
    gl.useProgram(solid.p); gl.uniform1f(solid.u.uClass, 5);
    const near = [];
    for (const c of chunks.values()) {
      if (!boxIn(P, c.cx * CHUNK, c.y0 - 3, c.cz * CHUNK, (c.cx + 1) * CHUNK, c.y1, (c.cz + 1) * CHUNK)) continue;
      near.push(c); c.d = ((c.cx + .5) * CHUNK - S.cam[0]) ** 2 + ((c.cz + .5) * CHUNK - S.cam[2]) ** 2;
    }
    near.sort((a, q) => a.d - q.d);
    for (const c of near) { gl.bindVertexArray(c.m.vao); gl.drawArrays(gl.TRIANGLES, 0, c.m.count); S_.tris += c.m.count / 3; }
    gl.uniform1f(solid.u.uClass, 0);
    if (!clip) R.stats.chunks = near.length;
    pf?.pass('far land');
    gl.useProgram(lit.p); setLight(lit, S); gl.uniform1f(lit.u.uClip, clip); gl.uniform1f(lit.u.uClass, 5);
    gl.uniformMatrix4fv(lit.u.uVP, false, vp); gl.uniformMatrix4fv(lit.u.uModel, false, R.TO);
    gl.uniform1f(lit.u.uCut, Math.min(R.view, R.fogView || 1e9)); gl.uniform1f(lit.u.uLift, FAR_DROP);
    let nf = 0;
    for (const t of far.values()) {
      if (!boxIn(P, t.tx * FAR_TILE, t.y0 - 30, t.tz * FAR_TILE, (t.tx + 1) * FAR_TILE, t.y1, (t.tz + 1) * FAR_TILE)) continue;
      gl.bindVertexArray(t.m.vao); gl.drawArrays(gl.TRIANGLES, 0, t.m.count); S_.tris += t.m.count / 3; nf++;
    }
    gl.uniform1f(lit.u.uCut, 0); gl.uniform1f(lit.u.uLift, 0); gl.uniform1f(lit.u.uClass, 0);
    if (!clip) R.stats.far = nf + '/' + far.size;

    // trees (the farthest as pictures)
    pf?.pass('trees');
    const imps = impostors();   // (made the first time: it draws, so before the trees' program goes on)
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.useProgram(inst.p); setLight(inst, S); gl.uniform1f(inst.u.uClip, clip);
    gl.uniformMatrix4fv(inst.u.uVP, false, vp); gl.uniform1f(inst.u.uTime, S.time); gl.uniform3fv(inst.u.uAutumn, S.autumnCol); gl.uniform1f(inst.u.uSnowLine, S.snowLine ?? 999);
    gl.uniform1f(inst.u.uSway, .012 + S.wind * .02); gl.uniform2fv(inst.u.uWindD, SEA_D); gl.uniform1f(inst.u.uDither, 1);
    for (const k of kinds) for (const m of [k.near, k.far]) {
      if (!m.icount) continue;
      gl.uniform1f(inst.u.uFade, m === k.near ? 1 : 2);
      gl.bindVertexArray(m.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, m.icount); S_.tris += m.count / 3 * m.icount;
    }
    gl.uniform1f(inst.u.uDither, 0); gl.uniform1f(inst.u.uSway, 0); gl.uniform1f(inst.u.uFade, 0);
    {
      gl.useProgram(impP.p); setLight(impP, S); gl.uniform1f(impP.u.uClip, clip);
      gl.uniformMatrix4fv(impP.u.uVP, false, vp); gl.uniform3fv(impP.u.uAutumn, S.autumnCol); gl.uniform1f(impP.u.uSnowLine, S.snowLine ?? 999); gl.uniform1f(impP.u.uFade, 2);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, imps.tex); gl.uniform1i(impP.u.uAtlas, 1); gl.activeTexture(gl.TEXTURE0);
      kinds.forEach((k, i) => {
        if (!k.flatN) return;
        gl.uniform4fv(impP.u.uCell, imps.cells[i]); gl.uniform2fv(impP.u.uSize, imps.sizes[i]);
        gl.bindVertexArray(k.imp.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, k.flatN); S_.tris += 2 * k.flatN;
      });
    }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);

    // sky, just where nothing else is (it sits at the very back of the depth range)
    pf?.pass('sky');
    gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
    gl.useProgram(sky.p);
    gl.uniformMatrix4fv(sky.u.uInvVP, false, invert(vp));
    gl.uniform3fv(sky.u.uZenith, S.zenith); gl.uniform3fv(sky.u.uHorizon, S.horizon); gl.uniform3fv(sky.u.uSun, S.sun);
    gl.uniform3fv(sky.u.uSunCol, S.sunCol); gl.uniform3fv(sky.u.uCloud, S.cloud); gl.uniform1f(sky.u.uNight, S.night); gl.uniform1f(sky.u.uTime, S.time); gl.uniform1f(sky.u.uAurora, S.aurora || 0); gl.uniform1f(sky.u.uStarA, S.starA || 0); gl.uniform1f(sky.u.uStarK, S.starK || 1); gl.uniform3fv(sky.u.uPole, S.pole || POLE); gl.uniform3fv(sky.u.uGal, GAL);
    gl.uniform4fv(sky.u.uMoon, S.moon || NOMOON); gl.uniform3fv(sky.u.uSunSky, S.sunSky || S.sun); gl.uniform1f(sky.u.uMoonK, S.moonK || 0);
    if (sky.u.uGradeT) gl.uniform3fv(sky.u.uGradeT, S.gradeT);
    if (sky.u.uGrain) gl.uniform2fv(sky.u.uGrain, S.grain);
    gl.bindVertexArray(tri.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (S.night > .02 && !clip) {
      // the stars, added over the sky where nothing stands; a view without the camera's place, so
      // they hold still however far out in the world you are
      gl.useProgram(stars.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniformMatrix4fv(stars.u.uVR, false, mul(proj, lookAt([0, 0, 0], [S.look[0] - S.cam[0], S.look[1] - S.cam[1], S.look[2] - S.cam[2]], S.camUp)));
      gl.uniform3fv(stars.u.uPole, S.pole || POLE); gl.uniform4fv(stars.u.uMoon, S.moonK > 0 ? S.moon : DOWN); gl.uniform1f(stars.u.uA, S.starA || 0); gl.uniform1f(stars.u.uPx, Math.max(1, h / 700));
      gl.uniform1f(stars.u.uNight, S.night * Math.min(2, S.starK || 1) * (1 - (S.overcast || 0))); gl.uniform1f(stars.u.uTime, S.time); gl.uniform1fv(stars.u.uGaze, S.gaze || NOGAZE);
      gl.uniform1f(stars.u.uLine, 0); gl.bindVertexArray(starPts.vao); gl.drawArrays(gl.POINTS, 0, starPts.count);
      if (S.gaze) { gl.uniform1f(stars.u.uLine, 1); gl.bindVertexArray(starLn.vao); gl.drawArrays(gl.LINES, 0, starLn.count); }
      gl.disable(gl.BLEND);
    }
    gl.depthMask(true); gl.depthFunc(gl.LESS);
  }

  R.draw = (S, W, cw, ch) => {
    const w = cw, h = ch;
    R.vh = h; R.vw = w;
    const proj = perspective(S.fov, w / h, .15, R.farView + 300), view = lookAt(S.cam, S.look, S.camUp);
    const vp = mul(proj, view);
    R.vp = vp;
    // the same view relative to O, a point by the camera (whole 16 m, y 0), for drawing (LIT_VS);
    // R.vp stays in world terms for picking, culling, the sky and the clouds
    const O = R.O = [Math.round(S.cam[0] / 16) * 16, 0, Math.round(S.cam[2] / 16) * 16], rel = v => [v[0] - O[0], v[1], v[2] - O[2]];
    R.TO = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -O[0], 0, -O[2], 1]);
    const vpO = mul(proj, lookAt(rel(S.cam), rel(S.look), S.camUp));
    { const fx = S.look[0] - S.cam[0], fy = S.look[1] - S.cam[1], fz = S.look[2] - S.cam[2], l = Math.hypot(fx, fy, fz) || 1; R.viewInfo = { cam: S.cam, f: [fx / l, fy / l, fz / l], fov: S.fov, aspect: w / h }; }
    S_.tris = 0; S_.props = S.props; S_.grassSway = .3 + S.wind * .45;
    S.gradeT = gradeTint(S); S.wet = S.wet || 0;
    S.grain = [Math.max(1, Math.round(w / Math.max(1, innerWidth) * .9)), .075];   // (look.js grain(): cell in device pixels, strength)
    const volumes = R.cloudStyle !== 'poly';
    if (volumes) mistOf(S); else S.mistU = null;
    const pf = R.prof;   // perf.js: each pass timed on the GPU, when that is on
    R.hawkMesh = buildHawk(S.pose);
    gl.bindBuffer(gl.ARRAY_BUFFER, hawk.buf); gl.bufferData(gl.ARRAY_BUFFER, R.hawkMesh, gl.DYNAMIC_DRAW);
    // far stand-ins: past so many metres an instanced shape draws as its simpler twin, if one is made
    for (const key in LOD) {
      const a = S.props[key], [twin, d] = LOD[key]; if (!a?.length || !shapes.has(twin)) continue;
      const near = [], far = S.props[twin] ||= [];
      for (let i = 0; i < a.length; i += 8) ((a[i] - S.cam[0]) ** 2 + (a[i + 1] - S.cam[1]) ** 2 + (a[i + 2] - S.cam[2]) ** 2 > d * d ? far : near).push(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6], a[i + 7]);
      S.props[key] = near;
    }
    // the look tests' extra passes: the shadow map (P), the world mirrored in the water (T)
    if (R.look.shadows) { pf?.pass('shadow map'); shadowPass(S); }
    R.reflOn = R.look.reflect && reflectPass(S, vp, vpO, proj, w, h, pf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    // Solid things first, nearest first, in the shaders with no discard (SOLID), so the GPU can skip
    // shading whatever ends up hidden; then what needs discard (far land, trees); the sky last, only
    // where nothing was drawn; then the see-through things. Same picture, less shading.
    gl.clearColor(S.horizon[0], S.horizon[1], S.horizon[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    const P = planes(vp);
    drawWorld(S, vpO, proj, P, 0, pf);

    // clouds last, see-through (at most half there), over everything solid: first their depth
    // alone, then their colour on just that nearest skin, so a cloud's inner faces never show
    // (or, in the volume styles, the mist over the sky and the clouds as volumes, clouds.js; only the
    // dust devils stay polygons)
    pf?.pass('clouds');
    if (volumes) {
      vol.sky(S, invert(vp), tri);
      S_.tris += vol.draw(S, vp, S.props, R.cloudStyle);
    }
    const poly = key => CLOUDY.has(key) && !(volumes && vol.has(key));
    gl.useProgram(inst.p);
    gl.uniform1f(inst.u.uDither, 2); gl.uniform1f(inst.u.uClip, 0);
    const prop = propOf(inst, null);
    gl.colorMask(false, false, false, false);
    for (const key in S.props) if (poly(key)) prop(key);
    gl.colorMask(true, true, true, true); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const key in S.props) if (poly(key)) prop(key, true);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS);

    gl.uniform1f(inst.u.uDither, 0);
    // see-through bits: shadow, water, motes
    pf?.pass('shadow, foam');
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.useProgram(flat.p); gl.uniformMatrix4fv(flat.u.uVP, false, vpO); gl.uniform3fv(flat.u.uO, O); gl.uniform1f(flat.u.uPx, h * .9); if (flat.u.uGradeT) gl.uniform3fv(flat.u.uGradeT, S.gradeT); if (flat.u.uGrain) gl.uniform2fv(flat.u.uGrain, S.grain);
    const sh = shadowVerts(S);
    if (sh) {
      gl.uniform1f(flat.u.uPoints, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
      gl.bindBuffer(gl.ARRAY_BUFFER, fx.buf); gl.bufferData(gl.ARRAY_BUFFER, sh, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(fx.vao); gl.drawArrays(gl.TRIANGLES, 0, sh.length / 7);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // soft dark patches under ruins and animals
    const cv = contactVerts(S);
    if (cv.length) {
      gl.uniform1f(flat.u.uPoints, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
      upload(fx.buf, cv); gl.bindVertexArray(fx.vao); gl.drawArrays(gl.TRIANGLES, 0, cv.length / 7);
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
    R.stats.tris = S_.tris | 0;
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
    // (the higher you are the softer the patch: a fainter core, its edge blurred wide)
    const blur = Math.min(1, above / 30), ca = a * (1 - blur * .45), ra = blur ? rad * (1 - blur * .4) : rad, rb = rad * (1 + blur * 1.2);
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283;
      out.push(...c, .1, .08, .06, ca, ...at(a0, ra), .1, .08, .06, blur ? ca * .6 : 0, ...at(a1, ra), .1, .08, .06, blur ? ca * .6 : 0);
      if (blur) out.push(...at(a0, ra), .1, .08, .06, ca * .6, ...at(a0, rb), .1, .08, .06, 0, ...at(a1, rb), .1, .08, .06, 0,
        ...at(a0, ra), .1, .08, .06, ca * .6, ...at(a1, rb), .1, .08, .06, 0, ...at(a1, ra), .1, .08, .06, ca * .6);
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
