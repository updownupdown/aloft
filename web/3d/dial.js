// Time of day, top right, on a small pane of glass: a half disc for the sky from sunrise to sunset
// (moonrise to moonset at night), cut into wedges coloured for each part of the day (dawn rose,
// morning gold, midday pale, afternoon amber, dusk coral; the night in blues), the sun or moon on
// its rim, and the hour, day and season underneath with the ring count below.
import { SEASON_DAYS } from './sky.js';

// the parts of the day by tod, and the colour of each wedge
const PARTS = [[.2, .3, '#f2b8a0'], [.3, .45, '#f5d68a'], [.45, .55, '#f8eab4'], [.55, .7, '#efc072'], [.7, .8, '#ec9a7c']];
const NIGHT = [[.75, .8, '#8e8fbf'], [.8, 1, '#5e6c9e'], [0, .2, '#4b5a8c'], [.2, .25, '#8e8fbf']];

export function createDial(parent) {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 44, CY = 42, R = 38;
  // a point on the rim: f runs 0 at the left end (sunrise, or sunset for the moon) to 1 at the right
  const pt = (f, r = R) => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  const wedge = (f0, f1, col) => {
    const [x0, y0] = pt(f0), [x1, y1] = pt(f1);
    return `<path d="M${CX} ${CY}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${col}"/>`;
  };
  // tod to the arc: by day .25 (sunrise) .. .75 (sunset); by night .75 .. 1.25
  const dayF = t => (t - .25) / .5, nightF = t => (((t - .75) % 1 + 1) % 1) / .5;
  const day = PARTS.map(([a, c, col]) => wedge(Math.max(0, dayF(a)), Math.min(1, dayF(c)), col)).join('');
  const night = NIGHT.map(([a, c, col]) => wedge(nightF(a), c === 1 ? .5 : nightF(c) || 1, col)).join('');
  el.innerHTML = `<svg viewBox="0 0 88 46" aria-hidden="true"><g class="dayw">${day}</g><g class="nightw">${night}</g>
    <path class="shade" d=""/><path class="rim" d="M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}"/><path class="base" d="M${CX - R - 3} ${CY}H${CX + R + 3}"/><circle class="sun" r="5"/></svg>
    <div class="label"></div><div class="season"></div><div class="score"></div>`;
  parent.append(el);
  const sun = el.querySelector('.sun'), shade = el.querySelector('.shade'), label = el.querySelector('.label'), seasonEl = el.querySelector('.season'), scoreEl = el.querySelector('.score');
  let key = '';
  return {
    // tod runs 0 (midnight) to 1; the sun is up from .25 to .75 and the moon has the arc at night
    update(tod, dayN, hide, score = '', season = null) {
      const k = Math.round(tod * 400) + ',' + dayN + ',' + hide + ',' + score + ',' + season?.name;
      if (k === key) return; key = k;
      el.classList.toggle('hidden', hide);
      const isNight = tod < .25 || tod >= .75;
      const f = isNight ? nightF(tod) : dayF(tod);
      const [x, y] = pt(f);
      sun.setAttribute('cx', x.toFixed(2)); sun.setAttribute('cy', y.toFixed(2)); sun.classList.toggle('moon', isNight);
      // the part of the arc still to come is veiled, so the flown part reads at a glance
      if (f < .995) { const [x0, y0] = pt(f); shade.setAttribute('d', `M${CX} ${CY}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${CX + R} ${CY}Z`); } else shade.setAttribute('d', '');
      el.classList.toggle('night', isNight);
      const h = hourName(tod);
      label.textContent = `${h[0].toUpperCase()}${h.slice(1)} · Day ${dayN}`;
      if (season) {
        const into = ((dayN - 1) % SEASON_DAYS) + 1;
        seasonEl.className = 'season ' + season.name;
        seasonEl.textContent = `${season.name[0].toUpperCase()}${season.name.slice(1)}, day ${into} of ${SEASON_DAYS}`;
      }
      scoreEl.textContent = score; scoreEl.classList.toggle('hidden', !score);
      el.title = `Day ${dayN}, ${h}${season ? ', ' + season.name : ''}`;
    },
  };
}
// the hour in words, for the label and for anything else that wants to say what time it is
export function hourName(tod) {
  return tod < .2 || tod >= .8 ? 'night' : tod < .3 ? 'dawn' : tod < .45 ? 'morning' : tod < .55 ? 'midday' : tod < .7 ? 'afternoon' : 'dusk';
}
