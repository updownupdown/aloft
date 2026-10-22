// Sleep: perched at night, a Sleep button left of Take off. Sleeping, the world fades almost to
// black as the view turns up under the bird to the sky; the stars stay bright and wheel round the
// pole star (render.js uStarA, uStarK) for a moment, by as much as is left of the night; then the
// night is over: the view comes back down and the light returns at first light, the wings full.
// On the ground it is too exposed: the button says so instead. A touch wakes you early.
import { period, DAY } from '../sky.js';

// seconds: fading out and turning up, the stars turning, coming back; how fast they turn for a whole
// night left (radians a second: three quarters of the old 60x night's 45 degrees a second)
const SLEEP = { down: 2, hold: 2, up: 2, spin: .75 * 45 * Math.PI / 180 };
const NIGHT = .4;   // the night's share of the day (period(): before .2 and after .8)

export function sleepSystem(G) {
  const b = G.b, H = G.hud, ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', `<button class="takeoff3 sleep3 gone" aria-label="Sleep">Sleep</button><div class="night3"></div>
  <style>
    #ui3 .takeoff3.sleep3 { right: calc(84px + 168px + env(safe-area-inset-right)); }
    #ui3:has(.sing3.lefty) .takeoff3.sleep3 { right: auto; left: calc(84px + 168px + env(safe-area-inset-left)); }
    #ui3 .takeoff3.sleep3::before { clip-path: none; border-radius: 50%; background: transparent; box-shadow: inset -4px -2px 0 0 var(--ink); }
    .night3 { position: fixed; inset: 0; background: #070b14; opacity: 0; pointer-events: none; transition: opacity 1.2s; z-index: 1; }
    .night3.on { opacity: .92; transition: opacity 2s; background: radial-gradient(ellipse at 50% 35%, #070b14 25%, #000 100%); }
  </style>`);
  const btn = ui.querySelector('.sleep3'), veil = ui.querySelector('.night3');
  let sleeping = false, slept = 0, bared = false, spin = 0, rate = 0, a0 = 0, woke = false;
  const starA = () => ((G.day || 0) * 1.0027 + G.tod) * Math.PI * 2;   // the stars turn once a day (and a little), about the pole
  // the end: the view comes back down and the light returns (early, from a touch: no skip to dawn)
  const wake = early => {
    if (!sleeping || woke) return;
    woke = true; b.skyView = false; veil.classList.remove('on');
    if (!early) {   // the rest of the night passes while the eyes are closed
      const left = G.tod > .8 ? 1.2 - G.tod : .2 - G.tod;
      if (left > 0) G.systems.clock.update((left + .01) * DAY);
      b.stamina = b.maxStamina ?? 1;
    }
    setTimeout(() => {
      sleeping = b.asleep = woke = false; spin = 0;
      if (bared) { H.hide(false); bared = false; }
      if (!early) H.toast('You wake at first light.', 3);
    }, SLEEP.up * 1000);
  };
  const sleep = () => {
    if (b.state === 'ground') { H.toast('Too open to sleep on the ground. Find a branch to roost on.', 3); return; }
    if (b.state !== 'perch') return;
    sleeping = b.asleep = true; slept = 0; spin = 0; a0 = starA();
    // the stars turn by as much as the night has left, never faster than SLEEP.spin
    const left = G.tod > .8 ? 1.2 - G.tod : Math.max(0, .2 - G.tod);
    rate = SLEEP.spin * Math.min(1, left / NIGHT);
    veil.classList.add('on'); b.skyView = true; if (!H.hidden) { H.hide(true); bared = true; }
    H.did('sleep'); G.audio.rustle?.(.3);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.audio.unlock?.(); sleep(); });
  // for menu.js's one action button
  (G.actions ||= {}).sleep = { run: sleep, when: () => !sleeping && period(G.tod) === 'night' && b.state === 'perch' && !(b.settle > 0) };   // only where it can roost
  G.on('gesture', () => { if (sleeping && !woke && slept > 1) wake(true); });
  H.tip('sleep', () => b.state === 'perch' && period(G.tod) === 'night', 'Night has come. Tap Sleep to roost till first light; your wings rest while you sleep.');
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
      btn.classList.toggle('gone', sleeping || !night || b.state !== 'perch' || b.settle > 0 || !!G.menu?.open);
      if (!sleeping) return;
      if (b.state !== 'perch' && !woke) return wake(true);
      slept += dt;
      if (!woke) {
        spin += rate * dt * Math.min(1, slept / SLEEP.down);   // easing in as the view turns up
        b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + dt * .2);
        if (slept > SLEEP.down + SLEEP.hold) wake(false);
      }
    },
  };
}
