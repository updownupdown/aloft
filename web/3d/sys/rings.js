// Rings of mist hang over the land in courses (world.js ringLoop): wreaths of mist, made twice as
// visible on 2026-10-26 (James: they were too hard to see). Each course starts low and climbs; fly through one for a burst of speed
// (RING_BOOST), enough to carry the hawk up to the next, which glows a little brighter. Fly a whole
// course in one go and it says so ('ringLoop'). The courses are laid afresh each day.
// Each course leads somewhere (world.js: its last ring over a landmark or rising air), and the last
// ring lifts you (R2). Each day one course near you is Today's (R4): named on Today, its next ring on
// the compass until it is flown.
import { ringsNear, setRingDay } from '../world.js';
import { DAY } from '../sky.js';
import { mix3 } from '../util.js';
import { journal, esc } from '../journal.js';

const RING_BOOST = 5.2;   // m/s a ring adds
export const COURSE = { lift: 8, liftT: 3, wings: .2, today: 1500 };   // the last ring: m/s up for 3 s, a fifth of the wings back; Today's course within 1.5 km
const way = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((Math.atan2(dx, -dz) / (Math.PI / 4) + 8)) % 8];

export function ringsSystem(G) {
  const b = G.b, got = new Map();   // ring id -> G.clock time collected
  G.rings = 0;
  let run = null;   // the loop being flown: { circuit, n, k, count, t }
  const live = G.ringLive = r => { const t = got.get(r.id); return t === undefined || G.clock - t > DAY; };
  let lift = 0, today = null, todayT = 0;   // the last ring's lift (seconds left); Today's course { circuit, n, level, end, rings, day, done }
  function pickToday() {
    const firsts = ringsNear(b.p[0], b.p[2], COURSE.today).filter(r => r.k === 0 && live(r)).map(r => [r, Math.hypot(r.x - b.p[0], r.z - b.p[2])]).filter(([, d]) => d < COURSE.today).sort((a, c) => a[1] - c[1]);
    if (!firsts.length) return null;
    const r = firsts[0][0];
    return { circuit: r.circuit, n: r.of, level: r.level, end: r.end, day: G.day, done: false };
  }
  // the ring of Today's course to fly next (the first, or the next of a run along it)
  const nextOf = T => ringsNear(b.p[0], b.p[2], 2500).find(r => r.circuit === T.circuit && r.k === (run?.circuit === T.circuit ? run.next : 0));
  (G.marks ||= []).push(() => {
    if (!today || today.done || today.day !== G.day) return [];
    const r = nextOf(today); return r && live(r) ? [['course', r.x, r.z, 'Today’s course']] : [];
  });
  const sec = journal(G).section(8, 'A course of rings');
  G.menu.onOpen(() => {
    const T = today?.day === G.day ? today : null, r = T && nextOf(T);
    sec.el.classList.toggle('hidden', !T);
    if (!T) return;
    const d = r ? Math.hypot(r.x - b.p[0], r.z - b.p[2]) : 0, where = !r ? '' : d < 100 ? 'Its next ring is right here' : `Its ${run?.circuit === T.circuit ? 'next' : 'first'} ring is ${Math.round(d / 50) * 50} m ${way(r.x - b.p[0], r.z - b.p[2])}, on your compass`;
    const to = T.end?.kind === 'place' ? `, ending at ${esc(T.end.name)}` : T.end?.kind === 'air' ? ', ending on rising air' : '';
    sec.body.innerHTML = `<p class="aim3 ${T.done ? 'done' : ''}"><i></i><span>${T.done ? 'Flown: ' : ''}${T.n} rings${T.level === 'hard' ? ', hard' : T.level === 'easy' ? ', easy' : ''}${to}${!T.done && where ? `. ${where}` : ''}.</span></p>`;
  });
  G.hud.tip('ring', () => b.state === 'fly' && ringsNear(b.p[0], b.p[2], 60).some(r => live(r) && Math.hypot(r.x - b.p[0], r.y - b.p[1], r.z - b.p[2]) < 60), 'A faint ring of mist: fly through it for a burst of speed. The next ring of its course glows, a little higher.');
  // each ring of a course plays the next note of a rising phrase in the Valley's key, and the last
  // resolves it with a chord as the lift comes (L1 of the gameplay study); a ring alone, the old chime
  const PHRASE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function tune(n, of) {
    const A = G.audio; if (!A.tone || !A.hz || !of || of < 2) { A.ring?.(); return; }
    if (n < of) { const f = A.hz(PHRASE[Math.min(n - 1, PHRASE.length - 1)] - 12); A.tone({ f, dur: 1.1, vol: .11, type: 'triangle' }); A.tone({ f: f * 2, dur: .5, vol: .03 }); return; }
    const top = PHRASE[Math.min(n - 1, PHRASE.length - 1)] - 12;
    [top - 12, top - 5, top, top + 4].forEach((st, i) => A.tone({ f: A.hz(st), dur: 2.2, vol: .09, delay: i * .06, type: 'triangle' }));
  }
  return {
    id: 'rings',
    live,
    update(dt) {
      setRingDay(G.day || 0);
      if ((!today || today.day !== G.day) && (todayT -= dt) <= 0) { todayT = 30; today = pickToday(); }
      // the last ring's lift: up and away, wings refreshed
      if (lift > 0) { lift -= dt; if (b.state === 'fly') { const k = Math.min(1, lift / COURSE.liftT); b.p[1] += COURSE.lift * k * dt; b.vy = Math.max(b.vy || 0, 0); } }
      if (run && G.clock - run.t > 25) run = null;
      if (b.state !== 'fly' || !b.prev) return;
      for (const r of ringsNear(b.p[0], b.p[2], 30)) {
        if (!live(r)) continue;
        const n = [-Math.sin(r.yaw), 0, Math.cos(r.yaw)];
        const d0 = (b.prev[0] - r.x) * n[0] + (b.prev[2] - r.z) * n[2], d1 = (b.p[0] - r.x) * n[0] + (b.p[2] - r.z) * n[2];
        if (Math.sign(d0) === Math.sign(d1)) continue;
        const rad = Math.hypot(b.p[0] - r.x - n[0] * d1, b.p[1] - r.y, b.p[2] - r.z - n[2] * d1);
        if (rad > r.r) continue;
        b.s = Math.min(46, b.s + RING_BOOST); G.rings++; got.set(r.id, G.clock);
        G.hud.did('ring'); G.emit('ring', r);
        // a loop flown ring after ring, without a long pause between
        if (run && run.circuit === r.circuit && G.clock - run.t < 25) { run.count++; run.t = G.clock; } else run = { circuit: r.circuit, count: 1, t: G.clock };
        run.next = r.k + 1;
        tune(run.count, r.of);
        if (run.count >= r.of) {
          run = null; G.emit('ringLoop', { circuit: r.circuit, n: r.of, level: r.level });
          lift = COURSE.liftT; b.stamina = Math.min(b.maxStamina ?? 1, b.stamina + COURSE.wings);
          if (today?.circuit === r.circuit) today.done = true;
          const to = r.end?.kind === 'place' ? `, to ${r.end.name}` : r.end?.kind === 'air' ? ', onto rising air' : '';
          G.hud.tally(`${today?.circuit === r.circuit ? 'Today’s course' : 'A whole course'}: ${r.of} rings${r.level === 'hard' ? ', hard' : ''}${to}`, 'ring');
        }
        for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; G.part([r.x + Math.cos(a) * r.r * Math.cos(r.yaw), r.y + Math.sin(a) * r.r, r.z + Math.cos(a) * r.r * Math.sin(r.yaw)], [Math.cos(a) * 1.5 * Math.cos(r.yaw), Math.sin(a) * 1.5 + .5, Math.cos(a) * 1.5 * Math.sin(r.yaw)], 1.4, [.97, .97, .95], .3); }
      }
      G.hud.counter = G.rings ? `${G.rings} ring${G.rings > 1 ? 's' : ''}` : '';
    },
    scene(S) {
      // each ring a loose wreath of soft mist puffs (see-through, fading to nothing at the rim),
      // barely paler than the sky behind, with a gap or two so it reads as a wisp, not a hoop
      const R = S.ribbon ||= [], f = [S.look[0] - S.cam[0], S.look[1] - S.cam[1], S.look[2] - S.cam[2]], fl = Math.hypot(...f) || 1;
      const rx = -f[2] / fl, rz = f[0] / fl, rl = Math.hypot(rx, rz) || 1, right = [rx / rl, 0, rz / rl];
      const up = [0, 1, 0];
      { const fx = f[0] / fl, fy = f[1] / fl, fz = f[2] / fl; up[0] = right[1] * fz - right[2] * fy; up[1] = right[2] * fx - right[0] * fz; up[2] = right[0] * fy - right[1] * fx; if (up[1] < 0) { up[0] = -up[0]; up[1] = -up[1]; up[2] = -up[2]; } }
      const SIDES = 7;
      for (const r of ringsNear(S.cam[0], S.cam[2], 360)) {
        if (!live(r)) continue;
        const d = Math.hypot(r.x - S.cam[0], r.y - S.cam[1], r.z - S.cam[2]), near = Math.min(1, 30 / Math.max(d, 1));
        // the way on glows a little: the next ring of the course being flown, else each course's first
        const next = run ? run.circuit === r.circuit && r.k === run.next : r.k === 0;
        // lined up to fly through it (aim.js): mixed toward the aim's ring colour, a little larger
        const aimed = G.aim?.ring?.id === r.id;
        let col = mix3(S.horizon, [1, 1, .98], .5 + near * .2 + (next ? .2 : 0));
        if (aimed) col = mix3(col, G.aim?.ringCol || [1, .84, .4], .4);
        const al = Math.min(.95, 2 * (.34 + near * .14 + (next ? .1 : 0) + (aimed ? .08 : 0))) * Math.min(1, (360 - d) / 60);   // twice as visible (James, 10-26)
        // (a soft volume of mist, clouds.js ringv, denser for the way on)
        if (G.R.cloudStyle !== 'poly') { (S.props.ringv ||= []).push(r.x, r.y, r.z, r.r, r.yaw, Math.min(1, .3 + (next ? .4 : 0) + (aimed ? .3 : 0)), 0, 0); continue; }
        const c = Math.cos(r.yaw), sn = Math.sin(r.yaw), N = 30;
        for (let i = 0; i < N; i++) {
          // gaps where a slow wave along the ring dips, different for each ring
          const g = Math.sin(i / N * 6.283 * 2 + r.id * 1.7) + Math.sin(i / N * 6.283 * 3 + r.id * .9 + G.t * .05) * .6;
          if (g < -.9) continue;
          const a = i / N * 6.283 + G.t * .05, w = Math.sin(i * 2.7 + G.t * .4 + r.id) * .35, rr = r.r * (1 + w * .1);
          const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr, lz = Math.sin(i * 1.3 + G.t * .3) * .4;
          const px = r.x + c * lx - sn * lz, py = r.y + ly, pz = r.z + sn * lx + c * lz;
          const sz = r.r * (.28 + Math.abs(w) * .25) * Math.min(1, (g + 1.1) * 1.4) * (aimed ? 1.12 : 1), pa = al * Math.min(1, (g + 1) * 1.5);
          for (let k = 0; k < SIDES; k++) {
            const a0 = k / SIDES * 6.283, a1 = (k + 1) / SIDES * 6.283;
            const e0 = [Math.cos(a0) * sz, Math.sin(a0) * sz], e1 = [Math.cos(a1) * sz, Math.sin(a1) * sz];
            R.push(px, py, pz, col[0], col[1], col[2], pa);
            for (const e of [e0, e1]) R.push(px + right[0] * e[0] + up[0] * e[1], py + up[1] * e[1], pz + right[2] * e[0] + up[2] * e[1], col[0], col[1], col[2], 0);
          }
        }
      }
    },
    save: () => ({ n: G.rings, got: [...got].slice(-300), today }),
    load(o) { G.rings = o.n || 0; for (const [k, v] of o.got || []) got.set(k, v); today = o.today || null; },
  };
}
