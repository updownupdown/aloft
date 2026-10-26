# Tiercel — project conventions

**2026-10-25: the game is called Tiercel** (James; "Aloft" was taken on Steam). Everything a player
reads says Tiercel; the repo, the live URL (/aloft/), the `aloft.` storage keys, the `aloft-vN` cache
and `__aloft3d` keep the old name on purpose, so installs and saves carry over.

**2026-10-20: the game is 3D** (James's decision); the 2D game was deleted (it is in git history
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
  The `CACHE` number is the build number (`aloft-v221` is build 221), shown on Settings > Advanced >
  Update; say "live in build N" when a change ships.

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
web/3d/clouds.js        clouds as soft volumes (lobes integrated along the view ray) and the valley mist (S.mists); Soft is the look (James, 10-23), ?clouds=poly the old polygons
web/3d/look.js          Settings > Advanced > Look tests: ideas on trial (C shore foam) behind switches (R.look[id]; #defines via R.relook); T reflections is Settings > Graphics > Ultra (app.js); GRADE_GLSL and grain() (Paper grain, stronger on dense screens). Kept for good (10-24): flat far trees, layered blue ridges (render.js haze, land only), sunset undersides (clouds.js), the glory on mist. Removed: real shadows, smooth shading, land detail, wind waves, dew, dappled light, render to texture, light shafts
web/3d/rain.js          the rain (S.rainU from sys/weather.js): fine drizzle placed by the GPU round the camera, veils far off in a downpour; rings on water are render.js waterAt, splashes weather.js
web/3d/shapes.js        low-poly builders (builder, blob, prism, cone) and tree/ring/cloud meshes
web/3d/hawk.js          the hawk mesh, rebuilt per frame from a pose
web/3d/birds.js         other birds: Settings > Bird picks red-tail, osprey, barn owl or raven (sys/species.js, aloft.bird); ?bird=swift|heron|mallard tries the rest
web/3d/sky.js           clock (G.tod, G.day, G.season) and light (G.light)
web/3d/hud.js           G.hud: meter() (slim bars that breathe when low), tip()/did(), say(msg, { kind, secs, icon }) / toast(msg, secs, kind): the message line top centre above the compass, kinds in SAY (event, song, tutorial, hint, warn, reply; quiet: name, glint, tally), paced by PACE (one line per 45 s); reply(), name(), glint(), tally(), quietly(); flight/status, hide(), thumb pads
web/3d/quiet.js        the quiet levels of the message line: name(title, icon) thin titles with an icon under the compass, glint() tap-to-read icons beside it (stacked: the newest, three dots when more; hidden but the dots under a tip or message), tally() counts (small words and an icon in the name's place, below it when both show); pick a level by the quiet messages study (Say only for what must be known now)
web/3d/compass.js       the linear compass, top middle (N/E/S/W, nest, the way south or home, landmarks found)
web/3d/menu.js          G.menu (style A, 2026-10-23): a pale sheet in three columns: the rail (logo, Quit, sections Today, Map, Journal (Songs, Places, Things, Nest), Tutorial ('how'), Settings ('play'), Resume), the section's pages, the page; tab(), page(), group() (Settings pages: Sounds, Graphics, Controls, Your bird ('journey'), Advanced; Journal > Messages is hints.js; 'today' = Today's actions), toggle(), button({ group, main }), choice(), range(), info(), onOpen(), subtitle(), set(on, tab, page); ORDER/TOOLS/PAGES/GROUPS/SECTION_OF
web/3d/today.js         the Today section: on the left the Tutorial box (lessons, the day's aim: journal sections before 7), then your life and to-dos; on the right your bird, food/water/wings/health bars, where
web/3d/letter.js        the menu's frame (frosted glass, .glass3 in 3d.css); swap it to restyle
web/3d/facet.js         low-poly helpers (map land) (PIG colours, poly, facets, gem, chamfer, hardShadow, lit)
web/3d/icons.js         every UI icon (James's picks, 2026-10-21): ICONS and icon(key) -> a 24x24 SVG in currentColor
web/3d/logo.js          the game's mark: a red-tail from above, wings level, over hazy faceted hills (menu title, splash, app icons via tools/icon.html); a head's width between each wingtip and the edge
web/3d/globe.js         the Map tab's globe (the whole tab, no pages): one WebGL shader, land (+ roughness for ridges) and fog textures baked from earth.js, day and night from the sun; project()/unproject() for markers
web/3d/dial.js          the day dial, top right (bead marks now; hub cut-out holds Call)
web/3d/tips.js          tips as a short line and an icon (SHORT, keyed by tip id; TIP_GROUPS), swipe to dismiss, tap to pause and read more, gear to Settings > Messages
web/3d/hints.js         Journal > Messages (once How to play > Hints, then Settings > Messages): every tip and message kind with on/off switches (G.hud.off), Show the tips again
web/3d/dev.js           Settings > Advanced > Dev mode (Off, 0/25/50/100%: G.emit('mock', k), each system mocks its own progress, then a reload), Time of day; Dev tools > Copy debug link (?dbg=: place, time, weather; paste to Claude), Feature list: every small feature, how to try it, a tick when tested; Frame cost from G.perf. Add yours: G.dev?.add({ id, title, how, area, round, pr, go })
web/3d/journal.js       journal(G).section(order, title) routes by order: <10 Today, other 10-29 hidden (no Log), 30-41 Journal > Nest, 42 and 60+ Journal > Things (finds, bottles; the field guide's animals), 43-59 Journal > Places (wonders, biomes 45, landmarks); .page('songs') is Journal > Songs (with the field guide's other birds, G.guide.cards('bird')). shot.js: project(), afterDraw(), portraits
web/3d/pics.js          still pictures of the game's own meshes (songbirdPic(sp, px)), cached data URLs
web/3d/app.js           Update, Graphics, Haptics, Quiet meters and Quit rows; wake lock; asks for full screen on each touch while not full screen
web/3d/coach.js        the lessons' coach: a card with the thumbs doing the move, ghost thumbs on screen, the Skip pill
web/3d/action.js        the one action button, bottom right (left of the note pad) on the ground or perched (Take off, Sleep from G.actions; swipe for the other)
web/src/                audio.js (Web Audio synth; volumes A.vol/A.setVol: music, wind, fx buses), music.js (Valley, the generative music), birdvoice.js, songs.js (songbird species)
web/birds.html          bird lab: every species side by side (3d/birdlab.js)
web/icons/, web/fonts/  app icons (tools/icon.html + tools/make-icons.mjs), bundled fonts (SIL OFL)
web/3d/sys/*.js         systems: air (thermal clouds/motes), rings, food (hunger, thirst, mice; the hunt's reach, mantling, misses), findwater (thirsty: fresh water on the compass), aim, flora (tufts, flowers, stones, reeds), bushes (world.js bushesNear; perch on top),
                        guide (field guide: G.sight(key,x,y,z,r), G.guide.page()), journey (countries and
                        landmarks found, route, years turning with your own spring), map (the Map tab: a globe to spin and zoom, fog of war, paper grain and straight pencil lines; tallies top left; tap to drop a pin (+ Add pin, 12 colours, Fast-travel where explored) or pick a place; only one-of-a-kind places get marks), nest (twigs, egg, chick),
                        story (health -> G.tailRed, keepsakes, tricks, courtship, mate and fledglings),
                        howto (the Tutorial's pages, one per lessons chapter in their order (PAGES), with cards; Flying holds the controls map)
                        songs (songbirds, learning and imitating songs by finding notes in any order, hints after two misses, the teacher singing it again slowly, a coach for the first song, birds placed in stereo in their own voices, singers on the compass and the rail by bearing, alarm calls, gifts, Call; the Sing UI is singui.js + songs.css in Linen, note colours NOTE_COLS), moments (music that notices),
                        aims (a daily aim and feathers (G.feather: each makes the wings last 3% longer, b.endure, up to 20), the lands collection, racing the companion),
                        lessons (the tutorial: the first flight with the HUD hidden and coach.js's ghost thumbs, then the lessons card once and a chain of quiet lessons under Today; Tutorial > Overview lists the chapters with Replay; a feather for the first flight and each chapter, once), poles (the ice edges: pale air, aurora, the pole wall; fly through it to cross to the opposite longitude),
                        sealife (whales to ride, fish boils, flying fish, turtles), drift (icebergs, sea ice, driftwood, bottles; perches via world.js env.solids),
                        isles (rain pools, seabirds, a sight per archipelago; the sea is salt, food.js), skyrivers (G.skyWind), nightsea (pole star / Southern Cross, plankton)
```

A system is `(G) => ({ id, update?(dt, c), scene?(S), save?(), load?(o) })`, added to `SYSTEMS` in
main.js. It adds instanced shapes with `G.R.shape(name, tris)` and pushes 8 floats per instance to
`S.props[name]` (x, y, z, scale, yaw, tint, turn, phase), points to `S.motes` (x, y, z, r, g, b, size),
particles with `G.part()`, and talks on the bus (`G.on`, `G.emit`). Saves go under `aloft.save3d`
(per system). 3D coordinates: x east, z south, **y up**, metres, water at y = 0. render.js draws relative to R.O, a
point by the camera (uO, uModel relative to it), since float32 at tens of km shook edges. The world is a rough Earth
96 x 61 km (earth.js EARTH): x wraps at +-48 km (main.js moves the bird and emits `wrap`, dx; keep
positions you hold in step), the poles are the north and south edges, and each place's season comes
from its latitude (`G.season` is the bird's own; `G.date` the calendar). Debug:
`window.__aloft3d.dbg` (thermal, forest, mouse, fly).

## Code style

- Modern JS, ES modules, 2-space indent, semicolons, single quotes. Keep files small
  and focused; shared helpers go in `util.js` / `paint.js`.
- **Keep the Earth real** (James, 2026-10-23): a land, tree or animal only where the real place has it.
  biomes.js `FITS` (which extra lands a cell may roll), world.js `NATIVE` (trees by continent),
  sys/critters.js `LOCAL` (each animal's regional species, or none). Variety never beats realism.
- The world is a pure function of (x, z) and `ih()`; never store generated content
  except in small caches. Mutable per-object state (caught mice, collected rings)
  lives in a system keyed by the object's id.
- UI is frosted glass in Linen (James's pick G, 2026-10-23): warm cream panels (at least 86% opaque, so
  text reads over any world) with a backdrop blur, pill shapes, warm charcoal ink #2a2420 / #5c5248, moss #3f5a35
  for what you press (Resume, main buttons, switches, the chosen page), clay #a8492e for every slider, in Figtree
  (bundled in `web/fonts/` for the offline PWA, so no web-font links). Use the tokens in `3d.css :root`
  (--ink, --moss, --clay, --sheet, --plate, --btn), never raw colours. Buttons over the world are cream pills,
  Take off with a moss ring. The HUD has no panes: white ink with a dark halo. Study: https://claude.ai/artifact/LwsU6LW5UJvyKHPAUHJaSw.
- Persisted settings use `localStorage` keys prefixed `aloft.`, always via the
  try/catch `store` helper in `web/3d/util.js`.
- Keep it light on tests (project is early and experimental). Check changes in a
  browser; `window.__aloft3d` exposes G, b, R and `dbg` helpers.
- Smoke test: `node tools/smoke.mjs` (or `node tools/smoke.mjs menu tour`) plays the game headless
  through boot, every menu page, a world tour and the date line, travel, a hunt, perching, singing
  and sleep, and boots each bird; it prints any page error and exits 1. Run it before merging a big
  change. Needs Playwright; headless WebGL is software, so it says nothing about frame rate.

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
