// A small picture of each songbird, drawn in code as a faceted side view (SVG), from its
// colours and `look` in src/songs.js: size, tail length and cock, crest, owl head, bill, spots,
// bib. One source for every place that shows a songbird: the Songs list while perched and the
// Journal's songs. birdSVG(sp) returns an <svg> string; size it with CSS.
const rgb = (c, k = 1) => `rgb(${c.map(v => Math.round(Math.min(255, v * k))).join(',')})`;
const P = pts => pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
const cache = new Map();

export function birdSVG(sp) {
  if (cache.has(sp.id)) return cache.get(sp.id);
  const L = sp.look, { body, cap, breast } = sp.cols, owl = !!L.owl;
  const poly = (pts, c) => `<polygon points="${P(pts)}" fill="${c}"/>`;
  const out = [];
  // tail: fanned back from the rump, cocked up for a wren
  const tl = 14 * L.tail * (owl ? .6 : 1), ck = L.tail > 1.4 ? 9 : 2;
  out.push(poly([[17, 25], [17 - tl, 24 - ck], [16 - tl, 29 - ck], [18, 30]], rgb(body, .78)));
  // legs on a twig
  out.push(`<path d="M2 44 H62" stroke="${rgb([110, 82, 56])}" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="M30 36 L29 43 M35 36 L36 43" stroke="${rgb([70, 56, 44])}" stroke-width="1.3"/>`);
  // body in facets: back above, breast below, a darker wing over them
  out.push(poly([[15, 26], [22, 17], [38, 15], [46, 21], [31, 24]], rgb(body)));
  out.push(poly([[15, 26], [31, 24], [46, 21], [45, 30], [33, 37], [21, 35]], rgb(breast)));
  out.push(poly([[31, 24], [46, 21], [45, 30]], rgb(breast, .9)));
  out.push(poly([[19, 22], [35, 18.5], [40, 24], [27, 30]], rgb(body, .82)));
  out.push(poly([[19, 22], [27, 30], [17, 27]], rgb(body, .7)));
  if (L.spots) for (const [x, y] of [[30, 29], [35, 27], [38, 31], [33, 33], [41, 27]]) out.push(poly([[x, y], [x + 2, y + 1], [x, y + 2.4]], rgb(body, .55)));
  // head: an owl's is big and round with a pale facial disc; others small, cap on top
  const hx = owl ? 43 : 48, hy = owl ? 15 : 15, r = owl ? 11 : 7.5;
  const ring = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 - Math.PI / 8; return [hx + Math.cos(a) * r, hy + Math.sin(a) * r * .92]; });
  out.push(poly([ring[4], ring[5], ring[6], ring[7], ring[0], [hx, hy]], rgb(cap)));
  out.push(poly([ring[0], ring[1], ring[2], ring[3], ring[4], [hx, hy]], L.bib ? rgb(cap) : rgb(owl ? breast : body, owl ? 1 : .95)));
  out.push(poly([ring[1], ring[2], ring[3], [hx, hy + 1]], rgb(L.bib ? cap : breast, L.bib ? 1 : .96)));
  if (L.crest) out.push(poly([[hx - 2, hy - r * .8], [hx - r - 4, hy - r - 5], [hx + 2, hy - r * .95]], rgb(cap)));
  if (owl) {
    out.push(poly([[hx + 1, hy - 6], [hx + 9, hy - 3], [hx + 9, hy + 6], [hx + 1, hy + 8], [hx - 3, hy + 1]], rgb(breast, 1.08)));
    out.push(`<circle cx="${hx + 4}" cy="${hy}" r="2.2" fill="#1e1612"/><circle cx="${hx + 8.3}" cy="${hy}" r="1.8" fill="#1e1612"/>`);
    out.push(poly([[hx - 4, hy - r * .8], [hx - 7, hy - r - 3], [hx - 1, hy - r * .9]], rgb(cap)));   // ear tuft
  } else out.push(`<circle cx="${hx + 2.5}" cy="${hy - 1.5}" r="1.5" fill="#1e1612"/><circle cx="${hx + 3}" cy="${hy - 2}" r=".5" fill="#fff"/>`);
  // bill
  const bx = owl ? hx + 10 : hx + r * .9, bl = (owl ? 3 : 6) * L.bill, bw = L.thick ? 3.2 : 1.8, by = owl ? hy + 3 : hy;
  out.push(poly([[bx, by - bw], [bx + bl, by + .4], [bx, by + bw]], owl ? '#4a4038' : rgb([60, 50, 44])));
  const s = .8 + .2 * Math.min(1.5, L.size);
  const svg = `<svg viewBox="0 0 64 48" aria-hidden="true"><g transform="translate(32 30) scale(${s.toFixed(2)}) translate(-32 -30)">${out.join('')}</g></svg>`;
  cache.set(sp.id, svg);
  return svg;
}
