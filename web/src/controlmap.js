// The controls map for How to play: each gesture drawn as a finger's ink line on a little square
// of paper, with what it does beside it. Drawn as if the hawk flies to the right; flying left,
// every gesture mirrors. A gesture whose mark in the game has a colour carries that colour here.
const INK = '#3a2418', RED = '#b02c48', GREEN = '#3f7a3c', FAINT = 'rgba(58,36,24,.35)';

// small drawing helpers, all in a 64 x 64 box
const dot = (x, y, r = 4, c = INK) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const ring = (x, y, r, c = INK, o = .55) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="1.4" opacity="${o}"/>`;
const line = (d, c = INK, w = 2.4) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// an arrowhead at x, y pointing along angle a (degrees, 0 = right, 90 = down)
const head = (x, y, a, c = INK, s = 7) => `<path d="M${-s} ${-s * .62} L0 0 L${-s} ${s * .62}" transform="translate(${x} ${y}) rotate(${a})" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
const tap = (x, y, n = 1, c = INK) => dot(x, y, 4, c) + Array.from({ length: n }, (_, i) => ring(x, y, 9 + i * 6, c, .6 - i * .15)).join('');
// the travelling hawk, a faint tick to show which way is forward
const hawk = (x = 50, y = 8) => `<path d="M${x - 7} ${y - 3} Q${x - 2} ${y + 1} ${x + 4} ${y} M${x - 7} ${y + 3} Q${x - 2} ${y - 1} ${x + 4} ${y}" stroke="${FAINT}" stroke-width="1.6" fill="none" stroke-linecap="round"/>${head(x + 7, y, 0, FAINT, 3)}`;

const DRAW = {
  flap: () => tap(32, 34),
  aim: () => dot(32, 32, 5) + ring(32, 32, 10) + line('M32 20 V9') + head(32, 9, -90) + line('M44 32 H55') + head(55, 32, 0)
    + line('M32 44 V55') + head(32, 55, 90) + line('M20 32 H9') + head(9, 32, 180),
  turn: () => dot(50, 34) + line('M50 34 H12') + head(12, 34, 180) + head(20, 34, 180),
  hover: () => dot(32, 52) + line('M32 52 V12') + head(32, 12, -90),
  land: () => dot(32, 12) + line('M32 12 V52') + head(32, 52, 90),
  thermal: () => dot(14, 40) + line('M14 40 H44 Q54 40 54 32 Q54 24 44 24 H18') + head(18, 24, 180),
  flip: () => dot(32, 54) + line('M32 54 C10 54 10 18 32 18 C54 18 54 46 38 50') + head(38, 50, 165),
  hunt: () => dot(12, 14) + line('M12 14 L44 44', RED) + head(44, 44, 45, RED)
    + `<ellipse cx="50" cy="52" rx="6" ry="3.6" fill="${RED}" opacity=".75"/>`,
  perch: () => line('M6 44 Q30 38 58 42', GREEN, 3) + line('M40 41 L48 32', GREEN, 2) + tap(30, 33, 2, GREEN),
  hop: () => line('M8 50 H56', FAINT, 1.6) + tap(32, 34),
  takeoff: () => line('M8 52 H56', FAINT, 1.6) + dot(18, 32) + dot(32, 32) + dot(46, 32) + ring(18, 32, 9, INK, .3) + ring(32, 32, 9, INK, .45) + ring(46, 32, 9),
  call: () => `<rect x="18" y="18" width="28" height="28" rx="14" fill="none" stroke="${INK}" stroke-width="1.6"/>` + dot(32, 32, 5)
    + ring(32, 32, 19, INK, .45) + ring(32, 32, 25, INK, .25),
};

// [title, what it does, drawing, where it works]
export const CONTROLS = [
  ['air', 'Tap anywhere', 'Flap. Well-spaced beats barely tire the wings.', 'flap'],
  ['air', 'Touch and hold, then lean', 'Up for a hovering stance, forward for a longer glide, down to dive, back to slow down with a back-beat of the wings. Leaning back never turns the hawk.', 'aim'],
  ['air', 'Swipe back', 'Turn around. Only a clean swipe turns; black double arrows show it.', 'turn'],
  ['air', 'Swipe up', 'Hover in place on beating wings, to look around. It tires the wings.', 'hover'],
  ['air', 'Swipe down', 'Settle softly down to land, right where you are.', 'land'],
  ['air', 'Swipe forward, then back', 'Ride the thermal: float up as high as the air goes, turning at its edges.', 'thermal'],
  ['air', 'Draw a circle', 'A flip: round one way for a loop, the other for a front flip.', 'flip'],
  ['air', 'Draw a line to a mouse or fish', 'Stoop on it. The line shows in red.', 'hunt'],
  ['air', 'Double tap a branch', 'Fly to it and perch. The branch glows green.', 'perch'],
  ['rest', 'Tap', 'Hop. Taps spaced well apart only ever hop.', 'hop'],
  ['rest', 'Three quick taps', 'Take off.', 'takeoff'],
  ['any', 'Call button', 'The red-tail\'s scream. Hold it longer for a louder call.', 'call'],
];
const GROUPS = { air: 'In the air', rest: 'On a branch or the ground', any: 'Anywhere' };

export function controlMap() {
  // one wobble for every line, so the ink looks brushed rather than ruled
  let html = '<svg width="0" height="0" style="position:absolute"><filter id="ctl-ink"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="3"/>'
    + '<feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></svg>';
  html += '<p class="ctl-note">Drawn as if the hawk is flying right; flying left, every gesture mirrors. A new gesture cancels the last one unless the two can work together.</p>';
  for (const [g, name] of Object.entries(GROUPS)) {
    html += `<h3>${name}</h3><div class="ctl-map">`;
    for (const [grp, title, text, d] of CONTROLS) {
      if (grp !== g) continue;
      html += `<figure><svg viewBox="0 0 64 64" aria-hidden="true"><g filter="url(#ctl-ink)">${grp === 'air' ? hawk() : ''}${DRAW[d]()}</g></svg>`
        + `<figcaption><b>${title}</b><small>${text}</small></figcaption></figure>`;
    }
    html += '</div>';
  }
  return html;
}
