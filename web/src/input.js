// Touch first, mouse and keyboard as fallbacks. Pointer Events give one code path for all:
// every touch on the game is a gesture (gestures.js reads taps, strokes and holds); the
// keyboard keeps arrows or WASD to turn and pitch, and Space (or X, J) to flap.
export function createInput(canvas, gestures) {
  const I = { keys: new Set(), flapKey: 0, gestures };
  canvas.addEventListener('pointerdown', () => I.onAny?.());
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  gestures.attach();

  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.code;
    if (k === 'Space' || k === 'KeyX' || k === 'KeyJ') { I.flapKey++; e.preventDefault(); }
    I.keys.add(k); I.onAny?.(); I.onKey?.(k, e);
  });
  addEventListener('keyup', e => I.keys.delete(e.code));
  addEventListener('blur', () => I.keys.clear());
  return I;
}

// the frame's intent: keys held, flaps pressed, and the gestures since last frame
export function readInput(I) {
  const k = I.keys;
  const face = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
  const pitch = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
  const flaps = I.flapKey; I.flapKey = 0;
  return { steer: null, face, pitch, flaps, gestures: I.gestures.frame() };
}
