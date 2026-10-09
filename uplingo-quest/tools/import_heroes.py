"""Import the AI-generated hero character sheets into assets/heroes/.

Each sheet is one row of six chibi characters on a flat magenta background, in class order:
wordsmith, knight, ranger, keeper, orator, scribe. The script removes the magenta,
splits the row at the empty columns between characters, trims each one and saves
assets/heroes/<class>_<m|f>.webp (transparent, max 640 px tall).

Usage:
  python3 tools/import_heroes.py boys.png girls.png
  python3 tools/import_heroes.py --download        # fetch the sheets from SHEET_URLS
"""
import os
import sys
import urllib.request

from PIL import Image

CLASSES = ['wordsmith', 'knight', 'ranger', 'keeper', 'orator', 'scribe']
# Figma AI image links (expire 7 days after generation, 2026-10-09).
SHEET_URLS = {
    'm': 'https://www.figma.com/api/mcp/asset/8ab80249-ea43-4033-8186-6fb3146ad5b5.png',
    'f': 'https://www.figma.com/api/mcp/asset/3ddabb9d-7795-446c-9d76-55e4079c33c4.png',
}
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'heroes')


def is_key(r, g, b):
    # Magenta-ish: strong red and blue, weak green (also catches anti-aliased edges).
    return r > 150 and b > 150 and g < 110 and abs(r - b) < 90


def remove_magenta(im):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_key(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif r > 120 and b > 120 and g < 140 and r - g > 60 and b - g > 60:
                # Soft fringe: fade it out and pull the colour away from pink.
                px[x, y] = (min(r, g + 40), g, min(b, g + 40), 110)
    return im


def split(im, n=6):
    w, h = im.size
    alpha = im.getchannel('A')
    cols = [sum(1 for y in range(0, h, 2) if alpha.getpixel((x, y)) > 40) for x in range(w)]
    filled = [c > 1 for c in cols]
    runs, start = [], None
    for x, f in enumerate(filled + [False]):
        if f and start is None:
            start = x
        elif not f and start is not None:
            runs.append([start, x])
            start = None
    # Merge runs separated by tiny gaps (staffs, bows) until there are n characters.
    while len(runs) > n:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps)
        runs[i] = [runs[i][0], runs[i + 1][1]]
        del runs[i + 1]
    if len(runs) < n:  # fall back to equal slices
        step = w / n
        runs = [[int(i * step), int((i + 1) * step)] for i in range(n)]
    return [im.crop((a, 0, b, h)) for a, b in runs]


def drop_edge_fragments(im):
    """Remove small blobs touching the left/right edge (props from the neighbouring hero)."""
    w, h = im.size
    alpha = im.getchannel('A')
    mask = [[alpha.getpixel((x, y)) > 40 for x in range(w)] for y in range(h)]
    seen = [[False] * w for _ in range(h)]
    blobs = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0][x0] or seen[y0][x0]:
                continue
            stack, pts, edge = [(x0, y0)], [], False
            seen[y0][x0] = True
            while stack:
                x, y = stack.pop()
                pts.append((x, y))
                if x <= 1 or x >= w - 2:
                    edge = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            blobs.append((pts, edge))
    total = sum(len(p) for p, _ in blobs) or 1
    px = im.load()
    for pts, edge in blobs:
        if edge and len(pts) < total * 0.18:
            for x, y in pts:
                px[x, y] = (0, 0, 0, 0)
    return im


def trim(im, pad=8):
    box = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def import_sheet(path, gender):
    os.makedirs(OUT, exist_ok=True)
    sheet = remove_magenta(Image.open(path))
    for cls, part in zip(CLASSES, split(sheet)):
        hero = trim(drop_edge_fragments(part))
        if hero.height > 640:
            hero = hero.resize((round(hero.width * 640 / hero.height), 640), Image.LANCZOS)
        out = os.path.join(OUT, f'{cls}_{gender}.webp')
        hero.save(out, 'WEBP', quality=90, method=6)
        print('saved', os.path.relpath(out), hero.size)


def main(args):
    if args and args[0] == '--download':
        for g, url in SHEET_URLS.items():
            path = os.path.join(OUT, f'_sheet_{g}.png')
            os.makedirs(OUT, exist_ok=True)
            urllib.request.urlretrieve(url, path)
            import_sheet(path, g)
            os.remove(path)
    elif len(args) == 2:
        import_sheet(args[0], 'm')
        import_sheet(args[1], 'f')
    else:
        print(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
