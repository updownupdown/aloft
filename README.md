# Tiercel

**A calm, low-poly 3D flight game: you're a hawk riding thermals over a procedurally generated Earth.**

▶ **Play it at [updownupdown.github.io/aloft](https://updownupdown.github.io/aloft/)** — best on an Android phone (add it to your home screen to play full screen and offline); a desktop browser works too.

There's no score to chase. You glide, circle up on rising air, perch in trees, hunt when you're hungry and drink when you're thirsty. The world is shaped by the real planet: its coastlines, biomes, great rivers and lakes, and natural wonders like Uluru and the great waterfalls, with caves to fly into, auroras near the poles, and seasons and a day–night cycle overhead. Along the way you learn songbirds' songs, collect keepsakes and landmarks in a journal, and fill in a globe as you explore.

You start as a red-tailed hawk and can switch to an osprey, a barn owl or a raven. Flying is two thumbs for two wings. A gentle set of lessons teaches the rest.

## Built with

Plain JavaScript and hand-written WebGL2: no framework, no bundler, no build step, no runtime dependencies. All terrain, trees, birds and clouds are generated in code, and all music and birdsong are synthesised live with the Web Audio API. Real-world geography is baked from Natural Earth data by a small Python tool (`tools/earth`).

The game started as a 2D prototype and briefly in Godot before settling on the web. (The repo keeps its original working name, *Aloft*.)

## Running locally

There's nothing to install. Run `tools/serve.sh` (or serve the `web/` folder with any static server) and open http://localhost:8000. `node tools/smoke.mjs` plays through the game headless as a smoke test. Every push to `main` that touches `web/` deploys to GitHub Pages.
