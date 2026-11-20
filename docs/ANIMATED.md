# Animated banners

`tools/make-animated-banner.py` makes a 1500 × 500 animated banner from a JSON spec:

```sh
python tools/make-animated-banner.py my-banner.json --out build/my-banner
```

It writes `my-banner.gif` (for compatibility), `my-banner.webp` (lossless), `my-banner.png`
(a still at `still_time`) and `my-banner.json` (the spec plus the seed, theme and quote style
that were used). Existing files are never overwritten. Needs Python 3.8+, Pillow, NumPy and a
local Chrome, Chromium or Edge (the text is drawn by the browser, like the static tool).

## Spec

| Key | Meaning |
|---|---|
| `project`, `version`, `version_size` | Small top line, version line and its font size (default 21). `rows` sets the y of `bar`, `project`, `title` lines, `rule` and `version`, so the version can sit under the rule. |
| `theme` | A name from `tools/themes.json`, `random`, or `random:<tag>` (e.g. `random:bold` for saturated themes). |
| `quote_style` | `english`, `french`, `spanish`, `german`, `japanese` or `random`. |
| `seed` | Fixes every random choice (theme, quotes, border shapes, palette timing). `--seed` overrides it. |
| `layout` | `left` (text left, subject right) or `center` (text centred, subjects either side). `text_width` sets the centred block width. |
| `title` | A string, or a list of lines: `{"parts": [{"text", "tone", "weight"}], "size"}`. Quotes wrap the whole title; `suffix` (default ` edition`) joins the last line, muted. |
| `border` | A geometric edge preset: `modern` (mixed shapes, dots, stripes) or `bold` (solid shapes only); shapes stay clear of the text block. Omit for none. |
| `spotlights` | Overhead beams: `cx`, `floor_y`, `top_width`, `floor_width`, `strength`, optional `colour`. |
| `subjects` | Animated GIFs or still PNGs with transparency: `image`, `x` (centre), `floor` (bottom), `height`, `mirror`, `phase` (0–1 of the loop), `palettes`, `cycle`. |

`palettes` is a list of `[body, detail]` colour pairs: saturated parts take the first, softer
parts the second, shading is kept, and greys and yellows (claws, eyes) stay as they are. With one
pair the subject is simply recoloured. With `cycle: [min, max]` (seconds) it switches to the next
pair after a random interval in that range.

Colour values are `#rrggbb` or theme references: `main`, `main2`, `accent1`–`accent3`,
`contrast`, `background`, `text.accent`, `text.muted`, `text.project`, `text.subtitle`.

## Themes

Each theme in `tools/themes.json` has a background, one or two `main` colours, a few `accents`,
a `contrast` colour from the opposite side of the wheel, and text tones. Add a theme by adding an
entry; `random` picks among all of them.

## Adding effects

Layers live in `tools/banner_fx.py`: `border_layer` (add shapes to `_shape`, slots to
`BORDER_PRESETS`), `spotlight_layer`, `recolour` and `Subject`. `compose` stacks them over the
browser-drawn text layer.
