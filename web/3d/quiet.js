// The quiet levels of the message line (James's pick A with C from the quiet messages study,
// 2026-10-23, https://claude.ai/artifact/XnzHqYQUUyYKVsAeNnDZdX). hud.js keeps the loud level, the
// message line itself, for what must be said now; this file holds the rest:
// - a name: a place or a moment, thin white words and an icon under the compass, no box; two close
//   together share it
// - a glint: something new to learn, an icon beside the compass that waits to be tapped; tap it
//   and a glass card says it all. Stacked: the newest shows, with three dots when more wait
// - a count: a count or a confirmation, small words and an icon in the same place as a name
//   (under it when both show), gone in two seconds
// - the next step (James, 2026-10-24): the open lesson, or the day's aim once the lessons are done,
//   as a thin line in the name's place for as long as it is open: a ring, the task, and in lighter
//   type what helps. Not a message: a label, like the height on the ladder. It yields to a name, a
//   message or a tip for their few seconds; ticks and fades when done; a swipe rests it till the
//   next take-off; a switch under Journal > Messages (hints.js 'say:next') turns it off
import { icon } from './icons.js';

export const QUIET = {
  nameSecs: 3.6,     // a name shows this long
  glints: 3,         // glints waiting at once; a fourth sends the oldest off
  glintDim: 60,      // a glint dims after this long unread
  glintBreathe: 6,   // and breathes this long when it comes
  tallySecs: 2.2,
  doneSecs: 2.4,     // the next step's tick stays this long
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
      <div><button class="main3" data-t="ok">Got it</button></div></div>
    <p class="next3" aria-live="polite"><i class="nring3">${icon('check')}</i><span class="nt3"></span><small class="ns3"></small></p>`);
  const q = s => ui.querySelector(s);
  const nameEl = q('.name3'), nameT0 = q('.name3 .nt3'), nameIc = q('.name3 .ic3'), row = q('.glints3'), more = q('.glmore3'), tallyEl = q('.qcount3'), card = q('.glintcard3');
  const nextEl = q('.next3'), nextTx = nextEl.querySelector('.nt3'), nextSub = nextEl.querySelector('.ns3');
  let names = [], nameT = 0, tallyT = 0, glints = [], open = null;
  // the next step: a slot for the lesson and one for the aim (the lesson shows first); rest: swiped away till take-off
  const slots = { lesson: null, quest: null, aim: null };   // (quest: the one you follow, sys/quests.js)
  let nextKey = '', doneT = 0, rest = false;

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
    // the next step: text (or null to clear it) and what helps, in lighter type
    next(who, text, sub = '') {
      const s = slots[who];
      if (s?.done && doneT > 0) return;   // ticked: it fades first
      if (s && s.text === text && s.sub === sub) return;
      slots[who] = text ? { text, sub } : null;
    },
    nextDone(who) { const s = slots[who]; if (s && !s.done) { s.done = true; doneT = QUIET.doneSecs; } },
    nextRest() { rest = true; },
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
      // the next step: the open lesson, else the aim; a done one fades after its tick
      if (doneT > 0 && (doneT -= dt) <= 0) for (const w in slots) if (slots[w]?.done) slots[w] = null;
      const s = slots.lesson || slots.quest || slots.aim || slots.season || slots.course, on = !!s && !rest && !H.off['say:next'];
      const k = on ? `${s.text}|${s.sub}|${s.done ? 1 : 0}` : '';
      if (k !== nextKey) {
        nextKey = k;
        if (on) { nextTx.textContent = s.text; nextSub.textContent = s.done ? 'Done' : s.sub; nextEl.classList.toggle('done', !!s.done); }
        nextEl.classList.toggle('show', on);
      }
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
    card.classList.add('hidden'); if (open) { H.learned?.(open.title); drop(open); } open = null; G.paused = false;
  });
  // a new day clears what waits
  G.on('newDay', () => { for (const g of [...glints]) drop(g); });
  // the next step swiped away, either way: it rests till the next take-off
  let sx = null, sdx = 0;
  nextEl.addEventListener('pointerdown', e => { sx = e.clientX; sdx = 0; nextEl.setPointerCapture(e.pointerId); nextEl.classList.add('drag'); e.stopPropagation(); });
  nextEl.addEventListener('pointermove', e => { if (sx === null) return; sdx = e.clientX - sx; nextEl.style.transform = `translateX(calc(-50% + ${sdx}px))`; nextEl.style.opacity = String(Math.max(.2, 1 - Math.abs(sdx) / 160)); });
  const swiped = () => {
    if (sx === null) return; sx = null; nextEl.classList.remove('drag'); nextEl.style.opacity = '';
    if (Math.abs(sdx) > 50) { nextEl.style.transform = `translateX(calc(-50% + ${Math.sign(sdx) * 400}px))`; rest = true; setTimeout(() => { nextEl.style.transform = ''; }, 400); }
    else nextEl.style.transform = '';
  };
  nextEl.addEventListener('pointerup', swiped); nextEl.addEventListener('pointercancel', swiped);
  nextEl.addEventListener('touchstart', e => e.stopPropagation());
  G.on('takeoff', () => { rest = false; });

  return Q;
}
