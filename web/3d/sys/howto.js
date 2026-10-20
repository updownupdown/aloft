// How to play: the controls map (a flat drawing of the two thumbs for each move, beside its
// words), then the ways of the world. Keep the map in step with input.js and flight.js.
const INK = '#3a2418';
const PIG = { water: '#4f7fa6', berry: '#a8483a', ochre: '#b8862f', leaf: '#6f8a4a', indigo: '#4f6f9e', stone: '#8a7a6a' };

// a phone held sideways with a thumb on each side; marks: 'tap', 'up', 'down', 'in', 'out', 'hold',
// 'side' (slid left and right together, for steering a stoop), or none
function thumbs(left, right, col) {
  const mark = (m, x, y, s) => {
    const arrow = (dx, dy) => { const tx = x + dx * 12, ty = y + dy * 12, px = -dy * 3.2, py = dx * 3.2;
      return `<path d="M${x} ${y} L${tx} ${ty} M${tx - dx * 4 + px} ${ty - dy * 4 + py} L${tx} ${ty} L${tx - dx * 4 - px} ${ty - dy * 4 - py}"/>`; };
    if (m === 'tap') return `<circle cx="${x}" cy="${y}" r="7.5" stroke-dasharray="2 2.4"/><circle cx="${x}" cy="${y}" r="11" stroke-opacity=".45" stroke-dasharray="2 3"/>`;
    if (m === 'hold') return `<circle cx="${x}" cy="${y}" r="9"/><path d="M${x + 13} ${y - 2} a13 13 0 1 1 -4 -9" stroke-dasharray="2 2.6"/>`;
    if (m === 'up') return arrow(0, -1);
    if (m === 'down') return arrow(0, 1);
    if (m === 'in') return arrow(s, 0);
    if (m === 'out') return arrow(-s, 0);
    if (m === 'side') { if (s < 0) return ''; const c = x + 7, yy = y + 12;   // one double arrow under both thumbs
      return `<path d="M${c - 17} ${yy} L${c + 17} ${yy} M${c - 13} ${yy - 3.5} L${c - 17} ${yy} L${c - 13} ${yy + 3.5} M${c + 13} ${yy - 3.5} L${c + 17} ${yy} L${c + 13} ${yy + 3.5}"/>`; }
    return '';
  };
  const hex = (x, y) => Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + Math.PI / 6; return `${(x + Math.cos(a) * 6).toFixed(1)},${(y + Math.sin(a) * 6).toFixed(1)}`; }).join(' ');
  const thumb = (x, y, m) => `<polygon points="${hex(x, y)}" fill="${m ? col : 'none'}" fill-opacity=".32" stroke="${INK}" stroke-opacity="${m ? .8 : .35}" stroke-linejoin="miter"/>` +
    `<g stroke="${col}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">${mark(m, x, y, x < 38 ? 1 : -1)}</g>`;
  return `<svg viewBox="0 0 76 50" aria-hidden="true"><polygon points="9,5 67,5 73,11 73,39 67,45 9,45 3,39 3,11" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="1"/>${thumb(left === 'side' ? 31 : 18, left === 'side' ? 22 : 28, left)}${thumb(right === 'side' ? 45 : 58, right === 'side' ? 22 : 28, right)}</svg>`;
}

const MOVES = [
  ['tap', 'tap', PIG.indigo, 'Flap', 'Tap both thumbs together. Wings tire; let them recover in a glide.'],
  ['tap', '', PIG.stone, 'A weaker flap', 'One thumb alone leads with that wing; the other follows lightly. It nudges you round.'],
  ['up', 'up', PIG.water, 'Climb', 'Both thumbs up. Climbing costs speed.'],
  ['down', 'down', PIG.water, 'Dive', 'Both thumbs down. Diving earns speed. (Invert in Settings swaps the two.)'],
  ['up', 'down', PIG.leaf, 'Bank and turn', 'One up, one down: you turn toward the lower thumb, like tipping your wings.'],
  ['in', 'in', PIG.berry, 'Tuck and stoop', 'Slide your thumbs together. The faint aim dots focus on one spot: dive at a mouse.'],
  ['side', 'side', PIG.berry, 'Steer the stoop', 'Wings tucked, slide both thumbs left or right together to steer the dive onto its mark.'],
  ['out', 'out', PIG.ochre, 'Flare and land', 'Slide them apart. You slow, hover with flaps, and drop your feet to land.'],
  ['hold', '', PIG.ochre, 'Ride a thermal', 'Inside rising air, hold a thumb still: the hawk circles the lift on its own.'],
];

export function howtoSystem(G) {
  const pane = G.menu.tab('how', 'How to play');
  pane.innerHTML = `<p><b>Your two thumbs are your wings.</b> Put one on each side of the screen; each becomes a stick where it lands.</p>
    <div class="ctl3">${MOVES.map(([l, r, c, t, s]) => `<figure>${thumbs(l, r, c)}<figcaption><span>${t}</span><span>${s}</span></figcaption></figure>`).join('')}</div>
    <h3>Food, water and rest</h3>
    <ul class="how">
      <li><b>Mice</b> twitch the grass in open meadows. Dive at one and come in low; your feet reach for it. The aim ring turns berry-red on a mouse.</li>
      <li><b>Drink</b> by landing at the water’s edge or on the water. Food lasts about five minutes, water about seven. Nothing bad happens when they run low; your wings just recover more slowly.</li>
      <li>Slow down into a tree’s crown and you settle on one of its <b>limbs</b>. Trunks are hard. The aim ring is sage where a landing would be soft.</li>
    </ul>
    <h3>The air</h3>
    <ul class="how">
      <li>Motes under a cloud mark a <b>thermal</b>. Windward slopes lift too.</li>
      <li>Fly through the <b>golden rings</b> for a burst of speed.</li>
    </ul>
    <h3>The journey and the year</h3>
    <ul class="how">
      <li>The day turns on the dial (top right), and the seasons every eight days. In autumn, follow the hawks <b>south</b> to the wintering marsh, and home again in spring. The <b>Journal</b> keeps your map, your route and the <b>landmarks</b> you find; each one sends a postcard to the album.</li>
      <li>Twigs lie under some broadleaf trees. Land beside one to pick it up, then perch on a branch to start a <b>nest</b>. Five twigs and there is an egg; when it hatches, keep part of each mouse you catch and carry it home. Five meals and your chick <b>fledges</b> and flies with you.</li>
      <li>Keep well fed and watered and flap cleanly, and your hawk grows <b>healthy</b>: after the first migration its tail turns a deep brick red.</li>
      <li>Rare <b>keepsakes</b> glint in the grass: land beside one to keep it. In the wintering marsh a hawk may come to look you over. A red tail, keepsakes, songs you know and <b>acrobatics</b> (a full-speed stoop, a wingover: bank hard one way, then the other) win it as your <b>mate</b>, who flies with you and helps feed your chick.</li>
      <li>Animals you see up close get a page in the <b>field guide</b>, with a portrait from that moment.</li>
      <li><b>Photo mode</b> (Settings) holds the world still: drag to swing round the hawk, pinch to come closer.</li>
    </ul>
    <p><small>Keyboard: W/S climb and dive, A/D bank, Shift tuck, E flare, Space flap, P or Esc for this menu.</small></p>`;
  return { id: 'howto' };
}
