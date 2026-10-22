// Rising air made visible: a cumulus cap over each thermal, and leaves carried up the column
// in a slow spiral (seen when you are near; no dust or dots, James 2026-10-21).
// The vario beeps while the hawk climbs in it. (The lift itself is world.js airLift().)
// The drifting clouds cast soft shadows on the land (round eight C1): S.shadeC, the nearest few as
// discs for render.js; shaded ground is cooler, so a thermal under a shadow weakens (env.shade).
// Fair-weather clouds drift across the sky between them, more of them, and greyer, when overcast.
import { height, WATER, thermalsNear, thermalCentre, WIND, ih, env } from '../world.js';
import { smooth } from '../util.js';
import { builder, reseed } from '../shapes.js';

// a leaf: two facets folded along the midrib, tipped up so it shows edge on or not
// (unit length, the instance scales it; its yaw spin makes it flicker as it tumbles)
function leaf() {
  reseed(71); const B = builder(), a = [.95, .66, .24], b = [.85, .45, .2], c = Math.cos(.9), s = Math.sin(.9);
  const v = (x, y, z) => [x, y * c + z * s, z * c - y * s];
  B.tri(v(-.5, 0, 0), v(0, .1, .25), v(.5, 0, 0), a); B.tri(v(-.5, 0, 0), v(.5, 0, 0), v(0, .1, -.25), b);
  return B.out();
}

export function airSystem(G) {
  const b = G.b;
  // the fair-weather clouds drifting over (x, y, z, size, yaw), more and lower when overcast
  function driftClouds(cx, cz, r) {
    const out = [], C = 420, oc = G.overcast || 0, dx = G.clock * WIND[0] * 2.2, dz = G.clock * WIND[2] * 2.2;
    const a = Math.floor((cx - dx - r) / C), b2 = Math.floor((cx - dx + r) / C), c0 = Math.floor((cz - dz - r) / C), c1 = Math.floor((cz - dz + r) / C);
    for (let gz = c0; gz <= c1; gz++) for (let gx = a; gx <= b2; gx++) for (let k = 0; k < 3; k++) {
      if (ih(gx, gz, 300 + k) > .28 + oc * .55) continue;
      const x = (gx + ih(gx, gz, 310 + k)) * C + dx, z = (gz + ih(gx, gz, 320 + k)) * C + dz;
      if (Math.hypot(x - cx, z - cz) > r) continue;
      out.push([x, 300 + ih(gx, gz, 330 + k) * 140 - oc * 60, z, 24 + ih(gx, gz, 340 + k) * 26 + oc * 12, ih(gx, gz, 350 + k) * 6.283]);
    }
    return out;
  }
  // where each cloud's shadow lies, along the sun; deeper on a bright day, gone under a grey sky
  let shadows = [], castT = 0;
  function cast() {
    const L = G.light, sd = L.sunSky, oc = G.overcast || 0, k = .5 * L.daylight * (1 - oc * .85) * (1 - (G.eclipse || 0));
    shadows = [];
    if (sd[1] < .12 || k < .03) return;
    for (const c of driftClouds(b.p[0], b.p[2], 1300)) {
      const g = Math.max(height(c[0], c[2]), WATER), up = (c[1] - g) / sd[1];
      const x = c[0] - sd[0] * up, z = c[2] - sd[2] * up;
      shadows.push([x, z, c[3] * 1.5, k, Math.hypot(x - b.p[0], z - b.p[2])]);
    }
  }
  env.shade = (x, z) => {
    let v = 0;
    for (const q of shadows) { const d = Math.hypot(x - q[0], z - q[1]); if (d < q[2]) v = Math.max(v, q[3] / .5 * smooth(q[2], q[2] * .55, d)); }
    return v;
  };
  G.dev?.add({ id: 'r8-shadows', title: 'Cloud shadows weaken thermals', area: 'Flight', round: 'R8 C1', how: 'On a bright day with clouds, soft shadows drift over the land; a thermal under one is weaker, so ride the sunlit ones.' });
  G.R.shape('leaf', leaf());
  G.hud.tip('ride', () => !!b.inThermal, 'Rising air! Hold a thumb still and the hawk circles it, climbing.');
  return {
    id: 'air',
    update(dt) {
      if ((castT -= dt) <= 0) { castT = .25; cast(); }
      if (b.ride) G.hud.did('ride');
      if (b.lift > .8 && b.state === 'fly') G.audio.vario(b.lift * 9);
    },
    scene(S) {
      const clouds = S.props.cloud ||= [];
      for (const c of driftClouds(S.cam[0], S.cam[2], 1000)) clouds.push(c[0], c[1], c[2], c[3], c[4], .7 - (G.overcast || 0) * .5, 0, 0);
      // their shadows: the nearest few, as soft discs (x, z, radius, depth)
      S.shadeC = shadows.filter(q => q[4] < 900).sort((p, q) => p[4] - q[4]).slice(0, 8).map(q => [q[0], q[1], q[2], q[3]]);
      for (const t of thermalsNear(S.cam[0], S.cam[2], 650)) {
        const [cx, cz] = thermalCentre(t, t.top);
        clouds.push(cx, t.top + 18, cz, 20 + t.r * .7, t.id % 7, .6, 0, 0);
        const dist = Math.hypot(t.x - S.cam[0], t.z - S.cam[2]); if (dist > 260) continue;
        const g0 = Math.max(height(t.x, t.z), WATER), span = Math.min(170, t.top - g0), day = .35 + .65 * G.light.daylight;
        // leaves lifted off the ground, spiralling up and tumbling
        const L = S.props.leaf ||= [];
        for (let i = 0; i < 28; i++) {
          const h1 = ((i * 53 + t.id * 7) % 97) / 97, h2 = ((i * 31 + t.id) % 83) / 83, top = Math.min(span, 90);
          const up = (G.t * t.w * .6 * day + h1 * top) % top, y = g0 + 1 + up;
          const [mx, mz] = thermalCentre(t, y), a = h2 * 6.283 + G.t * (.5 + h1 * .4), rr = t.r * (.25 + .5 * h2) * (1 - up / top * .4);
          const sz = (.7 + h1 * .5) * smooth(0, 4, up) * smooth(top, top - 15, up) * (1 + dist / 300);
          L.push(mx + Math.cos(a) * rr, y, mz + Math.sin(a) * rr, sz, a * 2.3 + G.t * 3 * (h2 - .5), h2, (G.season?.autumn || 0) * .5, 0);
        }
      }
    },
  };
}
