# Bakes Aloft's Earth: Natural Earth coastlines warped onto the game's wrapping strip (oceans
# narrowed, Europe enlarged; a smooth, shape-keeping warp), then biomes from simple climate rules,
# hand-placed mountain ranges and sites, and continents. Writes web/3d/earthdata.js, read by
# web/3d/earth.js. Needs Python 3 with numpy, Pillow and scipy, and the land outline:
#   npm pack world-atlas@2.0.2 && tar xzf world-atlas-2.0.2.tgz      (public domain, Natural Earth)
#   py -3 tools/earth/mask.py package/land-10m.json tools/earth/land10.png 0.1
#   py -3 tools/earth/bake.py tools/earth/land10.png
# and the great lakes and rivers (public domain, Natural Earth 10m), saved beside this script:
#   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson
#   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson
# The warp: CP pins real places (lon, lat) to spots on the strip (u, v), in units of 4/3 km, u east
# from the wrap seam, v south from the north edge. Move a pin, bake, look at earth-preview.png.
import sys, os, json, base64, numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from scipy.spatial import cKDTree
from PIL import ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
land = np.array(Image.open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'land10.png'))) > 127
RES = 180 / land.shape[0]
W, H = 72.0, 46.0                 # the strip in units
KM = 96 / 72                      # km per unit: the world is 96 km round
X0, Z0 = -48000.0, -H / 2 * KM * 1000   # metres of the strip's north-west corner (x east, z south)
SEAM = 3300                       # open sea kept either side of the wrap seam, metres
CP = [
 # North America
 (-165, 64, 4.5, 6), (-156, 71, 6.5, 3.6), (-135, 69, 10, 4), (-123, 49, 10.3, 10.3), (-122.4, 37.7, 10.8, 13.4),
 (-110, 23, 13.8, 18), (-85, 60, 17, 6.6), (-87.6, 41.9, 17.4, 12.3), (-74, 40.7, 21.8, 12.8), (-60, 54, 24.5, 8.2),
 (-80, 25.5, 20.4, 17.2), (-80, 9, 20.5, 22), (-105, 40, 14, 12.4), (-97, 30, 16.2, 15.7), (-155.5, 19.6, 1.5, 19.5),
 # South America
 (-77, -12, 17.8, 28.2), (-35, -8, 27.6, 28), (-43, -23, 25.2, 32.2), (-58, -34.6, 22, 35.4), (-67, -55.9, 19.6, 41),
 (-72, -40, 18.6, 37), (-60, -3, 22, 26.6), (-75, 10.5, 20.6, 22),
 # Greenland, Iceland
 (-44, 60, 26.3, 6.2), (-35, 82, 28, 1.0), (-19, 65, 28.2, 4),
 # Europe (large)
 (-10, 53, 30.1, 9.9), (-9, 38.7, 30.5, 17.7), (-5.6, 36, 31.8, 19.0), (2.3, 48.8, 34.4, 12.8), (12.5, 41.9, 38.3, 16.8),
 (13.4, 52.5, 38.3, 11.2), (5.3, 60.4, 35.7, 6.7), (25.8, 71, 41.7, 1.6), (25, 60, 41.7, 5.7), (23.7, 38, 41.7, 18.0),
 (29, 41, 43.8, 16.2), (37.6, 55.7, 46.4, 8.5), (60, 58, 50.8, 7.4), (41.6, 41.6, 47.7, 16.0), (-3, 58.5, 32.2, 7.3),
 # Africa
 (10, 37, 37.5, 19.6), (-7.6, 33.6, 31.4, 20.4), (-17.4, 14.7, 30.6, 25.2), (31, 30, 44, 20.6), (3.4, 6.5, 35.2, 27.5),
 (51, 11.8, 49.5, 25.4), (15.3, -4.3, 38.5, 30), (18.4, -34, 39.6, 37.6), (47, -19, 47.4, 33.6), (39.7, -4, 45.6, 30), (20, 20, 39, 23),
 # Middle East, Asia
 (46.7, 24.6, 49.6, 21.2), (51.4, 35.7, 51.4, 17.8), (67, 25, 53.8, 20.6), (72.8, 19, 54.6, 22.6), (77.5, 8, 55.6, 25.6),
 (77, 28.6, 55.7, 20), (87, 28, 57.1, 19.4), (70, 48, 53.8, 12.5), (80, 65, 54.2, 5), (108, 53, 59.2, 9.5), (116.4, 39.9, 61.3, 15),
 (121.5, 31.2, 62.4, 17.4), (114, 22.3, 61, 20.2), (100.5, 13.7, 59.2, 22.5), (103.8, 1.3, 60, 25.8), (139.7, 35.7, 64.9, 15.2),
 (158, 56, 66.5, 9), (190, 66, 68.2, 4.6), (130, 70, 62.4, 3.2), (100, 75, 58.3, 1.8), (95, 40, 57.9, 14.8),
 # Indonesia, Australia, NZ
 (110, -7, 60.6, 28), (141, -5, 65, 27.6), (115.8, -32, 58.8, 35.4), (151.2, -33.9, 64.8, 36), (131, -12.5, 62.3, 30.2),
 (145, -38, 63.6, 37.6), (174.8, -41, 67.4, 38.4), (167, -46, 66.2, 40),
 # the high Arctic held small, up against the sea ice
 (-100, 76, 13.5, 1.3), (-75, 72, 19.5, 2.4), (60, 76, 50, 1.0), (140, 74, 63.5, 1.5), (-115, 72, 10.5, 2.4),
 # Antarctica and the Southern Ocean
 (-60, -64, 24.2, 42.8), (0, -70, 37, 44.6), (90, -67, 54, 44.6), (180, -77, 72, 45.2), (-120, -73, 6, 45),
]
lon = np.array([c[0] for c in CP], float); lat = np.array([c[1] for c in CP], float)
q = np.array([c[2] + 1j * c[3] for c in CP])
merc = lambda lo, la: np.radians(lo) - 1j * np.log(np.tan(np.pi / 4 + np.radians(la) / 2))   # x east, y south
p = merc(lon, lat)
Q = np.concatenate([q - W, q, q + W]); P = np.concatenate([p - 2 * np.pi, p, p + 2 * np.pi])   # one turn of u is one of longitude
def warp(v):
    # moving least squares, similarity (conformal and smooth): strip point -> Mercator point
    v = np.asarray(v); out = np.empty(v.shape, complex); fv = v.ravel(); fo = out.ravel()
    for s in range(0, fv.size, 20000):
        x = fv[s:s + 20000][:, None]
        w = 1 / (np.abs(x - Q[None]) ** 2 + 3.0)
        sw = w.sum(1, keepdims=True); qs = (w * Q).sum(1, keepdims=True) / sw; ps = (w * P).sum(1, keepdims=True) / sw
        qh = Q[None] - qs; ph = P[None] - ps
        a = (w * np.conj(qh) * ph).sum(1, keepdims=True) / (w * np.abs(qh) ** 2).sum(1, keepdims=True)
        fo[s:s + 20000] = ((x - qs) * a + ps)[:, 0]
    return out
def lonlat(m):
    return (np.degrees(m.real) + 540) % 360 - 180, np.degrees(2 * np.arctan(np.exp(-m.imag)) - np.pi / 2)
def grid(step):
    # nodes every step metres from the corner, covering the strip
    nx, nz = int(round(W * KM * 1000 / step)), int(np.ceil(H * KM * 1000 / step)) + 1
    xs = X0 + np.arange(nx) * step; zs = Z0 + np.arange(nz) * step
    X, Z = np.meshgrid(xs, zs)
    return X, Z, (X - X0) / (KM * 1000) + 1j * (Z - Z0) / (KM * 1000)

# ---- land and the distance to the coast (62.5 m, then every fourth node) -------------------------
FINE = 62.5
X, Z, UV = grid(FINE)
print('warping', X.shape)
glon, glat = lonlat(warp(UV))
iy = np.clip(((90 - glat) / RES).astype(int), 0, land.shape[0] - 1); ix = ((glon + 180) / RES).astype(int) % land.shape[1]
L = land[iy, ix]
L[np.abs(X) > 48000 - SEAM] = False
NZF, NXF = L.shape
def _xyz(lo, la):
    lo = np.radians(lo); la = np.radians(la); return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
_fine = cKDTree(_xyz(glon.ravel(), glat.ravel()))
def to_px(coords):
    # real (lon, lat) points -> fine-grid pixels (i east, j south), refined past the nearest node
    c = np.asarray(coords, float)[:, :2]; k = _fine.query(_xyz(c[:, 0], c[:, 1]))[1]; i, j = k % NXF, k // NXF
    i1, j1 = np.clip(i, 1, NXF - 2), np.clip(j, 1, NZF - 2)
    dlo = lambda a, b: (a - b + 540) % 360 - 180
    a = dlo(glon[j1, i1 + 1], glon[j1, i1 - 1]) / 2; b = dlo(glon[j1 + 1, i1], glon[j1 - 1, i1]) / 2
    cc = (glat[j1, i1 + 1] - glat[j1, i1 - 1]) / 2; d = (glat[j1 + 1, i1] - glat[j1 - 1, i1]) / 2
    r0 = dlo(c[:, 0], glon[j, i]); r1 = c[:, 1] - glat[j, i]; det = a * d - b * cc
    ok = np.abs(det) > 1e-12; det = np.where(ok, det, 1)
    di = np.where(ok, (r0 * d - b * r1) / det, 0); dj = np.where(ok, (a * r1 - cc * r0) / det, 0)
    return np.stack([i + np.clip(di, -1.5, 1.5), j + np.clip(dj, -1.5, 1.5)], 1)
# ---- the great lakes (Natural Earth, scale rank 0 to 2 and a few more): water in the land, at the
# sea's level, fresh unless salt (alkaline, or named). Each is dilated a node so the small ones show.
SALT = {'Great Salt Lake', 'Dead Sea', 'North Aral Sea', 'South Aral Sea', 'Aral Sea', 'Lake Eyre North', 'Lake Eyre South', 'Lake Torrens', 'Lake Urmia', 'Lake Van', 'Qinghai Hu', 'Lake Natron', 'Lake Turkana', 'Lake Balkhash'}
MORE = {'Lake Turkana', 'Lake Geneva', 'Lac Léman', 'Lake Constance', 'Bodensee', 'Lake Garda', 'Loch Ness', 'Lake Tahoe', 'Dead Sea', 'Lake Tana', 'Lake Chad', 'Lake Nicaragua', 'Lake Urmia', 'Lake Van', 'Qinghai Hu', 'Lake Okeechobee', 'Päijänne', 'Vättern', 'Lake Inari', 'Lake Toba'}
LAKE_SRC = os.path.join(HERE, 'ne_10m_lakes.geojson')
LAKES = []; lakeId = np.zeros(L.shape, np.uint8)
if os.path.exists(LAKE_SRC):
    for f in json.load(open(LAKE_SRC, encoding='utf-8'))['features']:
        pr = f['properties']; nm = pr.get('name') or ''; rank = pr.get('scalerank', 9)
        if not nm or (rank > 2 and nm not in MORE) or len(LAKES) >= 250: continue
        g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        im = Image.new('L', (NXF, NZF), 0); dr = ImageDraw.Draw(im)
        for poly in polys:
            for ri, ring in enumerate(poly):
                px = to_px(ring)
                if len(px) >= 3 and np.ptp(px[:, 0]) < NXF / 2: dr.polygon([tuple(q) for q in px.round(1)], fill=0 if ri else 255)
        m = np.array(im) > 0
        if m.sum() == 0: continue
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)   # a node wider all round
        # (some are water in the land mask already, Geneva and the like: they are still this lake)
        if (m & L).sum() < 3 and m.sum() < 12: continue
        salt = pr.get('featurecla') == 'Alkaline Lake' or nm in SALT
        LAKES.append([nm, 1 if salt else 0]); lakeId[m] = len(LAKES); L[m] = False
    print('lakes', len(LAKES), '(salt', sum(s for _, s in LAKES), ')')
pad = 160
Lp = np.concatenate([L[:, -pad:], L, L[:, :pad]], 1)
dsea = distance_transform_edt(Lp, sampling=FINE)[:, pad:-pad]       # on land: metres to the sea
dland = distance_transform_edt(~Lp, sampling=FINE)[:, pad:-pad]     # at sea: metres to land
sdf = np.where(L, dsea - FINE / 2, -(dland - FINE / 2))
SDF = sdf[::4, ::4]; SNX, SNZ = SDF.shape[1], SDF.shape[0]
# each node within 500 m of a lake's water knows which lake (0: none): fresh water to drink, no whales
_, (li, lj) = distance_transform_edt(lakeId == 0, sampling=FINE, return_indices=True)
near = distance_transform_edt(lakeId == 0, sampling=FINE) <= 500
LAKEGRID = np.where(near, lakeId[li, lj], 0)[::4, ::4].astype(np.uint8)

# ---- biomes and continents (500 m) -----------------------------------------------------------
lon, lat = glon[::8, ::8].copy(), glat[::8, ::8].copy()
# on land: units inland from the sea (the lakes don't make coasts: their shores keep their land)
Ls = L | (lakeId > 0); Lsp = np.concatenate([Ls[:, -pad:], Ls, Ls[:, :pad]], 1)
dl = (distance_transform_edt(Lsp, sampling=FINE)[:, pad:-pad] - FINE / 2)[::8, ::8] / (KM * 1000)
Lb = L[::8, ::8]
alat = np.abs(lat)
def vnoise(x, y, f, seed):
    g = np.random.default_rng(seed).random((400, 400))
    X_ = x * f; Y_ = y * f; i = np.floor(X_).astype(int); j = np.floor(Y_).astype(int); fx = X_ - i; fy = Y_ - j
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = g[j % 400, i % 400]; b = g[j % 400, (i + 1) % 400]; c = g[(j + 1) % 400, i % 400]; d = g[(j + 1) % 400, (i + 1) % 400]
    return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) * 2 - 1
def fbm(x, y, f, seed): return vnoise(x, y, f, seed) * .6 + vnoise(x, y, f * 2.1, seed + 1) * .3 + vnoise(x, y, f * 4.3, seed + 2) * .15
lon0, lat0 = lon.copy(), lat.copy()
lon = lon0 + fbm(lon0, lat0, .15, 11) * 3.2
lat = lat0 + fbm(lon0, lat0, .15, 12) * 2.2
patch = fbm(lon0, lat0, .5, 13)
# ---- places measured on the strip (metres), not in warped degrees ------------------------------
# A site a few tenths of a degree across is 100-300 m on the strip, smaller than one 500 m node, and the
# +-3 degree noise warp above moves it a few km besides: most sites never landed (3 fire mountains in
# the world out of 18, no redwoods). So a site is placed at the real place's spot on the strip (the
# nearest unwarped node) and given at least RMIN of radius, a band at least WMIN of half-width; the
# edges wobble by metres (jx, jz) instead of by degrees.
from scipy.spatial import cKDTree
Xb, Zb = X[::8, ::8], Z[::8, ::8]                                            # metres of each 500 m node
mpd = 500 / np.maximum(np.abs(np.gradient(lat0, axis=0)), 1e-6)               # metres per degree of latitude there
def _xyz(lo, la):
    lo = np.radians(lo); la = np.radians(la); return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
_tree = cKDTree(_xyz(lon0.ravel(), lat0.ravel()))
def spot(x, y):
    i = _tree.query(_xyz(x, y))[1]; return Xb.ravel()[i], Zb.ravel()[i], mpd.ravel()[i]
RMIN, WMIN = 900.0, 500.0
jx = fbm(lon0, lat0, .5, 21) * 350; jz = fbm(lon0, lat0, .5, 22) * 350
def dxw(a, b):
    d = (a - b) % 96000; return np.where(d > 48000, d - 96000, d)
def ellm(x, y, r, ry=None, rmin=None):
    rmin = RMIN if rmin is None else rmin; sx, sz, s = spot(x, y); rx = max(rmin, r * s); rz = max(rmin, (ry or r) * s)
    return (dxw(Xb + jx, sx) / rx) ** 2 + ((Zb + jz - sz) / rz) ** 2 <= 1
def linem(pts, w, wmin=None):
    m = np.zeros(lon.shape, bool); P = [spot(x, y) for x, y in pts]; wmin = WMIN if wmin is None else wmin
    for (x0, z0, s0), (x1, z1, s1) in zip(P, P[1:]):
        ax, az = dxw(x1, x0), z1 - z0; px, pz = dxw(Xb + jx, x0), Zb + jz - z0
        t = np.clip((px * ax + pz * az) / max(ax * ax + az * az, 1), 0, 1)
        m |= np.hypot(px - t * ax, pz - t * az) <= max(wmin, w * (s0 + s1) / 2)
    return m
def box0(a, b, c, d): return (lon0 >= a) & (lon0 <= b) & (lat0 >= c) & (lat0 <= d)
def box(a, b, c, d): return (lon >= a) & (lon <= b) & (lat >= c) & (lat <= d)
def ell(x, y, rx, ry=None):
    ry = ry or rx; dx = ((lon - x + 540) % 360 - 180) / rx; return dx * dx + ((lat - y) / ry) ** 2 <= 1
def line(pts, w):
    m = np.zeros(lon.shape, bool)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        ax, ay = x1 - x0, y1 - y0; px, py = lon - x0, lat - y0
        t = np.clip((px * ax + py * ay) / (ax * ax + ay * ay), 0, 1)
        m |= np.hypot(px - t * ax, py - t * ay) <= w
    return m
B = np.full(lon.shape, 'forest', dtype='<U10')
def put(mask, name): B[mask] = name
# ---- broad climate by latitude --------------------------------------------------------------
na = lon < -50; eu = (lon >= -30) & (lon < 60); asia = lon >= 60
tl = np.where(na, np.interp(lon, [-170, -130, -95, -75, -55], [67, 68, 59, 57, 55]),
     np.interp(lon, [-30, 20, 60, 90, 105, 130, 160, 180], [66, 69.5, 67, 68, 72, 70, 64, 64]))
bs = np.where(na, np.interp(lon, [-170, -125, -110, -95, -75, -55], [60, 57, 53, 50, 47, 47]),
     np.interp(lon, [-30, 10, 30, 60, 80, 100, 130, 160, 180], [60, 60, 58, 56, 54, 51, 50, 52, 58]))
put(lat >= bs, 'taiga')
put((lat >= bs) & ((eu & (lon > 4)) | box(155, 170, 50, 62)), 'birch')
put(lat >= tl, 'tundra')
put((lat < bs) & (lat > 23), 'forest')
put((lat < bs) & (lat > 23) & (patch > .15), 'meadow')
put(box(-98, -70, 44, 54) | box(22, 31, 60, 66) | box(12, 22, 58.5, 63), 'lakeland')
put(alat <= 23, 'savanna')
put(lat < -23, 'forest')
put((lat < -23) & (patch > .1), 'meadow')
# ---- dry lands ----------------------------------------------------------------------------
put(box(30, 125, 43, 53) | box(-112, -96, 31, 53) | box(-65, -57, -40, -30) | ((lat < -40) & (lon > -71) & (lon < -60)) | box(35, 60, 46, 52) | box(-120, -111, 38, 44), 'steppe')
desert = (box(-17, 33, 16, 31) | box(33, 58, 14, 31) | box(68, 75.5, 24, 30) | box(90, 115, 38, 46) | box(77, 90, 37, 41.5) | box(52, 68, 37, 45)
  | box(53, 63, 26, 35) | (box(117, 147, -33, -18) & (dl > .45)) | box(12, 24, -28, -17) | box(-71.5, -69, -28, -16) | box(-118, -108, 28, 37.5)
  | box(-108, -101, 25, 32) | box(42, 51.5, 2, 11) | box(-114.5, -109, 24, 32))
put(desert, 'desert')
# ---- the Mediterranean, the Cape, California, central Chile, SW Australia --------------------
med = (box(-10, 37, 30.5, 44) & ~box(-10, 10, 43, 44)) | box(26, 37, 36, 41.5)
put(med & ~desert, 'maquis')
put(box(-124.5, -116, 32, 38.5) | box(-73, -70, -37, -30) | box(17.5, 26, -35, -32.5) | box(114, 120, -36, -30) | box(135, 141, -36, -33), 'maquis')
# ---- tropics -------------------------------------------------------------------------------
rain = (ell(-63, -3.5, 14, 8.5) | ell(20, .5, 10.5, 5.2) | box(-13, 9, 4, 8) | box(95, 156, -10, 8) | box(-92, -77, 7, 17) | box(48, 50.6, -25, -12)
  | box(73, 76, 9, 16) | (box(-50, -35, -28, -5) & (dl < 1.3)) | box(145, 146.5, -19, -15) | box(98, 108, 10, 20) | box(-80, -73, 0, 9))
put(rain & (alat <= 23.5), 'rainforest')
# mangroves on tropical shores, here and there
put((alat < 24) & (dl < .3) & (fbm(lon0, lat0, 2, 14) > -.1) & ~desert, 'swamp')
for x, y, r in [(-81, 25.8, .9), (89.2, 21.9, 1.2), (6, 4.8, .9), (105.8, 9.8, .9), (-50, 0, 1.2), (-61.5, 8.6, .8), (-82.3, 30.8, .6)]: put(ellm(x, y, r), 'swamp')
# ---- mountains ----------------------------------------------------------------------------
R = [
 ([(6, 44.2), (7, 45.8), (10, 46.5), (13, 47), (16, 47.5)], 1.0, 'alpine'), ([(-1.8, 43), (3, 42.5)], .6, 'mountains'),
 ([(17.5, 49), (22, 49.2), (25, 47.5), (25.5, 45.5), (22.5, 45)], .8, 'mountains'), ([(37.5, 44.5), (43, 43), (49, 41)], .8, 'alpine'),
 ([(6, 59), (9, 61.5), (13, 64), (16, 67), (20, 69)], 1.4, 'mountains'), ([(-9, 30.5), (-5, 32.5), (0, 34), (6, 35.5)], 1.0, 'mountains'),
 ([(9, 44.3), (12.5, 43), (14, 41.5), (16, 40)], .6, 'mountains'), ([(14.5, 46), (17, 44), (19.5, 42.5), (21, 40)], .8, 'mountains'),
 ([(59, 50), (60, 55), (60, 61), (64, 67)], .8, 'mountains'),
 ([(-150, 62), (-135, 60), (-122, 54), (-116, 49), (-112, 45), (-107, 40), (-106, 35)], 2.6, 'mountains'),
 ([(-135, 60), (-122, 54), (-116, 49), (-111, 45), (-106.5, 40)], 1.1, 'alpine'),
 ([(-121.5, 48.5), (-121.7, 44), (-121.2, 40.5)], 1.0, 'mountains'), ([(-120.5, 39.5), (-119, 37), (-118.2, 35.6)], .9, 'sequoia', 800),
 ([(-84, 34), (-80, 37), (-77, 40), (-73, 43), (-69, 46)], 1.4, 'mountains'),
 ([(-75, 10), (-77, 3), (-78, -2), (-76, -10), (-71, -15), (-68, -20), (-69, -30), (-70.5, -36), (-72, -45), (-73, -50), (-72, -54)], 1.8, 'alpine'),
 ([(72, 35.5), (77, 33), (81, 30), (85, 28), (90, 27.6), (95, 28.5)], 1.6, 'alpine'), ([(70, 41.5), (76, 42), (82, 43), (88, 43.5)], 1.2, 'alpine'),
 ([(66, 35), (71, 36), (75, 37.5)], 1.3, 'alpine'), ([(45, 36.5), (49, 33), (53, 30), (57, 28)], 1.2, 'mountains'), ([(85, 50), (90, 49), (96, 47.5)], 1.3, 'mountains'),
 ([(27, -30.5), (29.5, -28.5), (31, -25)], 1.0, 'mountains'), ([(146, -38), (149, -35), (151, -31), (151, -27), (147, -20), (145, -15)], 1.1, 'mountains'),
 ([(136.5, 35), (138, 36), (140, 38.5), (141, 41), (142.8, 43.5)], .8, 'mountains'), ([(167, -46), (169.5, -44), (172, -42.5)], .8, 'alpine'),
 ([(-153, 62.5), (-147, 63.3), (-141, 62)], 1.2, 'alpine'), ([(-160, 68), (-145, 68.5)], 1.0, 'mountains'), ([(157, 51), (160, 56), (162, 58)], 1.0, 'mountains'),
 ([(138, -4.5), (146, -6.5)], 1.0, 'mountains'), ([(100, 27), (102, 31), (103, 34)], 1.5, 'mountains'), ([(43, 15), (44.5, 13.5)], 1.2, 'mountains'),
]
for pts, w, nm, *wm in R: put(linem(pts, w, *wm), nm)   # a fourth number: a band at least that wide on the strip, metres
# the grain of each range (D): which way its ridges run, the bearing of the nearest stretch of its
# line on the strip, in sixteenths of a half turn (+1; 0 where no range runs)
GRAIN = np.zeros(lon.shape, np.uint8); _gd = np.full(lon.shape, 1e9)
for pts, w, nm, *wm in R:
    if nm not in ('mountains', 'alpine'): continue
    GP = [spot(x, y) for x, y in pts]; wmin = wm[0] if wm else WMIN
    for (x0, z0, s0), (x1, z1, s1) in zip(GP, GP[1:]):
        ax, az = dxw(x1, x0), z1 - z0; px, pz = dxw(Xb + jx, x0), Zb + jz - z0
        t = np.clip((px * ax + pz * az) / max(ax * ax + az * az, 1), 0, 1); d = np.hypot(px - t * ax, pz - t * az)
        band = max(wmin, w * (s0 + s1) / 2) * 1.3; q = int(round((np.arctan2(az, ax) % np.pi) / np.pi * 16)) % 16 + 1
        m = (d <= band) & (d < _gd); GRAIN[m] = q; _gd[m] = d[m]
print('grain nodes', int((GRAIN > 0).sum()))
put(ellm(88, 33, 9, 3.8), 'alpine'); put(ellm(38.5, 9.5, 3, 4), 'mountains'); put(ellm(-4.5, 57.2, 1.6, .9), 'moor')
put(ellm(-61, 5.5, 1.6) | ellm(-64, 5.8, 1.2), 'cliffs')    # the tepuis
# ---- coasts, fjords, moors ----------------------------------------------------------------
temperate_coast = (alat > 34) & (alat < 66) & (dl < .35) & np.isin(B, ['forest', 'meadow', 'maquis', 'steppe', 'taiga', 'birch', 'lakeland'])
put(temperate_coast, 'coast')
for x, y, r in [(-9.4, 52.9, .5), (-5.5, 50.2, .5), (0.3, 49.7, .5), (1.4, 51.1, .3), (143, -38.7, .8), (-121.6, 36.2, .6), (-8.5, 37, .5), (-7, 58.3, .5)]: put(ellm(x, y, r, None, 600) & (dl < .6), 'cliffs')   # a stretch of coast, not a disc that reaches inland towns
put(box(-11, 1.8, 50, 59) & (lat > 53.5) | box(-10.5, -6, 51.5, 55.4) & ~(dl < .3) | box(-25, -13, 63, 67) | box(-8, -6, 61.5, 62.5) | box(-61, -57, -52.5, -51), 'moor')
fj = ((box(4.5, 31, 58, 71) & (dl < 1.0)) | (box(-160, -123, 48, 61) & (dl < 1.0)) | (box(-76, -72, -56, -41) & (dl < 1.2)) | (box(166, 168.5, -46.5, -44) & (dl < .7))
      | (box(-74, -18, 59.5, 78) & (dl < .5)) | (box(-24, -21, 65, 66.6) & (dl < .5)) | (box(-7, -4.8, 56, 58.6) & (dl < .35)) | (box(-66, -52, 47, 60) & (dl < .5)))
put(fj, 'fjord')
put(linem([(-122.4, 37.3), (-123.6, 39.3), (-124.1, 41), (-124.2, 42.2)], 1.0, 900) & (dl < 1.4) | linem([(-73.4, -38), (-73.6, -40), (-73.7, -42)], .9, 900) & (dl < 1.2), 'redwood')   # the fog coasts: California north of the Golden Gate, Valdivia
put(box0(-112.5, -107.5, 35.3, 39.2) | ellm(17.6, -27.6, .6) | ellm(-107.8, 27.4, 1), 'canyon')
put(ellm(-102.3, 43.8, 1.2) | ellm(-112.7, 51, .7) | ellm(-1.5, 42.2, .4) | ellm(34.8, 38.6, .6), 'badlands')
# ---- sites --------------------------------------------------------------------------------
for x, y, r in [(110.3, 24.8, 2.4), (107, 20.9, 1), (14.3, 45.7, .5), (-88.8, 20.4, 1.8), (98.5, 8.3, .8), (-9, 53, .3), (44.9, -18.8, .6)]: put(ellm(x, y, r), 'karst')
for x, y, r in [(-67.5, -20.2, 1.0), (-113.5, 40.8, .8), (137.3, -28.4, 1.6), (8.4, 33.7, .7), (16.3, -18.8, .7), (69.8, 23.8, .9), (54, 34.5, 1.2)]: put(ellm(x, y, r), 'saltflat')
for x, y, r in [(4.5, 43.5, .4), (29.3, 45.1, .5), (22.9, -19.3, 1.3), (-57, -17.5, 2), (30.5, 7.5, 2), (47, 31, 1), (-84, 53, 3), (78, 57, 3), (-6.4, 37, .4), (6.5, 53.4, .6), (31, 31.2, .6), (0.3, 52.7, .4), (-89.5, 29.3, .7)]: put(ellm(x, y, r), 'marsh')
for x, y, r in [(-19, 64.6, 1.4), (15, 37.75, .4), (14.4, 40.8, .3), (37.35, -3.07, .6), (138.7, 35.4, .5), (-155.5, 19.6, 1.4), (-121.8, 46.85, .5), (-98.6, 19, .6),
                (-78.4, -0.7, .6), (160, 55, 1.5), (112.9, -7.9, .8), (105.4, -6.1, .4), (175.6, -39.3, .6), (44.3, 39.7, .5), (-16.6, 28.3, .8), (-28, 38.5, 1.2), (-90.5, -0.5, 1.2), (-122.2, 42.9, .4)]:
    put(ellm(x, y, r), 'volcano')
# each wonder in the land it was built in (G3): the pyramids in the desert, Stonehenge on the downs
for x, y, nm in [(31.134, 29.979, 'desert'), (2.294, 48.858, 'meadow'), (12.492, 41.89, 'maquis'), (10.396, 43.723, 'meadow'), (-1.826, 51.179, 'meadow'), (78.042, 27.175, 'meadow'), (103.867, 13.412, 'rainforest')]:
    put(ellm(x, y, 0, None, 650), nm)
# ---- ice ------------------------------------------------------------------------------------
put((lat < -60) | (lat > 80) | (box(-56, -18, 60, 84) & (dl > .5)), 'ice')
B[~Lb] = "sea"
print('rare lands (500 m nodes):', ', '.join(f'{nm} {int((B == nm).sum())}' for nm in ['volcano', 'karst', 'saltflat', 'badlands', 'canyon', 'cliffs', 'marsh', 'redwood', 'sequoia']))

# continents, from the unwarped real place
lo, la = lon0, lat0
C = np.full(lon.shape, 'asia', dtype='<U10')
C[(lo < -25) & (la > 7)] = 'n-america'
C[(lo < -25) & (lo > -95) & (la < 12.6) & ((lo > -77.4) | (la < 7))] = 's-america'
C[(lo >= -25) & (lo < 60) & (la >= 35.5) & ~((lo > 27) & (la < 42))] = 'europe'
C[(lo >= -25) & (lo < 52) & (la < 37.6) & (la > -40) & ~((lo >= 34.5) & (la >= 12.5))] = 'africa'
C[((lo >= 110) & (la < -9)) | ((lo >= 130) & (la < 0)) | (((lo > 160) | (lo < -130)) & (la < 25))] = 'oceania'
C[(lo < -168) & (la > 55)] = 'asia'
C[(lo > -75) & (lo < -10) & (la > 59)] = 'n-america'
C[la < -58] = 'antarctica'

BIOMES = ['sea', 'ice', 'tundra', 'taiga', 'birch', 'forest', 'meadow', 'lakeland', 'moor', 'coast', 'cliffs', 'fjord', 'mountains', 'alpine', 'sequoia', 'redwood',
          'steppe', 'maquis', 'desert', 'canyon', 'badlands', 'saltflat', 'savanna', 'rainforest', 'swamp', 'marsh', 'karst', 'volcano']
CONTS = [None, 'europe', 'africa', 'asia', 'n-america', 's-america', 'oceania', 'antarctica']
bi = np.zeros(B.shape, np.uint8)
for k, n in enumerate(BIOMES): bi[B == n] = k
ci = np.zeros(B.shape, np.uint8)
for k, n in enumerate(CONTS):
    if n: ci[(C == n) & Lb] = k
cell = (bi | (ci << 5)).astype(np.uint8)
BNX, BNZ = cell.shape[1], cell.shape[0]

# ---- lat/lon every 2 km, longitude unwrapped along each row ---------------------------------------
_, _, UV2 = grid(2000)
LON, LAT = lonlat(warp(UV2))
LON = np.degrees(np.unwrap(np.radians(LON), axis=1))
for j in range(1, LON.shape[0]): LON[j] -= 360 * np.round((LON[j, 0] - LON[j - 1, 0]) / 360)   # rows agree

# ---- the great rivers (Natural Earth, scale rank 0 to 3; 4 in Europe, which is drawn larger) ----
# Each as lines of strip points (metres), source to mouth, simplified to about 12 m; world.js cuts
# them, so they run where the real ones do and never fade (the Nile through the Sahara)
ENGLISH = {'Amazonas': 'Amazon', 'Huang': 'Yellow River', 'Chang Jiang': 'Yangtze', 'Jinsha': 'Yangtze', 'Donau': 'Danube', 'Firat': 'Euphrates', 'Ertis': 'Irtysh', 'Lancang': 'Mekong',
           'Abay': 'Blue Nile', "Argun'": 'Argun', 'Grande': 'Rio Grande', 'Ganga': 'Ganges', 'Yarlung': 'Brahmaputra', 'Rhein': 'Rhine', 'Wisla': 'Vistula', 'Dnipro': 'Dnieper', 'Dunav': 'Danube', 'Duna': 'Danube', 'Dunarea': 'Danube',
           # the branches and headwaters under the names of the rivers they are
           'Al Furat': 'Euphrates', 'Dicle': 'Tigris', 'Dnepre': 'Dnieper', 'Bratul Chillia': 'Danube', 'Bratul Sfintu Gheorghe': 'Danube', 'Borcea': 'Danube',
           'Olenekskaya Protoka': 'Lena', 'Bykovskaya Protoka': 'Lena', 'Rosetta Branch': 'Nile', 'Damietta Branch': 'Nile', 'Damqogkanbab': 'Brahmaputra', 'Dihang': 'Brahmaputra',
           'Tongtian': 'Yangtze', 'Tuotuo': 'Yangtze', 'Ideriyn': 'Selenga', 'Za': 'Mekong', 'Ergun': 'Argun', 'Hailar': 'Argun', 'Kibali': 'Uele', 'Shiquan': 'Indus', 'Lek': 'Rhine',
           'Yellow': 'Yellow River', 'Irrawaddy Delta': 'Irrawaddy', 'Negro': 'Rio Negro', 'Mountain Nile': 'White Nile', 'Albert Nile': 'White Nile'}
RIVER_SRC = os.path.join(HERE, 'ne_10m_rivers_lake_centerlines.geojson')
def simplify(P, tol):
    if len(P) < 3: return P
    keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True; st = [(0, len(P) - 1)]
    while st:
        a, b = st.pop(); A, Bp = P[a], P[b]; seg = Bp - A; L2 = max(seg @ seg, 1e-9)
        t = np.clip(((P[a + 1:b] - A) @ seg) / L2, 0, 1); d = np.hypot(*(P[a + 1:b] - A - t[:, None] * seg).T) if b > a + 1 else np.array([])
        if len(d) and d.max() > tol: k = a + 1 + int(d.argmax()); keep[k] = True; st += [(a, k), (k, b)]
    return P[keep]
RIVERS = []
if os.path.exists(RIVER_SRC):
    for f in json.load(open(RIVER_SRC, encoding='utf-8'))['features']:
        pr = f['properties']; nm = pr.get('name_en') or pr.get('name') or ''; rank = pr.get('scalerank', 9)
        g = f['geometry']; lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        if not nm or not lines or not lines[0]: continue
        lo0, la0 = lines[0][0][0], lines[0][0][1]
        eu = -12 < lo0 < 45 and 35 < la0 < 72
        if rank > (4 if eu else 3): continue
        nm = ENGLISH.get(nm, nm)
        for ln in lines:
            px = to_px(ln) * FINE + [X0, Z0]
            # cut where it jumps across the wrap seam or runs off past the coast
            run = []
            for q in px:
                i, j = int(round((q[0] - X0) / FINE)) % NXF, int(np.clip(round((q[1] - Z0) / FINE), 0, NZF - 1))
                wet = sdf[j, i] < -150
                if run and (abs(q[0] - run[-1][0]) > 2000 or wet):
                    if len(run) > 1: RIVERS.append([nm, int(rank), simplify(np.array(run), 12)])
                    run = [] if wet else [q]
                    continue
                if not wet: run.append(q)
            if len(run) > 1: RIVERS.append([nm, int(rank), simplify(np.array(run), 12)])
    RIVERS = [r for r in RIVERS if np.hypot(*np.diff(r[2], axis=0).T).sum() > 300]
    print('rivers', len(RIVERS), 'lines,', len({r[0] for r in RIVERS}), 'named,', sum(len(r[2]) for r in RIVERS), 'points')
# ---- write ----------------------------------------------------------------------------------
def rle(a):
    out = bytearray(); f = a.ravel(); i = 0
    while i < f.size:
        v = f[i]; n = 1
        while i + n < f.size and f[i + n] == v and n < 255: n += 1
        out += bytes([int(v), n]); i += n
    return base64.b64encode(bytes(out)).decode()
q = np.clip(np.round(SDF / 50), -127, 127).astype(int)
delta = np.diff(np.concatenate([np.zeros((SNZ, 1), int), q], 1), axis=1)   # row deltas: smooth, so mostly tiny
dz = (np.clip(delta, -127, 127) + 128).astype(np.uint8)
assert (np.abs(delta) <= 127).all()
js = f'''// Baked by tools/earth/bake.py from Natural Earth (public domain). Do not edit by hand: rebake.
// SDF: metres to the coast (+ land, - sea) / 50, every {int(FINE * 4)} m, rows of deltas + 128, base64.
// CELL: biome | continent << 5 every 500 m, run-length pairs, base64. LL: [lat, lon] every 2 km.
// GRAIN: the ranges' ridge bearing (sixteenths of a half turn, +1) every 500 m. LAKE: which of LAKES
// ([name, salt]) the water there is, every 250 m. RIVERS: [name, scale rank, [x, z, x, z ...]] lines.
export const EARTH = {{ W: 96000, H: {H * KM * 1000:.0f}, X0: {X0:.0f}, Z0: {Z0:.0f}, SEAM: {SEAM} }};
export const SDF = {{ step: 250, nx: {SNX}, nz: {SNZ}, data: '{base64.b64encode(dz.tobytes()).decode()}' }};
export const CELL = {{ step: 500, nx: {BNX}, nz: {BNZ}, data: '{rle(cell)}' }};
export const BIOME_IDS = {json.dumps(BIOMES)};
export const CONTINENTS = {json.dumps(CONTS)};
export const GRAIN = {{ step: 500, nx: {BNX}, nz: {BNZ}, data: '{rle(GRAIN)}' }};
export const LAKE = {{ step: 250, nx: {SNX}, nz: {SNZ}, data: '{rle(LAKEGRID)}' }};
export const LAKES = {json.dumps(LAKES, ensure_ascii=False)};
export const RIVERS = {json.dumps([[n, r, [int(v) for v in P.round().ravel()]] for n, r, P in RIVERS], ensure_ascii=False, separators=(',', ':'))};
export const LL = {{ step: 2000, nx: {LAT.shape[1]}, nz: {LAT.shape[0]}, lat: {json.dumps([round(float(v), 2) for v in LAT.ravel()])}, lon: {json.dumps([round(float(v), 2) for v in LON.ravel()])} }};
'''
open(os.path.join(ROOT, 'web', '3d', 'earthdata.js'), 'w').write(js)
print('earthdata.js', len(js) // 1024, 'KB')
# a preview to look at
COL = {'sea': '#5b8fb0', 'ice': '#f1ece0', 'tundra': '#a9a88a', 'taiga': '#4f7556', 'birch': '#a9b56c', 'forest': '#6f8f4e', 'meadow': '#9bb067', 'lakeland': '#7fa36a', 'moor': '#8c6f78',
       'coast': '#b7ab84', 'cliffs': '#a79c8a', 'fjord': '#5f8a62', 'mountains': '#8f8577', 'alpine': '#c9c3b6', 'sequoia': '#7a3f2c', 'redwood': '#8a4a32', 'steppe': '#c8b977', 'maquis': '#a6a35a',
       'desert': '#e2c48c', 'canyon': '#b4643e', 'badlands': '#cdb79c', 'saltflat': '#f4efe2', 'savanna': '#cdb46a', 'rainforest': '#2f6b3a', 'swamp': '#55704a', 'marsh': '#b3a35e', 'karst': '#77a553', 'volcano': '#3e3a39'}
img = np.zeros(B.shape + (3,), np.uint8)
for k, c in COL.items(): img[B == k] = [int(c[i:i + 2], 16) for i in (1, 3, 5)]
Image.fromarray(img).save(os.path.join(HERE, 'earth-preview.png'))
