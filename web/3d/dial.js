// Time of day, top right: the whole day as a disc (night, dawn, day, dusk, with a little sun at
// noon and a moon at midnight) that turns under a fixed upright needle, so the time now is always
// at the top; only the upper half shows, six hours either side. Round the rim runs the forecast: a
// thin band, right of the needle, coloured by the weather due over the hours ahead (G.forecast,
// from the weather system; failing that, just the weather now, a little way ahead). The season and
// its day sit underneath.
import { SEASON_DAYS, DAY } from './sky.js';

const NIGHT = '#4f5e92', TWI = '#8e8fbf', DAWN = '#f2b8a0', DUSK = '#ec9a7c', NOON = '#f5d68a';
// the parts of the day by tod, and the colour of each, round the disc
const PARTS = [[0, .2, NIGHT], [.2, .25, TWI], [.25, .3, DAWN], [.3, .7, NOON], [.7, .75, DUSK], [.75, .8, TWI], [.8, 1, NIGHT]];
// the forecast band's colour for each kind of weather
export const SKY = { clear: '#ffd977', cloud: '#c3ccd3', fog: '#e4e7e8', rain: '#5d93d6', snow: '#f4f8ff', storm: '#5a4c8c' };
const SAY = { clear: 'clear', cloud: 'cloudy', fog: 'fog', rain: 'rain', snow: 'snow', storm: 'a storm' };
const SLICES = 12, RING = 4.2;

export function createDial(parent) {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 44, CY = 42, R = 36;
  // a point at angle a (radians clockwise from straight up)
  const at = (a, r = R) => [CX + r * Math.sin(a), CY - r * Math.cos(a)];
  const P = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  // a slice of the disc by tod (drawn with midnight at the top; the group turns it)
  const wedge = (t0, t1, col) => `<path d="M${CX} ${CY}L${P(at(t0 * 6.2832))}A${R} ${R} 0 ${t1 - t0 > .5 ? 1 : 0} 1 ${P(at(t1 * 6.2832))}Z" fill="${col}"/>`;
  // a piece of the forecast band just outside the rim, from a0 to a1 (fixed: it does not turn)
  const band = (a0, a1) => { const r0 = R + 1.6, r1 = r0 + RING; return `M${P(at(a0, r1))}A${r1} ${r1} 0 0 1 ${P(at(a1, r1))}L${P(at(a1, r0))}A${r0} ${r0} 0 0 0 ${P(at(a0, r0))}Z`; };
  const disc = PARTS.map(([t0, t1, col]) => wedge(t0, t1, col)).join('');
  const [sx, sy] = at(Math.PI, R * .62), [mx, my] = at(0, R * .62);
  // the band covers the hours ahead: the right quarter, from the needle to the base line
  const Q = Math.PI / 2, slices = Array.from({ length: SLICES }, (_, i) => `<path d="${band(i / SLICES * Q, (i + 1) / SLICES * Q)}"/>`).join('');
  const id = 'dc' + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<svg viewBox="0 0 88 46" aria-hidden="true"><defs><clipPath id="${id}"><rect x="0" y="0" width="88" height="${CY}"/></clipPath></defs>
    <path class="track" d="${band(-Q, Q)}"/><g class="ring">${slices}</g>
    <g clip-path="url(#${id})"><g class="disc">${disc}<circle class="sun" cx="${sx}" cy="${sy}" r="4.2"/><circle class="moon" cx="${mx}" cy="${my}" r="3.6"/></g></g>
    <path class="rim" d="M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}"/><path class="base" d="M${CX - R - 7} ${CY}H${CX + R + 7}"/>
    <g class="needle"><path class="bar" d="M${CX - 1.7} ${CY}V${CY - R + 9}H${CX + 1.7}V${CY}Z"/><path class="tip" d="M${CX} ${CY - R - 1}L${CX + 4.6} ${CY - R + 8}H${CX - 4.6}Z"/></g></svg>
    <div class="season"></div>`;
  parent.append(el);
  const discEl = el.querySelector('.disc'), seasonEl = el.querySelector('.season');
  const ring = [...el.querySelectorAll('.ring path')];
  let key = '';
  return {
    // tod runs 0 (midnight) to 1; the disc turns so that tod sits under the needle.
    // forecast(seconds ahead) gives the weather due then: clear, cloud, fog, rain, snow or storm
    update(tod, dayN, hide, season = null, forecast = null) {
      const k = Math.round(tod * 400) + ',' + dayN + ',' + hide + ',' + season?.name;
      if (k === key) return; key = k;
      el.classList.toggle('hidden', hide);
      discEl.setAttribute('transform', `rotate(${(-tod * 360).toFixed(2)} ${CX} ${CY})`);
      el.classList.toggle('night', tod < .25 || tod >= .75);
      // the forecast: each slice ahead takes the weather due at its middle (a quarter turn is 6 hours)
      let next = '', now = '';
      ring.forEach((p, i) => {
        const kind = forecast ? forecast((i + .5) / SLICES * .25 * DAY) : null;
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
