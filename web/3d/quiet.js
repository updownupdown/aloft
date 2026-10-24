// The quiet levels of the message line (James's pick A with C from the quiet messages study,
// 2026-10-23, https://claude.ai/artifact/XnzHqYQUUyYKVsAeNnDZdX). hud.js keeps the loud level, the
// message line itself, for what must be said now; this file holds the rest:
// - a name: a place or a moment, thin white words and an icon under the compass, no box; two close
//   together share it
// - a glint: something new to learn, an icon beside the compass that waits to be tapped; tap it
//   and a glass card says it all. Stacked: the newest shows, with three dots when more wait
// - a count: a count or a confirmation, small words and an icon in the same place as a name
//   (under it when both show), gone in two seconds
import { icon } from './icons.js';

export const QUIET = {
  nameSecs: 3.6,     // a name shows this long
  glints: 3,         // glints waiting at once; a fourth sends the oldest off
  glintDim: 60,      // a glint dims after this long unread
  glintBreathe: 6,   // and breathes this long when it comes
  tallySecs: 2.2,
};

// a glint's title from its text when none is given: the first clause, if short
export const titleOf = text => {
  const m = String(text).match(/^[^.!:?;,]{2,34}(?=[.!:?;,])/);
  return m ? m[0].replace(/^(A|An|The) /, '').replace(/^./, c => c.toUpperCase()) : String(text).split(' ').slice(0, 4).join(' ') + '…';
};

export function createQuiet(G, ui, H) {
  ui.insertAdjacentHTML('beforeend', `<p class="name3" aria-live="polite"><span class="ic3"></span><span class="nt3"></span></p>
    <div class="glints3"><span class="glmore3" aria-hidden="true"><i></i><i></i><i></i></span></div><p class="qcount3"><span class="ic3"></span><span class="tx3"></span></p>
    <div class="glintcard3 hidden" role="dialog" aria-label="Something new"><h4><span class="ic3"></span><b></b></h4><p></p>
      <div><button class="main3" data-t="ok">Got it</button></div></div>`);
  const q = s => ui.querySelector(s);
  const nameEl = q('.name3'), nameT0 = q('.name3 .nt3'), nameIc = q('.name3 .ic3'), row = q('.glints3'), more = q('.glmore3'), tallyEl = q('.qcount3'), card = q('.glintcard3');
  let names = [], nameT = 0, tallyT = 0, glints = [], open = null;

  const Q = {
    // a place or a moment: shown when the line is free; a second within a few seconds joins the first
    name(title, ic = 'landmarks') {
      if (H.off['say:name']) return;
      if (nameT > 0 && names.length < 2 && !names.includes(title)) { names.push(title); nameT = Math.max(nameT, QUIET.nameSecs * .8); draw(); return; }
      Q.pending.push({ title, ic, at: performance.now() / 1000 });
    },
    pending: [],
    // something new: an icon waits beside the compass
    glint(title, text, ic = 'how') {
      if (!text) return;
      title ||= titleOf(text);
      if (H.off['say:glint']) return;
      const old = glints.find(g => g.title === title);
      if (old) { old.t = 0; old.el.classList.remove('dim'); return; }
      while (glints.length >= QUIET.glints) drop(glints[0]);
      const el = document.createElement('button');
      el.className = 'gl3 live'; el.setAttribute('aria-label', `Read: ${title}`); el.innerHTML = icon(ic);
      const g = { title, text, ic, el, t: 0 };
      el.addEventListener('click', () => read(g));
      glints.push(g); row.insertBefore(el, more); stack();
    },
    // a count or a confirmation: a few words, then gone
    tally(text, ic = 'check') {
      if (H.off['say:tally']) return;
      tallyEl.querySelector('.ic3').innerHTML = icon(ic); tallyEl.querySelector('.tx3').textContent = text;
      tallyEl.classList.add('show'); tallyT = QUIET.tallySecs;
    },
    get count() { return glints.length; },
    // free: the message line and the tips are quiet and the bird is not mid-move
    // told: called when a name shows (hud.js paces them with the rest)
    update(dt, free, told) {
      if ((nameT -= dt) <= 0 && nameEl.classList.contains('show')) nameEl.classList.remove('show');
      if (nameT <= -.6 && free && Q.pending.length) {
        const now = performance.now() / 1000;
        Q.pending = Q.pending.filter(n => now - n.at < 20);
        const n = Q.pending.shift();
        if (n) { names = [n.title]; nameIc.innerHTML = icon(n.ic); nameT = QUIET.nameSecs; draw(); told?.(); }
      }
      if ((tallyT -= dt) <= 0) tallyEl.classList.remove('show');
      for (const g of glints) {
        g.t += dt;
        if (g.t > QUIET.glintBreathe) g.el.classList.remove('live');
        if (g.t > QUIET.glintDim) g.el.classList.add('dim');
      }
      ui.classList.toggle('glints3on', glints.length > 0);
      // under a tip or the message line only the dots show: just past its right end, never over it
      const big = glints.length ? [...ui.querySelectorAll('.toast3.show, .hint3.show')].map(e => e.getBoundingClientRect()).sort((p, q) => q.right - p.right)[0] : null;
      if (big) { const o = ui.getBoundingClientRect(); row.style.left = `${big.right - o.left + 6}px`; row.style.top = `${big.top - o.top + big.height / 2 - 18}px`; }
      else if (row.style.left) row.style.left = row.style.top = '';
    },
  };
  function draw() { nameT0.textContent = names.join(' · '); nameEl.classList.add('show'); }
  function drop(g) { g.el.remove(); glints = glints.filter(x => x !== g); stack(); }
  // stacked (James, 2026-10-24): only the newest shows, and three dots (not a button) say more
  // wait; while a tip or the message line shows, the icons hide and only the dots stay (3d.css)
  function stack() {
    glints.forEach((g, i) => g.el.classList.toggle('old', i < glints.length - 1));
    ui.classList.toggle('glstack3', glints.length > 1);
  }
  function read(g) {
    open = g; G.paused = true;
    card.querySelector('.ic3').innerHTML = icon(g.ic); card.querySelector('b').textContent = g.title; card.querySelector('p').textContent = g.text;
    card.classList.remove('hidden');
  }
  card.addEventListener('click', e => {
    if (!e.target.closest('[data-t]')) return;
    card.classList.add('hidden'); if (open) drop(open); open = null; G.paused = false;
  });
  // a new day clears what waits
  G.on('newDay', () => { for (const g of [...glints]) drop(g); });

  return Q;
}
