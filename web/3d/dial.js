// Time of day, top right, in low poly: a half gem of twelve facets for the sun's path above a
// horizon line, each facet the flat colour of the hour it stands for (by day dawn rose, morning
// straw, midday blue, dusk amber; by night violet deepening to indigo and back to dawn). The
// facets already flown are shaded over, the sun (or the moon at night) is a little hexagon on
// the rim, and the hour and day are written under it with the ring count below.
const SKY_DAY = ['#e8b4a4', '#efd3a6', '#b9d2e6', '#a7c6e2', '#b9d2e6', '#ecc99a', '#e0a07e'];
const SKY_NIGHT = ['#c99a8e', '#8d7fa3', '#56608a', '#3a4368', '#56608a', '#8d7fa3', '#d4a596'];
const N = 12;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// the colour at f (0..1) along a list, mixed between its two nearest stops
const at = (cols, f) => { const t = f * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(t)), a = hex(cols[i]), b = hex(cols[i + 1]), k = t - i; return a.map((v, j) => Math.round(v + (b[j] - v) * k)); };

export function createDial(parent) {
  const el = document.createElement('div'); el.className = 'dial';
  const CX = 52, CY = 50, R = 42;
  // a point on the rim: f runs 0 at the left end (sunrise, or sunset for the moon) to 1 at the right
  const pt = (f, r = R) => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  const P = (f, r) => pt(f, r).map(v => v.toFixed(1)).join(' ');
  const wedge = i => `${CX} ${CY} ${P(i / N)} ${P((i + 1) / N)}`;
  // each facet a flat colour, every other one a shade lighter, as if leaning to the light
  const facets = cols => Array.from({ length: N }, (_, i) => {
    const c = at(cols, (i + .5) / N), k = i % 2 ? 1.06 : .97;
    return `<polygon points="${wedge(i)}" fill="rgb(${c.map(v => Math.min(255, v * k) | 0)})"/>`;
  }).join('');
  const rim = Array.from({ length: N + 1 }, (_, i) => P(i / N)).join(' ');
  el.innerHTML = `<svg viewBox="0 0 104 56" aria-hidden="true">
    <g class="sky day">${facets(SKY_DAY)}</g><g class="sky night">${facets(SKY_NIGHT)}</g>
    <g class="flown">${Array.from({ length: N }, (_, i) => `<polygon points="${wedge(i)}"/>`).join('')}</g>
    <polyline class="arc" points="${rim}"/>
    <path class="arc" d="M4 ${CY} L100 ${CY}"/>
    <polygon class="sun" points="${Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + .5; return `${(Math.cos(a) * 6).toFixed(2)} ${(Math.sin(a) * 6).toFixed(2)}`; }).join(' ')}"/>
  </svg><div class="label"></div><div class="score"></div>`;
  parent.append(el);
  const skyDay = el.querySelector('.sky.day'), skyNight = el.querySelector('.sky.night'), flown = [...el.querySelectorAll('.flown polygon')];
  const sun = el.querySelector('.sun'), label = el.querySelector('.label'), scoreEl = el.querySelector('.score');
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
      sun.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`); sun.classList.toggle('moon', night);
      flown.forEach((p, i) => p.classList.toggle('on', (i + 1) / N <= f));
      el.classList.toggle('night', night);
      skyDay.classList.toggle('hidden', night); skyNight.classList.toggle('hidden', !night);
      label.textContent = `${hourName(tod)} · day ${day}`;
      scoreEl.textContent = score; scoreEl.classList.toggle('hidden', !score);
      el.title = `Day ${day}, ${hourName(tod)}`;
    },
  };
}
// the hour in words, for the label and for anything else that wants to say what time it is
export function hourName(tod) {
  return tod < .2 || tod >= .8 ? 'night' : tod < .3 ? 'dawn' : tod < .45 ? 'morning' : tod < .55 ? 'midday' : tod < .7 ? 'afternoon' : 'dusk';
}
