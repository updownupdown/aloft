// Time of day, top right, on a small pane of glass: the sun's path as a thin arc over the horizon,
// the part already flown drawn in amber (indigo at night), the sun (or the moon at night) riding
// on it, and the hour and day underneath with the ring count below.
export function createDial(parent) {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 44, CY = 29, R = 40;
  // a point on the arc: f runs 0 at the left end (sunrise, or sunset for the moon) to 1 at the right
  const pt = f => { const a = Math.PI * (1 - f); return [CX + R * Math.cos(a), CY - R * .68 * Math.sin(a)]; };
  const path = f => { let d = ''; for (let i = 0; i <= 24; i++) { const [x, y] = pt(f * i / 24); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; } return d; };
  el.innerHTML = `<svg viewBox="0 0 88 30" aria-hidden="true"><path class="track" d="${path(1)}"/><path class="flown" d=""/><circle class="sun" r="4.5"/></svg>
    <div class="label"></div><div class="score"></div>`;
  parent.append(el);
  const flown = el.querySelector('.flown'), sun = el.querySelector('.sun'), label = el.querySelector('.label'), scoreEl = el.querySelector('.score');
  let key = '';
  return {
    // tod runs 0 (midnight) to 1; the sun is up from .25 to .75 and the moon has the arc at night
    update(tod, day, hide, score = '') {
      const k = Math.round(tod * 400) + ',' + day + ',' + hide + ',' + score;
      if (k === key) return; key = k;
      el.classList.toggle('hidden', hide);
      const night = tod < .25 || tod >= .75;
      const f = night ? ((tod + .25) % 1) / .5 : (tod - .25) / .5;
      const [x, y] = pt(f);
      sun.setAttribute('cx', x.toFixed(2)); sun.setAttribute('cy', y.toFixed(2)); sun.classList.toggle('moon', night);
      flown.setAttribute('d', f > .01 ? path(f) : '');
      el.classList.toggle('night', night);
      const h = hourName(tod);
      label.textContent = `${h[0].toUpperCase()}${h.slice(1)} · Day ${day}`;
      scoreEl.textContent = score; scoreEl.classList.toggle('hidden', !score);
      el.title = `Day ${day}, ${h}`;
    },
  };
}
// the hour in words, for the label and for anything else that wants to say what time it is
export function hourName(tod) {
  return tod < .2 || tod >= .8 ? 'night' : tod < .3 ? 'dawn' : tod < .45 ? 'morning' : tod < .55 ? 'midday' : tod < .7 ? 'afternoon' : 'dusk';
}
