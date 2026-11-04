#!/usr/bin/env python3
"""prepare-images.py — every picture the build ships, derived from the live site's OWN files (no generation).

Inputs  : assets/source/* (sr-assets downloads) + audit/bundle-images/* (the bundle's Springfield images; see
          docs/CHANGE-LOG.md for which ones are Springfield's — the CJD staff/storefront/interior photos are NOT used)
Outputs : src/assets-static/img/*.webp|png|jpg|ico|svg and src/content/images.json
          { key: { file, w, h, origin, alt, role } }  (alt = the live alt where the live site gives one)

  python3 -I src/tools/prepare-images.py
"""
import json, os, glob, shutil
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets-static', 'img')
os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(ROOT, 'assets', 'source')
BUN = os.path.join(ROOT, 'audit', 'bundle-images')
ORIGIN = 'https://springfieldavedispensary.store'
IMAGES = {}


def find(pattern, where):
    hits = sorted(glob.glob(os.path.join(where, pattern)))
    if not hits:
        raise SystemExit('missing source image: ' + pattern)
    return hits[0]


def save(im, name, key, origin, alt, role, q=80, lossless=False):
    path = os.path.join(OUT, name)
    if name.endswith('.webp'):
        im.save(path, 'WEBP', quality=q, method=6, lossless=lossless)
    elif name.endswith('.png'):
        im.save(path, 'PNG', optimize=True)
    else:
        im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=True)
    IMAGES[key] = {'file': 'assets/img/' + name, 'w': im.width, 'h': im.height, 'origin': origin, 'alt': alt, 'role': role,
                   'bytes': os.path.getsize(path)}


def resize_w(im, w):
    if im.width <= w:
        return im.copy()
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


# ---- logo: dark green NJ silhouette + street sign on white -> white knocked out to alpha (for a light seal)
logo_src = find('springfield_ave_Dispensary_pic_5_*.jpg', BUN)
logo = Image.open(logo_src).convert('RGB')
r, g, b = logo.split()
lum = Image.merge('RGB', (r, g, b)).convert('L')
# alpha from distance to white: pure white -> 0, ink -> 255 (soft knee keeps anti-aliased edges)
alpha = lum.point(lambda v: 0 if v > 246 else 255 if v < 200 else int((246 - v) * 255 / 46))
logo_a = logo.convert('RGBA'); logo_a.putalpha(alpha)
bbox = alpha.getbbox(); logo_a = logo_a.crop(bbox)
for w in (96, 192, 320):
    save(resize_w(logo_a, w), f'logo-{w}.webp', f'logo-{w}', ORIGIN + '/assets/' + os.path.basename(logo_src).split('-', 0)[0],
         'Springfield Ave Dispensary', 'LOGO', q=90)

# ---- the ONE Springfield store photo (382x510): native size + a graded, blurred backdrop (decorative)
int_src = find('image_1776388493068-*.png', BUN)
interior = Image.open(int_src).convert('RGB')
save(interior, 'interior-382.webp', 'interior', ORIGIN + '/assets/image_1776388493068-BD0KN1kN.png',
     'Springfield Ave Dispensary interior', 'CONTENT IMAGE', q=84)
bd = interior.resize((interior.width * 3, interior.height * 3), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
bd = ImageEnhance.Brightness(bd).enhance(0.62); bd = ImageEnhance.Contrast(bd).enhance(1.12)
tint = Image.new('RGB', bd.size, (6, 24, 14)); bd = Image.blend(bd, tint, 0.28)
save(bd, 'interior-backdrop.webp', 'interior-backdrop', ORIGIN + '/assets/image_1776388493068-BD0KN1kN.png', '', 'BACKGROUND', q=62)
# a landscape crop of the photo for wide frames (top of the display cases + green wall)
crop = interior.crop((0, 40, 382, 40 + 286))
save(crop, 'interior-wide-382.webp', 'interior-wide', ORIGIN + '/assets/image_1776388493068-BD0KN1kN.png',
     'Springfield Ave Dispensary interior', 'CONTENT IMAGE', q=84)

# ---- six category shots (896x1280, product on black) -> tiles + luminance-keyed cut-outs
CATS = [('flower', 'Flower'), ('prerolls', 'Pre-Rolls'), ('vapes', 'Vapes'), ('edibles', 'Edibles'),
        ('concentrates', 'Concentrates'), ('accessories', 'Accessories')]
for slug, alt in CATS:
    src = find(f'cat-{slug}-*.png', BUN)
    im = Image.open(src).convert('RGB')
    origin = ORIGIN + '/assets/' + os.path.basename(src)
    for w in (360, 560):
        save(resize_w(im, w), f'cat-{slug}-{w}.webp', f'cat-{slug}-{w}', origin, alt, 'CONTENT IMAGE', q=78)
    # cut-out: alpha from brightness against the black seamless; a radial feather removes the lit floor/edges
    lumi = ImageChops.lighter(ImageChops.lighter(im.getchannel('R'), im.getchannel('G')), im.getchannel('B'))
    a = lumi.point(lambda v: 0 if v < 10 else 255 if v > 58 else int((v - 10) * 255 / 48))
    W, H = im.size
    feather = Image.new('L', (W, H), 0)
    fd = Image.radial_gradient('L').resize((W, H))            # 0 centre -> 255 edge
    feather = fd.point(lambda v: 255 if v < 150 else 0 if v > 250 else int((250 - v) * 255 / 100))
    a = ImageChops.multiply(a, feather)
    cut = im.convert('RGBA'); cut.putalpha(a)
    bb = a.point(lambda v: 255 if v > 24 else 0).getbbox(); cut = cut.crop(bb)
    for w in (280, 440):
        save(resize_w(cut, w), f'cut-{slug}-{w}.webp', f'cut-{slug}-{w}', origin, '', 'DECORATIVE CUT-OUT', q=82)

# ---- blog pictures (1408x768)
BLOG = {'live-rosin': 'blog-live-rosin', 'terpenes': 'blog-terpenes', 'edibles': 'blog-edibles',
        'sativa-summer': 'blog-sativa-summer', 'delivery': 'blog-delivery'}
for k, stem in BLOG.items():
    src = find(f'*{stem}-*.png', SRC)
    im = Image.open(src).convert('RGB')
    origin = ORIGIN + '/assets/' + os.path.basename(src).split('-', 1)[1]
    for w in (480, 960, 1408):
        save(resize_w(im, w), f'{stem}-{w}.webp', f'{stem}-{w}', origin, '', 'CONTENT IMAGE', q=76)

# ---- social card + favicons: the live files, unchanged
og = find('*sad-opengraph.jpg', SRC)
shutil.copyfile(og, os.path.join(OUT, 'sad-opengraph.jpg'))
IMAGES['og'] = {'file': 'assets/img/sad-opengraph.jpg', 'w': 1200, 'h': 630, 'origin': ORIGIN + '/sad-opengraph.jpg', 'alt': '', 'role': 'OG'}
for f in ('favicon.ico', 'favicon.svg', 'favicon-192.png', 'favicon-32.png'):
    hit = glob.glob(os.path.join(SRC, '*' + f))
    if hit:
        shutil.copyfile(hit[0], os.path.join(OUT, f))
        IMAGES['fav-' + f] = {'file': 'assets/img/' + f, 'origin': ORIGIN + '/' + f, 'role': 'ICON/UI'}

with open(os.path.join(ROOT, 'src', 'content', 'images.json'), 'w') as fh:
    json.dump(IMAGES, fh, indent=1)
tot = sum(v.get('bytes', 0) for v in IMAGES.values())
print(f'{len(IMAGES)} images, {tot/1024:.0f} KB total (webp/png), written to src/assets-static/img + src/content/images.json')
