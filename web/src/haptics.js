// Haptics: a tiny buzz per wingbeat, a thump on landing, a pulse on entering rising air, so
// intent is felt in the hand as well as seen. Android Chrome only (navigator.vibrate); on
// everything else these are no-ops. Saved under aloft.haptics.
export function createHaptics(store) {
  const H = { on: store.get('haptics', true) };
  const can = () => H.on && typeof navigator.vibrate === 'function';
  const buzz = p => { if (!can()) return; try { navigator.vibrate(p); } catch { /* not allowed yet */ } };
  H.setOn = on => { H.on = on; store.set('haptics', on); if (!on) try { navigator.vibrate?.(0); } catch { /* ignore */ } };
  H.flap = () => buzz(9);
  H.land = soft => buzz(soft ? 14 : 30);
  H.crash = () => buzz([40, 30, 20]);
  H.lift = () => buzz([10, 50, 10]);          // entering a thermal
  H.ring = () => buzz(12);
  H.catch = () => buzz([25, 40, 25]);
  H.sip = () => buzz(8);
  H.note = () => buzz(6);                     // a note held in tune on the string
  H.call = () => buzz([15, 60, 40]);
  H.jolt = () => buzz(18);                    // a crow's pass
  // a faint rumble while stooping: short pulses while the speed stays high
  let next = 0;
  H.stoop = (k, t) => { if (k <= 0 || t < next) return; next = t + .32 - .12 * k; buzz(Math.round(6 + 8 * k)); };
  return H;
}
