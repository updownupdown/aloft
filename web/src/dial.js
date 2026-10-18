// Time of day as a small dial: noon at the top, midnight at the bottom, the paper-light half
// is daylight, and the sun (or moon) travels round the rim. The day number sits in the middle.
export function createDial() {
  const el = document.createElement('div'); el.className = 'dial';
  const R = 19, C = 22, pt = (tod, r = R) => { const a = (tod - .5) * Math.PI * 2; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
  const [dx0, dy0] = pt(.25), [dx1, dy1] = pt(.75);
  el.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true">
    <circle cx="${C}" cy="${C}" r="${R}" class="night"/>
    <path d="M${dx0},${dy0} A${R},${R} 0 0 1 ${dx1},${dy1} Z" class="day"/>
    <circle cx="${C}" cy="${C}" r="${R}" class="rim"/>
    <line x1="${C}" y1="${C - R - 1}" x2="${C}" y2="${C - R + 3}" class="tick"/>
    <text x="${C}" y="${C + 4}" class="num"></text>
    <circle r="3.4" class="sun"/>
  </svg>`;
  document.getElementById('ui').append(el);
  const sun = el.querySelector('.sun'), num = el.querySelector('.num');
  let key = '';
  return {
    update(tod, day, hide) {
      const k = Math.round(tod * 400) + ',' + day + ',' + hide;
      if (k === key) return; key = k;
      el.classList.toggle('hidden', hide);
      const [x, y] = pt(tod), night = tod < .23 || tod > .77;
      sun.setAttribute('cx', x.toFixed(2)); sun.setAttribute('cy', y.toFixed(2));
      sun.classList.toggle('moon', night);
      num.textContent = day;
      el.title = `Day ${day}`;
    },
  };
}
