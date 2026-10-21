// Sleep: perched at night, a Sleep button left of Take off. Sleeping, the screen dims and the night
// runs by quickly to first light, and the wings fill. On the ground it is too exposed: the button
// says so instead. A touch or Take off wakes you early.
import { period } from '../sky.js';

const SLEEP = { speed: 60 };   // how many times faster the night runs while you sleep

export function sleepSystem(G) {
  const b = G.b, H = G.hud, ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', `<button class="takeoff3 sleep3 gone" aria-label="Sleep">Sleep</button><div class="night3"></div>
  <style>
    #ui3 .takeoff3.sleep3 { right: calc(84px + 168px + env(safe-area-inset-right)); }
    #ui3:has(.sing3.lefty) .takeoff3.sleep3 { right: auto; left: calc(84px + 168px + env(safe-area-inset-left)); }
    #ui3 .takeoff3.sleep3::before { clip-path: none; border-radius: 50%; background: transparent; box-shadow: inset -4px -2px 0 0 var(--ink); }
    .night3 { position: fixed; inset: 0; background: #070b14; opacity: 0; pointer-events: none; transition: opacity 1.2s; z-index: 1; }
    .night3.on { opacity: .62; }
  </style>`);
  const btn = ui.querySelector('.sleep3'), veil = ui.querySelector('.night3');
  let sleeping = false, slept = 0;
  const wake = msg => {
    if (!sleeping) return;
    sleeping = b.asleep = false; veil.classList.remove('on');
    if (msg) H.toast(msg, 3);
  };
  const sleep = () => {
    if (b.state === 'ground') { H.toast('Too open to sleep on the ground. Find a branch to roost on.', 3); return; }
    if (b.state !== 'perch') return;
    sleeping = b.asleep = true; slept = 0; veil.classList.add('on'); H.did('sleep');
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.audio.unlock?.(); sleep(); });
  // for menu.js's one action button
  (G.actions ||= {}).sleep = { run: sleep, when: () => !sleeping && period(G.tod) === 'night' && (b.state === 'perch' || b.state === 'ground') && !(b.settle > 0) };
  G.on('gesture', () => { if (sleeping && slept > 1) wake(); });
  H.tip('sleep', () => b.state === 'perch' && period(G.tod) === 'night', 'Night has come. Tap Sleep to roost till first light; your wings rest while you sleep.');
  return {
    id: 'sleep',
    update(dt) {
      const night = period(G.tod) === 'night';
      btn.classList.toggle('gone', sleeping || !night || (b.state !== 'perch' && b.state !== 'ground') || b.settle > 0 || !!G.menu?.open);
      if (!sleeping) return;
      if (b.state !== 'perch') return wake();
      slept += dt;
      G.systems.clock.update(dt * (SLEEP.speed - 1));   // the night hurries by
      b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + dt * .5);
      if (!night) wake('You wake at first light.');
    },
  };
}
