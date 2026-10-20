# Aloft — project conventions

**2026-10-20: Aloft is now 3D** (James's decision). The game is `web/index.html` + `web/3d/`.
The 2D game in `web/src/` is no longer loaded; it stays only as reference while its features
are ported to 3D, then it is deleted (keep `src/audio.js`, `music.js`, `birdvoice.js`, `songs.js`,
which 3D and the labs share). See "3D layout" below.

A cozy, zen flight game, first made in 2D (side-scrolling). You play a hawk (a red-tailed-hawk-like
species) riding thermals over procedurally generated hills, trees and ponds. Painted
in a loose watercolour style ("Wet Wash"). Android-first as an installable PWA, desktop
browser for quick testing, iOS later.

Live: https://updownupdown.github.io/aloft/ (every push to `main` touching `web/` deploys).

## Stack

- **Plain HTML + JavaScript (ES modules) on a 2D canvas.** No framework, no bundler,
  no build step, no npm dependencies for the game. `web/` is served as-is.
- Godot was the first prototype and was dropped (2026-10-18): the wasm was ~40 MB, and
  the art direction is JavaScript canvas code.
- All sound is synthesised with Web Audio (`web/src/audio.js`); no audio files.
- PWA: `web/manifest.webmanifest` + `web/sw.js` (stale-while-revalidate cache). When you
  add a file under `web/src/`, add it to `FILES` in `sw.js`.

## Layout

```
web/index.html          entry; loads src/game.js as a module, registers sw.js
web/style.css           DOM overlay in the Pigment style (menu button, pause menu, toasts, Sing, dial)
web/src/game.js         state, systems (meters, weather, clock, critters, songs), taps, loop, HUD meters
web/src/bird.js         hawk flight model, perch/ground/swim states, animation pose
web/src/world.js        procedural world: biomes (incl. mountains), ground, cliff scarps + rock spires, ponds + fish, landmarks, trees + perches, bushes, twigs, worms, mice, thermals, rings
web/src/air.js          wave lift + lens clouds, kettles of wild hawks, cumulus at the cloudbase and the tunnels carved in them
web/src/airart.js       their art: lens clouds, kettle hawks, carved cumulus, ridge-lift grass lean and streaming leaves
web/src/render.js       draws a frame (sky, parallax hills, world layer, hawk, weather)
web/src/atmos.js        sky moods and slow changes: dawn fog, rainbow, meteors, aurora, moon phase, feather wear + moult, dream path, way hint
web/src/skyfx.js        paints those: aurora, rainbow, golden rays, meteors, fog, moulted feathers, wind-arrow hint, the dream
web/src/paint.js        watercolour toolkit: wash, bloom, softWash, lift, paper textures
web/src/palette.js      day / dusk / night palettes blended by time of day, greyed by weather
web/src/input.js        keyboard (arrows/WASD, flap keys) and hands touches to gestures.js
web/src/gestures.js     touch gestures: taps (counted), holds (by time; report where the finger is), strokes (line, hook, circle); the sign above the hawk
web/src/controls.js     what each gesture does per state: tap or hold where the hawk should go (hover above, slow above-behind, turn far behind, ride in a thermal), double-tap targets, strokes; latched modes
web/src/songs.js        songbird species: songs, where and when they sing, the gift each song brings
web/src/life.js         mice, fish, flocks (boids), visiting songbirds, companion hawk and fledgling
web/src/journey.js      migration, landmarks found, nest and chick, journal + map (with the route flown), save/resume
web/src/guide.js        field guide: sight() from the drawing code, portraits cut from the frame, pages for the journal
web/src/postcard.js     postcards at landmarks, saved to the album
web/src/story.js        long-term health (tail colour), keepsakes, acrobatics, courtship and a mate down south
web/src/fauna.js        herons, deer and squirrels: larger life that is only there to be seen
web/src/music.js        generative music in four styles (valley, tape loops, wind harp, kalimba); Valley's numbers in VALLEY_TUNE
web/src/birdvoice.js    songbird voices: per-species call templates and synthesis engines
web/lab.html            bird song lab (pick the songbird voice, saved as aloft.birdVoice)
web/musiclab.html       music lab (tune Valley, saved as aloft.musicTune); both labs share lab.css
web/src/photo.js        photo mode (pan, save or share a PNG)
web/src/ui.js           pause menu, settings, how to play, songbook, toasts
web/src/controlmap.js   the controls map in How to play: one ink drawing per gesture (keep it in step with controls.js)
web/src/singing.js      perched singing: a ladder of note pools up one edge (low at the bottom), known birds in columns on the other
web/src/dial.js         time-of-day dial (top right)
web/src/seal.js         Aloft's mark, the wax seal (drawSeal): the menu's Resume seal and the app icons
web/icons/              app icons, the wax seal on paper (generated from tools/icon.html by tools/make-icons.mjs)
web/fonts/              bundled Cormorant Garamond italic and Spectral (SIL OFL, licences alongside)
tools/serve.sh          serve web/ on localhost:8000
tools/make-icons.mjs    regenerate icons from tools/icon.html (needs Playwright)
```

## 3D layout (the game)

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
web/3d/sky.js           clock (G.tod, G.day, G.season) and light (G.light)
web/3d/hud.js           G.hud: meter() (washed bars), tip()/did(), toast() (queued), status, counter (under the dial), hide(), quiet meters, thumb pads
web/3d/menu.js          G.menu: tab(), toggle(), button(), onOpen(), subtitle(), set(); tab order/titles in ORDER/TITLES
web/3d/letter.js        the menu's look (handmade sheet, margin rule, tab brush stroke, wax seal); swap it to restyle
web/3d/paper.js         paper and paint helpers for the UI (handmadeTex, wash, deckle, brush, inkLine)
web/3d/seal.js          Aloft's wax seal (menu Resume, app icons via tools/icon.html)
web/3d/dial.js          the day dial, top right
web/3d/journal.js       the Journal tab: journal(G).section(order, title); shot.js: project(), afterDraw(), portraits
web/3d/app.js           Update, Full screen, Quiet meters and Quit rows
web/3d/post.js          looks (R.style): plain, wash, ink, cel, layers, retro; one full-screen pass after the scene
web/3d/sys/*.js         systems: air (thermal clouds/motes), rings, food (hunger, thirst, mice), aim,
                        guide (field guide: G.sight(key,x,y,z,r), G.guide.page()), journey (migration south to
                        JOURNEY.marsh, landmarks found, route, years, journal map), nest (twigs, egg, chick),
                        story (health -> G.tailRed, keepsakes, tricks, courtship, mate and fledglings),
                        photo (photo mode, postcards, album), howto (How to play and the controls map)
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
- The world is a pure function of x and `hash()`; never store generated content
  except in small caches. Mutable per-object state (eaten berries, collected rings)
  lives in `G` keyed by the object's id.
- World coordinates: x right, **y down**, ground around y = 0, sky up to `CEILING`
  (-820). The view is ~300 world units tall (wider/taller on other aspect ratios).
- UI typography is Cormorant Garamond italic for titles and Spectral for text, both bundled in
  `web/fonts/` (offline PWA), so no web-font links. UI style is "Pigment" (Field Journal D): sepia
  ink, ruled lines, world pigments as accents; notes in the shared folder under `ui-style/`.
- Persisted settings use `localStorage` keys prefixed `aloft.`, always via the
  try/catch `store` helper in `game.js`.
- Keep it light on tests (project is early and experimental). Check changes in a
  browser; `window.__aloft` exposes the game state and `__aloft.dbg` has helpers
  to jump the hawk to a perch, pond, ground or thermal.

## Art direction: Wet Wash

Every hill, tree, cloud and feather is a polygon washed two or three times with
slightly different wobbly edges in multiply blend (`wash()`), with a darker rim where
pigment dries; paper texture is multiplied over the whole frame. Light comes from
leaving paper bare (`lift()`), never from white paint. Source demos and notes live in
the project's shared folder under `art-direction/`. Palettes are in `palette.js`;
add colours there rather than inline.

## Gameplay tuning (where the numbers live)

- Flight: `bird.js` constants (gravity, drag, relax angle, stall, flap) and `world.js`
  `lift()` for thermal strength. Ridge lift: `world.js` `ridgeLift()` and `TUNE.ridge`; wave lift and kettles: top of `air.js`. A tap flaps; `flap(b, power, G, sync)`
  scales cost and thrust by sync. Gesture timing and sizes: top of `gestures.js`; what they do: `controls.js`.
- Camera zoom (`ZOOM` default, `ZOOM_OUT` high and fast) and the two-tap take-off window: top of
  `game.js`. `G.view` is the zoomed world view; `G.view.scr` is screen space (sky, far hills,
  weather, HUD), sized as the art was first drawn; world sprites paint at the fixed `G.view.spx`.
- Day length, thirst/hunger rates, berry and ring respawn: top of `game.js`. Seasons last eight days (`SEASON_DAYS`,
  `updateClock`). Journey length and start: `JOURNEY` / `START_X` in `world.js`.
- Progress is saved under `aloft.save` (position, clock, meters, journey, nest); learned songs
  and the song log are separate keys so a new journey keeps them.

## CLI workflow (Git Bash on Windows, or any shell)

- `tools/serve.sh` then open http://localhost:8000. Phones on the same Wi-Fi can open
  `http://<pc-ip>:8000` (service worker and install need https or localhost, so test
  installing on the live site).
- Use `py -3` for Python on James's machine (plain `python` is a stray 2.7).
- Local copy lives at `C:\dev\aloft`.
