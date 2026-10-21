// Ghost flights by link: the last three minutes of flight are kept, and Settings shares them as
// a link (the world's seed and the path, packed small). Opening such a link flies a pale ghost
// hawk along that path, over and over, in the same world, starting just behind it. A visit saves
// nothing, so the visitor's own journey waits as it was.
import { WORLD } from '../noise.js';

const GHOST = { every: .25, keep: 720, pause: 3 };   // seconds between samples, samples kept (3 min), rest between loops

// pack: seed, the start (x, y, z as whole metres), then each step as half-metre moves in bytes
// and the heading as a byte; deflated and written as base64url
async function pack(seed, pts) {
  const n = pts.length, buf = new DataView(new ArrayBuffer(16 + n * 4));
  buf.setUint32(0, seed); buf.setInt32(4, Math.round(pts[0][0])); buf.setInt16(8, Math.round(pts[0][1])); buf.setInt32(10, Math.round(pts[0][2])); buf.setUint16(14, n);
  let p = [Math.round(pts[0][0]), Math.round(pts[0][1]), Math.round(pts[0][2])].map(v => v * 2);
  pts.forEach((q, i) => {
    for (let k = 0; k < 3; k++) { const d = Math.max(-127, Math.min(127, Math.round(q[k] * 2) - p[k])); buf.setInt8(16 + i * 4 + k, d); p[k] += d; }
    buf.setUint8(16 + i * 4 + 3, Math.round(((q[3] % 6.283) + 6.283) % 6.283 / 6.283 * 255));
  });
  let bytes = new Uint8Array(buf.buffer);
  if (window.CompressionStream) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  return (window.CompressionStream ? 'z' : 'r') + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpack(s) {
  let bytes = Uint8Array.from(atob(s.slice(1).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (s[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  const buf = new DataView(bytes.buffer), n = buf.getUint16(14), pts = [];
  const p = [buf.getInt32(4) * 2, buf.getInt16(8) * 2, buf.getInt32(10) * 2];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) p[k] += buf.getInt8(16 + i * 4 + k);
    pts.push([p[0] / 2, p[1] / 2, p[2] / 2, buf.getUint8(16 + i * 4 + 3) / 255 * 6.283]);
  }
  return { seed: buf.getUint32(0), pts };
}

export function ghostSystem(G) {
  const b = G.b, rec = [];
  let recT = 0, ghost = null, t = 0;
  G.ghost = null;   // { x, y, z } while a ghost flies (the compass shows it)

  // share: the path flown lately, as a link
  async function share() {
    const flown = rec.filter(q => q[4]).map(q => q.slice(0, 4));
    if (flown.length < 40) { G.hud.toast('Fly a little first: the link carries your last few minutes in the air.', 4); return; }
    const u = new URL(location.href.split('?')[0]);
    u.searchParams.set('seed', WORLD.seed); u.searchParams.set('ghost', await pack(WORLD.seed, flown));
    try {
      if (navigator.share) { await navigator.share({ title: 'Aloft', text: 'Fly with my ghost in Aloft.', url: u.href }); return; }
    } catch { /* cancelled */ return; }
    try { await navigator.clipboard.writeText(u.href); G.hud.toast('A link to your ghost flight is copied. Send it to a friend.', 4); }
    catch { G.hud.toast('Could not share the link from here.', 3); }
  }
  G.menu.button('play', { label: 'Share a ghost flight', sub: 'your last 3 minutes, as a link', group: 'play', onClick: () => { G.menu.set(false); share(); } });

  // a visit: the ghost's path, and the visitor starts just behind its start, saving nothing
  const qs = new URLSearchParams(location.search);
  if (qs.has('ghost')) unpack(qs.get('ghost')).then(g => {
    if (!g.pts.length) return;
    ghost = g.pts; G.resetting = true;
    const s = ghost[0];
    b.p = [s[0] - Math.sin(s[3]) * 22, s[1] + 3, s[2] + Math.cos(s[3]) * 22]; b.yaw = s[3];   // just behind it, the same way b.state = 'fly'; b.s = 13; b.vy = 0;
    b.perch = b.tree = b.from = null; b.settle = b.hop = 0;
    G.hud.toast('A friend’s ghost flight: the pale hawk flies their path. Your own journey waits, unsaved here.', 7);
  }).catch(() => G.hud.toast('That ghost link could not be read.', 4));

  return {
    id: 'ghost',
    update(dt) {
      if ((recT -= dt) <= 0) {
        recT = GHOST.every;
        rec.push([b.p[0], b.p[1], b.p[2], b.yaw, b.state === 'fly' ? 1 : 0]);
        if (rec.length > GHOST.keep) rec.shift();
      }
      if (!ghost) return;
      t += dt;
      const span = (ghost.length - 1) * GHOST.every, at = t % (span + GHOST.pause);
      if (at > span) { G.ghost = null; return; }
      const f = at / GHOST.every, i = Math.floor(f), k = f - i, a = ghost[i], c = ghost[Math.min(i + 1, ghost.length - 1)];
      const da = Math.atan2(Math.sin(c[3] - a[3]), Math.cos(c[3] - a[3]));
      G.ghost = { x: a[0] + (c[0] - a[0]) * k, y: a[1] + (c[1] - a[1]) * k, z: a[2] + (c[2] - a[2]) * k, yaw: a[3] + da * k };
    },
    scene(S) {
      const g = G.ghost; if (!g) return;
      // the hawk's heading (0 north) to the props' angle from east; a pale trail of points behind
      (S.props.soar ||= []).push(g.x, g.y, g.z, .9, g.yaw - Math.PI / 2, .75, 0, 0);
      let last = [g.x, g.y, g.z];
      for (let i = 1; i < 12; i++) {
        const j = Math.max(0, Math.floor((t % ((ghost.length - 1) * GHOST.every + GHOST.pause)) / GHOST.every) - i), q = ghost[j];
        if (Math.hypot(q[0] - last[0], q[1] - last[1], q[2] - last[2]) < 2) continue;   // only where it has moved
        S.motes.push(q[0], q[1], q[2], .92, .95, 1, .55 - i * .035); last = q;
      }
    },
  };
}
