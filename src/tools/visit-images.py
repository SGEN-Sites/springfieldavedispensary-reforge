#!/usr/bin/env python3
"""visit-images.py — the visit lane's own cut-out (review finding: the shared luminance-keyed edibles cut-out keeps a grey
oval of the photo's slate surface and a smoke wisp, so on the dark ground it reads as a vignetted photo, not a cut-out).

Input  : src/assets-static/img/cat-edibles-560.webp (the live Springfield edibles category shot, already derived by
         src/tools/prepare-images.py from the live site's own file). Nothing generated, nothing from the sister store.
Output : src/assets-static/img/visit-cut-edibles-<w>.webp and src/content/images.d/visit.json
         (keys visit-cut-edibles-<w>; same shape as images.json: file, w, h, origin, alt, role)

Method : the slate, its sugar specks, the smoke and the shadow are near-neutral; the chocolate and every gummy are not.
         Alpha comes from HSV saturation (gated by brightness, since the saturation of the near-black ground is noise),
         specks are opened away, the gaps the white sugar coating leaves are closed, holes are filled, small islands are
         dropped, and the rim keeps the soft key so the edges keep their real shape.

  python3 -I src/tools/visit-images.py                  (writes the files)
  python3 -I src/tools/visit-images.py --preview <png>  (also writes a preview on the site's ground colour)
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'src', 'assets-static', 'img')
OUT_JSON = os.path.join(ROOT, 'src', 'content', 'images.d', 'visit.json')
SHARED = json.load(open(os.path.join(ROOT, 'src', 'content', 'images.json')))
GROUND = (7, 17, 11)   # --bg-1, for the preview only


def components(mask):
    """4-connected components of a boolean mask -> (label array, sizes)."""
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    sizes = [0]
    n = 0
    for sy, sx in zip(*np.nonzero(mask)):
        if lab[sy, sx]:
            continue
        n += 1
        lab[sy, sx] = n
        q = deque([(sy, sx)])
        size = 0
        while q:
            y, x = q.popleft()
            size += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((ny, nx))
        sizes.append(size)
    return lab, sizes


def fill_holes(mask):
    """True where the mask is set or the pixel cannot reach the frame edge through unset pixels."""
    lab, _ = components(~mask)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    return ~outside


def to_img(a):
    return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L')


def edibles():
    src = Image.open(os.path.join(IMG, 'cat-edibles-560.webp')).convert('RGB')
    a = np.asarray(src).astype(float)
    mx = a.max(2)
    sat = (mx - a.min(2)) / np.maximum(mx, 1)
    soft = np.clip((sat - .2) / .16, 0, 1) * np.clip((mx - 22) / 20, 0, 1)
    im = to_img((soft > .5).astype(float))
    im = im.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))      # open: drop specks
    im = im.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))    # close: sugar-coating gaps
    core = np.asarray(im) > 127
    lab, sizes = components(core)
    keep = [i for i, s in enumerate(sizes) if i and s >= 600]
    core = fill_holes(np.isin(lab, keep))
    body = np.asarray(to_img(core.astype(float)).filter(ImageFilter.MinFilter(3))) > 127
    rim = np.asarray(to_img(core.astype(float)).filter(ImageFilter.MaxFilter(3))) > 127
    alpha = to_img(np.where(body, 1.0, np.where(rim, soft, 0.0))).filter(ImageFilter.GaussianBlur(.7))
    cut = src.convert('RGBA')
    cut.putalpha(alpha)
    return cut.crop(alpha.point(lambda p: 255 if p > 8 else 0).getbbox())


def save(cut, slug, widths):
    out = {}
    origin = SHARED.get(f'cat-{slug}-560', {}).get('origin', '')
    for w in widths:
        w = min(w, cut.width)
        im = cut if w == cut.width else cut.resize((w, round(cut.height * w / cut.width)), Image.LANCZOS)
        name = f'visit-cut-{slug}-{w}.webp'
        im.save(os.path.join(IMG, name), 'WEBP', quality=84, method=6)
        out[f'visit-cut-{slug}-{w}'] = {'file': 'assets/img/' + name, 'w': im.width, 'h': im.height, 'origin': origin, 'alt': '',
                                         'role': 'DECORATIVE CUT-OUT'}
    return out


def main():
    data = {'_note': 'Visit lane cut-out, made by src/tools/visit-images.py from src/assets-static/img/cat-edibles-560.webp (the live Springfield category shot). Decorative (alt empty).'}
    e = edibles()
    data.update(save(e, 'edibles', [280]))
    with open(OUT_JSON, 'w') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    for k, x in data.items():
        if not k.startswith('_'):
            print(k, x['w'], 'x', x['h'])
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        sheet = Image.new('RGBA', (e.width + 40, e.height + 40), GROUND + (255,))
        sheet.alpha_composite(e, (20, 20))
        sheet.convert('RGB').save(p)
        print('preview', p)


if __name__ == '__main__':
    main()
