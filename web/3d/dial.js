// Time of day, top right: a half disc for the sky from sunrise to sunset (moonrise to moonset at
// night) in three parts only (dawn, day and dusk by day; dusk, night and dawn by night), the sun
// or moon on its rim, and the season and its day underneath. Round the rim runs the forecast: a
// thin band coloured by the weather due at each point of the arc still to come (G.forecast, from
// the weather system; failing that, just the weather now, a little way ahead).
import { SEASON_DAYS, DAY } from './sky.js';

const DAWN = '#f2b8a0', DUSK = '#ec9a7c';
// the wedges by tod, and the colour of each
const PARTS = [[.2, .3, DAWN], [.3, .7, '#f5d68a'], [.7, .8, DUSK]];
const NIGHT = [[.75, .8, '#8e8fbf'], [.8, 1, '#4f5e92'], [0, .2, '#4f5e92'], [.2, .25, '#8e8fbf']];
// the forecast band's colour for each kind of weather
export const SKY = { clear: '#ffd977', cloud: '#c3ccd3', fog: '#e4e7e8', rain: '#5d93d6', snow: '#f4f8ff', storm: '#5a4c8c' };
const SAY = { clear: 'clear', cloud: 'cloudy', fog: 'fog', rain: 'rain', snow: 'snow', storm: 'a storm' };
const SLICES = 24, RING = 4.2;

export function createDial(parent) {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 44, CY = 42, R = 36;
  // a point on the rim: f runs 0 at the left end (sunrise, or sunset for the moon) to 1 at the right
  const pt = (f, r = R) => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  const P = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  const wedge = (f0, f1, col) => `<path d="M${CX} ${CY}L${P(pt(f0))}A${R} ${R} 0 0 1 ${P(pt(f1))}Z" fill="${col}"/>`;
  // a piece of the forecast band, just outside the rim
  const band = (f0, f1) => { const r0 = R + 1.6, r1 = r0 + RING; return `M${P(pt(f0, r1))}A${r1} ${r1} 0 0 1 ${P(pt(f1, r1))}L${P(pt(f1, r0))}A${r0} ${r0} 0 0 0 ${P(pt(f0, r0))}Z`; };
  // tod to the arc: by day .25 (sunrise) .. .75 (sunset); by night .75 .. 1.25
  const dayF = t => (t - .25) / .5, nightF = t => (((t - .75) % 1 + 1) % 1) / .5;
  const day = PARTS.map(([a, c, col]) => wedge(Math.max(0, dayF(a)), Math.min(1, dayF(c)), col)).join('');
  const night = NIGHT.map(([a, c, col]) => wedge(nightF(a), c === 1 ? .5 : nightF(c) || 1, col)).join('');
  const slices = Array.from({ length: SLICES }, (_, i) => `<path d="${band(i / SLICES, (i + 1) / SLICES)}"/>`).join('');
  el.innerHTML = `<svg viewBox="0 0 88 46" aria-hidden="true"><path class="track" d="${band(0, 1)}"/><g class="ring">${slices}</g><g class="dayw">${day}</g><g class="nightw">${night}</g>
    <path class="shade" d=""/><path class="rim" d="M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}"/><path class="base" d="M${CX - R - 7} ${CY}H${CX + R + 7}"/><circle class="sun" r="5"/></svg>
    <div class="season"></div>`;
  parent.append(el);
  const sun = el.querySelector('.sun'), shade = el.querySelector('.shade'), seasonEl = el.querySelector('.season');
  const ring = [...el.querySelectorAll('.ring path')];
  let key = '';
  return {
    // tod runs 0 (midnight) to 1; the sun is up from .25 to .75 and the moon has the arc at night.
    // forecast(seconds ahead) gives the weather due then: clear, cloud, fog, rain, snow or storm
    update(tod, dayN, hide, season = null, forecast = null) {
      const k = Math.round(tod * 400) + ',' + dayN + ',' + hide + ',' + season?.name;
      if (k === key) return; key = k;
      el.classList.toggle('hidden', hide);
      const isNight = tod < .25 || tod >= .75;
      const f = isNight ? nightF(tod) : dayF(tod);
      const [x, y] = pt(f);
      sun.setAttribute('cx', x.toFixed(2)); sun.setAttribute('cy', y.toFixed(2)); sun.classList.toggle('moon', isNight);
      // the part of the arc still to come is veiled, so the flown part reads at a glance
      shade.setAttribute('d', f < .995 ? `M${CX} ${CY}L${P(pt(f))}A${R} ${R} 0 0 1 ${CX + R} ${CY}Z` : '');
      el.classList.toggle('night', isNight);
      // the forecast: each slice still ahead takes the weather due at its middle; the slices
      // behind the sun are left empty
      let next = '', now = '';
      ring.forEach((p, i) => {
        const mid = (i + .5) / SLICES, ahead = (mid - f) * DAY / 2;
        const kind = forecast && mid > f - .5 / SLICES ? forecast(Math.max(0, ahead)) : null;
        p.setAttribute('fill', SKY[kind] || 'none'); p.style.stroke = SKY[kind] || 'none';
        if (kind && !now) now = kind; else if (kind && kind !== now && !next) next = kind;
      });
      const h = hourName(tod);
      if (season) {
        const into = ((dayN - 1) % SEASON_DAYS) + 1;
        seasonEl.className = 'season ' + season.name;
        seasonEl.textContent = `${season.name[0].toUpperCase()}${season.name.slice(1)}, day ${into} of ${SEASON_DAYS}`;
      }
      el.title = `Day ${dayN}, ${h}${season ? ', ' + season.name : ''}${now ? `. ${SAY[now][0].toUpperCase()}${SAY[now].slice(1)} now${next ? `, then ${SAY[next]}` : ''}` : ''}`;
    },
  };
}
// the hour in words, for the dial's title and for anything else that wants to say what time it is
export function hourName(tod) {
  return tod < .2 || tod >= .8 ? 'night' : tod < .3 ? 'dawn' : tod < .45 ? 'morning' : tod < .55 ? 'midday' : tod < .7 ? 'afternoon' : 'dusk';
}
