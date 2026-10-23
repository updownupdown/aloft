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
web/3d/world.js         terrain height(x,z) (coasts from earth.js, islands, pack ice), colours, trees + perches, thermals, airLift, rings
web/3d/earth.js         the Earth under the world: coastDist, earthBiome, continentAt, latLon/toXZ, oceanAt (each ocean's way across), regionAt, calendar (yearFrac, dateOf, seasonAt, snowLine)
web/3d/earthdata.js     baked grids for earth.js (made by tools/earth/bake.py from Natural Earth; do not edit by hand)
web/3d/render.js        WebGL2 renderer: sky, chunks, instanced trees and named shapes, hawk, water, points
web/3d/shapes.js        low-poly builders (builder, blob, prism, cone) and tree/ring/cloud meshes
web/3d/hawk.js          the hawk mesh, rebuilt per frame from a pose
web/3d/birds.js         other birds: Settings > Bird picks red-tail, osprey, barn owl or raven (sys/species.js, aloft.bird); ?bird=swift|heron|mallard tries the rest
web/3d/sky.js           clock (G.tod, G.day, G.season) and light (G.light)
web/3d/hud.js           G.hud: meter() (bars that flash when low), tip()/did(), say(msg, { kind, secs, icon }) / toast(msg, secs, kind): the message line top centre above the compass, kinds in SAY (event, song, tutorial, hint, warn, reply; quiet: name, glint, tally), paced by PACE (one line per 45 s); reply(), name(), glint(), tally(), quietly(); flight/status, hide(), thumb pads
web/3d/quiet.js        the quiet levels of the message line: name() thin titles under the compass, glint() tap-to-read icons beside it (kept in Journal > Log > Notes), tally() counts; pick a level by the quiet messages study (Say only for what must be known now)
web/3d/compass.js       the linear compass, top middle (N/E/S/W, nest, the way south or home, landmarks found)
web/3d/menu.js          G.menu: tab(), page() (sub-tabs), group() (Settings columns), toggle(), button({ group, main }), choice() (radio buttons), range() (a 0-100% slider), onOpen(), subtitle(), set(on, tab, page); ORDER/TITLES/ICONS/GROUPS
web/3d/letter.js        the menu's frame (frosted glass, .glass3 in 3d.css); swap it to restyle
web/3d/facet.js         low-poly helpers (map land, postcards) (PIG colours, poly, facets, gem, chamfer, hardShadow, lit)
web/3d/icons.js         every UI icon (James's picks, 2026-10-21): ICONS and icon(key) -> a 24x24 SVG in currentColor
web/3d/logo.js          Aloft's mark, a hawk over the hills (menu title, app icons via tools/icon.html)
web/3d/globe.js         the Map tab's globe: one WebGL shader, land + fog textures baked from earth.js; project()/unproject() for markers
web/3d/dial.js          the day dial, top right (bead marks now; hub cut-out holds Call)
web/3d/tips.js          tips as a short line and an icon (SHORT, keyed by tip id; TIP_GROUPS), swipe to dismiss, i to pause and read more, gear to Hints
web/3d/hints.js         How to play > Hints: every tip and message kind with on/off switches (G.hud.off), Show the tips again
web/3d/dev.js           Settings > Dev tools > Feature list: every small feature, how to try it, a tick when tested; Frame cost from G.perf. Add yours: G.dev?.add({ id, title, how, area, round, pr, go })
web/3d/journal.js       the Journal tab and its pages (Log, Songs, Landmarks, Field guide, Album): journal(G).section(order, title), .page(id); shot.js: project(), afterDraw(), portraits
web/3d/pics.js          still pictures of the game's own meshes (songbirdPic(sp, px)), cached data URLs
web/3d/app.js           Update, Graphics, Haptics, Quiet meters and Quit rows; wake lock; asks for full screen on each touch while not full screen
web/3d/action.js        the one action button, bottom right (left of the note pad) on the ground or perched (Take off, Sleep from G.actions; swipe for the other)
web/src/                audio.js (Web Audio synth; volumes A.vol/A.setVol: music, wind, fx buses), music.js (Valley, the generative music), birdvoice.js, songs.js (songbird species)
web/birds.html          bird lab: every species side by side (3d/birdlab.js)
web/lab.html            bird song lab; web/musiclab.html music lab (both share lab.css)
web/icons/, web/fonts/  app icons (tools/icon.html + tools/make-icons.mjs), bundled fonts (SIL OFL)
web/3d/sys/*.js         systems: air (thermal clouds/motes), rings, food (hunger, thirst, mice), aim, flora (tufts, flowers, stones, reeds), bushes (world.js bushesNear; perch on top),
                        guide (field guide: G.sight(key,x,y,z,r), G.guide.page()), journey (countries and
                        landmarks found, route, years turning with your own spring), map (the Map tab: a globe to spin and zoom, fog of war, tap a place; only one-of-a-kind places get marks), nest (twigs, egg, chick),
                        story (health -> G.tailRed, keepsakes, tricks, courtship, mate and fledglings),
                        photo (photo mode, postcards, album), howto (How to play and the controls map)
                        songs (songbirds, learning and imitating songs, dialects, mimics, alarm calls, gifts, Call), moments (music that notices),
                        aims (a daily aim and feathers, the lands collection, racing the companion),
                        season (the first season guided by the companion, one lesson a day), ghost (ghost flights by link), poles (the ice edges: white air, a wind back, aurora),
                        sealife (whales to ride, fish boils, flying fish, turtles), drift (icebergs, sea ice, driftwood, bottles; perches via world.js env.solids),
                        isles (rain pools, seabirds, a sight per archipelago; the sea is salt, food.js), skyrivers (G.skyWind), nightsea (pole star / Southern Cross, plankton)
```

A system is `(G) => ({ id, update?(dt, c), scene?(S), save?(), load?(o) })`, added to `SYSTEMS` in
main.js. It adds instanced shapes with `G.R.shape(name, tris)` and pushes 8 floats per instance to
`S.props[name]` (x, y, z, scale, yaw, tint, turn, phase), points to `S.motes` (x, y, z, r, g, b, size),
particles with `G.part()`, and talks on the bus (`G.on`, `G.emit`). Saves go under `aloft.save3d`
(per system). 3D coordinates: x east, z south, **y up**, metres, water at y = 0. The world is a rough Earth
96 x 61 km (earth.js EARTH): x wraps at +-48 km (main.js moves the bird and emits `wrap`, dx; keep
positions you hold in step), the poles are the north and south edges, and each place's season comes
from its latitude (`G.season` is the bird's own; `G.date` the calendar). Debug:
`window.__aloft3d.dbg` (thermal, forest, mouse, fly).

## Code style

- Modern JS, ES modules, 2-space indent, semicolons, single quotes. Keep files small
  and focused; shared helpers go in `util.js` / `paint.js`.
- The world is a pure function of (x, z) and `ih()`; never store generated content
  except in small caches. Mutable per-object state (caught mice, collected rings)
  lives in a system keyed by the object's id.
- UI is frosted glass (James's pick, 2026-10-20): translucent white panels with a backdrop blur,
  pill shapes, slate ink #1d2b36, a dark slate pill for the main action, in Outfit (James, 2026-10-20; bundled in
  `web/fonts/` for the offline PWA, so no web-font links). The HUD has no panes: white ink with a dark halo. Mockups: https://claude.ai/artifact/NHHnDTDSyAQwrsAbpTRVVk (B).
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
- Day length and seasons: `DAY`, `SEASON_DAYS` in `sky.js`; the calendar (`YEAR_DAYS`) and sun by latitude in `earth.js` / `sky.js`. Starts per bird: `STARTS` in `main.js`. Poles: `POLES` in `sys/poles.js`.
- Progress saves under `aloft.save3d`, one entry per system. **Saves are not kept across big changes yet**
  (experimental phase, James 2026-10-22): change the save format freely; main.js drops a save that doesn't fit.

## CLI workflow (Git Bash on Windows, or any shell)

- `tools/serve.sh` then open http://localhost:8000. Phones on the same Wi-Fi can open
  `http://<pc-ip>:8000` (service worker and install need https or localhost, so test
  installing on the live site).
- Use `py -3` for Python on James's machine (plain `python` is a stray 2.7).
- Local copy lives at `C:\dev\aloft`.
