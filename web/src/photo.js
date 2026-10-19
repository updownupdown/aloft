// Photo mode: the world holds still, the HUD hides, drag to frame the shot, then save it.
// Every picture also leaves a small copy in the journal's album, with the day and the place.
const ALBUM_MAX = 12;
export function createPhoto({ canvas, G, ui, onEnd, store, caption }) {
  const bar = document.createElement('div');
  bar.className = 'photo-bar hidden';
  bar.innerHTML = '<span>Drag to frame your picture</span><button data-act="snap" class="primary">Take picture</button><button data-act="done">Done</button>';
  document.getElementById('ui').append(bar);
  let drag = null, home = null;
  const down = e => { if (!G.photo) return; drag = { x: e.clientX, y: e.clientY }; };
  const move = e => {
    if (!G.photo || !drag) return;
    const s = G.view.s, dx = (e.clientX - drag.x) / s, dy = (e.clientY - drag.y) / s;
    drag = { x: e.clientX, y: e.clientY };
    G.cam.x = Math.max(home.x - 400, Math.min(home.x + 400, G.cam.x - dx));
    G.cam.y = Math.max(home.y - 300, Math.min(home.y + 200, G.cam.y - dy));
  };
  const up = () => { drag = null; };
  canvas.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);

  function begin() {
    G.photo = true; G.paused = true; home = { ...G.cam };
    ui.hideButton(true); bar.classList.remove('hidden'); bar.parentNode.classList.add('photo');
  }
  function end() {
    G.photo = false; bar.classList.add('hidden'); bar.parentNode.classList.remove('photo'); ui.hideButton(false);
    G.cam.x = home.x; G.cam.y = home.y; onEnd();
  }
  async function snap() {
    bar.classList.add('hidden');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    bar.classList.remove('hidden');
    if (!blob) return;
    keep();
    const name = `aloft-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Aloft' }); return; }
    } catch { /* share cancelled: fall back to saving */ }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    ui.toast('Picture saved.', 2);
  }
  // a thumbnail for the album: a small jpeg, so a dozen fit in local storage
  function keep() {
    if (!store) return;
    try {
      const w = 320, h = Math.round(w * canvas.height / canvas.width), c = document.createElement('canvas');
      c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, 0, 0, w, h);
      const album = store.get('album', []);
      album.push({ src: c.toDataURL('image/jpeg', .6), note: caption?.() || '' });
      while (album.length > ALBUM_MAX) album.shift();
      store.set('album', album);
    } catch { /* storage full or canvas tainted: the picture still saves */ }
  }
  bar.addEventListener('click', e => { const act = e.target.dataset?.act; if (act === 'snap') snap(); if (act === 'done') end(); });
  return { begin, end };
}
