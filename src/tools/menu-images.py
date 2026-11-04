#!/usr/bin/env python3
"""menu-images.py — the menu lane's own cut-outs (review finding: the shared luminance-keyed vape and edibles cut-outs
read as photos in a spotlight — the vape keeps the photo's grey-white studio disc, the edibles keep the slate's oval).

Inputs  : src/assets-static/img/cat-vapes-560.webp, cat-edibles-560.webp (the live category shots, already derived by
          src/tools/prepare-images.py from the live site's own files). Nothing generated, nothing from the sister store.
Outputs : src/assets-static/img/menu-cut-<slug>-<w>.webp and src/content/images.d/menu.json
          (keys menu-cut-<slug>-<w>; same shape as images.json: file, w, h, origin, alt, role)

  vapes   : the backdrop is a smooth neutral gradient. A 2-D polynomial fitted to the pixels left and right of the product
            models it; a pixel belongs to the product where it differs from that model. Each row is filled between its
            outermost product pixels (the vape is convex row by row), the edges are smoothed, and the box fades out at the
            bottom of the frame instead of ending in a hard line.
  edibles : the slate, its speckles, the smoke and the shadow are near-neutral; the chocolate and the gummies are not.
            Alpha comes from HSV saturation, small specks are dropped, the gaps the sugar coating leaves are closed and
            holes are filled.

  python3 -I src/tools/menu-images.py            (writes the files)
  python3 -I src/tools/menu-images.py --preview <png>   (also writes a contact sheet on the site's ground colour)
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'src', 'assets-static', 'img')
OUT_JSON = os.path.join(ROOT, 'src', 'content', 'images.d', 'menu.json')
SHARED = json.load(open(os.path.join(ROOT, 'src', 'content', 'images.json')))


def largest_component(mask, seed=None):
    """4-connected component of a boolean mask: the one containing `seed` (y, x), else the largest."""
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    best, best_n, cur = 0, 0, 0
    seeds = [seed] if seed is not None else zip(*np.nonzero(mask))
    for sy, sx in seeds:
        if not mask[sy, sx] or lab[sy, sx]:
            continue
        cur += 1; n = 0; q = deque([(sy, sx)]); lab[sy, sx] = cur
        while q:
            y, x = q.popleft(); n += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur; q.append((ny, nx))
        if n > best_n:
            best, best_n = cur, n
        if seed is not None:
            break
    return lab == best if best else np.zeros_like(mask)


def keep_large(mask, min_px):
    """Drop 4-connected components smaller than min_px (specks, sugar crystals on the slate)."""
    H, W = mask.shape
    seen = np.zeros_like(mask); out = np.zeros_like(mask)
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        comp = []; q = deque([(sy, sx)]); seen[sy, sx] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        if len(comp) >= min_px:
            ys, xs = zip(*comp); out[list(ys), list(xs)] = True
    return out


def fill_holes(mask):
    """Everything not reachable from the border through background becomes part of the object."""
    bg = ~mask
    H, W = mask.shape
    reach = np.zeros_like(mask)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if bg[y, x] and not reach[y, x]: reach[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if bg[y, x] and not reach[y, x]: reach[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and bg[ny, nx] and not reach[ny, nx]:
                reach[ny, nx] = True; q.append((ny, nx))
    return ~reach


def to_img(mask_f):
    return Image.fromarray(np.clip(mask_f * 255, 0, 255).astype(np.uint8), 'L')


def vapes():
    src = Image.open(os.path.join(IMG, 'cat-vapes-560.webp')).convert('RGB')
    a = np.asarray(src).astype(float)
    H, W, _ = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    u, v = xx / W - .5, yy / H - .5
    terms = [u ** i * v ** j for i in range(5) for j in range(5 - i)]           # degree-4 polynomial, 15 terms
    A = np.stack([t.ravel() for t in terms], 1)
    fit = ((xx < 160) | (xx > 415) | (yy < 215)).ravel()                        # backdrop only (product: x 165-410, y > 225)
    bg = np.empty_like(a)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A[fit], a[..., c].ravel()[fit], rcond=None)
        bg[..., c] = (A @ coef).reshape(H, W)
    d = np.abs(a - bg).max(2)
    m = d > 45                                       # the fit under-reads the halo peak by up to ~35 next to the tank
    m[:, :160] = False; m[:, 416:] = False                                      # outside the product strip: backdrop
    m = largest_component(m)
    # row spans, then a running median so one stray pixel cannot widen a row
    L = np.full(H, -1.0); R = np.full(H, -1.0)
    for y in range(H):
        xs = np.nonzero(m[y])[0]
        if len(xs) >= 3: L[y], R[y] = xs.min(), xs.max()
    rows = np.nonzero(L >= 0)[0]
    top = rows.min()
    def med(arr):
        out = arr.copy()
        for y in rows:
            win = arr[max(top, y - 4): y + 5]; win = win[win >= 0]
            out[y] = np.median(win)
        return out
    L, R = med(L), med(R)
    # the box (the widest rows) has straight sides that fade into the dark lower down, where the edge test weakens:
    # from the first full-width row down, its sides are the median of the full-width rows
    wid = R - L
    full = rows[wid[rows] >= .85 * wid[rows].max()]
    Lb, Rb, mid = np.median(L[full]), np.median(R[full]), int(np.median(full))
    for y in range(full.min(), H):            # the bevel at the top of the box keeps its detected (narrower) rows
        if y > mid and (L[y] < 0 or R[y] - L[y] < .85 * (Rb - Lb)): L[y], R[y] = Lb, Rb
        elif L[y] >= 0: L[y], R[y] = max(L[y], Lb), min(R[y], Rb)
        else: L[y], R[y] = Lb, Rb
    rows = np.arange(top, H)
    alpha = np.zeros((H, W))
    for y in rows:
        l, r = L[y], R[y]
        # 1px soft edge on each side (sub-pixel coverage)
        alpha[y] = np.clip(np.minimum(xx[y] - l + 1, r + 1 - xx[y]), 0, 1)
    # the box runs off the bottom of the photo: let it fade into the dark instead of ending in a hard line
    f0, f1 = int(H * .70), H
    ramp = np.ones(H); ramp[f0:f1] = np.linspace(1, 0, f1 - f0) ** 1.4
    alpha *= ramp[:, None]
    a_img = to_img(alpha).filter(ImageFilter.GaussianBlur(.6))
    cut = src.convert('RGBA'); cut.putalpha(a_img)
    return cut.crop(a_img.point(lambda p: 255 if p > 8 else 0).getbbox())


def edibles():
    src = Image.open(os.path.join(IMG, 'cat-edibles-560.webp')).convert('RGB')
    a = np.asarray(src).astype(float)
    mx = a.max(2)
    sat = (mx - a.min(2)) / np.maximum(mx, 1)                                     # HSV saturation
    # slate, sugar specks, smoke and shadow are near-neutral (S < .15); chocolate and every gummy are not (S > .35),
    # dark navy gummies included; below max 22 the saturation of the black ground is noise
    soft = np.clip((sat - .2) / .16, 0, 1) * np.clip((mx - 22) / 20, 0, 1)
    core = soft > .5
    # drop specks (open), close the gaps the white sugar coating leaves (close), fill holes, drop small pieces
    im = to_img(core.astype(float))
    im = im.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    im = im.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))
    core = np.asarray(im) > 127
    core = keep_large(core, 600)
    core = fill_holes(core)
    # final alpha: the filled body, eased at its rim by the soft key so edges keep their real shape
    body = np.asarray(to_img(core.astype(float)).filter(ImageFilter.MinFilter(3))) > 127
    rim = np.asarray(to_img(core.astype(float)).filter(ImageFilter.MaxFilter(3))) > 127
    alpha = np.where(body, 1.0, np.where(rim, soft, 0.0))
    a_img = to_img(alpha).filter(ImageFilter.GaussianBlur(.7))
    cut = src.convert('RGBA'); cut.putalpha(a_img)
    return cut.crop(a_img.point(lambda p: 255 if p > 8 else 0).getbbox())


def save(cut, slug, widths):
    out = {}
    origin = SHARED[f'cat-{slug}-560']['origin'] if f'cat-{slug}-560' in SHARED else ''
    for w in widths:
        w = min(w, cut.width)
        im = cut if w == cut.width else cut.resize((w, round(cut.height * w / cut.width)), Image.LANCZOS)
        name = f'menu-cut-{slug}-{w}.webp'
        im.save(os.path.join(IMG, name), 'WEBP', quality=84, method=6)
        out[f'menu-cut-{slug}-{w}'] = {'file': 'assets/img/' + name, 'w': im.width, 'h': im.height, 'origin': origin, 'alt': '',
                                        'role': 'DECORATIVE CUT-OUT'}
    return out


def main():
    data = {'_note': 'Menu lane cut-outs, made by src/tools/menu-images.py from src/assets-static/img/cat-<slug>-560.webp (live category shots). Decorative (alt empty).'}
    v, e = vapes(), edibles()
    # widths: the stage draws a cut-out at most ~300 CSS px tall / 300 px wide; 2x screens need about twice that
    data.update(save(v, 'vapes', [v.width // 2, v.width]))
    data.update(save(e, 'edibles', [280, 440]))
    with open(OUT_JSON, 'w') as f:
        json.dump(data, f, indent=1); f.write('\n')
    for k, x in data.items():
        if not k.startswith('_'): print(k, x['w'], 'x', x['h'])
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        tiles = []
        for c in (v, e):
            base = Image.new('RGBA', c.size, (8, 22, 15, 255)); base.alpha_composite(c); tiles.append(base.convert('RGB'))
        Hh = 520
        tiles = [t.resize((round(t.width * Hh / t.height), Hh)) for t in tiles]
        sheet = Image.new('RGB', (sum(t.width for t in tiles) + 20, Hh), (60, 60, 60)); x = 0
        for t in tiles: sheet.paste(t, (x, 0)); x += t.width + 20
        sheet.save(p)


if __name__ == '__main__':
    main()
