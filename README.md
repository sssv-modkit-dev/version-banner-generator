>[!WARNING]
> ⚠ WARNING: this documentation was not hand-written and has been deemed as low-quality AI work. (Source: the person behind this repository)  
> ⚠ WARNING: this banner generator was not hand-written and has been deemed as low-quality AI over-engineered feature-sprawled work. (Source: the person behind this repository)

WORK IN PROGRESS

# version-banner-generator

![Synthetic release-banner example](assets/demo-banner.png)

Minimal release banners made from your own transparent renders: a dark background,
palette-coloured italic edition title, matched quotation marks and a character image.
Includes one-command PNG export, future-concept batches and a resolved JSON recipe.

**Current scope:** a browser Banner Lab for local PNG/JPEG sheets and a standalone
Windows PowerShell/System.Drawing compositor. Both export 1500 x 500 banners.
No AI generation, model renderer, game adapter or original modkit installation is
required. The examples are original artwork.

## Banner Lab

**[Open Banner Lab](https://sssv-modkit-dev.github.io/version-banner-generator/)**


The browser lab starts in a light **Simple View**: open a PNG/JPEG, let it suggest
sprite crops, pick a subject, edit your text/colour and download. Its two tabs are
Create and Batch. **Advanced View** preserves your project and reveals exact crop
rectangles, draggable guides, layered parts assemblies, three layouts, palettes,
matched quotes, seeded randomization and single PNG or batch ZIP downloads.
Recipes preserve settings and check the original images when reopened. Images stay
on the visitor's device; the app has no uploads, analytics or external font calls.
Detection handles transparent sheets and common flat/printed backgrounds, with
manual corrections available. Flat sprite backgrounds become transparent automatically;
turn this off to keep the original. Rotate 90 degrees or flip horizontally/vertically
in either view. Preview, PNG, batch exports and recipes retain these settings. The
searchable picker shows 96 sprites at a time, with a Show all option. Combine
several sprites as layers, download transparent cutouts, and style each text element
independently while themes coordinate the defaults. The demo includes an original
character sheet and animated, editable mashups; PNG exports are still images.

Preview the implementation locally:

```text
node tools/build-web.mjs
python tools/serve-web.py
```

Open <http://127.0.0.1:8765/> for local development. The public Banner Lab runs on
GitHub Pages with no installation. See [usage, checks and deployment](docs/BANNER-LAB.md) and the
[implementation checklist](docs/PAGES-DEMO-PLAN.md).

## Give this to your coding bot

[BOT-BRIEF.md](BOT-BRIEF.md) explains how to adapt the idea to a modding project,
including verified head selections, camera presets and selective recolouring.
It distinguishes the working compositor from future adapter integration.

## Generate a banner

Run from the repository root on Windows:

```powershell
powershell -NoProfile -File tools/make-banner.ps1
```

This writes `build/release-banner.png` and `build/release-banner.json`.
Existing images or recipes are never silently overwritten. Use `-Out` for a new path.

```powershell
powershell -NoProfile -File tools/make-banner.ps1 -Project 'MY GAME MODKIT' -Name 'Jadeish Crown Raven' -Version 'v0.2.0' -Palette green -QuoteStyle french -ImagePath private/raven-head.png -Out build/raven-v0.2.png
powershell -NoProfile -File tools/make-banner.ps1 -Batch -Out build/future-concepts
```

| Option | Meaning |
| --- | --- |
| `-Project` | Small project label |
| `-Name` | Release name; quotation marks and `edition` are added automatically |
| `-Version` | Secondary text; default `CONCEPT` |
| `-Palette` | `blue`, `orange`, or `green` text/accent palette |
| `-QuoteStyle` | `random` (default), `english`, `french`, `spanish`, `german`, or `japanese` |
| `-ImagePath` | Local transparent PNG; defaults to the included original prism |
| `-Out` | PNG path, or batch output directory |
| `-Batch` | Three palette/name concepts labelled `FUTURE CONCEPT`; uses the selected image |

Names and versions are plain text. Batch mode uses its example names rather than
`-Name` or `-Version`. Palettes change text and accents, not image pixels. Random
quote styles are recorded independently per output. Layout is fixed at 1500 x 500;
long titles shrink to fit. Very long project/release names are rejected.

For the same typography across machines, use the same Windows fonts. Each recipe
records the selected quote style, caption, palette, font, dimensions and input
image SHA256. It contains only the input basename, not a private absolute path.
To reproduce a banner, supply the recorded values and the same image/font setup;
automatic CLI recipe replay is not implemented yet.

## Connect your game

The compositor consumes a transparent PNG. A separate game adapter should render
verified geometry with saved camera settings and perform material/part recolours
before calling it. See [the adapter contract](docs/ADAPTERS.md). You can start with
a cached render without pretending that arbitrary model rendering is automated.

Keep private assets in `private/` or outside this repository. ROMs, extracted
models, textures, private indexes and game-derived renders are not included.
The software licence does not grant rights to game imagery.

## Check it

```powershell
powershell -NoProfile -File tools/smoke-test.ps1
```

The checks generate all quote styles and a batch, inspect PNG dimensions and JSON
recipes, and confirm overwrite refusal. Visual checks remain separate. The original
demo can be recreated with `examples/make-demo.ps1` when its PNG is absent.

Original code, documentation and synthetic demos are dedicated under
[CC0 1.0 Universal](LICENSE). Bundled fonts use SIL OFL 1.1 and fflate uses MIT;
see [asset provenance and licences](web/assets/README.md).
Third-party inputs retain their own terms.
