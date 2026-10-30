# Bundled assets

- `demo-sheet.png`: six original character sprites drawn by
  `tools/make-demo-sheet.py` (gem, robot, leafy cat, caterpillar, ghost and flower).
  The remix cards combine these sprites as editable layers.
  These examples and `mark.svg` are covered by the repository's CC0 dedication.
- `Lato-Regular.ttf`, `Lato-BoldItalic.ttf`: Lato by the Lato Project authors,
  retrieved from `google/fonts/ofl/lato`; see `Lato-OFL.txt` (SIL OFL 1.1).
- `LabQuotes.ttf`: modified subset of Noto Sans JP from
  `google/fonts/ofl/notosansjp/NotoSansJP[wght].ttf`, containing U+300C and U+300D.
  Renamed family to Lab Quotes. See `NotoSansJP-OFL.txt` (SIL OFL 1.1).
  Other scripts may need system fallback fonts.
- `fflate.mjs`: unmodified browser ESM build of **fflate 0.8.2**, from
  `https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js`.
  MIT licence: `fflate-LICENSE.txt`. Used for streaming ZIP packaging.

Downloaded 2026-10-30 with `tools/fetch-web-assets.py`. Normal builds and browser
sessions do not download dependencies. Artifact SHA256 values are recorded by
`tools/build-web.mjs` in `site/dist/artifact-manifest.json`.
