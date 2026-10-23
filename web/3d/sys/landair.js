// Each land's own air: dust devils spinning up the thermals of the dry lands (a thermal you can
// see), steam venting from the fire mountain's flanks (its lift is world.js's volcano column),
// sea fog rolling up the fjords and coasts on the morning, and a heat shimmer over the salt
// flats at midday. Near the hawk only.
import { height, thermalsNear, thermalCentre, landmarksNear, blend, ih, coastDist } from '../world.js';
import { mix3, smooth } from '../util.js';
import { builder, reseed } from '../shapes.js';

const DEVIL_LANDS = { badlands: 1, savanna: .8, desert: .9, canyon: .5, saltflat: .7, steppe: .6 };
const FOG_LANDS = { fjord: 1, coast: .7 };

// a dust devil: a funnel of grit, sparse twisted facets widening upward (unit height)
function devil() {
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
  G.R.shape('devil', devil());
  let land = 'meadow', landT = 0, vents = [];
  const dryOf = new Map();   // thermal id -> how dry its land is
  return {
    id: 'landair',
    update(dt) {
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
      // dust devils: on hot clear days, a spinning funnel low on some of the dry lands' thermals
      if (L.daylight > .5 && !(G.rain > .1)) {
        const P = S.props.devil ||= [];
        for (const t of thermalsNear(cam[0], cam[2], 450)) {
          if (t.volcano) continue;
          let dry = dryOf.get(t.id); if (dry === undefined) { dry = DEVIL_LANDS[blend(t.x, t.z)[0].name] || 0; dryOf.set(t.id, dry); if (dryOf.size > 500) dryOf.clear(); }
          if (ih(t.id, 0, 704) > dry * .6) continue;
          const [x, z] = thermalCentre(t, 10), g = Math.max(height(x, z), 0), wob = Math.sin(G.t * .4 + t.id) * 6;
          const h = 26 + ih(t.id, 1, 705) * 30;
          P.push(x + wob, g - .5, z + Math.cos(G.t * .3 + t.id) * 6, h, G.t * 4 + t.id, .5, 0, 0);
        }
      }
      // sea fog rolling in over the water of the fjords and coasts, mornings on some days
      // (along the shore only: out on the open sea it read as grey lumps on the water)
      const fog = (FOG_LANDS[land] || 0) * smooth(-1600, -500, coastDist(cam[0], cam[2])) * (dayHash(G, 1) < .55 ? 1 : 0) * smooth(.2, .26, G.tod) * (1 - smooth(.38, .48, G.tod));
      if (fog > .05) {
        const P = S.props.puff ||= [], step = 30;
        for (let gz = -9; gz <= 9; gz++) for (let gx = -9; gx <= 9; gx++) {
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
