// Builds ground chunks off the main thread (render.js sends jobs), so fast flight never stutters
// while new ground appears. The world is a pure function of the seed and env's season fields.
import { chunkMesh, env } from './world.js';
import { setSeed, WORLD } from './noise.js';

onmessage = e => {
  const { k, cx, cz, cells, gen, seed, snow, season, seasonDay, size, drop, far } = e.data;
  if (seed !== WORLD.seed) setSeed(seed);
  env.snow = snow; env.season = season; env.seasonDay = seasonDay;
  const data = chunkMesh(cx, cz, cells, size, drop).slice();
  postMessage({ k, cx, cz, cells, gen, data, far }, [data.buffer]);
};
