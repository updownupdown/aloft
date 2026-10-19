// Two-thumb controls: a faint strip down each side of the screen, one for each thumb.
//  - tap both strips together to flap; the closer together the taps, the cleaner the beat
//  - a tap on one strip alone is a weak half-beat that tires the wings more
//  - swipe sideways on one strip to turn that way
//  - hold both thumbs: one up and one down tilts the nose (hard over at speed: a loop),
//    both low settles the hawk down to land, both high trims it for a long glide or rides a thermal
//  - slide both thumbs inward to focus on something ahead (a mouse, a fish, a branch)
// The strips stand in from the screen edges so thumbs stay clear of the phone's own gestures.
const PAIR = .2, TAP = .26, SWIPE = 34, FOCUS_IN = 22;

export function createStrips() {
  const root = document.getElementById('ui');
  const mk = side => {
    const el = document.createElement('div'); el.className = `strip strip-${side}`;
    el.innerHTML = '<b></b><i></i>'; root.append(el);
    return el;
  };
  const els = { L: mk('l'), R: mk('r') };
  const S = { L: null, R: null, pend: null, events: [], focus: false, off: { L: false, R: false } };
  const now = () => performance.now() / 1000;
  const rectOf = side => els[side].getBoundingClientRect();
  const upAt = (side, y) => { const r = rectOf(side); return Math.max(-1, Math.min(1, 1 - 2 * (y - r.top) / r.height)); };

  // which strip (if any) a touch at screen point x, y lands on
  function zoneAt(x, y) {
    for (const side of ['L', 'R']) {
      if (S.off[side]) continue;
      const r = rectOf(side);
      if (r.width && y >= r.top && y <= r.bottom && x >= r.left - 6 && x <= r.right + 6) return side;
    }
    return null;
  }
  function down(id, x, y) {
    const side = zoneAt(x, y);
    if (!side || S[side]) return null;
    S[side] = { id, x0: x, y0: y, x, y, t0: now(), moved: false, swiped: false };
    return side;
  }
  function move(id, x, y) {
    const side = S.L?.id === id ? 'L' : S.R?.id === id ? 'R' : null; if (!side) return;
    const f = S[side]; f.x = x; f.y = y;
    const dx = x - f.x0;
    if (Math.hypot(dx, y - f.y0) > 12) f.moved = true;
    const other = S[side === 'L' ? 'R' : 'L'];
    // both thumbs sliding toward the middle is focus; one thumb flicked sideways is a turn
    if (S.L && S.R) {
      const inL = S.L.x - S.L.x0, inR = S.R.x0 - S.R.x;
      if (!S.focus && inL > FOCUS_IN && inR > FOCUS_IN) { S.focus = true; S.events.push({ type: 'focus', on: true }); }
      else if (S.focus && (inL < 8 || inR < 8)) { S.focus = false; S.events.push({ type: 'focus', on: false }); }
    } else if (!f.swiped && !other && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(y - f.y0) && now() - f.t0 < .4) {
      f.swiped = true; S.events.push({ type: 'swipe', side, dir: Math.sign(dx) });
    }
  }
  function up(id) {
    const side = S.L?.id === id ? 'L' : S.R?.id === id ? 'R' : null; if (!side) return;
    const f = S[side]; S[side] = null;
    if (S.focus) { S.focus = false; S.events.push({ type: 'focus', on: false }); }
    if (!f.moved && !f.swiped && now() - f.t0 < TAP) tap(side, f.t0, upAt(side, f.y0));
  }
  // a tap waits a moment for its partner on the other strip; pressed close together they are one beat
  function tap(side, t, u) {
    const p = S.pend;
    if (p && p.side !== side && Math.abs(t - p.t) < PAIR) {
      const gap = Math.abs(t - p.t);
      S.pend = null;
      S.events.push({ type: 'flap', sync: 1 - Math.max(0, Math.min(1, (gap - .05) / (PAIR - .05))), gap, first: t < p.t ? side : p.side, up: (u + p.up) / 2 });
      flash(gap < .06 ? 'sync' : 'ragged');
      return;
    }
    if (p) S.events.push({ type: 'tap', side: p.side, up: p.up });
    S.pend = { side, t, up: u };
  }
  function flash(kind) {
    for (const s of ['L', 'R']) { const e = els[s]; e.classList.remove('sync', 'ragged'); void e.offsetWidth; e.classList.add(kind); }
  }

  // per frame: the events since last time, and where any held thumbs are
  function frame() {
    const t = now(), p = S.pend;
    if (p) {
      const o = S[p.side === 'L' ? 'R' : 'L'];
      const partnerComing = o && !o.moved && Math.abs(o.t0 - p.t) < PAIR && t - o.t0 < TAP;
      if (t - p.t > PAIR && !partnerComing) { S.events.push({ type: 'tap', side: p.side, up: p.up }); S.pend = null; }
    }
    const held = {};
    for (const side of ['L', 'R']) {
      const f = S[side], el = els[side].lastChild;
      // a thumb counts as held once it has stayed down a moment (a tap never steers)
      held[side] = f && (t - f.t0 > .16 || f.moved) && !f.swiped ? upAt(side, f.y) : null;
      if (f) { const r = rectOf(side); el.style.transform = `translate(${f.x - r.left}px, ${f.y - r.top}px)`; }
      els[side].classList.toggle('touch', !!f);
    }
    const ev = S.events; S.events = [];
    return { held, events: ev, focus: S.focus };
  }
  // a strip can be given over to something else (the singing string covers the right one)
  function disable(side, off) {
    S.off[side] = off; els[side].classList.toggle('hidden', off);
    if (off && S[side]) S[side] = null;
  }
  function show(on) { for (const s of ['L', 'R']) els[s].classList.toggle('faded', !on); }
  return { zoneAt, down, move, up, frame, disable, show, owns: id => S.L?.id === id || S.R?.id === id };
}
