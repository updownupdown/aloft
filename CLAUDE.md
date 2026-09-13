# Aloft — project conventions

A cozy, zen 2D side-scrolling flight game. You play a bird (a fictional
red-tailed-hawk-like species) riding thermals over procedurally generated
hills and water. Terraria-like pixel-art look. Android-first, web for quick
testing, iOS later.

## Engine & version

- **Godot 4.7.2.stable.official** (`godot --version` to confirm — pin this
  exact patch version; re-check after any engine upgrade).
- **GDScript only. No C#** (C# cannot export to web in Godot 4).
- **Compatibility renderer** (`gl_compatibility`) everywhere, so web,
  Android and iOS render identically. Never switch to Forward+/Mobile
  renderers.
- Godot 4 APIs only — never Godot 3 syntax:
  - `TileMapLayer`, not `TileMap`.
  - `@export` / `@onready`, not `export(...)` / `onready`.
  - `CharacterBody2D`, not `KinematicBody2D`.
  - Callable-based signals: `signal.connect(callable)` /
    `some_signal.connect(_on_signal)`, not the old string-based `connect()`.

## Code style

- **Typed GDScript throughout**: typed variables, typed function params and
  return types (`func foo(x: float) -> void:`), typed `@export` vars.
- Keep scenes small and push logic into scripts. Avoid building behavior
  purely in the editor (signals wired in code where practical, not just in
  the Node inspector) so everything stays text-diffable and AI-editable.
- One script per scene root node, colocated with its `.tscn` under
  `scenes/<feature>/`. Shared/stateless logic (terrain generation, input
  handling) lives under `scripts/`.
- Autoloads (singletons) live in `scripts/autoload/` and are registered in
  `project.godot` under `[autoload]`.

## Pixel-perfect settings (already configured in `project.godot`)

- Internal viewport: **480×270**, stretch mode `viewport`, aspect `keep`,
  scale mode `integer` — always renders at an integer multiple, never
  blurry/non-integer scaled.
- Default texture filter: **Nearest** (no linear filtering / mipmaps on
  pixel art).
- Terrain tiles: **16×16 px**.
- Bird sprite: roughly **32–48 px**.
- Desktop mouse emulates touch (`pointing/emulate_touch_from_mouse=true`),
  so gameplay scripts only need to handle `InputEventScreenTouch` /
  `InputEventScreenDrag` — the same code path drives both touch and mouse.

### Palette

Not locked in yet. Propose picking one ~32-color Lospec palette and
sticking to it for all art (terrain, bird, UI, weather effects):

1. **DB32 (Dawnbringer 32)** — the classic general-purpose 32-color
   palette; balanced warm/cool tones, well suited to natural landscapes.
2. **Endesga 32 (EDG32)** — more saturated/vibrant, good if we want a
   punchier, more stylized sky/hills look.
3. **Pear36** — a 36-color nature-leaning palette with a wide green/blue
   range, close to a middle ground between the two above.

Default to **DB32** until told otherwise; the Python/Pillow pipeline
(`assets/palette/`) should snap all generated art to whichever palette is
chosen.

## Engine building blocks to prefer

- **FastNoiseLite** for procedural terrain heightmaps.
- **TileMapLayer** for terrain tiles.
- **CanvasModulate** (+ 2D lights/shaders as needed) for day/night and
  water tinting.
- **GPUParticles2D** (fallback `CPUParticles2D`) for weather (rain, leaves,
  wind streaks).
- **Area2D** for thermal zones (upward wind that lifts the bird).
- **CharacterBody2D** for the bird's flight physics.

## Directory layout

```
scenes/            Scene + colocated script per feature (bird, world, thermal, environment)
scripts/autoload/  Singletons (game clock / day-night state)
scripts/terrain/   Procedural generation (noise -> chunk data)
scripts/input/     Touch/mouse controller
assets/palette/    Chosen palette + Python/Pillow pixel-snapping pipeline
assets/placeholder/ Placeholder art (flat shapes) used before real art lands
tools/             Git Bash CLI scripts (run desktop, export web, build Android)
export/            Build output (gitignored)
```

## CLI workflow (Git Bash, see `tools/`)

- `tools/run-desktop.sh` — run the game in the Godot editor's runtime on
  desktop.
- `tools/export-web.sh` — export the Web (single-threaded) build and serve
  it on localhost for Chrome testing.
- `tools/build-android.sh` — build a debug APK and install it on a
  connected phone via `adb`.

## Toolchain notes (this machine)

- Godot binary is `C:\Program Files\Godot\Godot_v4.7.2-stable_win64.exe`,
  exposed on PATH as `godot` via a shim at
  `%USERPROFILE%\.local\bin\godot.cmd`.
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` point at the Android SDK;
  `platform-tools` (adb) is on PATH.
- Use `py -3` for Python (plain `python` resolves to a stray Python 2.7 on
  this machine) — only needed later for the Pillow pixel-snapping script.
- Project lives at `C:\dev\aloft`, intentionally outside OneDrive to avoid
  file-lock/sync issues with Godot's `.godot/` cache and Android build
  artifacts.
- Android debug export needs two one-time, per-machine settings in Godot's
  global Editor Settings (`%APPDATA%\Godot\editor_settings-4.7.tres`, not
  part of this repo — a fresh machine/clone needs these redone):
  - `export/android/java_sdk_path` set to the JDK 17 install dir (here:
    `C:/Program Files/Eclipse Foundation/jdk-17.0.0.35-hotspot`).
  - A valid debug keystore at `export/android/debug_keystore`
    (`%APPDATA%\Godot\keystores\debug.keystore`). The one Godot
    auto-creates is a placeholder, not an actual keystore — generate a
    real one, and use **`-storetype JKS`** explicitly: this machine's
    bundled Android build-tools (28.0.3) `apksigner` only tries the
    legacy JKS loader and fails on JDK 17's default PKCS12 format with
    "Invalid keystore format".
    ```
    keytool -genkeypair -v -storetype JKS -keystore "%APPDATA%\Godot\keystores\debug.keystore" \
      -storepass android -alias androiddebugkey -keypass android \
      -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
    ```
