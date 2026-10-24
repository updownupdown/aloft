// Each land's own air: a dust devil spinning up a thermal of the dry lands (a thermal you can
// see: ride into it and climb; one at a time, gathering out of the dust and thinning away, and soft,
// a volume like the clouds, clouds.js 'devil'; James 10-24), steam venting from the fire mountain's flanks (its lift is world.js's volcano column),
// sea fog rolling up the fjords and coasts on the morning, and a heat shimmer over the salt
// flats at midday. Near the hawk only.
import { height, thermalsNear, thermalCentre, landmarksNear, blend, ih, coastDist } from '../world.js';
import { mix3, smooth } from '../util.js';
import { builder, reseed } from '../shapes.js';

const DEVIL_LANDS = { badlands: 1, savanna: .8, desert: .9, canyon: .5, saltflat: .7, steppe: .6 };
// the one dust devil: how far from you it may start (m), how long it lasts and fades in and out (s),
// the rest between one and the next (s)
export const DEVIL = { near: 120, far: 420, gone: 750, life: [45, 90], fadeIn: 8, fadeOut: 10, rest: [25, 70] };
const FOG_LANDS = { fjord: 1, coast: .7 };

// a dust devil as polygons (the fallback, Settings > Graphics > Clouds: Polygons): a funnel of
// grit, sparse twisted facets widening upward (unit height)
function devilMesh() {
  reseed(91); const B = builder(), c1 = [.78, .66, .5], c2 = [.7, .58, .44];
  for (let i = 0; i < 110; i++) {
    const t = i / 110, y = t, a = i * 2.39996 + t * 9, r = .06 + t * t * .42, w = .035 + t * .06;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, tx = -Math.sin(a) * w, tz = Math.cos(a) * w;
    B.tri([x - tx, y, z - tz], [x + tx, y + .02, z + tz], [x, y + .05 + t * .04, z], i & 1 ? c1 : c2);
  }
  return B.out();
}
const dayHash = (G, k) => ih(G.day | 0, k, 701);

export function landAirSystem(G) {
  const b = G.b;
  G.R.shape('devil', devilMesh());
  let land = 'meadow', landT = 0, vents = [];
  const dryOf = new Map();   // thermal id -> how dry its land is
  const dryAt = t => { let d = dryOf.get(t.id); if (d === undefined) { d = DEVIL_LANDS[blend(t.x, t.z)[0].name] || 0; dryOf.set(t.id, d); if (dryOf.size > 500) dryOf.clear(); } return d; };
  let devil = null, devilT = 10;   // { t: the thermal, age, life, a: how there it is, h: its height }
  const clear = () => G.light.daylight > .5 && !(G.rain > .1);
  function devils(dt) {
    if (devil) {
      const d = devil, far = Math.hypot(d.x - b.p[0], d.z - b.p[2]) > DEVIL.gone;
      d.age += dt;
      const want = d.age < d.life && clear() && !far ? 1 : 0;
      d.a = want ? Math.min(1, d.a + dt / DEVIL.fadeIn) : Math.max(0, d.a - dt / DEVIL.fadeOut);
      if (!want && d.a <= 0) { devil = null; devilT = DEVIL.rest[0] + Math.random() * (DEVIL.rest[1] - DEVIL.rest[0]); }
      return;
    }
    if ((devilT -= dt) > 0) return;
    devilT = 5;
    if (!clear()) return;
    const ts = thermalsNear(b.p[0], b.p[2], DEVIL.far).filter(t => {
      if (t.volcano) return false;
      const d = Math.hypot(t.x - b.p[0], t.z - b.p[2]);
      return d > DEVIL.near && d < DEVIL.far && Math.random() < dryAt(t) * .6;
    });
    const t = ts[Math.floor(Math.random() * ts.length)]; if (!t) return;
    devil = { t, x: t.x, z: t.z, age: 0, a: 0, life: DEVIL.life[0] + Math.random() * (DEVIL.life[1] - DEVIL.life[0]), h: 26 + ih(t.id, 1, 705) * 30 };
  }
  G.dev?.add({ id: 'devil', title: 'A dust devil: one at a time, soft, fading in and out', area: 'World',
    how: 'Hot clear days in the dry lands (badlands, desert, savanna, steppe): a spinning column of dust marks a thermal; fly into it to climb.',
    go: () => { G.tod = .5; G.rain = 0; devil = null; devilT = 0; } });
  return {
    id: 'landair',
    devil: () => devil, devilNow() { devil = null; devilT = 0; },   // (debug)
    update(dt) {
      devils(dt);
      if ((landT -= dt) <= 0) {
        landT = 2; land = blend(b.p[0], b.p[2])[0].name;
        const v = landmarksNear(b.p[0], b.p[2], 900).find(l => l.kind === 'volcano');
        vents = v ? [0, 1, 2, 3, 4].map(k => { const a = k * 1.26 + ih(k, 0, 702), r = 90 + ih(k, 1, 703) * 80, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r; return [x, height(x, z), z]; }) : [];
      }
      // steam from the fire mountain's vents
      for (const [x, y, z] of vents) if (Math.random() < dt * 3) G.part([x + (Math.random() - .5) * 2, y + .5, z + (Math.random() - .5) * 2], [(Math.random() - .5) * .8 + .6, 2.5 + Math.random() * 2, (Math.random() - .5) * .8], 4, [.93, .93, .92], 1.2 + Math.random());
    },
    scene(S) {
      const cam = S.cam, L = G.light;
      // the dust devil: on a hot clear day, a spinning column low on a dry land's thermal,
      // wandering with it
      if (devil && devil.a > 0) {
        const d = devil, t = d.t, [cx, cz] = thermalCentre(t, 10), x = cx + Math.sin(G.t * .4 + t.id) * 6, z = cz + Math.cos(G.t * .3 + t.id) * 6;
        d.x = x; d.z = z;
        const g = Math.max(height(x, z), 0), a = d.a * d.a * (3 - 2 * d.a), soft = G.R.cloudStyle !== 'poly';
        // (soft: it thickens out of the air; polygons: it grows up out of the ground)
        (S.props.devil ||= []).push(x, g - .5, z, soft ? d.h * (.85 + .15 * a) : d.h * a, G.t * 2.2 + t.id, .5, 0, soft ? 1 - a : 0);
      }
      // sea fog rolling in over the water of the fjords and coasts, mornings on some days
      // (along the shore only: out on the open sea it read as grey lumps on the water)
      const fog = (FOG_LANDS[land] || 0) * smooth(-1600, -500, coastDist(cam[0], cam[2])) * (dayHash(G, 1) < .55 ? 1 : 0) * smooth(.2, .26, G.tod) * (1 - smooth(.38, .48, G.tod));
      if (fog > .05) {
        // (with volume clouds, clouds.js, it is a layer of mist: top, density, lumps, thinning above)
        if (G.R.cloudStyle !== 'poly') (S.mists ||= []).push([16 - (1 - fog) * 20, .025 * fog, 8, 10]);
        const P = S.props.puff ||= [], step = 30;
        if (G.R.cloudStyle === 'poly') for (let gz = -9; gz <= 9; gz++) for (let gx = -9; gx <= 9; gx++) {
          const ix = Math.floor(cam[0] / step) + gx, iz = Math.floor(cam[2] / step) + gz;
          const x = (ix + ih(ix, iz, 706)) * step + G.t * 1.5 % step, z = (iz + ih(ix, iz, 707)) * step;
          if (height(x, z) > 3) continue;
          P.push(x, 4 + ih(ix, iz, 708) * 6 - (1 - fog) * 20, z, 18 + ih(ix, iz, 709) * 10, ih(ix, iz, 710) * 6.28, .5, 0, 0);
        }
      }
      // heat shimmer: pale wavering bands lying over the salt flats, far off, at midday
      if (land === 'saltflat' && L.daylight > .8 && !(G.overcast > .5)) {
        const R = S.ribbon ||= [], col = mix3(S.horizon, [1, 1, 1], .5);
        const fx = Math.sin(S.yaw ?? 0), fz = -Math.cos(S.yaw ?? 0);
        const dx = S.look ? S.look[0] - cam[0] : fx, dz = S.look ? S.look[2] - cam[2] : fz, dl = Math.hypot(dx, dz) || 1;
        const ax = dx / dl, az = dz / dl, sx = -az, sz = ax;
        for (let k = 0; k < 5; k++) {
          const d = 160 + k * 45, w = 140 + k * 40, cx = cam[0] + ax * d, cz = cam[2] + az * d, y = height(cx, cz) + .6 + Math.sin(G.t * 2.3 + k) * .25, al = .1 + .06 * Math.sin(G.t * 3.1 + k * 1.7);
          const v = [[cx - sx * w, y, cz - sz * w], [cx + sx * w, y, cz + sz * w], [cx + sx * w, y + 1.4, cz + sz * w], [cx - sx * w, y + 1.4, cz - sz * w]];
          for (const p of [v[0], v[1], v[2], v[0], v[2], v[3]]) R.push(p[0], p[1], p[2], col[0], col[1], col[2], al);
        }
      }
    },
  };
}
