// The Controls lab (controls study, 2026-10-24): ideas for the thumbs on trial behind switches on
// Settings > Controls, each off by default so the game plays as it did. The switches live in
// G.ctl (kept under aloft.ctl3d) and are read where they act: input.js (I.ctl: reach, dead1,
// holdFlap), flight.js (b.ctl: beat, softLand), camera.js (G.ctl.lead) and hud.js (rose, rest).
// Settle each one as James decides: keep it for good (no switch) or take it out.
import { store } from '../util.js';

const DEFAULTS = { reach: .13, dead1: false, holdFlap: false, beat: false, rose: false, rest: 'corner', lead: false, softLand: false };

export function ctlLabSystem(G) {
  const ctl = G.ctl = { ...DEFAULTS, ...store.get('ctl3d', {}) };
  G.input.ctl = ctl; G.b.ctl = ctl;
  const set = (k, v) => { ctl[k] = v; const o = {}; for (const q in ctl) if (ctl[q] !== DEFAULTS[q]) o[q] = ctl[q]; store.set('ctl3d', o); };
  const row = (label, sub, k) => G.menu.toggle('play', { label, sub, group: 'ctllab', get: () => !!ctl[k], set: v => set(k, v) });
  G.menu.choice('play', { label: 'Stick reach', group: 'ctllab', options: [[.1, 'Short'], [.13, 'Normal'], [.17, 'Long']], get: () => ctl.reach, set: v => set('reach', v),
    sub: v => v < .13 ? 'a full move is a short slide of the thumb' : v > .13 ? 'a full move is a long slide: finer control' : 'as it has been' });
  row('Steadier single thumb', 'a small dead zone when one thumb flies alone, so a resting thumb doesn’t drift the heading', 'dead1');
  row('Flap beside a held thumb', 'a tap while the other thumb is held is a full flap, not a weak one-wing beat', 'holdFlap');
  row('Beat to climb', 'thumbs up below glide speed: the hawk beats on its own and keeps climbing, at the wings’ cost', 'beat');
  row('Marks on the pads', 'up, down, in and out marked on each pad in the flight colours', 'rose');
  G.menu.choice('play', { label: 'Resting pads', group: 'ctllab', options: [['corner', 'Corners'], ['last', 'Last touch'], ['none', 'Hidden']], get: () => ctl.rest, set: v => set('rest', v),
    sub: v => v === 'last' ? 'the pads stay where your thumbs last landed' : v === 'none' ? 'no pads until a thumb is down' : 'faint rings in the lower corners' });
  row('Camera leads turns', 'the view looks a little into a bank', 'lead');
  row('Softer landings', 'a plain glide onto the ground lands and runs on instead of bouncing', 'softLand');
  G.dev?.add({ id: 'ctl-lab', area: 'Flight', round: 'Controls study 10-24', title: 'Controls lab: stick reach, a steadier single thumb, a full flap beside a held thumb, beat to climb, pad marks, resting pads, a leading camera, softer landings', how: 'Settings > Controls > Controls lab: switch one on and fly.' });
  return { id: 'ctllab' };
}
