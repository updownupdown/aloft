// Flight tuning values. Mutable so the hidden tuning page can change them live; the
// page saves overrides to localStorage and they are applied at start.
export const DEFAULTS = {
  gravity: 140,      // world units / s^2
  dragA: 1.55,       // parasitic drag (x 1e-3), grows with speed^2
  dragB: 49,         // induced drag (x 1e3), grows as speed drops
  relax: -0.17,      // path angle the hawk settles into hands-off
  stall: 38,         // speed below which the nose drops
  flap: 18,          // speed added per flap
  kick: 28,          // upward kick per flap
  stamina: 0.12,     // stamina spent per flap (of 1)
  regen: 0.2,        // stamina regained per second while gliding
  thermal: 48,       // peak thermal climb, units / s
  ridge: 2.6,        // ridge lift per unit of wind
  flare: 0.9,        // extra braking when nose-high
};
export const RANGES = {
  gravity: [60, 260], dragA: [0.5, 4], dragB: [10, 120], relax: [-0.5, 0.1], stall: [20, 60], flap: [5, 40], kick: [0, 60],
  stamina: [0, 0.4], regen: [0.02, 1], thermal: [0, 100], ridge: [0, 3], flare: [0, 3],
};
export const TUNE = { ...DEFAULTS };
export function applyTune(o) { for (const k in DEFAULTS) if (typeof o?.[k] === 'number') TUNE[k] = o[k]; }
