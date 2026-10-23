// Sleep: perched at night, a Sleep button left of Take off. Sleeping, the world fades almost to
// black as the view turns up under the bird to the sky; the stars stay bright and wheel round the
// pole star (render.js uStarA, uStarK) for a moment, by as much as is left of the night; then the
// night is over: the view comes back down while the clock runs on fast through first light, so the
// day comes up as it would (only quicker), the wings full.
// Only a roost: a perch at least ROOST m above the ground or water, never a bush (the ground, a bush
// or a low rock is too exposed; there the Sleep button doesn't show). A touch hurries the waking (the night still passes).
import { period, light, DAY } from '../sky.js';
import { height, WATER, bushesNear } from '../world.js';

const ROOST = 2.5;   // metres above the ground or water a perch must be to sleep on

// seconds: fading out and turning up, the stars turning, coming back; how fast they turn for a whole
// night left (radians a second: three eighths of the old 60x night's 45 degrees a second)
const SLEEP = { down: 4, hold: 2, up: 4, spin: .375 * 45 * Math.PI / 180 };
const NIGHT = .4;   // the night's share of the day (period(): before .2 and after .8)
// the clock runs on under the veil until just before the sky starts to pale (the sun at elDark), then
// on through first light to the sun at elWake as you come back (by the sun here, so a far-north
// winter dawn comes late); if the sun stays down it falls back to the hours (dark, wake)
const DAWN = { elDark: -.2, elWake: .1, dark: .18, wake: .26 };

export function sleepSystem(G) {
  const b = G.b, H = G.hud, ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', `<button class="takeoff3 sleep3 gone" aria-label="Sleep">Sleep</button><div class="night3"></div>
  <style>
    #ui3 .takeoff3.sleep3 { right: calc(84px + 168px + env(safe-area-inset-right)); }
    #ui3:has(.sing3.lefty) .takeoff3.sleep3 { right: auto; left: calc(84px + 168px + env(safe-area-inset-left)); }
    #ui3 .takeoff3.sleep3::before { clip-path: none; border-radius: 50%; background: transparent; box-shadow: inset -4px -2px 0 0 var(--ink); }
    .night3 { position: fixed; inset: 0; background: #070b14; opacity: 0; pointer-events: none; transition: opacity 4s; z-index: 1; }
    .night3.on { opacity: .92; transition: opacity 4s; background: radial-gradient(ellipse at 50% 35%, #070b14 25%, #000 100%); }
  </style>`);
  const btn = ui.querySelector('.sleep3'), veil = ui.querySelector('.night3');
  let sleeping = false, slept = 0, bared = false, spin = 0, rate = 0, a0 = 0, woke = false, early = false, upT = 0, from = 0, span = 0, tDark = DAWN.dark, tWake = DAWN.wake;
  const ahead = to => (to - G.tod + 1) % 1;   // how far the clock has to run on to reach `to` (always forward, across midnight)
  const starA = () => ((G.yearFrac || 0) - 79 / 365 + G.tod - .5) * Math.PI * 2;   // the sky's local sidereal angle: once a day and a little, about the pole (stars.js)
  // the end: the view comes back down and the light returns (early: knocked off the perch, no skip to dawn)
  const wake = e => {
    if (!sleeping || woke) return;
    if (!e) { const left = ahead(tDark); if (left > 0 && left < .7) G.systems.clock.update(left * DAY); }   // what is left of the dark passes at once, still under the veil
    woke = true; early = e; upT = 0; from = G.tod; span = e || ahead(tWake) > .5 ? 0 : ahead(tWake); b.skyView = false; veil.classList.remove('on');
    if (!early) b.stamina = b.maxStamina ?? 1;
  };
  const up = () => { sleeping = b.asleep = woke = false; spin = 0; if (bared) { H.hide(false); bared = false; } };
  // a perch safe to sleep on: high enough, and not on top of a bush
  const roost = () => b.state === 'perch' && b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER) >= ROOST
    && !bushesNear(b.p[0], b.p[2], 4).some(o => Math.hypot(o.x - b.p[0], o.z - b.p[2]) < o.s * o.w * .45 + .3 && b.p[1] < o.y + o.s + 1);
  const sleep = () => {
    if (b.state === 'ground') { H.say('Too open to sleep on the ground. Find a branch to roost on.', { kind: 'warn', secs: 3, icon: 'sleep' }); return; }
    if (!roost()) { if (b.state === 'perch') H.say('Too low and open to sleep here. Find a branch to roost on.', { kind: 'warn', secs: 3, icon: 'sleep' }); return; }
    sleeping = b.asleep = true; slept = 0; spin = 0; a0 = starA();
    // the stars turn by as much as the night has left, never faster than SLEEP.spin
    const left = G.tod > .8 ? 1.2 - G.tod : Math.max(0, .2 - G.tod);
    rate = SLEEP.spin * Math.min(1, left / NIGHT);
    // when the sky will pale and when the sun will be up, here
    tDark = DAWN.dark; tWake = DAWN.wake; let dark = null;
    for (let d = .005; d < .7; d += .005) {
      const t = (G.tod + d) % 1, el = light(t, G.season.lat, G.yearFrac).el;
      if (dark === null && el > DAWN.elDark) dark = (t - .005 + 1) % 1;
      if (el > DAWN.elWake) { if (dark !== null) { tDark = dark; tWake = t; } break; }
    }
    veil.classList.add('on'); b.skyView = true; if (!H.hidden) { H.hide(true); bared = true; }
    H.did('sleep'); G.audio.rustle?.(.3);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.audio.unlock?.(); sleep(); });
  // for menu.js's one action button
  (G.actions ||= {}).sleep = { run: sleep, when: () => !sleeping && period(G.tod) === 'night' && !(b.settle > 0) && roost() };   // only where it can roost
  G.on('gesture', () => { if (sleeping && !woke && slept > 1) wake(false); });   // a touch hurries the morning; the night still passes
  H.tip('sleep', () => b.state === 'perch' && period(G.tod) === 'night' && roost(), 'Night has come. Tap Sleep to roost till first light; your wings rest while you sleep.');
  return {
    id: 'sleep',
    scene(S) {
      if (!sleeping) { S.starA = starA(); return; }
      S.starA = a0 + spin;   // held where they were, turned by the sleep's spin, until you are up
      const k = woke ? 0 : Math.min(1, slept / SLEEP.down);
      S.starK = 1 + 3 * k;   // bright through the dark
      if (!woke) S.night = Math.max(S.night || 0, .9 * k);
    },
    update(dt) {
      const night = period(G.tod) === 'night';
      btn.classList.toggle('gone', sleeping || !night || b.settle > 0 || !!G.menu?.open || !roost());
      if (!sleeping) return;
      if (b.state !== 'perch' && !woke) return wake(true);
      slept += dt;
      if (!woke) {
        spin += rate * dt * Math.min(1, slept / SLEEP.down);   // easing in as the view turns up
        b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + dt * .2);
        // the night passes under the veil: the clock runs on toward the last of the dark
        const left = ahead(tDark), t = SLEEP.down + SLEEP.hold - slept;
        if (left > 0 && left < .7) G.systems.clock.update(Math.min(left, left * dt / Math.max(dt, t)) * DAY);
        if (slept > SLEEP.down + SLEEP.hold) wake(false);
      } else {
        // coming back: on through first light, easing out as the light comes up (in game time)
        upT = Math.min(1, upT + dt / SLEEP.up);
        const done = (G.tod - from + 1) % 1, step = span * (1 - (1 - upT) ** 2) - done;
        if (step > 0) G.systems.clock.update(step * DAY);
        if (upT >= 1) up();
      }
    },
  };
}
