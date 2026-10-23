// Photo mode. The world holds still and the HUD hides; drag to swing the camera round the hawk,
// pinch (or the mouse wheel) to come closer, then take the picture: it is shared or saved to the
// device, framed with a line about the day and the place. Nothing is kept in the game (James,
// 2026-10-23: no album, no postcards).
import { height, WATER } from '../world.js';
import { afterDraw, glCanvas } from '../shot.js';
import { clamp } from '../util.js';
import { inSentence } from './journey.js';
import { hourName } from '../dial.js';
import { icon } from '../icons.js';

export function photoSystem(G) {
  const R = G.R;
  let lastS = null, cam = null, raf = 0;
  try { localStorage.removeItem('aloft.album3d'); } catch { /* the old album's pictures: let them go */ }

  // ---- photo mode --------------------------------------------------------------------------
  const ui = document.getElementById('ui3');
  ui.insertAdjacentHTML('beforeend', `<div class="shoot3 hidden"></div>
    <div class="photo3 hidden"><span>Drag to frame, pinch to come closer</span><button data-p="snap" class="main3">${icon('snap')}Take picture</button><button data-p="done">${icon('done')}Done</button></div>`);
  const pad = ui.querySelector('.shoot3'), bar = ui.querySelector('.photo3');
  const pointers = new Map();
  let pinch = 0;
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); });
  pad.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p || !cam) return;
    if (pointers.size === 1) { cam.yaw -= (e.clientX - p[0]) * .008; cam.pitch = clamp(cam.pitch + (e.clientY - p[1]) * .006, -.25, 1.35); }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, c] = [...pointers.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
      if (pinch) cam.dist = clamp(cam.dist * pinch / d, 1.4, 30);
      pinch = d;
    }
  });
  const up = e => { pointers.delete(e.pointerId); pinch = 0; };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  pad.addEventListener('wheel', e => { if (cam) cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * .1), 1.4, 30); }, { passive: true });

  function begin() {
    if (!lastS) return;
    G.menu.set(false); G.paused = true; G.photo = true;
    const f = lastS.focus, d = [lastS.cam[0] - f[0], lastS.cam[1] - f[1], lastS.cam[2] - f[2]], dist = Math.hypot(...d);
    cam = { f, yaw: Math.atan2(d[0], d[2]), pitch: Math.asin(clamp(d[1] / dist, -1, 1)), dist };
    G.hud.hide(true); G.menu.hideButton(true);
    pad.classList.remove('hidden'); bar.classList.remove('hidden');
    raf = requestAnimationFrame(draw);
  }
  function end() {
    G.photo = false; cam = null; cancelAnimationFrame(raf);
    pad.classList.add('hidden'); bar.classList.add('hidden');
    G.hud.hide(false); G.menu.hideButton(false); G.paused = false;
  }
  function view() {
    const f = cam.f, c = Math.cos(cam.pitch);
    const p = [f[0] + Math.sin(cam.yaw) * c * cam.dist, f[1] + Math.sin(cam.pitch) * cam.dist, f[2] + Math.cos(cam.yaw) * c * cam.dist];
    p[1] = Math.max(p[1], height(p[0], p[2]) + .6, WATER + .4);
    return { ...lastS, cam: p, look: [f[0], f[1] + .1, f[2]], camUp: [0, 1, 0], camHigh: p[1] - height(p[0], p[2]) };
  }
  function draw() {
    if (!G.photo) return;
    raf = requestAnimationFrame(draw);
    const S = view(), c = glCanvas();
    R.updateChunks(S.cam, 3);
    R.draw(S, null, c.width, c.height);
  }
  function snap() {
    G.emit('photo');
    bar.classList.add('hidden');
    afterDraw(async c => {
      // copy the frame now: WebGL clears it once shown
      const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height; copy.getContext('2d').drawImage(c, 0, 0);
      bar.classList.remove('hidden');
      const words = caption();
      const card = shareCard(copy, words);
      const blob = await new Promise(r => card.toBlob(r, 'image/jpeg', .9));
      if (!blob) return;
      const name = `aloft-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jpg`, file = new File([blob], name, { type: 'image/jpeg' });
      try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Aloft', text: words.join(' ') }); return; } } catch { /* cancelled: save instead */ }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      G.hud.reply('Picture saved.', 2.5);
    });
    // a fresh frame to cut it from
    const S = view(), c = glCanvas(); R.draw(S, null, c.width, c.height);
  }
  bar.addEventListener('click', e => { const p = e.target.closest('[data-p]')?.dataset.p; if (p === 'snap') snap(); if (p === 'done') end(); });
  addEventListener('keydown', e => { if (G.photo && e.code === 'Escape') end(); });
  G.menu.button('play', { label: 'Photo mode', sub: 'hold the world still and take a picture', group: 'play', main: true, onClick: begin });

  // ---- the caption: a line from the day -----------------------------------------------------
  // where, and what the sky is doing at what hour; then the last song heard or sky seen today
  let heard = null;
  G.on('song', sp => { heard = { day: G.day, text: `A ${sp.name} sang back.` }; });
  G.on('skyNote', t => { heard = { day: G.day, text: t }; });
  G.on('catch', e => { if (!heard || heard.day !== G.day) heard = { day: G.day, text: e.kind === 'fish' ? 'A fish from the water.' : e.kind === 'worm' ? 'A worm after the rain.' : 'A mouse in the grass.' }; });
  function caption() {
    const sky = G.storm > .5 ? 'stormy' : G.snowing > .3 ? 'snowy' : G.rain > .3 ? 'rainy' : G.fog > .4 ? 'misty' : G.overcast > .5 ? 'grey' : 'clear';
    const h = hourName(G.tod), place = G.placeName ? inSentence(G.placeName(G.b.p[0], G.b.p[2])) : 'the hills';
    const first = `Over ${place}, a ${sky} ${h === 'midday' ? 'midday' : h}, ${G.date?.text || `day ${G.season.d + 1} of ${G.season.name}`}, ${G.season.name}.`;
    return heard?.day === G.day ? [first, heard.text] : [first];
  }
  // the picture to share: the photo in a white border with the caption written under it
  function shareCard(photo, words) {
    const W = Math.min(1600, photo.width), ph = Math.round(photo.height * W / photo.width), pad = Math.round(W * .03), lh = Math.round(W * .026);
    const c = document.createElement('canvas'); c.width = W + pad * 2; c.height = ph + pad * 2 + lh * (words.length + 1.6);
    const x = c.getContext('2d');
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(photo, pad, pad, W, ph);
    x.fillStyle = '#2a2420'; x.textBaseline = 'alphabetic';
    words.forEach((t, i) => { x.font = `${i ? 500 : 600} ${Math.round(lh * .78)}px Figtree, system-ui, sans-serif`; x.fillStyle = i ? '#5c5248' : '#2a2420'; x.fillText(t, pad, pad + ph + lh * (1.35 + i), i ? W : W * .86); });
    x.font = `600 ${Math.round(lh * .6)}px Figtree, system-ui, sans-serif`; x.fillStyle = '#8a8f8f'; x.textAlign = 'right';
    x.fillText('Aloft', pad + W, pad + ph + lh * 1.35);
    return c;
  }

  return {
    id: 'photo',
    scene(S) { lastS = S; },
  };
}
