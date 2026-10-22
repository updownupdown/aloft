# Rasterise Natural Earth land (world-atlas topojson) to a lon/lat mask
import json, sys, numpy as np
from PIL import Image, ImageDraw
src, out, res = sys.argv[1], sys.argv[2], float(sys.argv[3])
T = json.load(open(src))
sx, sy = T['transform']['scale']; tx, ty = T['transform']['translate']
arcs = []
for a in T['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)
def ring(idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts += a[1:] if pts else a
    return pts
W, H = int(360 / res), int(180 / res)
img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
def P(lon, lat): return ((lon + 180) / res, (90 - lat) / res)
geoms = T['objects']['land']['geometries']
for g in geoms:
    polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
    for poly in polys:
        for k, r in enumerate(poly):
            pts = ring(r)
            # unwrap across the antimeridian (Russia/Fiji/Antarctica)
            u = [pts[0]]
            for lon, lat in pts[1:]:
                pl = u[-1][0]
                while lon - pl > 180: lon -= 360
                while lon - pl < -180: lon += 360
                u.append((lon, lat))
            for off in (-360, 0, 360):
                d.polygon([P(lon + off, lat) for lon, lat in u], fill=255 if k == 0 else 0)
# Antarctica polygon in NE wraps to the pole oddly: fill below -78 too
a = np.array(img); a[int((90 + 78) / res):, :] = 255
Image.fromarray(a).save(out)
print(W, H, (a > 127).mean())
