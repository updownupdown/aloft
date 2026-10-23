// Builds ground chunks off the main thread (render.js sends jobs), so fast flight never stutters
// while new ground appears. The world is a pure function of the seed and the date (env.yearFrac).
import { chunkMesh, env } from './world.js';
import { setSeed, WORLD } from './noise.js';

onmessage = e => {
  const { k, cx, cz, cells, gen, seed, yearFrac, size, drop, far, look } = e.data;
  if (seed !== WORLD.seed) setSeed(seed);
  env.yearFrac = yearFrac; env.look = look || '';   // (look.js: the ground bakes switched on)
  const data = chunkMesh(cx, cz, cells, size, drop).slice();
  postMessage({ k, cx, cz, cells, gen, data, far }, [data.buffer]);
};
