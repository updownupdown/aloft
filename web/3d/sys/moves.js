// Each bird's own move. The osprey dives into water and plunges feet first, reaching fish below
// the surface (fauna.js reads b.plunge), then lifts off heavy and dripping. The barn owl's glide
// is silent, so mice don't hear it coming (food.js reads G.silent). The raven tumbles over when
// you flick a bank twice the same way (birds.js SPIN). The red-tail kites: flared into the wind
// over open ground, it hangs still, watching the grass. The albatross is the master of dynamic
// soaring over the swells (swells.js; species.js scales SWELL for it). Runs after the flight step, before fauna.
import { height, WATER, WIND } from '../world.js';
import { fwd } from '../flight.js';
import { BIRD } from '../hawk.js';
import { SPIN } from '../birds.js';
import { oceanAt } from '../earth.js';

export const MOVES = {
  wetCost: .14, wetTime: 7,                       // osprey: the lift-off out of the water, and how long it drips
  flickGap: .7, tumbleTime: .95,                  // raven: the double flick, and one roll over
  kiteFlare: .45, kiteInto: .75, kiteWind: .12,   // red-tail: how hard to flare, how squarely into the wind, how much wind
  soarLow: 25,                                    // albatross: weaving below this over the sea counts as dynamic soaring
};
const WL = Math.hypot(WIND[0], WIND[2]), WX = WIND[0] / WL, WZ = WIND[2] / WL;
const ease = t => t * t * (3 - 2 * t);

export function movesSystem(G) {
  const b = G.b, H = G.hud;
  const above = () => b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER);
  const once = (flag, text, t = 5) => { if (!G.flags[flag]) { G.flags[flag] = 1; H.toast(text, t); } };

  // ---- osprey: the plunge ------------------------------------------------------------------
  let wet = 0;
  G.on('splash', () => {
    if (BIRD !== 'osprey' || b.state !== 'fly' || (b.tuck < .3 && b.s < 14)) return;
    b.plunge = 2; wet = MOVES.wetTime;   // 2: fauna looks for a fish this frame; 1: next frame, see what came of it
    G.audio.splash(true);
    for (let i = 0; i < 26; i++) G.part([b.p[0], WATER, b.p[2]], [(Math.random() - .5) * 5, 3 + Math.random() * 4, (Math.random() - .5) * 5], 1.1, [.86, .93, .96], .08);
  });
  G.on('takeoff', () => {
    if (BIRD !== 'osprey' || wet <= 0) return;
    // soaked and maybe holding a fish: a heavy, labouring lift-off
    b.vy *= .55; b.s *= .8; b.stamina = Math.max(0, b.stamina - MOVES.wetCost);
    once('wetOff', 'Heavy with water: beat hard to climb away. You shake yourself dry as you go.', 4.5);
  });
  G.on('flap', () => { if (BIRD === 'osprey' && wet > 0 && b.state === 'fly') b.stamina = Math.max(0, b.stamina - .02); });
  H.tip('plunge', () => BIRD === 'osprey' && b.state === 'fly' && height(b.p[0], b.p[2]) < WATER - 1 && above() > 20,
    'Over water: tuck and dive straight in to plunge feet first. You reach fish deep below the surface.');
  function osprey(dt) {
    if (b.plunge === 2) b.plunge = 1;
    else if (b.plunge) {
      b.plunge = 0;
      if (b.state === 'fly') {   // no fish within reach: you come up empty, sitting on the water
        b.state = 'swim'; b.p[1] = WATER + .12; b.s = 0; b.vy = 0; b.settle = .5; G.E.land('water');
        once('plungeMiss', 'Nothing this time. Watch for a fish rising, then plunge right on top of it.', 4);
      } else once('plungeFish', 'A plunge and a fish! Ospreys catch them deeper than any hawk.', 4);
    }
    if (wet > 0) {
      wet -= dt;
      if (b.state === 'fly' && Math.random() < dt * 14 * Math.min(1, wet / 3)) G.part([b.p[0], b.p[1] - .3, b.p[2]], [(Math.random() - .5) * .6, -1, (Math.random() - .5) * .6], .7, [.8, .9, .95], .04);
    }
  }

  // ---- barn owl: the silent glide ------------------------------------------------------------
  H.tip('silent', () => BIRD === 'owl' && G.silent && above() < 14,
    'Gliding, an owl makes no sound: mice below don’t hear you coming. A wingbeat gives you away.');

  // ---- raven: the tumble -----------------------------------------------------------------------
  let flick = 0, flickT = -9, flickArmed = true, tumble = null;
  function raven(dt, c) {
    const r = c.roll || 0;
    if (Math.abs(r) < .3) flickArmed = true;
    if (flickArmed && Math.abs(r) > .75 && b.state === 'fly') {
      flickArmed = false;
      const side = Math.sign(r);
      if (!tumble && side === flick && G.t - flickT < MOVES.flickGap && above() > 6) {
        tumble = { t: 0, side, lift: b.lift > 1 };
        b.vy -= 1.2; G.audio.call?.('raven', false, false, .5);
      }
      flick = side; flickT = G.t;
    }
    if (!tumble) return;
    tumble.t += dt;
    const k = Math.min(1, tumble.t / MOVES.tumbleTime);
    SPIN.a = -tumble.side * Math.PI * 2 * ease(k);
    if (k >= 1 || b.state !== 'fly') {
      SPIN.a = 0;
      if (k >= 1) { G.emit('trick', 'tumble', tumble.lift); once('tumble', 'A tumble! Ravens roll over for the joy of it. Try one in rising air.', 4); }
      tumble = null;
    }
  }

  // ---- red-tail: kiting ------------------------------------------------------------------------
  let kite = 0;
  const into = () => { const f = fwd(b); return -(f[0] * WX + f[2] * WZ) / (Math.hypot(f[0], f[2]) || 1); };
  H.tip('kite', () => BIRD === 'hawk' && b.state === 'fly' && into() > MOVES.kiteInto && above() > 6 && above() < 60 && b.s < 15 && (G.windK ?? .3) > MOVES.kiteWind,
    'You face into the wind. Slide your thumbs apart to flare and kite: hang still over the field and watch for mice.');
  function hawk(dt) {
    const h = above();
    const want = b.state === 'fly' && b.flare > MOVES.kiteFlare && into() > MOVES.kiteInto && h > 5 && h < 70 && b.s < 16
      && (G.windK ?? .3) > MOVES.kiteWind && height(b.p[0], b.p[2]) > WATER && !b.inThermal;
    kite += ((want ? 1 : 0) - kite) * Math.min(1, dt * 2.5);
    if (kite < .02 || b.state !== 'fly' || !b.prev) return;
    // the wind holds you up: undo most of this frame's drift and sink, and keep you just off the stall
    const p = b.p, q = b.prev, w = Math.min(1, G.windK ?? .3) * .6 + .4;
    p[0] = q[0] + (p[0] - q[0]) * (1 - .92 * kite * w); p[2] = q[2] + (p[2] - q[2]) * (1 - .92 * kite * w);
    if (p[1] < q[1]) p[1] = q[1] + (p[1] - q[1]) * (1 - kite * w);
    p[1] += Math.sin(G.t * 2.3) * .04 * kite;
    b.vy *= 1 - kite * .5; b.s += (7 - b.s) * Math.min(1, dt * 2) * kite; b.gamma *= 1 - kite * .5;
    if (kite > .8) once('kite', 'Kiting: hanging still on the wind. When a mouse moves below, tuck and drop on it.', 5);
  }

  // ---- albatross: the ocean wanderer ----------------------------------------------------------
  // dynamic soaring itself is swells.js, for every bird; the albatross gets far more from it
  // (species.js scales SWELL). Here: how far it has flown over the sea, and how long it has
  // weaved low over the swells, for its life goal
  let soarT = 0, seaM = 0, seaCheck = 0, atSea = false;
  function albatross(dt) {
    if ((seaCheck -= dt) <= 0) { seaCheck = .5; atSea = !!oceanAt(b.p[0], b.p[2]); }
    if (b.state !== 'fly' || !atSea) return;
    seaM += b.s * dt;
    if (seaM > 1000) { seaM -= 1000; G.emit('seaKm'); }
    if (above() < MOVES.soarLow && Math.abs(b.roll) > .3 && b.flapL > 2) {
      soarT += dt;
      if (soarT > 30) { soarT -= 30; G.emit('dynSoar'); }
    }
  }

  return {
    id: 'moves',
    update(dt, c) {
      G.silent = BIRD === 'owl' && b.state === 'fly' && b.flapL > 1.2;
      if (BIRD === 'osprey' || b.plunge) osprey(dt);
      else wet = 0;
      if (BIRD === 'raven' || tumble) raven(dt, c);
      if (BIRD === 'hawk') hawk(dt); else kite = 0;
      if (BIRD === 'albatross') albatross(dt);
      G.kiting = kite > .5;
    },
  };
}
