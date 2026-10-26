// Keepsakes glinting in the grass, and acrobatics. (Health, and the tail it reddens, moved to
// sys/growth.js, per bird, 2026-10-26.)
// The mate, the nest and the young were removed (James, 2026-10-26: the gameplay wasn't great). Other birds of your own kind (the neighbours,
// neighbours.js) are drawn with the shapes built here from the hawk's own mesh.
import { height, ih } from '../world.js';
import { buildHawk, BIRD } from '../hawk.js';
import { builder, blob, reseed } from '../shapes.js';
export { HEALTH_START } from './growth.js';
export const KEEPSAKES = ['blue jay feather', 'snail shell', 'smooth white pebble', 'curl of birch bark', 'robin’s eggshell', 'tuft of thistledown', 'acorn cap', 'heron feather'];
const KC = 420;   // one keepsake maybe in each cell this many metres across
// the neighbours are always your own kind, whichever bird you fly now (Settings > Bird):
// what the words call it, its field guide page (guide.js) and its full name
const KIND = { hawk: ['hawk', 'redtail', 'red-tail'], osprey: ['osprey', 'osprey', 'osprey'], owl: ['owl', 'barnowl', 'barn owl'], raven: ['raven', 'raven', 'raven'], albatross: ['albatross', 'albatross', 'albatross'] };
export const kind = () => KIND[BIRD] || KIND.hawk;

// a hawk turned to face +x (as instanced shapes do), coloured by which way each face looks:
// instanced shapes have one colour per face, so the underside takes the pale underwing colours
function hawkShape(pose) {
  const m = buildHawk({ flapL: 0, flapR: 0, handL: 0, handR: 0, fold: 0, flare: 0, legs: 0, tail: .2, tailPitch: 0, t: 0, tailRed: 1, ...pose });
  const o = new Float32Array(m.length);
  for (let i = 0; i < m.length; i += 12) {
    o[i] = m[i + 2]; o[i + 1] = m[i + 1]; o[i + 2] = -m[i];
    o[i + 3] = m[i + 5]; o[i + 4] = m[i + 4]; o[i + 5] = -m[i + 3];
    const under = m[i + 4] < 0 ? 9 : 6;
    for (let k = 0; k < 3; k++) o[i + 6 + k] = o[i + 9 + k] = m[i + under + k];
  }
  return o;
}
function keepsakeShape() {
  reseed(11); const B = builder();
  blob(B, 0, .04, 0, .07, [.93, .9, .84], [.8, .76, .7], [1.3, .6, 1]);
  blob(B, .06, .05, .03, .03, [.55, .66, .82], [.45, .55, .7]);
  return B.out();
}

export function storySystem(G) {
  const b = G.b;
  const St = { keepsakes: [], kept: new Set(), tricks: 0 };
  G.story = St;
  // the neighbours are your own species: rebuilt when Settings > Bird changes
  const ownKind = () => ['hawkGlide', 'hawkUp', 'hawkDown'].forEach((k, i) => G.R.shape(k, hawkShape([{}, { flapL: 1, flapR: 1, handL: -.3, handR: -.3 }, { flapL: -.7, flapR: -.7, handL: .4, handR: .4 }][i])));
  ownKind(); G.on('bird', ownKind);
  G.R.shape('keepsake', keepsakeShape());
  // ---- keepsakes: rare things in the grass, glinting -----------------------------------------
  function keepsakesNear(x, z, r) {
    const out = [];
    for (let j = Math.floor((z - r) / KC); j <= Math.floor((z + r) / KC); j++) for (let i = Math.floor((x - r) / KC); i <= Math.floor((x + r) / KC); i++) {
      if (ih(i, j, 301) > .28) continue;
      const kx = (i + .2 + ih(i, j, 302) * .6) * KC, kz = (j + .2 + ih(i, j, 303) * .6) * KC, y = height(kx, kz), id = `k${i},${j}`;
      if (y < 1.5 || St.kept.has(id)) continue;
      out.push({ id, x: kx, y, z: kz, kind: Math.floor(ih(i, j, 304) * KEEPSAKES.length) });
    }
    return out;
  }
  G.hud.tip('keepsake', () => b.state === 'fly' && keepsakesNear(b.p[0], b.p[2], 35).length > 0, 'Something glints in the grass. Land beside it to pick it up: a keepsake for your Journal.');
  function pickUp() {
    for (const k of keepsakesNear(b.p[0], b.p[2], 6)) {
      if (Math.hypot(k.x - b.p[0], k.z - b.p[2]) > 3.5) continue;
      St.kept.add(k.id); St.keepsakes.push(k.kind); G.audio.feather?.(); G.hud.did('keepsake');
      const n = St.keepsakes.length;
      G.hud.tally(`A ${KEEPSAKES[k.kind]}: keepsake ${n}`, 'keepsake');
      G.emit('keepsake', k);
    }
  }
  G.on('land', kind => { if (kind === 'ground') pickUp(); });

  // ---- acrobatics ------------------------------------------------------------------------------
  G.on('trick', () => { St.tricks++; });

  // Settings > Advanced > Dev mode: progress mocked at k (0, .25, .5 or 1; dev.js), then saved and reloaded
  G.on('mock', k => { St.tricks = Math.round(k * 12); });

  return {
    id: 'story',
    update() {
      // glints over keepsakes, to be seen from the air
      if (Math.random() < .3) for (const k of keepsakesNear(b.p[0], b.p[2], 90)) G.part([k.x + (Math.random() - .5) * .3, k.y + .2, k.z + (Math.random() - .5) * .3], [0, .6, 0], .6, [1, .95, .75], .08);
    },
    scene(S) {
      const d = S.props.keepsake ||= [];
      for (const k of keepsakesNear(S.cam[0], S.cam[2], 140)) d.push(k.x, k.y, k.z, 1.4, ih(k.x | 0, 1, 5) * 6, .5, 0, 0);
    },
    save: () => ({ keepsakes: St.keepsakes, kept: [...St.kept], tricks: St.tricks }),
    load(o) { if (o.health != null) G.oldHealth = o.health; St.keepsakes = o.keepsakes || []; St.kept = new Set(o.kept || []); St.tricks = o.tricks || 0; },
  };
}
