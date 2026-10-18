// Touch first, mouse and keyboard as fallbacks. Pointer Events give one code path for all.
//  - a short tap (quick, barely moving) is a tap: flap, or act on what was tapped
//  - press and hold, or drag, steers: the hawk points toward the finger
//  - with two fingers you can hold to steer with one and tap to flap with the other
const TAP_MS = 190, TAP_MOVE = 12;

export function createInput(canvas) {
  const I = { pointers: new Map(), taps: [], keys: new Set(), steerPtr: null, flapKey: 0 };
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
    const p = pos(e); I.pointers.set(e.pointerId, { x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), held: false });
    I.onAny?.();
  });
  canvas.addEventListener('pointermove', e => {
    const q = I.pointers.get(e.pointerId); if (!q) return;
    const p = pos(e); q.x = p.x; q.y = p.y;
    if (!q.held && Math.hypot(q.x - q.x0, q.y - q.y0) > TAP_MOVE) { q.held = true; I.steerPtr = e.pointerId; }
  });
  const up = e => {
    const q = I.pointers.get(e.pointerId); if (!q) return;
    I.pointers.delete(e.pointerId);
    if (!q.held && performance.now() - q.t0 < TAP_MS + 120) I.taps.push({ x: q.x0, y: q.y0 });
    if (I.steerPtr === e.pointerId) I.steerPtr = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', e => { I.pointers.delete(e.pointerId); if (I.steerPtr === e.pointerId) I.steerPtr = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.code;
    if (k === 'Space' || k === 'KeyX' || k === 'KeyJ') { I.flapKey++; e.preventDefault(); }
    I.keys.add(k); I.onAny?.(); I.onKey?.(k, e);
  });
  addEventListener('keyup', e => I.keys.delete(e.code));
  addEventListener('blur', () => { I.keys.clear(); I.pointers.clear(); I.steerPtr = null; });
  return I;
}

// promote held pointers to steering, then report the frame's intent in screen space
export function readInput(I) {
  const now = performance.now();
  for (const [id, q] of I.pointers) if (!q.held && now - q.t0 > TAP_MS) { q.held = true; I.steerPtr = id; }
  const q = I.steerPtr !== null ? I.pointers.get(I.steerPtr) : null;
  const k = I.keys;
  const face = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
  const pitch = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
  const taps = I.taps; I.taps = [];
  const flaps = I.flapKey; I.flapKey = 0;
  return { steer: q ? { x: q.x, y: q.y } : null, face, pitch, taps, flaps };
}
