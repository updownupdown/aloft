// Aloft icons: James's picks from the icon study (2026-10-21), https://claude.ai/artifact/Pb5ypQKv3WSAT7U1V5SRUR
// Each entry is the inner markup of a 24x24 icon, stroked in currentColor. Filled parts carry fill/stroke
// attributes inline. Wrap with icon(key) or put it in <svg viewBox="0 0 24 24"> with the stroke styles below.
export const ICONS = {
  // Height ladder: rising air, one to three chevrons lit by how strong (hud.js; red, 2026-10-22)
  updraft: '<path class="u1" d="M6.5 20l5.5-4.5 5.5 4.5"/><path class="u2" d="M6.5 14l5.5-4.5 5.5 4.5"/><path class="u3" d="M6.5 8l5.5-4.5 5.5 4.5"/>',
  // Menu button: Pause
  menu: '<rect x="5.6" y="4.8" width="4.6" height="14.4" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.8" y="4.8" width="4.6" height="14.4" rx="1.4" fill="currentColor" stroke="none"/>',
  // Resume: Play
  resume: '<path d="M8 5.5v13l10.5-6.5z"/>',
  // Quit: Door and arrow
  quit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  // Map: Folded map
  map: '<path d="M3 6l6-2.5 6 2.5 6-2.5v14l-6 2.5-6-2.5-6 2.5zM9 3.5v14M15 6v14"/>',
  // Journal: Closed book
  journal: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11M9 8h5"/>',
  // Game: Bird in flight
  game: '<path d="M2 9.5c3.5-.3 6.5 1.6 8.6 4.6L12 15l1.4-.9c2.1-3 5.1-4.9 8.6-4.6"/>',
  // Settings: Sliders
  settings: '<path d="M4 8h5M13 8h7M4 16h10M18 16h2"/><circle cx="11" cy="8" r="2"/><circle cx="16" cy="16" r="2"/>',
  // Tutorial (once How to play): Question
  how: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><circle fill="currentColor" stroke="none" cx="12" cy="16.8" r="1"/>',
  // Today: the sun over the horizon (2026-10-23)
  today: '<path d="M3 17.5h18M6.5 17.5a5.5 5.5 0 0 1 11 0M12 5v2.5M5.3 8.8l1.7 1.7M18.7 8.8L17 10.5M8.5 20.5h7"/>',
  // Health: a heart
  health: '<path d="M12 19.5s-7.5-4.4-7.5-9.6A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z"/>',
  // Audio: Speaker
  audio: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  // Graphics: Low-poly hills
  graphics: '<path d="M2 19l6-9 4 5 3-4 7 8zM8 10l4 9M15 11l-3 8"/>',
  // Gameplay: Game pad
  gameplay: '<path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1.2 4a2.5 2.5 0 0 1-4.3.9L14.5 16h-5l-1.8 2.3a2.5 2.5 0 0 1-4.3-.9l-1.2-4A5 5 0 0 1 7 7zM7.5 10v4M5.5 12h4"/><circle fill="currentColor" stroke="none" cx="16" cy="10.8" r="1"/><circle fill="currentColor" stroke="none" cx="17.8" cy="13.2" r="1"/>',
  // Dev tools: Brackets
  dev: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>',
  // Log: Calendar
  log: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
  // Songs: Two notes (revised, as today)
  songs: '<path d="M9 17.5V6l10-2v11.5"/><path d="M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>',
  // Lands: Pine and hill
  lands: '<path d="M7 3.5l4 8H3zM7 11.5V20M10 20c1.5-4 3.5-6 6-6s4.5 2 6 6M2 20h20"/>',
  // Landmarks: Flag on a hill
  landmarks: '<path d="M4 20c2-3 5-4.5 8-4.5s6 1.5 8 4.5M12 15.5V4l6 2.5-6 2.5"/>',
  // Field guide: Track
  guide: '<path d="M12 13c2.5 0 4.5 2.2 4.5 4.3 0 1.5-1.2 2.2-2.5 2.2-.8 0-1.3-.4-2-.4s-1.2.4-2 .4c-1.3 0-2.5-.7-2.5-2.2 0-2.1 2-4.3 4.5-4.3z"/><circle cx="6.8" cy="10.5" r="1.7"/><circle cx="10" cy="6.5" r="1.7"/><circle cx="14" cy="6.5" r="1.7"/><circle cx="17.2" cy="10.5" r="1.7"/>',
  // Album: Photo stack
  album: '<rect x="6.5" y="6.5" width="14.5" height="13" rx="1.5"/><path d="M3 16V4.5A1.5 1.5 0 0 1 4.5 3H16M6.5 16.5l4-4 3 3 2-2 5 5"/>',
  // Hunger: Mouse (revised)
  hunger: '<path d="M5.5 18c-.8-5.2 2.4-9.5 7-9.5 3.2 0 5.6 2 6.8 4.6l2.4 2c.4.4.2 1-.3 1.1L18.5 18zM9.8 9.4a3 3 0 1 1 5.7 1.2M5.5 17.4c-2.4.3-3.8-1-3.5-3.2.2-1.4 1.5-2 2.5-1.2M10 18v1.5M15 18v1.5"/><circle fill="currentColor" stroke="none" cx="17.5" cy="13.3" r="0.95"/>',
  // Thirst: Drop with shine
  thirst: '<path d="M12 3C9 7.5 6.5 10.5 6.5 13.5a5.5 5.5 0 0 0 11 0C17.5 10.5 15 7.5 12 3z"/><path d="M9.5 13.8a2.6 2.6 0 0 0 2.6 2.6"/>',
  // Stamina: Pulse
  stamina: '<path d="M3 12h4l2-4.5 3 9 2-4.5h7"/>',
  // Take off: Wings up
  takeoff: '<path d="M3 8c3.2 0 6.2 2 9 6 2.8-4 5.8-6 9-6M12 18v2.5M8 17.5l-1 2M16 17.5l1 2"/>',
  // Sleep: Zzz
  sleep: '<path d="M4 7h5l-5 6h5M12 12h4l-4 5h4M16.5 3h3.5l-3.5 4h3.5"/>',
  // Call: Speaker
  call: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  // Sing: Two notes
  sing: '<path d="M9 17.5V6l10-2v11.5"/><path d="M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>',
  // Hear it: Play in a ring
  hear: '<circle cx="12" cy="12" r="9"/><path fill="currentColor" stroke="none" d="M10 8.5v7l5.5-3.5z"/>',
  // Slow: Turtle (revised)
  slow: '<path d="M4.5 15.5c0-4.4 3.4-8 7.5-8s7.5 3.6 7.5 8zM7.7 15.5l1.8-4.4h5l1.8 4.4M9.5 11.1L12 7.5l2.5 3.6M7 15.5v2.5M17 15.5v2.5M4.5 15.5l-1.7 1.3"/><circle cx="20.8" cy="13.9" r="1.6"/>',
  // Done: Cross
  done: '<path d="M6 6l12 12M18 6L6 18"/>',
  // Done, ticked: a check (lessons, aims)
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  // Feather: a quill (feathers earned for aims and lessons)
  feather: '<path d="M19.5 4C12 4.5 7 9.5 6 17l-2 3M6 17c4.5-.3 8.5-2.6 10.8-7M9.2 13.3l5.3-.6"/>',
  // Take picture: Camera
  snap: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  // Zoom in: Plus
  zoomin: '<path d="M12 5v14M5 12h14"/>',
  // Zoom out: Minus
  zoomout: '<path d="M5 12h14"/>',
  // Centre on the hawk: Crosshair
  me: '<circle cx="12" cy="12" r="6.5"/><circle fill="currentColor" stroke="none" cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  // Nest: Nest on a branch (revised)
  nest: '<path d="M2 19c4.5-.2 8.5-.6 12.5-1.7 3-.8 5.3-2.1 7.5-4M16.8 16.6c.9 1.3 2.3 2.1 3.9 2.2M4.5 11c.6 3.6 2.8 5.6 5.75 5.6S15.4 14.6 16 11zM6.6 11a2.2 2.9 0 0 1 4.4 0M10.6 11a2.2 2.9 0 0 1 4.4 0"/>',
  // Way south: S in a ring
  south: '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.2c-.6-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2.1 2.6 1 2.6 2.2-1.1 2-2.6 2c-1.2 0-2.2-.6-2.7-1.5"/>',
  // Home: Tree home
  home: '<path d="M12 3l6 8h-3l4 5H5l4-5H6zM12 16v5"/>',
  // Ghost flight: Trail
  ghost: '<path d="M3 18c3-1 4-4 6-7s5-5 9-5"/><circle fill="currentColor" stroke="none" cx="19.5" cy="6" r="2"/>',
  // Map pin: Round pin
  pin: '<circle cx="12" cy="8.5" r="4.5"/><path d="M12 13v8"/>',
  // Speed: Stoop
  speed: '<path d="M6 4l12 12M18 9v7h-7M4 11l4 4M10 3l2 2"/>',
  // Glide: Soaring
  glide: '<path d="M3 10c3-.3 5.5 1.3 7.4 4L12 15l1.6-1c1.9-2.7 4.4-4.3 7.4-4M4 19.5h16"/>',
  // Agility: S turn (revised)
  agility: '<path d="M4 21c4 0 7-1.5 7-4.5S8 12 8 9.5 10.5 5 15 5h5M17.2 2.2L20 5l-2.8 2.8"/>',
  // Hover: Hold still
  hoverstat: '<path d="M12 3v4M12 17v4"/><circle cx="12" cy="12" r="4"/><path d="M5 12h2M17 12h2"/>',
  // Stamina: Bolt
  staminastat: '<path d="M13 3L5 13.5h6L10 21l9-11h-6z"/>',
  // Flap: Two taps
  flap: '<circle cx="7" cy="14" r="3.5"/><circle cx="17" cy="14" r="3.5"/><path d="M7 7V5M4 8l-1-1M10 8l1-1M17 7V5M14 8l-1-1M20 8l1-1"/>',
  // Turn: Thumbs split
  turn: '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M7 7.5V3M5 5l2-2 2 2M17 16.5V21M15 19l2 2 2-2"/>',
  // Climb and dive: Two thumbs up
  climb: '<circle cx="7" cy="15" r="3.5"/><circle cx="17" cy="15" r="3.5"/><path d="M7 9V4M5 6l2-2 2 2M17 9V4M15 6l2-2 2 2"/>',
  // Stoop: Arrows in
  stoop: '<path d="M3 12h6M15 12h6M6 9l3 3-3 3M18 9l-3 3 3 3"/>',
  // Flare: Arrows out
  flare: '<path d="M9 12H3M15 12h6M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  // Aim: Crosshair
  aim: '<circle cx="12" cy="12" r="4"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  // Prey: Mouse (revised)
  // Eat berries: a sprig of three
  berry: '<path d="M12 3.5c0 2.5-1 4-3 5.5M12 3.5c.5 2.6 2 4.2 4.5 5M12 3.5c2-1 3.8-.8 5 .4-1.2 1-3 1.3-5-.4z"/><circle cx="8" cy="14" r="3.2"/><circle cx="15.5" cy="13.2" r="3.2"/><circle cx="11.8" cy="18.6" r="3"/>',
  prey: '<path d="M5.5 18c-.8-5.2 2.4-9.5 7-9.5 3.2 0 5.6 2 6.8 4.6l2.4 2c.4.4.2 1-.3 1.1L18.5 18zM9.8 9.4a3 3 0 1 1 5.7 1.2M5.5 17.4c-2.4.3-3.8-1-3.5-3.2.2-1.4 1.5-2 2.5-1.2M10 18v1.5M15 18v1.5"/><circle fill="currentColor" stroke="none" cx="17.5" cy="13.3" r="0.95"/>',
  // Rising air: Spiral
  thermal: '<path d="M12 12a1.8 1.8 0 0 1 3.6 0 3.6 3.6 0 0 1-7.2 0 5.4 5.4 0 0 1 10.8 0 7.2 7.2 0 0 1-14.4 0"/>',
  // Ring: Four arcs (revised)
  ring: '<path d="M8.14 5.57A7.5 7.5 0 0 1 15.86 5.57M18.43 8.14A7.5 7.5 0 0 1 18.43 15.86M15.86 18.43A7.5 7.5 0 0 1 8.14 18.43M5.57 15.86A7.5 7.5 0 0 1 5.57 8.14"/>',
  // Twig: Twig
  twig: '<path d="M4 20L20 4M11 13l-4-5M15 9l4.5 1.5"/>',
  // Keepsake: Four-point star
  keepsake: '<path d="M12 3c.8 5 4 8.2 9 9-5 .8-8.2 4-9 9-.8-5-4-8.2-9-9 5-.8 8.2-4 9-9z"/>',
};
// the playable birds as filled silhouettes, for Call (the bird you fly): seen from below in flight,
// the owl perched and facing you
const F = d => `<path fill="currentColor" stroke="none" d="${d}"/>`;
Object.assign(ICONS, {
  // red-tail: broad wings, a short fanned tail
  bird_hawk: F('M12 6.2c.9 0 1.5.7 1.6 1.6l.1 1.3c2.8-.9 5.8-.8 8.3.5-.5.9-1.4 1.5-2.4 1.8l-1.1.8-1.2.2-1 .6-3.7.6.4 1.4c1.5.3 2.5 1.2 2.7 2.6-1.1.7-2.4 1.1-3.7 1.1s-2.6-.4-3.7-1.1c.2-1.4 1.2-2.3 2.7-2.6l.4-1.4-3.7-.6-1-.6-1.2-.2-1.1-.8c-1-.3-1.9-.9-2.4-1.8 2.5-1.3 5.5-1.4 8.3-.5l.1-1.3c.1-.9.7-1.6 1.6-1.6z'),
  // osprey: long wings crooked at the wrist, an M from below
  bird_osprey: F('M12 7c.8 0 1.3.6 1.4 1.4l.1 1.3 3.2-1.9c1.8-1 3.8-1.2 5.8-.5-1.5.5-2.6 1.3-3.4 2.4l-.9 1.3-4.6 1.3-.2 1.4 1.1 3.8-2.5-.9-2.5.9 1.1-3.8-.2-1.4-4.6-1.3-.9-1.3C5.1 9.7 4 8.9 2.5 8.4c2-.7 4-.5 5.8.5l3.2 1.9.1-1.3C10.7 7.6 11.2 7 12 7z'),
  // barn owl: perched, a heart-shaped face, two dark eyes
  bird_owl: F('M12 3.5c3.4 0 5.8 2.3 5.8 5.6v4.6c0 3.9-2.6 6.8-5.8 6.8s-5.8-2.9-5.8-6.8V9.1c0-3.3 2.4-5.6 5.8-5.6z') + '<circle fill="#1d2b36" stroke="none" cx="9.9" cy="9.6" r="1.1"/><circle fill="#1d2b36" stroke="none" cx="14.1" cy="9.6" r="1.1"/><path stroke="#1d2b36" stroke-width="1.1" d="M8 7.4c1.6-.6 2.9-.2 4 1 1.1-1.2 2.4-1.6 4-1M12 11v1.4"/>',
  // raven: fingered wings, a wedge-shaped tail
  bird_albatross: F('M12 8.6c.7 0 1.2.5 1.3 1.2l.1.9 9.1-1c-.3.7-.9 1.1-1.6 1.2l-7.4 1.4-.2 1.1 1.4 2.9-2.7-.8-2.7.8 1.4-2.9-.2-1.1-7.4-1.4c-.7-.1-1.3-.5-1.6-1.2l9.1 1 .1-.9c.1-.7.6-1.2 1.3-1.2z'),
  bird_raven: F('M12 6.5c.8 0 1.3.6 1.4 1.4l.1 1.2c3-.8 6-.5 8.5.9l-1 .4.6.6-1.2.2.3.7-1.6-.1-1.4.6-3.6.4-.3 1.5 2 3.5L12 19l-3.8-1.2 2-3.5-.3-1.5-3.6-.4-1.4-.6-1.6.1.3-.7-1.2-.2.6-.6-1-.4c2.5-1.4 5.5-1.7 8.5-.9l.1-1.2c.1-.8.6-1.4 1.4-1.4z'),
});
export const birdKey = id => ICONS['bird_' + id] ? 'bird_' + id : 'bird_hawk';
export const birdIcon = (id, cls = '') => icon(birdKey(id), cls);
export const icon = (key, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key] || ''}</svg>`;
