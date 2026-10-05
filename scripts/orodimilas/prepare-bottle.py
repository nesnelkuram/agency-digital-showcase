"""Oro di Milas Reserve şişesini Three.js için hazırlar.

Kaynak: orodimilas.com ana sayfasındaki şeffaf zeminli ürün fotoğrafı
(https://static.wixstatic.com/media/fdf34f_14446d3a0c744b3e8bfe2657e240f577~mv2.png).

Çıktılar (public/orodimilas/assets/):
  bottle-profile.json  Şişenin dönel profili: [yükseklik, yarıçap] çiftleri, yüksekliğe göre normalize.
  bottle-albedo.jpg    Silindirik açılımda renk dokusu: mat siyah zemin, gümüş ve altın folyo desen.
  bottle-rm.jpg        G = pürüzlülük, B = metaliklik (three.js roughnessMap/metalnessMap düzeni).
  bottle-hero.webp     WebGL olmadığında gösterilen şişe fotoğrafı.

Fotoğraf soldan aydınlatılmış; folyo desen sağ yarıda karanlığı yansıtıp kayboluyor.
Desen ayna simetrik olduğu için yazı bantları dışında sol yarı sağa aynalanır.
Fotoğraftaki gölge ve parlamalar dokuya taşınmaz; ışığı sahne verir.

Kullanım: python3 scripts/orodimilas/prepare-bottle.py /yol/kaynak.png
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'orodimilas' / 'assets'
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not SRC or not SRC.exists():
    sys.exit('Kaynak şişe fotoğrafının yolunu verin.')

# Şişe gövdesinin fotoğraftaki dikey sınırı (yansıma hariç, kırpılmış koordinatlar).
BOTTLE_BOTTOM = 4180
# Yazı bantları: aynalanmaz. Boyunda yalnız altın RESERVE yazısı alınır.
NECK = (0, 1080)
TEXT_BANDS = [(1540, 1640), (2560, 2740), (3750, 3900)]
RESERVE = (300, 960)
ORO = (2560, 2740)
GLOSS_ROWS = (1640, 3760)
GLOSS_HALF = 175
ARTWORK_TOP = 1500
TEX = 2048

img = Image.open(SRC).convert('RGBA')
bbox = img.split()[-1].getbbox()
img = img.crop(bbox)
rgba = np.asarray(img).astype(np.float32)
alpha = rgba[..., 3]
rgb = rgba[..., :3]
h, w = alpha.shape
cx = w / 2

# ── Profil ──
rows = []
for y in range(0, BOTTLE_BOTTOM, 10):
    xs = np.nonzero(alpha[y] > 128)[0]
    if len(xs):
        rows.append((y, (xs.max() - xs.min()) / 2))
radius_at = np.interp(np.arange(BOTTLE_BOTTOM), [r[0] for r in rows], [r[1] for r in rows])
# Piksel titreşimi yüzeyde yatay bantlar yaratır; profil yumuşatılır (kenarlar korunarak).
radius_at = cv2.GaussianBlur(radius_at.astype(np.float32)[:, None], (1, 0), 12)[:, 0]
height = float(BOTTLE_BOTTOM)
profile = [[round(1 - y / height, 4), round(float(radius_at[y]) / height, 4)] for y, _ in rows[::2]]
profile.append([0.0, round(float(radius_at[-1]) / height, 4)])
profile.sort()
(OUT / 'bottle-profile.json').write_text(json.dumps({'source': 'orodimilas.com ürün fotoğrafı', 'points': profile}))

# ── Folyo maskesi ──
lum = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
small = cv2.resize(lum, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
# Dikey ve yatay medyanın minimumu: ince çizgiler zemin sayılmaz, geniş ışık bantları zemin sayılır.
k = 21
pad = k // 2
mv = np.zeros_like(small)
mh = np.zeros_like(small)
for i in range(small.shape[0]):
    lo, hi = max(0, i - pad), min(small.shape[0], i + pad + 1)
    mv[i] = np.median(small[lo:hi], axis=0)
for j in range(small.shape[1]):
    lo, hi = max(0, j - pad), min(small.shape[1], j + pad + 1)
    mh[:, j] = np.median(small[:, lo:hi], axis=1)
base = cv2.resize(np.minimum(mv, mh), (w, h), interpolation=cv2.INTER_LINEAR)
base = cv2.GaussianBlur(base, (0, 0), 6)
mask = np.clip((lum - base - 14) / 55, 0, 1)
gold = np.clip(((rgb[..., 0] - rgb[..., 2]) - 22) / 30, 0, 1) * (lum > 70)
mask *= alpha > 200

def in_bands(y):
    return any(a <= y < b for a, b in TEXT_BANDS)

ys = np.arange(h)
mirror_rows = np.array([(NECK[1] <= y < BOTTLE_BOTTOM) and not in_bands(y) for y in ys])
mirrored = mask[:, ::-1]
gold_m = gold[:, ::-1]
left = np.arange(w) < cx
# Sağ yarı: sol yarının aynası ile kendi değerinin büyüğü.
for arr, arr_m in ((mask, mirrored), (gold, gold_m)):
    right_rows = arr[mirror_rows][:, ~left]
    arr[np.ix_(mirror_rows, ~left)] = np.maximum(right_rows, arr_m[mirror_rows][:, ~left])
# Boyunda yalnız altın RESERVE yazısı; kapsül kenarındaki ışık halkası alınmaz.
mask[NECK[0]:NECK[1]] = np.clip(gold[NECK[0]:NECK[1]] * 1.4, 0, 1)
# Boyun sonu ve omuzda baskı yok; yalnız ışık yansıması var.
mask[RESERVE[1]:ARTWORK_TOP] = 0
# ORO di MILAS bandı bütünüyle altın folyo.
gold[ORO[0]:ORO[1]] = 1

# ── Parlak lak katmanı ──
# Ortadaki Hayat Ağacı motifi mat zemine parlak siyah lakla basılmış; fotoğrafta yalnız
# kenarları seçiliyor. Kenar haritası kapatılarak dolu çizgilere çevrilir.
detail = np.abs(lum - cv2.GaussianBlur(lum, (0, 0), 9))
edges = (detail > 11).astype(np.uint8) * 255
edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
gloss = cv2.GaussianBlur(edges.astype(np.float32) / 255, (0, 0), 1.2)
zone = np.zeros_like(gloss)
zone[GLOSS_ROWS[0]:GLOSS_ROWS[1], int(cx - GLOSS_HALF):int(cx + GLOSS_HALF)] = 1
zone[ORO[0]:ORO[1]] = 0
gloss = np.clip(gloss * zone - mask * 2, 0, 1)
gloss = np.maximum(gloss, gloss[:, ::-1])
# Fotoğraf kenarlarında silindir bükülmesi nedeniyle bozulan kısımlar soluklaştırılır.
edge = np.abs((np.arange(w) - cx) / (w / 2))
mask *= np.clip((0.97 - edge) / 0.12, 0, 1)[None, :]
gold = np.clip(gold, 0, 1)

# ── Silindirik açılım ──
u = (np.arange(TEX) + 0.5) / TEX
theta = (u - 0.5) * 2 * np.pi
v_rows = ((np.arange(TEX) + 0.5) / TEX * BOTTLE_BOTTOM).astype(int)
albedo = np.zeros((TEX, TEX, 3), np.float32)
rm = np.zeros((TEX, TEX, 3), np.float32)
glass = np.array([16, 16, 15], np.float32)
silver = np.array([206, 204, 198], np.float32)
golden = np.array([214, 168, 96], np.float32)
lacquer = np.array([6, 6, 6], np.float32)
front = np.abs(theta) < np.pi / 2
for j, y in enumerate(v_rows):
    r = radius_at[min(y, BOTTLE_BOTTOM - 1)]
    xs = np.clip(cx + r * np.sin(theta), 0, w - 1)
    m = np.where(front, cv2.remap(mask[y:y + 1], xs.astype(np.float32)[None, :], np.zeros((1, TEX), np.float32), cv2.INTER_LINEAR)[0], 0)
    g = np.where(front, cv2.remap(gold[y:y + 1], xs.astype(np.float32)[None, :], np.zeros((1, TEX), np.float32), cv2.INTER_LINEAR)[0], 0)
    l = np.where(front, cv2.remap(gloss[y:y + 1], xs.astype(np.float32)[None, :], np.zeros((1, TEX), np.float32), cv2.INTER_LINEAR)[0], 0)
    foil = silver * (1 - g[:, None]) + golden * g[:, None]
    base_col = glass * (1 - l[:, None]) + lacquer * l[:, None]
    albedo[j] = base_col * (1 - m[:, None]) + foil * m[:, None]
    # Pürüzlülük: mat cam 0.62, parlak lak 0.12, folyo 0.20. Metaliklik: yalnız folyo.
    rm[j, :, 1] = (0.62 - 0.50 * l) * (1 - m) + 0.20 * m
    rm[j, :, 2] = 0.95 * m

Image.fromarray(np.clip(albedo, 0, 255).astype(np.uint8)).save(OUT / 'bottle-albedo.jpg', quality=88, optimize=True, progressive=True)
Image.fromarray(np.clip(rm * 255, 0, 255).astype(np.uint8)).save(OUT / 'bottle-rm.jpg', quality=88, optimize=True)

# ── Yedek görsel ──
hero = img.crop((0, 0, w, min(h, BOTTLE_BOTTOM + 260)))
hero.thumbnail((520, 1800), Image.LANCZOS)
hero.save(OUT / 'bottle-hero.webp', quality=86, method=6)
print('profile points', len(profile), 'texture', TEX, 'hero', hero.size)
