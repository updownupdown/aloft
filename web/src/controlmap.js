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
const held = () => dot(32, 34, 4.5) + ring(32, 34, 8, INK, .7) + ring(32, 34, 12, INK, .35);
const lean = (a, o = 1) => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), x = 32 + c * 25, y = 34 + s * 25;
  return `<g opacity="${o}">${line(`M${32 + c * 15} ${34 + s * 15} L${x} ${y}`, INK, 2)}${head(x, y, a, INK, 4.5)}</g>`; };
const three = (x, y) => dot(x, y - 12, 3) + dot(x, y, 3) + dot(x, y + 12, 3);

const DRAW = {
  flap: () => tap(32, 34),
  // a finger held down, and the ways it can lean from there (down and back lands too)
  hold: () => held() + [-90, -45, 0, 45, 90, 180].map(a => lean(a)).join(''),
  leanUp: () => held() + lean(-90), leanUpFwd: () => held() + lean(-45), leanFwd: () => held() + lean(0),
  leanDownFwd: () => held() + lean(45), leanDown: () => held() + lean(90) + lean(135, .45), leanBack: () => held() + lean(180),
  glide: () => dot(12, 36) + line('M12 36 H52') + head(52, 36, 0),
  turn: () => dot(52, 36) + line('M52 36 H12') + head(12, 36, 180) + head(20, 36, 180),
  thermal: () => dot(14, 40, 4, OCHRE) + line('M14 40 H44 Q54 40 54 32 Q54 24 44 24 H18', OCHRE) + head(18, 24, 180, OCHRE),
  flip: () => dot(32, 54) + line('M32 54 C10 54 10 18 32 18 C54 18 54 46 38 50') + head(38, 50, 165),
  hunt: () => dot(12, 14) + line('M12 14 L44 44', RED) + head(44, 44, 45, RED)
    + `<ellipse cx="50" cy="52" rx="6" ry="3.6" fill="${RED}" opacity=".75"/>`,
  food: () => line('M6 54 H58', FAINT, 1.6) + berries(28, 38) + ring(31, 41, 11, RED, .6) + ring(31, 41, 17, RED, .4),
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
  ['air', 'Hold, then lean', 'Keep a finger down a moment (it may move first; it still counts), then lean it from where it came down. The further the lean, the stronger. Holding never turns the hawk.', 'hold'],
  ['air', 'Lean up', 'Hover, kiting into the wind.', 'leanUp'],
  ['air', 'Lean up and forward', 'Glide up, trading speed for height.', 'leanUpFwd'],
  ['air', 'Lean forward', 'The longest glide.', 'leanFwd'],
  ['air', 'Lean down and forward', 'Glide down, gaining speed.', 'leanDownFwd'],
  ['air', 'Lean down, or down and back', 'Settle down and land.', 'leanDown'],
  ['air', 'Lean back', 'Slow down, then hover once slowed.', 'leanBack'],
  ['air', 'Swipe forward', 'A long glide.', 'glide'],
  ['air', 'Swipe back', 'Turn round. Only a clean swipe turns.', 'turn'],
  ['air', 'Swipe forward, then back', 'Ride the thermal you are in, or head for the nearest one and ride it up.', 'thermal'],
  ['air', 'Draw a circle', 'A flip, drawn the way the nose goes: over the top for a loop, under for a front flip. Draw it through a cloud ring nearby and the hawk loops through the ring.', 'flip'],
  ['air', 'Draw a line to a mouse or fish', 'Stoop on it.', 'hunt'],
  ['air', 'Double tap a branch', 'Fly to it and perch.', 'perch'],
  ['air', 'Double tap berries, a worm or a twig', 'Fly down, land and eat it (or pick up the twig).', 'food'],
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
  html += '<p class="ctl-note">Drawn as if the hawk is flying right; flying left, every gesture mirrors. A new gesture replaces the last one, unless the two can work together. A small sign above the hawk confirms each one, and stays while a hold, a ride or a target lasts.</p>';
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
