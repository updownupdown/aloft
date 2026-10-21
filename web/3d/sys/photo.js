// Photo mode, postcards and the album. In photo mode the world holds still and the HUD hides;
// drag to swing the camera round the hawk, pinch (or the mouse wheel) to come closer, then take
// the picture: it is shared or saved as a PNG, and a small copy goes in the Journal's album with
// the day and the place. Finding a landmark puts a postcard of that moment in the album too.
import { height, WATER } from '../world.js';
import { afterDraw, project, thumb, glCanvas } from '../shot.js';
import { PIG, facets, hardShadow } from '../facet.js';
import { journal, esc } from '../journal.js';
import { clamp } from '../util.js';
import { inSentence } from './journey.js';
import { hourName } from '../dial.js';
import { SEASON_DAYS } from '../sky.js';
import { icon } from '../icons.js';

const ALBUM_MAX = 16;

export function photoSystem(G) {
  const R = G.R, store = G.store;
  let lastS = null, cam = null, raf = 0;
  const album = () => store.get('album3d', []);
  const keep = item => { try { const a = album(); a.push(item); while (a.length > ALBUM_MAX) a.shift(); store.set('album3d', a); } catch { /* storage full: the picture still saves */ } };

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
    bar.classList.add('hidden');
    afterDraw(async c => {
      // copy the frame now: WebGL clears it once shown
      const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height; copy.getContext('2d').drawImage(c, 0, 0);
      bar.classList.remove('hidden');
      const words = caption();
      keep({ src: thumb(copy), note: words.join(' ') });
      const card = shareCard(copy, words);
      const blob = await new Promise(r => card.toBlob(r, 'image/jpeg', .9));
      if (!blob) return;
      const name = `aloft-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jpg`, file = new File([blob], name, { type: 'image/jpeg' });
      try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Aloft', text: words.join(' ') }); return; } } catch { /* cancelled: save instead */ }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      G.hud.toast('Picture saved, and a copy is in the Journal’s album.', 2.5);
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
    const first = `Over ${place}, a ${sky} ${h === 'midday' ? 'midday' : h}, day ${((G.day - 1) % SEASON_DAYS) + 1} of ${G.season.name}.`;
    return heard?.day === G.day ? [first, heard.text] : [first];
  }
  // the picture to share: the photo in a white border with the caption written under it
  function shareCard(photo, words) {
    const W = Math.min(1600, photo.width), ph = Math.round(photo.height * W / photo.width), pad = Math.round(W * .03), lh = Math.round(W * .026);
    const c = document.createElement('canvas'); c.width = W + pad * 2; c.height = ph + pad * 2 + lh * (words.length + 1.6);
    const x = c.getContext('2d');
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(photo, pad, pad, W, ph);
    x.fillStyle = '#1d2b36'; x.textBaseline = 'alphabetic';
    words.forEach((t, i) => { x.font = `${i ? 500 : 600} ${Math.round(lh * .78)}px Outfit, system-ui, sans-serif`; x.fillStyle = i ? '#43535f' : '#1d2b36'; x.fillText(t, pad, pad + ph + lh * (1.35 + i), i ? W : W * .86); });
    x.font = `600 ${Math.round(lh * .6)}px Outfit, system-ui, sans-serif`; x.fillStyle = '#8a8f8f'; x.textAlign = 'right';
    x.fillText('Aloft', pad + W, pad + ph + lh * 1.35);
    return c;
  }

  // ---- postcards -----------------------------------------------------------------------------
  // the view of the moment a landmark was found, framed with a white border on a card of faceted
  // paper, with a greeting and the date
  function postcard(canvas, name, date, at) {
    const W = 400, H = 250, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    facets(x, 0, 0, W, H, 70, cx => { const t = cx / W; return [PIG.paper[0] - 2 - t * 6, PIG.paper[1] - 4 - t * 9, PIG.paper[2] - 8 - t * 16]; }, { seed: date.length + name.length, relief: .4 });
    const pw = 300, ph = 150, py = 18, cw = canvas.width, ch = canvas.height;
    const sw = Math.min(cw, ch * 2), sh = sw / 2;
    const sx = clamp(at[0] - sw / 2, 0, cw - sw), sy = clamp(at[1] - sh * .6, 0, ch - sh);
    x.save(); x.translate(W / 2, py + ph / 2 + 6); x.rotate(-.025);
    const frame = [[-pw / 2 - 8, -ph / 2 - 8], [pw / 2 + 8, -ph / 2 - 8], [pw / 2 + 8, ph / 2 + 8], [-pw / 2 - 8, ph / 2 + 8]];
    hardShadow(x, frame, 4, 5, .3);
    x.fillStyle = '#fbf8f0'; x.fillRect(-pw / 2 - 8, -ph / 2 - 8, pw + 16, ph + 16);
    x.drawImage(canvas, sx, sy, sw, sh, -pw / 2, -ph / 2, pw, ph);
    x.restore();
    const ty = py + ph + 44;
    x.fillStyle = '#1d2b36'; x.textAlign = 'center';
    x.font = '700 22px Outfit, system-ui, sans-serif'; x.fillText(`Greetings from ${inSentence(name)}`, W / 2, ty, W - 30);
    x.fillStyle = '#43535f'; x.font = '500 13px Outfit, system-ui, sans-serif'; x.fillText(date, W / 2, ty + 22, W - 30);
    return c.toDataURL('image/jpeg', .72);
  }
  let card = null;
  G.on('landmark', l => { card = l; });

  // ---- the album, in the Journal ---------------------------------------------------------------
  const sec = journal(G).section(70, 'Album');
  sec.body.innerHTML = '<div class="album3"></div>';
  const box = sec.body.firstChild;
  box.addEventListener('click', e => e.target.closest('figure')?.classList.toggle('big'));
  G.menu.onOpen(() => {
    const pics = album();
    box.innerHTML = pics.length ? pics.slice().reverse().map(p => `<figure class="${p.card ? 'card' : ''}"><img alt="" src="${p.src}"><figcaption>${esc(p.note)}</figcaption></figure>`).join('')
      : '<p class="none">No pictures yet. Photo mode is in Settings, and finding a landmark sends a postcard.</p>';
  });

  return {
    id: 'photo',
    scene(S) {
      lastS = S;
      if (card) {
        const l = card; card = null;
        afterDraw(c => {
          const at = project(S, [l.x, (l.y ?? height(l.x, l.z)) + 5, l.z], c.width, c.height) || { x: c.width / 2, y: c.height / 2 };
          keep({ src: postcard(c, l.name, `Day ${G.day}, ${G.season.name}`, [at.x, at.y]), note: `Postcard: ${l.name}`, card: true });
        });
      }
    },
  };
}
