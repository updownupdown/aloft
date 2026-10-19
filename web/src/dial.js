// Time of day as a field journal would sketch it: a horizon line, an arc for the sun's path with
// a tick every two hours, the hours already flown washed in pale blue (slate at night, when the
// moon takes the arc), and the hour and day written under it. The ring count sits beneath, so
// the whole top right corner reads as one small instrument. Inside the arc the sky is washed in
// the colour of each hour it stands for: by day dawn rose, morning straw, midday blue and dusk
// amber; by night dusk violet deepening to indigo and back to dawn at the right-hand end.
const SKY_DAY = ['#e8b4a4', '#efd3a6', '#b9d2e6', '#a7c6e2', '#b9d2e6', '#ecc99a', '#e0a07e'];
const SKY_NIGHT = ['#c99a8e', '#8d7fa3', '#56608a', '#3a4368', '#56608a', '#8d7fa3', '#d4a596'];
export function createDial() {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 52, CY = 50, R = 42;
  // a point on the arc: f runs 0 at the left end (sunrise, or sunset for the moon) to 1 at the right
  const pt = (f, r = R) => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  const ticks = [1, 2, 3, 4, 5].map(i => { const [x0, y0] = pt(i / 6), [x1, y1] = pt(i / 6, R + 4); return `M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}`; }).join(' ');
  const [ax, ay] = pt(0), [bx, by] = pt(1);
  // each hour's colour sits under its place on the arc: a sideways gradient with a stop under every
  // point, spaced as the arc's x positions are, so midday spreads wide and dawn and dusk hug the ends
  const grad = (id, cols) => `<linearGradient id="${id}" x1="${ax}" x2="${bx}" y1="0" y2="0" gradientUnits="userSpaceOnUse">${
    cols.map((c, i) => `<stop offset="${((pt(i / (cols.length - 1))[0] - ax) / (bx - ax)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  el.innerHTML = `<svg viewBox="0 0 104 56" aria-hidden="true">
    <defs>${grad('dial-day', SKY_DAY)}${grad('dial-night', SKY_NIGHT)}
      <radialGradient id="dial-fade" cx="${CX}" cy="${CY}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></radialGradient>
      <mask id="dial-mask"><path d="M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by} Z" fill="url(#dial-fade)"/></mask></defs>
    <path class="sky day" mask="url(#dial-mask)" fill="url(#dial-day)" d="M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by} Z"/>
    <path class="sky night" mask="url(#dial-mask)" fill="url(#dial-night)" d="M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by} Z"/>
    <path class="flown" d=""/>
    <path class="arc" d="M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}"/>
    <path class="tick" d="${ticks}"/>
    <path class="arc" d="M4 ${CY} L100 ${CY}"/>
    <circle r="6" class="sun"/>
  </svg><div class="label"></div><div class="score"></div>`;
  document.getElementById('ui').append(el);
  const skyDay = el.querySelector('.sky.day'), skyNight = el.querySelector('.sky.night');
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
      skyDay.classList.toggle('hidden', night); skyNight.classList.toggle('hidden', !night);
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
