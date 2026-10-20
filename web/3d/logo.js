// Aloft's mark (icon B, James's pick): a red-tail high over three bands of low hills under a
// pale sky, the upper sky a little frosted. Drawn on a 2D canvas at any size: the app icons
// (tools/icon.html) and the logo by the menu's title.
const SKY = ['#8fbadb', '#e9efe9'], HILLS = [
  ['#b6c99a', [[0, 70], [18, 62], [34, 68], [52, 58], [70, 66], [86, 59], [100, 64]]],
  ['#8fae6c', [[0, 80], [22, 72], [40, 79], [62, 70], [82, 78], [100, 73]]],
  ['#6f9152', [[0, 90], [26, 84], [50, 90], [74, 83], [100, 89]]],
];
// the hawk from below, in a 200-unit box centred on (100, 60)
const HAWK = [[100, 22], [106, 31], [152, 27], [186, 37], [196, 40], [186, 43], [197, 47], [185, 49], [194, 54], [182, 54], [188, 59], [174, 58], [118, 66],
  [124, 88], [100, 97], [76, 88], [82, 66], [26, 58], [12, 59], [18, 54], [6, 54], [15, 49], [3, 47], [14, 43], [4, 40], [14, 37], [48, 27], [94, 31]];

// draw the mark into a square of side s at (x0, y0); round: corner radius as a fraction of s
export function drawLogo(x, s, { x0 = 0, y0 = 0, round = 0 } = {}) {
  x.save(); x.translate(x0, y0); x.scale(s / 100, s / 100);
  x.beginPath(); round ? x.roundRect(0, 0, 100, 100, round * 100) : x.rect(0, 0, 100, 100); x.clip();
  const g = x.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, SKY[0]); g.addColorStop(1, SKY[1]);
  x.fillStyle = g; x.fillRect(0, 0, 100, 100);
  for (const [col, pts] of HILLS) {
    x.beginPath(); x.moveTo(0, 100); for (const [px, py] of pts) x.lineTo(px, py); x.lineTo(100, 100); x.closePath();
    x.fillStyle = col; x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(0, 0, 100, 44);
  // the hawk, a quarter of its box wide, a third of the way down
  x.translate(50, 36); x.scale(.25, .25); x.translate(-100, -60);
  x.beginPath(); HAWK.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
  x.fillStyle = '#3a2a20'; x.fill();
  x.restore();
}
