# Aloft — project conventions

**2026-10-20: Aloft is 3D** (James's decision); the 2D game was deleted (it is in git history
before that date). `web/src/` keeps only `audio.js`, `music.js`, `birdvoice.js` and `songs.js`,
shared by 3D and the labs.

A cozy, zen 3D flight game (first made in 2D). You play a hawk (a red-tailed-hawk-like
species) riding thermals over procedurally generated hills, trees and ponds. The look is
low poly (James's pick, 2026-10-20): flat-shaded facets, soft haze, paper grain. Android-first as an installable PWA, desktop
browser for quick testing, iOS later.

Live: https://updownupdown.github.io/aloft/ (every push to `main` touching `web/` deploys).

## Stack

- **Plain HTML + JavaScript (ES modules), WebGL2 written directly.** No framework, no bundler,
  no build step, no npm dependencies for the game. `web/` is served as-is.
- Godot was the first prototype and was dropped (2026-10-18): the wasm was ~40 MB.
- All sound is synthesised with Web Audio (`web/src/audio.js`); no audio files.
- PWA: `web/manifest.webmanifest` + `web/sw.js` (stale-while-revalidate cache). When you
  add a file, add it to `FILES` in `sw.js` and bump `CACHE`.

## Layout

```
web/index.html          entry; loads 3d/main.js
web/3d/main.js          boot, the frame loop, save/resume, the SYSTEMS list, flight events, core menu rows
web/3d/flight.js        hawk flight model (energy, tuck/flare, flaps, thermal ride, trees, perching, ground, water)
web/3d/input.js         two thumbs = two wings (floating sticks, paired taps), keyboard
web/3d/camera.js        chase camera, hawk frame, pose (wing beats with per-wing amplitude)
web/3d/world.js         terrain height(x,z), colours, trees + perches, thermals, airLift, rings
web/3d/render.js        WebGL2 renderer: sky, chunks, instanced trees and named shapes, hawk, water, points
web/3d/shapes.js        low-poly builders (builder, blob, prism, cone) and tree/ring/cloud meshes
web/3d/hawk.js          the hawk mesh, rebuilt per frame from a pose
web/3d/birds.js         other birds: Settings > Bird picks red-tail, osprey, barn owl or raven (sys/species.js, aloft.bird); ?bird=swift|heron|mallard tries the rest
web/3d/sky.js           clock (G.tod, G.day, G.season) and light (G.light)
web/3d/hud.js           G.hud: meter() (rings), tip()/did(), toast() (queued), status, counter (under the dial), hide(), quiet meters, thumb pads
web/3d/menu.js          G.menu: tab(), toggle(), button(), onOpen(), subtitle(), set(); tab order/titles in ORDER/TITLES
web/3d/letter.js        the menu's frame (frosted glass, .glass3 in 3d.css); swap it to restyle
web/3d/facet.js         low-poly helpers (map land, postcards) (PIG colours, poly, facets, gem, chamfer, hardShadow, lit)
web/3d/logo.js          Aloft's mark, a hawk over the hills (menu title, app icons via tools/icon.html)
web/3d/dial.js          the day dial, top right
web/3d/tips.js          tips as a short line and an icon (SHORT, keyed by tip id), swipe to dismiss, i to pause and read more
web/3d/journal.js       the Journal tab: journal(G).section(order, title); shot.js: project(), afterDraw(), portraits
web/3d/app.js           Update, Full screen, Quiet meters and Quit rows
web/src/                audio.js (Web Audio synth), music.js (four styles), birdvoice.js, songs.js (songbird species)
web/birds.html          bird lab: every species side by side (3d/birdlab.js)
web/lab.html            bird song lab; web/musiclab.html music lab (both share lab.css)
web/icons/, web/fonts/  app icons (tools/icon.html + tools/make-icons.mjs), bundled fonts (SIL OFL)
web/3d/sys/*.js         systems: air (thermal clouds/motes), rings, food (hunger, thirst, mice), aim, flora (tufts, flowers, stones, bushes, reeds),
                        guide (field guide: G.sight(key,x,y,z,r), G.guide.page()), journey (migration south to
                        JOURNEY.marsh, landmarks found, route, years), map (the Map tab: fog of war, pan/zoom, tap a place), nest (twigs, egg, chick),
                        story (health -> G.tailRed, keepsakes, tricks, courtship, mate and fledglings),
                        photo (photo mode, postcards, album), howto (How to play and the controls map)
                        songs (songbirds, learning and imitating songs on the pitch strip, gifts, Call)
```

A system is `(G) => ({ id, update?(dt, c), scene?(S), save?(), load?(o) })`, added to `SYSTEMS` in
main.js. It adds instanced shapes with `G.R.shape(name, tris)` and pushes 8 floats per instance to
`S.props[name]` (x, y, z, scale, yaw, tint, turn, phase), points to `S.motes` (x, y, z, r, g, b, size),
particles with `G.part()`, and talks on the bus (`G.on`, `G.emit`). Saves go under `aloft.save3d`
(per system). 3D coordinates: x east, z south, **y up**, metres, water at y = 0. Debug:
`window.__aloft3d.dbg` (thermal, forest, mouse, fly).

## Code style

- Modern JS, ES modules, 2-space indent, semicolons, single quotes. Keep files small
  and focused; shared helpers go in `util.js` / `paint.js`.
- The world is a pure function of (x, z) and `ih()`; never store generated content
  except in small caches. Mutable per-object state (caught mice, collected rings)
  lives in a system keyed by the object's id.
- UI is frosted glass (James's pick, 2026-10-20): translucent white panels with a backdrop blur,
  pill shapes, slate ink #1d2b36, a dark slate pill for the main action, in Manrope (bundled in
  `web/fonts/` for the offline PWA, so no web-font links). Mockups: https://claude.ai/artifact/NHHnDTDSyAQwrsAbpTRVVk (B).
- Persisted settings use `localStorage` keys prefixed `aloft.`, always via the
  try/catch `store` helper in `web/3d/util.js`.
- Keep it light on tests (project is early and experimental). Check changes in a
  browser; `window.__aloft3d` exposes G, b, R and `dbg` helpers.

## Art direction

Everything is code-generated: low-poly flat-shaded meshes (`shapes.js`, `hawk.js`), two-sided
lighting (top and underside of each face coloured apart), hemisphere ambient, haze toward the
horizon colour and a faint paper grain. James chose this low-poly look on 2026-10-20 over
watercolour, ink, cel, layers, woodblock and gouache post passes (removed; in git history).
Colours live in `PAL` (world.js) and the moods in `sky.js`.

## Gameplay tuning (where the numbers live)

- Flight: `FLY` at the top of `flight.js`; thermals and lift in `world.js`; wave lift in `sys/winds.js`.
- Thumb timing (tap, pairing): top of `input.js`. Camera distances and dive focus: `camera.js`.
- Food and drink: `FOOD` in `sys/food.js`. Aim and the dive assist: `sys/aim.js`.
- Day length and seasons: `DAY`, `SEASON_DAYS` in `sky.js`. Journey: `JOURNEY` in `world.js`.
- Progress saves under `aloft.save3d`, one entry per system.

## CLI workflow (Git Bash on Windows, or any shell)

- `tools/serve.sh` then open http://localhost:8000. Phones on the same Wi-Fi can open
  `http://<pc-ip>:8000` (service worker and install need https or localhost, so test
  installing on the live site).
- Use `py -3` for Python on James's machine (plain `python` is a stray 2.7).
- Local copy lives at `C:\dev\aloft`.
