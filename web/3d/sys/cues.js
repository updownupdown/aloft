// Flight cues: the thumb pads take the colour of the flight mode the wings make (the How to play
// colours: ochre spread, soar, float and brake; berry folded, fast glide, stoop and zoom; blue
// climb and dive; moss bank and roll), glowing brighter riding a thermal; a stoop darkens the edges
// of the view as it gathers speed. Inside a thermal a soft warm glow sits on the edge of the screen
// toward its core (top: ahead, bottom: behind), stronger for stronger air; in the core it spreads to
// a faint warm ring all round, so you can feel the column and steer to stay in it. The red
// chevrons in the HUD stay as they are.
import { FLY } from '../flight.js';

export const CUES = { pad: .85, stoopEdge: .38, glow: .9, core: .3 };   // pad tint; how dark a full stoop's edges; thermal glow at full strength; the core's share of the radius
const COL = { none: [255, 255, 255], spread: [216, 160, 64], folded: [196, 84, 64], pitch: [96, 150, 200], bank: [128, 168, 96] };

export function cuesSystem(G) {
  const b = G.b, ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', `<div class="edge3"></div><div class="therm3"><div class="blob3"></div></div><div class="thermc3"></div>
  <style>
    .pad3 { border-color: rgba(var(--pc, 255, 255, 255), .8); box-shadow: 0 0 calc(var(--pg, 0) * 22px) rgba(var(--pc, 255, 255, 255), calc(var(--pg, 0) * .7)); transition: opacity .3s, border-color .25s, box-shadow .25s; }
    .pad3 i { background: rgba(var(--pc, 255, 255, 255), .78); transition: background .25s; }
    .edge3, .therm3, .thermc3 { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0; }
    .edge3 { background: radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(14, 18, 26, .9) 120%); }
    .therm3 { overflow: hidden; }
    .therm3 .blob3 { position: absolute; width: 70vmax; height: 70vmax; margin: -35vmax 0 0 -35vmax; border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 160, 72, .8) 0%, rgba(255, 146, 64, .34) 30%, transparent 62%); }
    .thermc3 { background: radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(255, 160, 72, .5) 100%); }
  </style>`);
  const pads = [...ui.querySelectorAll('.pad3')], edge = ui.querySelector('.edge3'), therm = ui.querySelector('.therm3'), blob = therm.firstChild, ring = ui.querySelector('.thermc3');
  let col = [...COL.none], glow = 0, stoopK = 0, thK = 0, ang = 0, core = 0;
  const mix = (a, q, k) => a.map((v, i) => v + (q[i] - v) * k);

  return {
    id: 'cues',
    update(dt, c) {
      const fly = b.state === 'fly' && !G.menu?.open && !b.asleep;
      // the mode the wings make, by the How to play colours
      let want = COL.none, g = 0;
      if (fly) {
        const pitch = Math.abs(c?.pitch || 0), roll = Math.abs(c?.roll || 0);
        if (b.barrel || b.spin) want = COL.bank;
        else if (b.tuck > .4) { want = COL.folded; g = b.stoop > .4 ? .6 : .25; }
        else if (b.flare > .4) { want = COL.spread; g = b.ride ? 1 : .2; }
        else if (roll > .45) want = COL.bank;
        else if (pitch > .4) want = COL.pitch;
      }
      const k = Math.min(1, dt * 6);
      col = mix(col, want === COL.none ? COL.none : mix(COL.none, want, CUES.pad), k);
      glow += (g - glow) * k;
      const css = col.map(Math.round).join(', ');
      for (const p of pads) { p.style.setProperty('--pc', css); p.style.setProperty('--pg', glow.toFixed(2)); }
      // a stoop: the edges of the view close in a little as it gathers speed
      const sk = fly ? (b.stoop || 0) * Math.min(1, Math.max(0, (b.s - 14) / (FLY.maxS * .6))) : 0;
      stoopK += (sk - stoopK) * Math.min(1, dt * 3);
      edge.style.opacity = (stoopK * CUES.stoopEdge).toFixed(3);
      // the thermal: a warm glow on the screen's edge toward the core, or all round in it
      const T = fly && b.inThermal;
      let tw = 0;
      if (T) {
        const { tx, tz, d, t } = T, f = [Math.sin(b.yaw), -Math.cos(b.yaw)], r = [Math.cos(b.yaw), Math.sin(b.yaw)];
        const vx = (tx - b.p[0]) / (d || 1), vz = (tz - b.p[2]) / (d || 1);
        const a = Math.atan2(vx * r[0] + vz * r[1], vx * f[0] + vz * f[1]);
        ang += Math.atan2(Math.sin(a - ang), Math.cos(a - ang)) * Math.min(1, dt * 4);
        const inCore = 1 - Math.min(1, Math.max(0, (d / t.r - CUES.core * .6) / (CUES.core * .8)));
        core += (inCore - core) * Math.min(1, dt * 3);
        tw = Math.min(1, Math.max(0, (b.lift - .8) / 3.5)) * .5 + .5;
      }
      thK += ((T ? tw : 0) - thK) * Math.min(1, dt * (T ? 2.5 : 1.2));
      // toward the core a glow on that edge; in the core a faint warm ring all round
      therm.style.opacity = (thK * CUES.glow * (1 - core)).toFixed(3);
      ring.style.opacity = (thK * CUES.glow * core * .8).toFixed(3);
      if (thK > .005) {
        // the glow's centre on an ellipse just past the screen's edge, toward the core
        const x = 50 + Math.sin(ang) * 58, y = 50 - Math.cos(ang) * 62;
        blob.style.left = `${Math.max(-6, Math.min(106, x))}%`; blob.style.top = `${Math.max(-8, Math.min(108, y))}%`;
      }
    },
  };
}
