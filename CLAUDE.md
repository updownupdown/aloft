# Aloft — project conventions

A cozy, zen 2D side-scrolling flight game. You play a hawk (a red-tailed-hawk-like
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
web/src/gestures.js     touch gestures drawn on the screen: taps (counted), strokes (line, hook, circle), hold-to-aim; their quiet feedback
web/src/controls.js     what each gesture does per state (flap, perch, prey, turn, glide, land, hover, ride, flip, aim), latched modes
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
web/src/singing.js      perched singing: half rings of note pools and known-bird pools in the bottom corners
web/src/dial.js         time-of-day dial (top right)
web/icons/              app icons (generated, see tools/make-icons.mjs)
web/fonts/              bundled Cormorant Garamond italic and Spectral (SIL OFL, licences alongside)
tools/serve.sh          serve web/ on localhost:8000
tools/make-icons.mjs    regenerate icons from tools/icon.html (needs Playwright)
```

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
