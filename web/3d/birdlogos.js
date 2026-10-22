// Songbird "logos": a small flat picture of each songbird, a few shapes in two to four colours, its
// telling marks drawn big (the chickadee's cap and bib, the robin's breast, the cardinal's crest and
// mask, the jay's blue crest...). Side on, facing right, in a 32x32 box; owls face you. Used by the
// song controls in place of the round portraits. birdLogo(sp) -> an SVG string.
import { SPECIES } from '../src/songs.js';

const INK = '#1d2b36';
// the parts, by species name: body, head (cap), breast colours; the bill; the tail (up, long,
// short); and the marks
const L = {
  Chickadee: { body: '#9a9a90', head: '#f4efe2', breast: '#f4efe2', cap: '#22252a', bib: '#22252a' },
  Robin: { body: '#6b5a49', head: '#33302c', breast: '#e0702e', eyering: 1 },
  Warbler: { body: '#e8cc2c', head: '#e8cc2c', breast: '#f6e04a', wing: '#7a7a30', streaks: '#b25a2a' },
  Wren: { body: '#93673f', head: '#93673f', breast: '#c9a272', tail: 'up', bars: '#5a3e24', brow: '#e2cfa8' },
  Thrush: { body: '#7a6448', head: '#7a6448', breast: '#f1e6cc', spots: '#4a3a2a' },
  Finch: { body: '#8a6a52', head: '#d8443a', breast: '#e86a5c', bill: 'thick', wing: '#6a4a3a' },
  Owl: { owl: 1, body: '#e8dcc6', face: '#fbf6ec', rim: '#c8a070', eyes: INK },
  Lark: { body: '#a08a62', head: '#a08a62', breast: '#efe4c8', crest: INK, streaks: '#6a5640', mask: INK, throat: '#f2d24a' },
  Cardinal: { body: '#c8302a', head: '#d8382e', breast: '#d8382e', crest: '#d8382e', bill: 'thick', billCol: '#f08a3a', mask: INK },
  Meadowlark: { body: '#9a8458', head: '#9a8458', breast: '#f2c636', vee: INK, brow: '#f2c636' },
  'Red-winged blackbird': { body: '#1e1c1c', head: '#1e1c1c', breast: '#1e1c1c', epaulet: ['#e0302a', '#f2c636'], billCol: '#6a6a70', rim: '#4e535e' },
  'Mourning dove': { body: '#b4a290', head: '#b4a290', breast: '#d4beaa', tail: 'long', smallHead: 1, wingSpots: INK, bill: 'short' },
  'Blue jay': { body: '#4a78c8', head: '#4a78c8', breast: '#f2f2ec', crest: '#4a78c8', necklace: INK, wing: '#2f5aa8', wingBars: '#fff' },
  'Song sparrow': { body: '#8a6a50', head: '#8a6a50', breast: '#ece2d0', streaks: '#6a4a30', breastSpot: '#5a3a24', brow: '#d8ccb8' },
  'White-throated sparrow': { body: '#8a6a4a', head: '#2a2a2c', breast: '#c8c4bc', throat: '#fff', crown: '#fff', lore: '#f2c636' },
  Veery: { body: '#b47a48', head: '#b47a48', breast: '#f3e6cf', spots: '#c49060' },
  'Cactus wren': { body: '#7a5a3c', head: '#5a3a24', breast: '#f0e6d2', spots: '#2a1e14', brow: '#fff', bill: 'long', tail: 'up' },
  'Canyon wren': { body: '#9a5a2c', head: '#8a7a6a', breast: '#9a5a2c', throat: '#fbf8f2', bill: 'long', tail: 'up' },
  Ptarmigan: { body: '#f4f2ec', head: '#f4f2ec', breast: '#f4f2ec', comb: '#e0302a', plump: 1, bill: 'short', outline: '#b8b2a6', tail: 'short' },
  Dipper: { body: '#5c5d66', head: '#7a6658', breast: '#5c5d66', eyelid: '#fff', tail: 'short', plump: 1, rim: '#7a7c86' },
  Bellbird: { body: '#6a9a3a', head: '#5a6a9a', breast: '#a8c25a', wing: '#4a6a2a' },
  Nightingale: { body: '#8a6a4c', head: '#8a6a4c', breast: '#e4d6c0', tailCol: '#c0602a', tail: 'long', eyering: 1 },
  'Whip-poor-will': { body: '#7a6650', head: '#7a6650', breast: '#a89070', necklace: '#f4efe2', bill: 'tiny', flatHead: 1, mottle: '#4a3a2a', tail: 'long' },
  'Tawny owl': { owl: 1, body: '#9a6036', face: '#d8a46a', rim: '#6a3a1a', eyes: INK, ears: 0 },
  Starling: { body: '#232630', head: '#232630', breast: '#2a2e3a', stars: '#f4efe2', sheen: '#5a8a6a', bill: 'long', billCol: '#f2c636', tail: 'short', rim: '#4e535e' },
  Mockingbird: { body: '#8c8c88', head: '#8c8c88', breast: '#ecece6', wing: '#4a4a48', wingPatch: '#fff', tail: 'long', tailEdge: '#fff' },
};

// a songbird side on: tail, body, wing, breast, head, bill, eye, then its marks
function songbird(o) {
  const s = [], hx = o.smallHead ? 22 : 21, hy = o.flatHead ? 12.5 : 11, hr = o.smallHead ? 4.2 : o.plump ? 5.4 : 5.6;
  const bodyCol = o.body;
  // the tail
  const tail = o.tail === 'up' ? 'M10 18 L3.5 6.5 L7.5 5.5 L13.5 16 Z'
    : o.tail === 'long' ? 'M11 19 L1 25.5 L2.5 27.5 L13 22 Z'
    : o.tail === 'short' ? 'M10 19 L5 21.5 L6 23.5 L11.5 22 Z'
    : 'M10.5 18.5 L3 23 L4.5 25.5 L12.5 21.5 Z';
  s.push(`<path d="${tail}" fill="${o.tailCol || bodyCol}"/>`);
  if (o.tailEdge) s.push(`<path d="M2.5 26.3 L1.3 25.3" stroke="${o.tailEdge}" stroke-width="1.6" stroke-linecap="round"/>`);
  // the body: a round-bellied egg, plumper for a ptarmigan or a dipper
  const body = o.plump ? 'M8 19 C8 12 14 9.5 20 10.5 C26 11.5 27 18 24 22.5 C21 27 11 27 8 19 Z' : 'M8.5 19 C9 13 14 10.5 19.5 11 C25 11.5 26 17.5 23.5 21.5 C20.5 26 11.5 25.5 8.5 19 Z';
  s.push(`<path d="${body}" fill="${bodyCol}"/>`);
  if (o.outline || o.rim) s.push(`<path d="${body}" fill="none" stroke="${o.outline || o.rim}" stroke-width="1"/>`);
  // the breast: the front and underside
  s.push(`<path d="M17 14.5 C22 13.5 25.5 16.5 24 21 C22 25.5 15 26 12.5 23 C16.5 22 18.5 18.5 17 14.5 Z" fill="${o.breast}"/>`);
  if (o.mottle) for (const [x, y] of [[13, 15], [16, 13.5], [11, 18], [15, 19], [19, 12.5]]) s.push(`<circle cx="${x}" cy="${y}" r="1" fill="${o.mottle}"/>`);
  if (o.spots) for (const [x, y] of [[19.5, 16.5], [22, 17.5], [20, 19.5], [22.5, 20.5], [18, 21.5], [20.5, 22.5]]) s.push(`<circle cx="${x}" cy="${y}" r=".95" fill="${o.spots}"/>`);
  if (o.streaks) for (const [x, y] of [[19.5, 16], [22, 17], [19, 19.5], [21.5, 20.5], [17.5, 22]]) s.push(`<path d="M${x} ${y}l.6 2" stroke="${o.streaks}" stroke-width="1" stroke-linecap="round"/>`);
  if (o.breastSpot) s.push(`<circle cx="21" cy="18" r="1.6" fill="${o.breastSpot}"/>`);
  if (o.vee) s.push(`<path d="M18.5 14.8 L21.5 18.5 L24.6 15.6" fill="none" stroke="${o.vee}" stroke-width="2" stroke-linejoin="round"/>`);
  if (o.stars) for (const [x, y] of [[13, 14.5], [16.5, 13], [12, 18.5], [16, 17.5], [20, 18.5], [18, 22], [14, 21.5]]) s.push(`<circle cx="${x}" cy="${y}" r=".7" fill="${o.stars}"/>`);
  // the wing, folded along the side
  const wing = o.wing || shade(bodyCol, -.18);
  s.push(`<path d="M10.5 16 C13 12.5 18 12.5 19.5 15 C18.5 19 14.5 21.5 9.5 21.5 Z" fill="${wing}"/>`);
  if (o.wingBars) s.push(`<path d="M13 17.5 l4.5 -1.2 M12 19.5 l4.5 -1.2" stroke="${o.wingBars}" stroke-width="1" stroke-linecap="round"/>`);
  if (o.wingPatch) s.push(`<path d="M13.5 16.5 l3.5 -1 l-.5 2.5 l-3.5 1 Z" fill="${o.wingPatch}"/>`);
  if (o.wingSpots) for (const [x, y] of [[14, 16.5], [16.5, 16], [15, 18.5]]) s.push(`<circle cx="${x}" cy="${y}" r=".9" fill="${o.wingSpots}"/>`);
  if (o.bars) for (const x of [12, 14.5, 17]) s.push(`<path d="M${x} 15.5 l-1 4" stroke="${o.bars}" stroke-width="1" stroke-linecap="round"/>`);
  if (o.epaulet) s.push(`<path d="M12.5 15 C14.5 13 17.5 13 18.5 14.5 L13 17 Z" fill="${o.epaulet[0]}"/><path d="M12.6 17 L18.5 14.6 L18.2 15.8 L13 18 Z" fill="${o.epaulet[1]}"/>`);
  if (o.sheen) s.push(`<path d="M11.5 15 C13.5 13 17 12.8 18.5 14" fill="none" stroke="${o.sheen}" stroke-width="1.1" stroke-linecap="round"/>`);
  // the crest, behind the head
  if (o.crest) s.push(`<path d="M${hx - 4} ${hy - 1.5} L${hx - 6.5} ${hy - 7.5} L${hx + 1} ${hy - 4.5} Z" fill="${o.crest}"/>`);
  // the head
  s.push(o.flatHead ? `<ellipse cx="${hx}" cy="${hy}" rx="${hr + .8}" ry="${hr - .9}" fill="${o.head}"/>` : `<circle cx="${hx}" cy="${hy}" r="${hr}" fill="${o.head}"/>`);
  if (o.outline || o.rim) s.push(`<circle cx="${hx}" cy="${hy}" r="${hr}" fill="none" stroke="${o.outline || o.rim}" stroke-width="1"/>`);
  if (o.cap) s.push(`<path d="M${hx - hr} ${hy} A${hr} ${hr} 0 0 1 ${hx + hr} ${hy} Z" fill="${o.cap}"/>`);
  if (o.bib) s.push(`<path d="M${hx + 1} ${hy + 3} L${hx + 5} ${hy + 3.2} L${hx + 2.5} ${hy + 7.5} Z" fill="${o.bib}"/>`);
  if (o.crown) s.push(`<path d="M${hx - 4.5} ${hy - 2} Q${hx} ${hy - 4.5} ${hx + 4.6} ${hy - 1.5}" fill="none" stroke="${o.crown}" stroke-width="1.3" stroke-linecap="round"/><path d="M${hx - 4.8} ${hy + 1} Q${hx} ${hy - 1.5} ${hx + 3.5} ${hy + .3}" fill="none" stroke="${o.crown}" stroke-width="1.1" stroke-linecap="round"/>`);
  if (o.throat) s.push(`<path d="M${hx + .5} ${hy + 2.5} Q${hx + 4.5} ${hy + 2.5} ${hx + 4.8} ${hy + 1} Q${hx + 4} ${hy + 6.5} ${hx} ${hy + 6} Z" fill="${o.throat}"/>`);
  if (o.lore) s.push(`<circle cx="${hx + 3.6}" cy="${hy - 1.6}" r="1" fill="${o.lore}"/>`);
  if (o.brow) s.push(`<path d="M${hx - 3} ${hy - 2.2} L${hx + 3.8} ${hy - 2.4}" stroke="${o.brow}" stroke-width="1.1" stroke-linecap="round"/>`);
  if (o.necklace) s.push(`<path d="M${hx - 1} ${hy + 4.8} Q${hx + 2.5} ${hy + 6.8} ${hx + 5} ${hy + 3.4}" fill="none" stroke="${o.necklace}" stroke-width="1.3" stroke-linecap="round"/>`);
  // the bill
  const bx = hx + hr - .6, by = hy + .3;
  const bill = o.bill === 'thick' ? `M${bx - .5} ${by - 2.4} L${bx + 4} ${by + .2} L${bx - .5} ${by + 2.6} Z`
    : o.bill === 'long' ? `M${bx} ${by - 1} L${bx + 6} ${by + 1.6} L${bx} ${by + 1.2} Z`
    : o.bill === 'short' ? `M${bx} ${by - 1} L${bx + 2.4} ${by + .4} L${bx} ${by + 1.4} Z`
    : o.bill === 'tiny' ? `M${bx} ${by - .5} L${bx + 1.6} ${by + .3} L${bx} ${by + 1} Z`
    : `M${bx} ${by - 1.2} L${bx + 3.6} ${by + .3} L${bx} ${by + 1.5} Z`;
  if (o.mask) s.push(`<path d="M${hx + 1.2} ${hy - 1.6} L${bx + 1} ${by - 2.4} L${bx + 1} ${by + 2.8} L${hx + 1.5} ${hy + 3.5} Z" fill="${o.mask}"/>`);
  s.push(`<path d="${bill}" fill="${o.billCol || INK}"/>`);
  // the eye (a white lid for a dipper, a pale ring for a robin)
  const ex = hx + 1.6, ey = hy - .8;
  if (o.eyering) s.push(`<circle cx="${ex}" cy="${ey}" r="1.6" fill="#f4efe2"/>`);
  s.push(`<circle cx="${ex}" cy="${ey}" r="1.05" fill="${o.mask === INK || o.head === '#1e1c1c' || o.head === '#232630' ? '#f4efe2' : INK}"/>`);
  if (o.eyelid) s.push(`<path d="M${ex - 1.3} ${ey - .4} Q${ex} ${ey - 1.8} ${ex + 1.3} ${ey - .4}" fill="${o.eyelid}"/>`);
  if (o.comb) s.push(`<path d="M${ex - 1.6} ${ey - 1.5} Q${ex} ${ey - 3.6} ${ex + 1.8} ${ey - 1.6} Z" fill="${o.comb}"/>`);
  return s.join('');
}
// an owl facing you: a round body, a round face with two big eyes, a little hooked bill
function owl(o) {
  return `<path d="M7 28 C5 18 8 7 16 6 C24 7 27 18 25 28 Z" fill="${o.body}"/>`
    + `<path d="M9.5 20 C10 24 13 27 16 27 C19 27 22 24 22.5 20 C20 22 12 22 9.5 20 Z" fill="${shade(o.body, .25)}"/>`
    + `<path d="M16 9.5 C11 7.5 6.5 11 7.5 15.5 C8.5 19.5 13 19.5 16 17.5 C19 19.5 23.5 19.5 24.5 15.5 C25.5 11 21 7.5 16 9.5 Z" fill="${o.face}" stroke="${o.rim}" stroke-width="1.3"/>`
    + `<circle cx="12.2" cy="14" r="2.2" fill="${o.eyes}"/><circle cx="19.8" cy="14" r="2.2" fill="${o.eyes}"/>`
    + `<circle cx="12.8" cy="13.4" r=".6" fill="#fff"/><circle cx="20.4" cy="13.4" r=".6" fill="#fff"/>`
    + `<path d="M15 16 L17 16 L16 18.5 Z" fill="#c89a5a"/>`;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return '#' + [n >> 16, n >> 8 & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('');
}

const cache = new Map();
export function birdLogo(sp, cls = 'logo3') {
  const key = sp.id + cls;
  if (!cache.has(key)) {
    const o = L[sp.name] || sp.logo || { body: sp.body, head: sp.cap, breast: sp.breast };
    cache.set(key, `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true">${o.owl ? owl(o) : songbird(o)}</svg>`);
  }
  return cache.get(key);
}
export const allLogos = () => SPECIES.map(sp => [sp, birdLogo(sp)]);
