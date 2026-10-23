// How to play, in five pages (the fifth, Hints, is hints.js): Controls (each move as the thumbs doing it beside the hawk doing it,
// both moving), Food, water and rest, The air, and The journey (small animated scenes beside the
// words). Keep the moves in step with input.js and flight.js. The scenes are SVG, moved by the
// .how3 keyframes in 3d.css; the hawks in Controls are the bird lab's renderer (birdlab.js), drawn
// only while that page shows.
import { startLab } from '../birdlab.js';
import { hintsPage } from '../hints.js';

const INK = '#1d2b36';
const PIG = { water: '#4f7fa6', berry: '#a8483a', ochre: '#b8862f', leaf: '#6f8a4a', indigo: '#4f6f9e', stone: '#8a7a6a' };

// a phone held sideways with a thumb on each side; marks: 'tap', 'up', 'down', 'in', 'out', a pair
// such as 'out up' (a diagonal: wing spread and raised), 'hold', 'side' (slid left and right
// together, for steering a stoop), 'ccw' / 'cw' (a full circle from down on the left or up on the
// right, or the other way round), or none. The thumb moves as the mark says, over and over.
// a mark's way on the screen ([x, y], y down) for the thumb on side s (1 left, -1 right): in is
// toward the middle; a pair adds up, at a diagonal
function dir(m, s) {
  const D = { up: [0, -1], down: [0, 1], in: [s, 0], out: [-s, 0] }, parts = (m || '').split(' ');
  if (!parts.every(k => D[k])) return null;
  const v = parts.reduce((a, k) => [a[0] + D[k][0], a[1] + D[k][1]], [0, 0]), l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}
function thumbs(left, right, col) {
  const mark = (m, x, y, s) => {
    const arrow = (dx, dy) => { const tx = x + dx * 12, ty = y + dy * 12, px = -dy * 3.2, py = dx * 3.2;
      return `<path d="M${x} ${y} L${tx} ${ty} M${tx - dx * 4 + px} ${ty - dy * 4 + py} L${tx} ${ty} L${tx - dx * 4 - px} ${ty - dy * 4 - py}"/>`; };
    if (m === 'tap') return `<circle cx="${x}" cy="${y}" r="11" stroke-opacity=".45" stroke-dasharray="2 3"/>`;
    if (m === 'hold') return `<path d="M${x + 13} ${y - 2} a13 13 0 1 1 -4 -9" stroke-dasharray="2 2.6"/>`;
    if (m === 'ccw' || m === 'cw') {   // a dashed circle, a chevron where the thumb sets off, pointing its way
      const ay = (s > 0) === (m === 'ccw') ? 1 : -1, cx = x, cy = y + ay * 9, k = (m === 'ccw' ? 1 : -1) * ay * 3.2;
      return `<circle cx="${x}" cy="${y}" r="9" stroke-dasharray="2 2.6"/><path d="M${cx - k} ${cy - 3.2} L${cx} ${cy} L${cx - k} ${cy + 3.2}"/>`;
    }
    const d = dir(m, s);
    if (d) return arrow(d[0], d[1]);
    if (m === 'side') { if (s < 0) return ''; const c = x + 7, yy = y + 12;   // one double arrow under both thumbs
      return `<path d="M${c - 17} ${yy} L${c + 17} ${yy} M${c - 13} ${yy - 3.5} L${c - 17} ${yy} L${c - 13} ${yy + 3.5} M${c + 13} ${yy - 3.5} L${c + 17} ${yy} L${c + 13} ${yy + 3.5}"/>`; }
    return '';
  };
  const thumb = (x, y, m) => {
    const s = x < 38 ? 1 : -1, d = dir(m, s) || [0, 0], dx = d[0] * 9, dy = d[1] * 9;
    const marks = `<g stroke="${col}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55">${mark(m, x, y, s)}</g>`;
    if (m === 'ccw' || m === 'cw') {   // the thumb goes round its circle
      const ay = (s > 0) === (m === 'ccw') ? 1 : -1;
      return marks + `<g class="th orb-${m}" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y + ay * 9}" r="6.5" fill="${col}" fill-opacity=".45" stroke="${INK}" stroke-opacity=".8"/></g>`;
    }
    return marks + `<g class="th ${m ? 'mv-' + m.replace(' ', '-') : ''}" style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px"><circle cx="${x}" cy="${y}" r="6.5" fill="${m ? col : 'none'}" fill-opacity=".45" stroke="${INK}" stroke-opacity="${m ? .8 : .35}"/></g>`;
  };
  return `<svg viewBox="0 0 76 50" aria-hidden="true"><rect x="3" y="5" width="70" height="40" rx="8" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="1"/>${thumb(left === 'side' ? 31 : 18, left === 'side' ? 22 : 28, left)}${thumb(right === 'side' ? 45 : 58, right === 'side' ? 22 : 28, right)}</svg>`;
}

// [left thumb, right thumb, colour, title, words, the hawk's pose in the bird lab]. Each thumb is a
// wing: up raises it, down lowers it, out (toward the screen's edge) spreads it wide, in (toward the
// middle) folds it against the body. In step with input.js and flight.js.
const MOVES = [
  ['', '', PIG.stone, 'Glide', 'Let go: the hawk trims to its best glide, sinking slowly.', 'glide'],
  ['tap', 'tap', PIG.indigo, 'Flap', 'Tap both thumbs together. Wings tire; let them recover in a glide.', 'flap'],
  ['tap', '', PIG.stone, 'A weaker flap', 'One thumb alone leads with that wing; the other follows lightly. It nudges you round.', 'lead'],
  ['up', 'up', PIG.water, 'Climb', 'Both wings up. Climbing costs speed.', 'climb'],
  ['out up', 'out up', PIG.ochre, 'Float and hover', 'Spread and up: a slow float in to land. Slow right down and you hover on beating wings, which tires them.', 'hover'],
  ['out', 'out', PIG.ochre, 'Soar', 'Spread wide: slow and buoyant, turning tight. In rising air, tip one thumb a little lower to circle inside it and climb.', 'soar'],
  ['out down', 'out down', PIG.ochre, 'Brake and land', 'Spread and down: the wings dump lift and you sink gently, feet out, onto a perch or the ground.', 'flare'],
  ['down', 'down', PIG.water, 'Dive', 'Both wings down: nose down, earning speed. (Invert in Settings swaps up and down.)', 'dive'],
  ['in', 'in', PIG.berry, 'Fast glide', 'Fold both in: less drag, a fast glide from one thermal to the next.', 'fast'],
  ['in down', 'in down', PIG.berry, 'Stoop', 'Folded and down: a steep, fast stoop. The aim line focuses on one spot: dive at a mouse.', 'stoop'],
  ['in up', 'in up', PIG.berry, 'Zoom', 'Folded and up: a swept climb that holds its speed. Swoop up out of a stoop.', 'zoom'],
  ['side', 'side', PIG.berry, 'Steer the stoop', 'Wings folded, slide both thumbs left or right together to steer the dive onto its mark.', 'steer'],
  ['up', 'down', PIG.leaf, 'Bank and turn', 'One up, one down: you turn toward the lower wing.', 'bank'],
  ['ccw', 'ccw', PIG.leaf, 'Barrel roll', 'Left down and right up, then turn both a full circle anticlockwise together: a roll to the left. Left up, right down, clockwise: to the right.', 'barrel'],
];

// ---- the scenes: 160 x 90, flat facets in the world's colours ----------------------------------
const HAWK = '<symbol id="hk3" viewBox="0 0 100 60"><polygon points="50,8 45,16 55,16" fill="#4a3628"/><polygon points="45,16 30,14 6,20" fill="#5b4433"/><polygon points="45,16 6,20 14,27" fill="#3e2c20"/><polygon points="45,16 14,27 43,28" fill="#30221a"/><polygon points="55,16 70,14 94,20" fill="#4a3628"/><polygon points="55,16 94,20 86,27" fill="#33251b"/><polygon points="55,16 86,27 57,28" fill="#271b14"/><polygon points="45,16 55,16 50,34" fill="#3a2a20"/><polygon points="45,16 43,28 50,34" fill="#2e2118"/><polygon points="55,16 57,28 50,34" fill="#251a13"/><polygon points="47,31 53,31 56,44" fill="#b8552f"/><polygon points="47,31 56,44 44,44" fill="#963f22"/></symbol>';
const sky = (a = '#cfe1ec', b = '#eef2ea') => `<rect width="160" height="90" fill="${b}"/><polygon points="0,0 160,0 0,50" fill="${a}"/><polygon points="160,0 160,40 0,50" fill="${a}" opacity=".6"/>`;
const hills = (y = 64) => `<polygon points="0,${y} 30,${y - 8} 58,${y - 2} 92,${y - 10} 124,${y - 3} 160,${y - 9} 160,90 0,90" fill="#b6c99a"/><polygon points="0,${y + 10} 40,${y + 4} 80,${y + 11} 120,${y + 5} 160,${y + 10} 160,90 0,90" fill="#8fae6c"/>`;
const hawk = (cls, x, y, w = 26, rot = 0) => `<g class="${cls}"><use href="#hk3" x="${x - w / 2}" y="${y - w * .3}" width="${w}" height="${w * .6}" transform="rotate(${rot} ${x} ${y})"/></g>`;
const tree = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><polygon points="-2,0 2,0 1.4,-26 -1.4,-26" fill="#6b4a33"/><polygon points="1,-14 16,-19 16,-17 1,-12" fill="#6b4a33"/><polygon points="-14,-22 0,-44 14,-24 6,-18 -8,-18" fill="#7f9a4e"/><polygon points="0,-44 14,-24 4,-30" fill="#6f8a42"/></g>`;
const SCENES = {
  mice: `${sky()}${hills(60)}<g class="grass"><polygon points="96,74 98,66 100,74" fill="#6f8a42"/><polygon points="104,75 107,64 109,75" fill="#6f8a42"/><polygon points="114,74 116,67 118,74" fill="#6f8a42"/></g>
    <g class="mouse3"><ellipse cx="107" cy="75" rx="5" ry="3" fill="#8a7a6a"/><circle cx="111" cy="73.5" r="2" fill="#8a7a6a"/><path d="M102 75q-5 1-7 -2" stroke="#8a7a6a" fill="none" stroke-width="1"/></g>
    <circle class="aim3" cx="107" cy="75" r="8" fill="none" stroke="#c0533f" stroke-width="1.6"/>${hawk('h dive3', 30, 18, 26, 125)}`,
  drink: `${sky()}${hills(58)}<polygon points="70,74 112,70 150,74 136,82 84,82" fill="#5f8fb6"/><polygon points="84,82 136,82 120,86 96,86" fill="#4f7fa6"/>
    <ellipse class="ripple3" cx="86" cy="75" rx="6" ry="1.6" fill="none" stroke="#fff" stroke-width=".8"/>${hawk('h drink3', 30, 20, 24, 150)}`,
  perch: `${sky()}${hills(66)}${tree(108, 84, 1.25)}${hawk('h perch3', 20, 22, 22, 100)}`,
  thermal: `${sky('#c7dceb')}<g fill="#fff"><polygon points="60,18 74,8 90,10 102,18 92,24 66,24"/><polygon points="74,8 90,10 82,16" fill="#f1f4f6"/></g>${hills(70)}
    <g class="motes3" fill="#fff"><circle cx="74" cy="64" r="1.2"/><circle cx="84" cy="58" r="1"/><circle cx="90" cy="66" r="1.2"/><circle cx="78" cy="50" r="1"/></g>${hawk('h circle3', 82, 40, 22, 0)}`,
  ring: `${sky()}${hills(66)}<ellipse cx="96" cy="40" rx="8" ry="16" fill="none" stroke="#fff" stroke-width="5" stroke-opacity=".9"/><ellipse cx="96" cy="40" rx="8" ry="16" fill="none" stroke="#dfe7ee" stroke-width="2" stroke-dasharray="5 4"/>
    <g class="streak3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"><path d="M112 34h14M112 42h20M112 50h12"/></g>${hawk('h ring3', 20, 40, 24, 90)}`,
  slope: `${sky()}<polygon points="0,90 0,70 70,62 120,34 160,30 160,90" fill="#b6c99a"/><polygon points="70,62 120,34 104,62" fill="#a5bb87"/><polygon points="0,90 0,80 80,78 160,64 160,90" fill="#8fae6c"/>
    <g class="wind3" stroke="#4f7fa6" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M10 60q30 -2 52 -6t30 -18"/><path d="M14 48q24 -2 44 -6t26 -16"/></g>${hawk('h lift3', 108, 22, 22, 80)}`,
  south: `<rect width="160" height="90" fill="#e4ebef"/><polygon points="0,0 160,0 160,22 0,26" fill="#8fae6c"/><polygon points="0,26 160,22 160,62 0,66" fill="#b6c99a"/><polygon points="0,66 160,62 160,90 0,90" fill="#9cc0c8"/>
    <text x="8" y="14" font-size="8" font-weight="700" fill="#1d2b36">N  ice</text><text x="8" y="84" font-size="8" font-weight="700" fill="#1d2b36">S  ice</text>
    <path class="route3" d="M80 10q-26 18 -6 34t4 36" fill="none" stroke="#1d2b36" stroke-width="1.6" stroke-dasharray="3 3"/>${hawk('h south3', 80, 12, 18, 180)}`,
  nest: `${sky()}${hills(70)}${tree(80, 90, 1.7)}
    <g class="twigs3" stroke="#8a5a32" stroke-width="1.6" stroke-linecap="round"><path d="M88 62l12 -2"/><path d="M90 64l10 -5"/><path d="M89 60l13 1"/><path d="M91 63l10 0"/></g>
    <ellipse class="egg3" cx="96" cy="59" rx="2.2" ry="2.8" fill="#eef0e6" stroke="#b8b09c" stroke-width=".5"/>${hawk('h twig3', 30, 74, 18, 60)}`,
  mate: `${sky('#d6e4ee')}${hills(68)}${hawk('h mateA3', 70, 36, 24, 0)}${hawk('h mateB3', 96, 44, 20, 0)}`,
  keepsake: `${sky()}${hills(56)}<polygon class="glint3" points="100,72 103,66 106,72 103,78" fill="#fff4c2" stroke="#d9a33a" stroke-width=".8"/>${hawk('h keep3', 30, 20, 22, 130)}`,
};
const scene = id => `<svg class="scene3 sc-${id}" viewBox="0 0 160 90" aria-hidden="true">${SCENES[id]}</svg>`;
const card = (id, title, text) => `<figure class="how3">${scene(id)}<figcaption><b>${title}</b><span>${text}</span></figcaption></figure>`;

export function howtoSystem(G) {
  const P = (id, title, order) => G.menu.page('how', id, title, order);
  const controls = P('controls', 'Controls', 10), food = P('food', 'Food, water and rest', 20), air = P('air', 'The air', 30), trip = P('journey', 'The journey', 40);
  G.menu.tab('how').insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${HAWK}</defs></svg>`);
  controls.innerHTML = `<p><b>Your two thumbs are your wings.</b> Put one on each side of the screen; each becomes a stick where it lands.</p>
    <div class="ctl3"><canvas aria-hidden="true"></canvas>${MOVES.map(([l, r, c, t, s, mode]) => `<figure>${thumbs(l, r, c)}<span class="pic" data-mode="${mode}"></span><figcaption><span>${t}</span><span>${s}</span></figcaption></figure>`).join('')}</div>
    <p><small>Keyboard: W/S climb and dive, A/D bank, Shift fold (with S to stoop), E spread, Space flap, Z/X barrel roll, P or Esc for this menu.</small></p>`;
  food.innerHTML = `<div class="hows3">
    ${card('mice', 'Mice', 'Mice twitch the grass, thickest round old farms and barns; small white marks over the grass are one squeaking. Dive at one and come in low: your feet reach for it, and the aim line turns red when you are lined up. Tap Eat (bottom right) to eat it, or carry it off: on a branch it is a calmer meal, and at your nest it drops in. In late summer and autumn, perch on a bush in fruit and Eat picks a beakful of berries.')}
    ${card('drink', 'Drink', 'Tap the water to drink: at its edge, floating on it, or a puddle after rain. The sea is salt; on islands, drink from the rain pools in the rock. Food lasts about twenty minutes, water nearly half an hour. When a bar runs low it warms and breathes, and your wings no longer fill all the way.')}
    ${card('perch', 'Perch, rest and sleep', 'Fly slowly into a tree’s crown where a branch shows a green ring and you settle on it. Trunks are hard. Perched, tap another green ring to hop across, or the ground to glide down to it. Take off is bottom right; at night Sleep sits beside it, and the night passes under the stars with your wings full by morning. The ground is too exposed to sleep on.')}
  </div>`;
  air.innerHTML = `<div class="hows3">
    ${card('thermal', 'Thermals', 'Leaves spiralling under a cloud mark rising air. Fly in, spread your wings wide and tip one a little lower to circle in it. Red chevrons by your height show the lift: steer toward where they grow.')}
    ${card('slope', 'Slopes', 'Wind blowing up a slope lifts you too. Fly along the windward side of a ridge.')}
    ${card('ring', 'Rings', 'Fly through the rings of cloud for a burst of speed.')}
  </div>`;
  trip.innerHTML = `<div class="hows3">
    ${card('south', 'The whole Earth', 'The world is a small Earth: every continent, the oceans narrowed so they can be crossed, the ice at either end. Fly east or west long enough and you come round to where you began. The day turns on the dial, top right, with the date; the season is the place’s own, so the north has summer while the south has winter. The Map shows where you have been; the Journal keeps the countries and landmarks you find.')}
    ${card('nest', 'A nest', 'Twigs lie under some broadleaf trees. Land beside one to pick it up, then perch on a branch to start a nest. Five twigs and there is an egg; when it hatches, bring it food: land at the nest with a catch in your feet and it drops in. Five meals and your chick fledges.')}
    ${card('mate', 'A mate', 'Keep well fed and watered and your hawk grows healthy: after its first year its tail turns deep red. In spring a hawk may come to look you over. A red tail, keepsakes, songs and acrobatics (a full stoop, a wingover) win it as your mate.')}
    ${card('keepsake', 'Keepsakes and pictures', 'Rare keepsakes glint in the grass: land beside one to keep it. Animals seen up close get a page in the field guide. Photo mode (Game, in this menu) holds the world still for a picture to share or save.')}
  </div>`;
  hintsPage(G);
  // the hawks of the controls page fly only while it shows
  let shown = false, tab = '';
  const look = () => { shown = G.menu.open && tab === 'how' && !controls.classList.contains('hidden'); };
  G.on('menuTab', id => { tab = id; look(); }); G.on('menuPage', look); G.on('resume', () => { shown = false; });
  const grid = controls.querySelector('.ctl3');
  startLab(grid.querySelector('canvas'), [...grid.querySelectorAll('.pic')], el => el.dataset.mode, { active: () => shown, eye: [0, .7, 1.6] });
  return { id: 'howto' };
}
