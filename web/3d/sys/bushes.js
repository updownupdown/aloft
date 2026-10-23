// Bushes (world.js bushesNear): leafy shrubs, gorse, sagebrush and thorn, drawn out to
// BUSHES.near metres. They turn in autumn and go bare-ish in winter like the broadleaves (only the
// leafy shrubs), and a bird can stand on top of one (world.js solidsNear).
import { bushesNear, height } from '../world.js';
import { BUSH_SHAPES } from '../shapes.js';

export const BUSHES = { near: 240, high: 260 };   // drawn this far round the camera; not at all from higher than `high` over the ground

export function bushesSystem(G) {
  for (const k in BUSH_SHAPES) G.R.shape(k, BUSH_SHAPES[k]());
  let list = [], from = null;
  G.dev?.add({ id: 'bushes', title: 'Bushes you can stand on', area: 'World', how: 'Leafy shrubs at wood edges and in thickets, gorse on moors and coasts, sagebrush in the dry lands, thorn bushes on the savanna. Land on top of one.',
    go: () => { const o = bushesNear(G.b.p[0], G.b.p[2], 300).sort((a, q) => Math.hypot(a.x - G.b.p[0], a.z - G.b.p[2]) - Math.hypot(q.x - G.b.p[0], q.z - G.b.p[2]))[0]; if (!o) return G.hud.reply('No bushes near', 2);
      const b = G.b; b.state = 'fly'; b.p = [o.x - 14, o.y + o.s + 4, o.z]; b.yaw = Math.PI / 2; b.s = 7; b.gamma = 0; } });
  return {
    id: 'bushes',
    scene(S) {
      const cam = S.cam, N = BUSHES.near;
      if (cam[1] - height(cam[0], cam[2]) > BUSHES.high) return;
      if (!from || Math.hypot(cam[0] - from[0], cam[2] - from[1]) > 12) { from = [cam[0], cam[2]]; list = bushesNear(cam[0], cam[2], N + 14); }
      const autumn = S.autumn ?? (G.season?.autumn || 0), bare = G.season?.winter ? .7 : 0;
      for (const o of list) {
        const dx = o.x - cam[0], dz = o.z - cam[2]; if (dx * dx + dz * dz > N * N) continue;
        (S.props[o.kind] ||= []).push(o.x, o.y, o.z, o.s, o.yaw, o.tint, o.kind === 'bush' ? Math.max(bare, autumn * (.5 + o.tint) * .8) : o.kind === 'heath' ? autumn * .9 : 0, 0);
      }
    },
  };
}
