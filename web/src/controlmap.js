// The controls map for How to play: each gesture drawn as a finger's ink line on a little square
// of paper, with what it does beside it. Drawn as if the hawk flies to the right; flying left,
// every gesture mirrors. A gesture whose mark in the game has a colour carries that colour here.
import { MARK } from './palette.js';

const col = k => `rgb(${MARK[k].join()})`;
const INK = col('ink'), RED = col('mouse'), GREEN = col('perch'), OCHRE = col('thermal'), FAINT = 'rgba(58,36,24,.35)';

// small drawing helpers, all in a 64 x 64 box
const dot = (x, y, r = 4, c = INK) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const ring = (x, y, r, c = INK, o = .55) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="1.4" opacity="${o}"/>`;
const line = (d, c = INK, w = 2.4) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// an arrowhead at x, y pointing along angle a (degrees, 0 = right, 90 = down)
const head = (x, y, a, c = INK, s = 7) => `<path d="M${-s} ${-s * .62} L0 0 L${-s} ${s * .62}" transform="translate(${x} ${y}) rotate(${a})" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
const tap = (x, y, n = 1, c = INK) => dot(x, y, 4, c) + Array.from({ length: n }, (_, i) => ring(x, y, 9 + i * 6, c, .6 - i * .15)).join('');
// the travelling hawk, a faint tick to show which way is forward
const hawk = (x = 50, y = 8) => `<path d="M${x - 7} ${y - 3} Q${x - 2} ${y + 1} ${x + 4} ${y} M${x - 7} ${y + 3} Q${x - 2} ${y - 1} ${x + 4} ${y}" stroke="${FAINT}" stroke-width="1.6" fill="none" stroke-linecap="round"/>${head(x + 7, y, 0, FAINT, 3)}`;

const BERRY = '#a8483a', WATER = '#4f7fa6';
// the hawk at rest, a faint shape to tap beside
const sitting = (x = 32, y = 34) => `<path d="M${x - 5} ${y + 7} Q${x - 7} ${y - 2} ${x} ${y - 6} Q${x + 6} ${y - 2} ${x + 4} ${y + 7} Z" fill="${FAINT}"/>` + dot(x + 1, y - 8, 3, FAINT);
const branch = (y, x0 = 6, x1 = 58) => line(`M${x0} ${y} Q${(x0 + x1) / 2} ${y - 3} ${x1} ${y + 1}`, FAINT, 2.2);
const water = y => line(`M6 ${y} q6 -3 13 0 t13 0 t13 0 t13 0`, WATER, 1.8);
const berries = (x, y) => dot(x, y, 3.4, BERRY) + dot(x + 6, y + 2, 3.4, BERRY) + dot(x + 2, y + 6, 3.4, BERRY);
const up = (x, y0 = 54, y1 = 14) => dot(x, y0) + line(`M${x} ${y0} V${y1}`) + head(x, y1, -90);
const down = (x, y0 = 12, y1 = 50) => dot(x, y0) + line(`M${x} ${y0} V${y1}`) + head(x, y1, 90);
const three = (x, y) => dot(x, y - 12, 3) + dot(x, y, 3) + dot(x, y + 12, 3);

const DRAW = {
  flap: () => tap(32, 34),
  aim: () => dot(32, 32, 5) + ring(32, 32, 10) + line('M32 20 V9') + head(32, 9, -90) + line('M44 32 H55') + head(55, 32, 0)
    + line('M32 44 V55') + head(32, 55, 90) + line('M20 32 H9') + head(9, 32, 180),
  glide: () => dot(12, 36) + line('M12 36 H52') + head(52, 36, 0),
  turn: () => dot(52, 36) + line('M52 36 H12') + head(12, 36, 180) + head(20, 36, 180),
  hover: () => up(32),
  land: () => down(32, 14, 52),
  thermal: () => dot(14, 40, 4, OCHRE) + line('M14 40 H44 Q54 40 54 32 Q54 24 44 24 H18', OCHRE) + head(18, 24, 180, OCHRE),
  flip: () => dot(32, 54) + line('M32 54 C10 54 10 18 32 18 C54 18 54 46 38 50') + head(38, 50, 165),
  hunt: () => dot(12, 14) + line('M12 14 L44 44', RED) + head(44, 44, 45, RED)
    + `<ellipse cx="50" cy="52" rx="6" ry="3.6" fill="${RED}" opacity=".75"/>`,
  perch: () => line('M6 44 Q30 38 58 42', GREEN, 3) + line('M40 41 L48 32', GREEN, 2) + tap(30, 33, 2, GREEN),
  hop: () => branch(44) + sitting(32, 35) + tap(12, 34) + tap(52, 34),
  drop: () => branch(22, 4, 40) + branch(52, 24, 60) + down(30, 12, 44),
  takeoff: () => up(20, 54, 12) + three(44, 33),
  walkTo: () => line('M6 50 H58', FAINT, 1.6) + sitting(14, 40) + berries(40, 40) + ring(43, 43, 10),
  eat: () => line('M6 52 H58', FAINT, 1.6) + down(30, 10, 38) + berries(36, 44),
  paddle: () => water(44) + sitting(38, 36) + tap(14, 34),
  drink: () => water(40) + sitting(22, 33) + dot(44, 46, 4, WATER) + ring(44, 46, 9, WATER),
  call: () => `<rect x="18" y="18" width="28" height="28" rx="14" fill="none" stroke="${INK}" stroke-width="1.6"/>` + dot(32, 32, 5)
    + ring(32, 32, 19, INK, .45) + ring(32, 32, 25, INK, .25),
};

// [where it works, the gesture, what it does, its drawing]
export const CONTROLS = [
  ['air', 'Tap anywhere', 'Flap. Flapping keeps a glide, a ride, a perch or a hunt going, but ends a hover or a landing.', 'flap'],
  ['air', 'Swipe forward', 'Trim for a long glide.', 'glide'],
  ['air', 'Swipe back', 'Turn round. Only a clean swipe turns; a small double arrow by the hawk shows it.', 'turn'],
  ['air', 'Swipe up', 'Hover in place to look around. It tires the wings.', 'hover'],
  ['air', 'Swipe down', 'Settle softly and land, right where you are.', 'land'],
  ['air', 'Swipe forward, then back', 'Ride the thermal you are in, or head for the nearest one and ride it up. Its mark shows in ochre.', 'thermal'],
  ['air', 'Draw a circle', 'A flip, drawn the way the nose goes: over the top for a loop, under for a front flip.', 'flip'],
  ['air', 'Draw a line to a mouse or fish', 'Stoop on it. The line and its mark show in red.', 'hunt'],
  ['air', 'Double tap a branch', 'Fly to it and perch. The branch is marked in green.', 'perch'],
  ['air', 'Touch and hold, then lean', 'Up: nose up toward a hover, or kiting into the wind. Forward: a longer glide. Down: dive, and far down to stoop. Back: slow down with back-beats; it never turns the hawk. Let go to fly hands off.', 'aim'],
  ['branch', 'Tap beside the hawk', 'Hop along the branch that way.', 'hop'],
  ['branch', 'Swipe down', 'Drop to the branch below.', 'drop'],
  ['branch', 'Swipe up, or three quick taps', 'Take off. Double tap another branch to fly straight there, or draw a line to prey to go after it.', 'takeoff'],
  ['ground', 'Tap', 'Hop toward the tap. Taps spaced out only ever hop.', 'hop'],
  ['ground', 'Tap berries, worms or water', 'Walk there to eat or drink.', 'walkTo'],
  ['ground', 'Swipe down', 'Eat or drink what is at your feet.', 'eat'],
  ['ground', 'Swipe up, or three quick taps', 'Take off.', 'takeoff'],
  ['water', 'Tap', 'Paddle that way.', 'paddle'],
  ['water', 'Tap the water by the hawk', 'Drink. Three sips fill your thirst.', 'drink'],
  ['water', 'Swipe up, or three quick taps', 'Take off.', 'takeoff'],
  ['any', 'Call button', 'The red-tail\'s scream. The longer you hold it, the louder it is; it calls when you let go, or at full voice after a moment and a half.', 'call'],
];
const GROUPS = { air: 'In the air', branch: 'On a branch', ground: 'On the ground', water: 'On the water', any: 'Anywhere' };

export function controlMap() {
  // one wobble for every line, so the ink looks brushed rather than ruled
  let html = '<svg width="0" height="0" style="position:absolute"><filter id="ctl-ink"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="3"/>'
    + '<feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></svg>';
  html += '<p class="ctl-note">Drawn as if the hawk is flying right; flying left, every gesture mirrors. A new gesture replaces the last one, unless the two can work together.</p>';
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
