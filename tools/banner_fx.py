"""Animated banner layers: themes, geometric border, spotlight beam and
animated subjects with recolouring and palette cycling.

The static layer (background and text) is drawn by a browser so text matches
the web editor; the layers here are composited on top with Pillow and NumPy.
Every random choice comes from one seeded generator, recorded in the output
settings, so a banner can be rebuilt exactly.
"""
import colorsys
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageSequence

W, H = 1500, 500
THEMES_PATH = Path(__file__).with_name('themes.json')


def rgb(hex_colour):
    h = hex_colour.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- themes
def load_theme(name, rng):
    themes = json.loads(THEMES_PATH.read_text(encoding='utf-8'))['themes']
    if name == 'random':
        name = rng.choice(sorted(themes))
    elif name.startswith('random:'):
        pool = sorted(k for k, v in themes.items() if name[7:] in v.get('tags', []))
        if not pool:
            raise ValueError('No theme tagged %r' % name[7:])
        name = rng.choice(pool)
    if name not in themes:
        raise ValueError('Unknown theme %r; choose one of: %s' % (name, ', '.join(sorted(themes))))
    return name, themes[name]


def tone(theme, value):
    """Resolve a colour reference: '#rrggbb', 'main', 'main2', 'accent1'..,
    'contrast', 'background' or 'text.<key>'."""
    if value.startswith('#'):
        return value
    if value.startswith('text.'):
        return theme['text'][value[5:]]
    if value.startswith('main'):
        return theme['main'][int(value[4:] or 1) - 1]
    if value.startswith('accent'):
        return theme['accents'][int(value[6:] or 1) - 1]
    return theme[value]


# ---------------------------------------------------------------- border
def _shape(draw, kind, box, colour, s):
    x0, y0, x1, y1 = [v * s for v in box]
    if kind == 'circle':
        draw.ellipse((x0, y0, x1, y1), fill=colour)
    elif kind == 'ring':
        draw.ellipse((x0, y0, x1, y1), outline=colour, width=int(5 * s))
    elif kind == 'triangle':
        draw.polygon([(x0, y1), (x1, y1), (x1, y0)], fill=colour)
    elif kind == 'triangle-tr':
        draw.polygon([(x0, y0), (x1, y0), (x1, y1)], fill=colour)
    elif kind == 'triangle-tl':
        draw.polygon([(x0, y0), (x1, y0), (x0, y1)], fill=colour)
    elif kind == 'bar':
        draw.rectangle((x0, y0, x1, y1), fill=colour)
    elif kind == 'dots':
        step = 18 * s
        r = 3.2 * s
        y = y0
        while y <= y1:
            x = x0
            while x <= x1:
                draw.ellipse((x - r, y - r, x + r, y + r), fill=colour)
                x += step
            y += step
    elif kind == 'stripes':
        step, width = 16 * s, 5 * s
        x = x0 - (y1 - y0)
        while x < x1:
            draw.polygon([(x, y1), (x + width, y1), (x + width + (y1 - y0), y0), (x + (y1 - y0), y0)], fill=colour)
            x += step


# Slots keep shapes on the edges, clear of the text block (x 60-970, y 60-400).
BORDER_PRESETS = {
    # Solid shapes only: no dot grids or stripes.
    'bold': [
        ('top-left', [('triangle-tl', (0, 0, 130, 130))]),
        ('top-right', [('triangle-tr', (1370, 0, 1500, 130)), ('circle', (1420, -80, 1580, 80))]),
        ('bottom-left', [('circle', (-90, 410, 110, 610)), ('triangle', (0, 380, 120, 500))]),
        ('bottom-right', [('triangle', (1380, 380, 1500, 500)), ('ring', (1410, 420, 1570, 580))]),
        ('left-edge', [('bar', (0, 160, 10, 340))]),
    ],
    'modern': [
        ('top-left', [('triangle-tl', (0, 0, 120, 120)), ('dots', (16, 16, 70, 52))]),
        ('top-right', [('triangle-tr', (1380, 0, 1500, 120)), ('ring', (1430, -40, 1530, 60)), ('dots', (1420, 16, 1484, 52))]),
        ('bottom-left', [('circle', (-90, 420, 110, 620)), ('ring', (-60, 440, 80, 580))]),
        ('bottom-right', [('triangle', (1380, 380, 1500, 500)), ('circle', (1430, 430, 1570, 570)), ('stripes', (1360, 470, 1500, 500))]),
        ('bottom-edge', [('bar', (180, 488, 520, 500)), ('stripes', (200, 478, 470, 500))]),
        ('left-edge', [('bar', (0, 150, 10, 330))]),
    ],
}


def border_layer(theme, preset, rng, scale=3):
    """RGBA overlay of edge shapes, supersampled for clean edges."""
    if preset not in BORDER_PRESETS:
        raise ValueError('Unknown border preset %r' % preset)
    big = Image.new('RGBA', (W * scale, H * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(big)
    palette = [theme['main'][0]] + theme['accents'] + [theme['contrast']]
    used = []
    for _slot, options in BORDER_PRESETS[preset]:
        kind, box = rng.choice(options)
        colour = rng.choice([c for c in palette if c not in used[-1:]])
        used.append(colour)
        _shape(draw, kind, box, rgb(colour) + (230,), scale)
    return big.resize((W, H), Image.LANCZOS)


# ---------------------------------------------------------------- spotlight
def spotlight_layer(cx, floor_y, top_width=70, floor_width=380, strength=0.30, colour='#fff4dc'):
    """Overhead stage beam: a soft cone from above the top edge to a floor pool.
    Returns a float array (H, W, 4): RGB colour and per-pixel alpha."""
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    top = -60.0
    t = np.clip((ys - top) / (floor_y - top), 0, 1)
    half = (top_width + (floor_width - top_width) * t) / 2
    d = np.abs(xs - cx) / half
    across = np.clip(1 - d, 0, 1) ** 0.8          # soft sides
    down = 0.55 + 0.45 * (1 - t)                    # brighter near the source
    beam = across * down * (ys <= floor_y + 6)
    # Floor pool: a flat ellipse where the beam lands.
    ex, ey = floor_width * 0.62, 26.0
    pool = np.clip(1 - ((xs - cx) / ex) ** 2 - ((ys - floor_y) / ey) ** 2, 0, 1) ** 0.7
    alpha = np.clip(beam * strength + pool * strength * 1.25, 0, 1)
    out = np.zeros((H, W, 4), np.float32)
    out[..., :3] = np.array(rgb(colour), np.float32) / 255
    out[..., 3] = alpha
    return out


def apply_light(base, light):
    """Screen-blend a light layer onto an RGB float image (0-1)."""
    a = light[..., 3:4]
    return 1 - (1 - base) * (1 - light[..., :3] * a)


# ---------------------------------------------------------------- subjects
def load_frames(path):
    with Image.open(path) as im:
        frames = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(im)]
        duration = im.info.get('duration', 40) or 40
    return frames, duration / 1000


def union_bbox(frames):
    box = [10 ** 9, 10 ** 9, 0, 0]
    for f in frames:
        b = f.getchannel('A').getbbox()
        if b:
            box = [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
    return box


def recolour(frame, body, detail, keep_sat=0.30):
    """Recolour a two-tone model: saturated pixels follow `body`, softer ones
    `detail`, shading kept from the original brightness. Greys (claws, teeth)
    and yellows (eyes) are left alone."""
    a = np.asarray(frame).astype(np.float32) / 255
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.zeros_like(mx)
    m = (mx - mn) > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(mx - mn, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(mx - mn, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(mx - mn, 1e-6), 0)
    hue = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    hue = (hue / 6) % 1 * 360
    eyes = (hue > 38) & (hue < 75) & (sat > 0.4)
    change = (al > 0.5) & (sat > keep_sat) & ~eyes
    w = np.clip((sat - 0.53) / 0.4, 0, 1)[..., None]          # 0 = detail, 1 = body
    tb, td = np.array(rgb(body), np.float32) / 255, np.array(rgb(detail), np.float32) / 255
    target = td * (1 - w) + tb * w
    ref = 0.61 * (1 - w) + 0.62 * w                              # reference brightness of the source tones
    shaded = np.clip(target * (mx[..., None] / ref), 0, 1)
    out = a.copy()
    out[..., :3] = np.where(change[..., None], shaded, a[..., :3])
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')


class Subject:
    """An animated (or still) subject placed by its union bounding box."""

    def __init__(self, spec, theme, rng):
        self.spec = spec
        self.frames, self.step = load_frames(spec['image'])
        bb = union_bbox(self.frames)
        self.scale = spec['height'] / (bb[3] - bb[1])
        self.mirror = spec.get('mirror', False)
        mid = (bb[0] + bb[2]) / 2
        if self.mirror:
            mid = self.frames[0].width - mid       # the box flips with the frame
        self.ox = spec['x'] - mid * self.scale
        self.oy = spec['floor'] - bb[3] * self.scale
        self.phase = spec.get('phase', 0.0)
        self.palettes = [(tone(theme, p[0]), tone(theme, p[1])) for p in spec.get('palettes', [])]
        self.switches = []
        cyc = spec.get('cycle')
        if cyc:
            t, lo, hi = 0.0, cyc[0], cyc[1]
            while t < spec.get('_length', 60):
                t += rng.uniform(lo, hi)
                self.switches.append(round(t, 3))
        self._cache = {}

    def palette_at(self, t):
        if not self.palettes:
            return None
        return self.palettes[sum(1 for s in self.switches if s <= t) % len(self.palettes)]

    def frame_at(self, t):
        n = len(self.frames)
        i = int(round((t / self.step) + self.phase * n)) % n
        pal = self.palette_at(t)
        key = (i, pal)
        if key not in self._cache:
            f = self.frames[i]
            if pal:
                f = recolour(f, *pal)
            size = (round(f.width * self.scale), round(f.height * self.scale))
            f = f.resize(size, Image.LANCZOS)
            if self.mirror:
                f = f.transpose(Image.FLIP_LEFT_RIGHT)
            # Hard alpha keeps the model's flat-shaded look crisp on any background.
            f.putalpha(f.getchannel('A').point(lambda v: 255 if v > 127 else 0))
            self._cache = {key: f}  # one frame per subject is enough
        return self._cache[key]

    def paste(self, canvas, t):
        f = self.frame_at(t)
        canvas.alpha_composite(f, (round(self.ox), round(self.oy)))


# ---------------------------------------------------------------- compose
def compose(static_rgb, theme, spec, rng, progress=None):
    """Yield (time, RGB frame) for the whole loop."""
    border = border_layer(theme, spec.get('border', 'modern'), rng) if spec.get('border') else None
    base = static_rgb.convert('RGBA')
    if border:
        base.alpha_composite(border)
    base_f = np.asarray(base.convert('RGB')).astype(np.float32) / 255
    for sp in spec.get('spotlights', []):
        base_f = apply_light(base_f, spotlight_layer(**sp))
    base = Image.fromarray((base_f * 255 + 0.5).astype(np.uint8), 'RGB').convert('RGBA')
    subjects = []
    for s in spec['subjects']:
        s = dict(s, _length=spec.get('length', 0) or 60)
        subjects.append(Subject(s, theme, rng))
    step = spec.get('frame_time') or subjects[0].step
    length = spec.get('length') or len(subjects[0].frames) * subjects[0].step
    count = int(round(length / step))
    for k in range(count):
        t = k * step
        im = base.copy()
        for s in subjects:
            s.paste(im, t)
        if progress:
            progress(k, count)
        yield t, im.convert('RGB')


def save_animation(frames, out_gif, out_webp, frame_time):
    """GIF (shared palette) for compatibility; lossless WebP at full quality."""
    frames = list(frames)
    ms = int(round(frame_time * 1000))
    frames[0].save(out_webp, save_all=True, append_images=frames[1:], duration=ms, loop=0, lossless=True, method=4)
    sample = Image.new('RGB', (W, H * 4))
    for i, k in enumerate(np.linspace(0, len(frames) - 1, 4).astype(int)):
        sample.paste(frames[k], (0, H * i))
    pal = sample.quantize(255, method=Image.Quantize.MEDIANCUT)
    idx = [np.asarray(f.quantize(palette=pal, dither=Image.Dither.NONE)) for f in frames]
    # Lossless size saving: pixels unchanged since the previous frame become the
    # transparent index 255, and each frame keeps the one before (disposal 1).
    flat = pal.getpalette()[:255 * 3] + [0, 0, 0]
    out = []
    for k, cur in enumerate(idx):
        d = cur.copy()
        if k:
            d[cur == idx[k - 1]] = 255
        im = Image.fromarray(d.astype(np.uint8), 'P')
        im.putpalette(flat)
        out.append(im)
    out[0].save(out_gif, save_all=True, append_images=out[1:], duration=ms, loop=0,
                transparency=255, disposal=1, optimize=False)
    return frames
