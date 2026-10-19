// Time of day as a field journal would sketch it: a horizon line, an arc for the sun's path with
// a tick every two hours, the hours already flown washed in pale blue (slate at night, when the
// moon takes the arc), and the hour and day written under it. The ring count sits beneath, so
// the whole top right corner reads as one small instrument.
export function createDial() {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 52, CY = 50, R = 42;
  // a point on the arc: f runs 0 at the left end (sunrise, or sunset for the moon) to 1 at the right
  const pt = (f, r = R) => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  const ticks = [1, 2, 3, 4, 5].map(i => { const [x0, y0] = pt(i / 6), [x1, y1] = pt(i / 6, R + 4); return `M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}`; }).join(' ');
  const [ax, ay] = pt(0), [bx, by] = pt(1);
  el.innerHTML = `<svg viewBox="0 0 104 56" aria-hidden="true">
    <path class="flown" d=""/>
    <path class="arc" d="M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}"/>
    <path class="tick" d="${ticks}"/>
    <path class="arc" d="M4 ${CY} L100 ${CY}"/>
    <circle r="6" class="sun"/>
  </svg><div class="label"></div><div class="score"></div>`;
  document.getElementById('ui').append(el);
  const flown = el.querySelector('.flown'), sun = el.querySelector('.sun'), label = el.querySelector('.label'), score = el.querySelector('.score');
  let key = '';
  return {
    // tod runs 0 (midnight) to 1; the sun is up from .25 to .75 and the moon has the arc at night
    update(tod, day, hide, rings = 0) {
      const k = Math.round(tod * 400) + ',' + day + ',' + hide + ',' + rings;
      if (k === key) return; key = k;
      el.classList.toggle('hidden', hide);
      const night = tod < .25 || tod >= .75;
      const f = night ? ((tod + .25) % 1) / .5 : (tod - .25) / .5;
      const [x, y] = pt(f);
      sun.setAttribute('cx', x.toFixed(2)); sun.setAttribute('cy', y.toFixed(2)); sun.classList.toggle('moon', night);
      flown.setAttribute('d', f < .03 ? '' : `M${ax} ${ay} A${R} ${R} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
      flown.classList.toggle('night', night);
      label.textContent = `${hourName(tod)} · day ${day}`;
      score.textContent = rings === 1 ? '1 ring' : `${rings} rings`;
      el.title = `Day ${day}, ${hourName(tod)}`;
    },
  };
}
// the hour in words, for the label and for anything else that wants to say what time it is
export function hourName(tod) {
  return tod < .2 || tod >= .8 ? 'night' : tod < .3 ? 'dawn' : tod < .45 ? 'morning' : tod < .55 ? 'midday' : tod < .7 ? 'afternoon' : 'dusk';
}
