// Sleep: perched at night, a Sleep button left of Take off. Sleeping, the eyes close (the screen
// goes almost black), then open on the sky: the view tips up to the stars, the night runs by
// quickly and the stars wheel round the pole star (render.js uStarA) to first light, and the wings
// fill. Waking, the eyes close a moment and the view comes back down. On the ground it is too
// exposed: the button says so instead. A touch or Take off wakes you early.
import { period } from '../sky.js';

const SLEEP = { speed: 60, close: 1.4, ramp: 2.5 };   // how much faster the night runs; seconds eyes closed; seconds to full speed

export function sleepSystem(G) {
  const b = G.b, H = G.hud, ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', `<button class="takeoff3 sleep3 gone" aria-label="Sleep">Sleep</button><div class="night3"></div>
  <style>
    #ui3 .takeoff3.sleep3 { right: calc(84px + 168px + env(safe-area-inset-right)); }
    #ui3:has(.sing3.lefty) .takeoff3.sleep3 { right: auto; left: calc(84px + 168px + env(safe-area-inset-left)); }
    #ui3 .takeoff3.sleep3::before { clip-path: none; border-radius: 50%; background: transparent; box-shadow: inset -4px -2px 0 0 var(--ink); }
    .night3 { position: fixed; inset: 0; background: #070b14; opacity: 0; pointer-events: none; transition: opacity 1.2s; z-index: 1; }
    .night3.on { opacity: .9; }
    .night3.on.sky { opacity: .12; transition: opacity 2.4s; background: radial-gradient(ellipse at 50% 40%, transparent 30%, #070b14 100%); }
  </style>`);
  const btn = ui.querySelector('.sleep3'), veil = ui.querySelector('.night3');
  let sleeping = false, slept = 0, bared = false;
  const wake = msg => {
    if (!sleeping) return;
    sleeping = b.asleep = b.skyView = false; veil.classList.remove('sky');
    if (bared) { H.hide(false); bared = false; }
    setTimeout(() => veil.classList.remove('on'), 700);   // eyes closed a moment, then the world
    if (msg) H.toast(msg, 3);
  };
  const sleep = () => {
    if (b.state === 'ground') { H.toast('Too open to sleep on the ground. Find a branch to roost on.', 3); return; }
    if (b.state !== 'perch') return;
    sleeping = b.asleep = true; slept = 0; veil.classList.add('on'); H.did('sleep'); G.audio.rustle?.(.3);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.audio.unlock?.(); sleep(); });
  // for menu.js's one action button
  (G.actions ||= {}).sleep = { run: sleep, when: () => !sleeping && period(G.tod) === 'night' && b.state === 'perch' && !(b.settle > 0) };   // only where it can roost
  G.on('gesture', () => { if (sleeping && slept > 1) wake(); });
  H.tip('sleep', () => b.state === 'perch' && period(G.tod) === 'night', 'Night has come. Tap Sleep to roost till first light; your wings rest while you sleep.');
  return {
    id: 'sleep',
    // the stars turn once a day about the pole (a little more, as the real sky gains on the sun)
    scene(S) { S.starA = ((G.day || 0) * 1.0027 + G.tod) * Math.PI * 2; if (sleeping && slept > SLEEP.close) S.night = Math.max(S.night || 0, .85 * (S.night > .2 ? 1 : 0)); },
    update(dt) {
      const night = period(G.tod) === 'night';
      btn.classList.toggle('gone', sleeping || !night || b.state !== 'perch' || b.settle > 0 || !!G.menu?.open);
      if (!sleeping) return;
      if (b.state !== 'perch') return wake();
      slept += dt;
      // eyes closed, then open on the stars: the view tips up and the night hurries by
      if (slept > SLEEP.close) {
        veil.classList.add('sky');
        if (!b.skyView) { b.skyView = true; if (!H.hidden) { H.hide(true); bared = true; } }   // camera.js turns the view up to the stars; the HUD steps aside
        const k = Math.min(1, (slept - SLEEP.close) / SLEEP.ramp);
        G.systems.clock.update(dt * (SLEEP.speed - 1) * k * k);
      }
      b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + dt * .5);
      if (!night) wake('You wake at first light.');
    },
  };
}
