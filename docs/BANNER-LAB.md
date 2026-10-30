# Banner Lab development and release

The browser app implements the sheet-to-batch workflow in `web/`. It runs entirely
in the visitor's browser; normal use needs no installation or account. Local
development requires Node 22+ and Python 3.12+. Runtime dependencies and fonts are
bundled in `web/assets/`, with licences and provenance alongside them.

## Preview locally

```text
node tools/build-web.mjs
python tools/serve-web.py
```

Open <http://127.0.0.1:8765/>. The dedicated preview server supplies explicit
JavaScript MIME types, including on Windows. Stop it with Ctrl+C.

1. Simple View opens by default with two tabs: Create and Batch.
2. Open a PNG/JPEG. Local automatic detection proposes separate sprite crops.
3. Pick a thumbnail, edit the project/name/version and colour, then download a PNG.
4. Use Surprise me to change the subject and palette while keeping your text.
5. Choose Batch for seeded variations and ZIP export. Advanced View exposes exact
   cuts, assemblies, full styles, inclusion controls, seeds and recipe files.

Switching views preserves the project. On phones the preview stays above the
controls, the sprite picker comes before text settings, and controls have larger
touch targets. Advanced cutting still has numeric alternatives to dragging.

## Artwork, themes and remixes

The searchable picker defaults to 96 cards; choose 48, 192 or All. Search matches subject
and source-sheet names. Click a sprite to use it alone or choose Add to my composition
to combine artwork; Edit layers opens positioning, scale, rotation and ordering.
Download cutout PNG exports the subject with transparent surroundings, without text.

Background removal samples the most common border colour. Matching pixels
connected to the border become transparent; enclosed colours remain. Advanced Subject controls offer an explicit matte colour and tolerance.
The cleaned source is shared by cut trimming, thumbnails, cutouts, preview and exports.
Natural sizing limits small-artwork enlargement to 2x at the default placement;
Fill restores full-area fitting. It does not create missing detail. Further manual
scaling remains possible. Original files and hashes stay unchanged.

Themes supply coordinated title, project, subtitle, background and accent colours.
Text elements each have independent colour, size and lettering overrides. Theme changes
keep those overrides; Follow theme clears the selected element's override. Recipes and
batches retain all styling and cleanup settings; older recipes retain legacy defaults.

The demo uses six original character sprites to make three layered compositions. Each
combines three editable layers. The preview animates those layers, can be paused, and
respects reduced-motion preferences and hidden tabs. Select a remix to edit it; exports
remain static PNGs. User imports hide the demo and are never used in public examples.

## Automatic detection

Uploads are analysed in a local Web Worker. The detector uses alpha for transparent
atlases, estimates solid border mattes, and ignores pale printed grids/checkerboards
when finding connected foreground regions. It groups overlapping details, filters
small annotations and proposes integer crop rectangles in approximate reading order.
Original files stay unchanged. Rendering automatically removes a dominant flat colour
connected to the source image border, preserving enclosed matching colours. Disable
Automatically remove sprite background to keep the original. Busy backgrounds and
checkerboards may remain; this is not character recognition or OCR. Rotate 90 degrees
and both flip buttons are available in Simple and Advanced View and saved in recipes.

Suggestions can split detached effects, combine touching sprites or include stray
artwork. An ambiguous image stays as one whole-image crop with an explanatory
message. Use Find sprites again to repeat detection, or Adjust cuts to refine
rectangles, grid spacing or custom guides in Advanced View. Detection is an initial
suggestion, not a guarantee of a correct cell for every frame. Small transparent
pixel-art atlases default to crisp sampling; Advanced View can override smoothing.

Only the first user image replaces the demo artwork; later imports add sheets.
The newly imported source is selected immediately.

The in-app [help](../web/help.html) explains each control, limits and recipe replay.

## Checks

```text
npm ci
npx playwright install chromium firefox
npm test
npm run build
npm run test:browser
```

Linux CI installs browser system dependencies with `--with-deps`. Tests serve the
built artifact under `/dist/`, exercising project-subpath asset URLs. Unit checks
cover slice geometry, background masks, component grouping, alpha bounds, stable
randomness, locks, safe names, counts and recipe validation. Browser checks cover
simple/advanced switching, mobile layouts, automatic PNG/JPEG detection, crop controls, assemblies,
all quote styles, PNG/ZIP output, missing-source replay, cancellation, malformed
files and narrow viewports. Playwright is development-only.

Screenshots and downloads go to ignored `test-results/`. Inspect actual output
at full size and README scale separately; passing tests alone is not visual QA.
The simple-view revision passed 14 unit checks plus Chromium/Firefox browser
regressions for the editor and exports. Additional checks cover JPEG replay,
view switching, mobile ordering, paginated multi-sheet selection and Chromium
mobile/touch emulation. Five owner-provided sheets were tested locally, without
copying their source images into the project. Suggested crops and desktop/mobile
screenshots received a separate visual review. These are candidate bounds, not
independently verified frame labels or a claim that every effect was grouped.

A prior complete 100-banner Chromium measurement produced an 8,195,750-byte ZIP
with 201 entries. This measures the geometric demo, not worst-case inputs.
Physical touch hardware, Safari and the live Pages origin remain unverified.

The existing PowerShell smoke test remains independent:

```powershell
powershell -NoProfile -File tools/smoke-test.ps1
```

## Data and module boundaries

- `core.mjs`: format/version, limits, PNG header checks, slicing, alpha bounds,
  deterministic choices, batch planning and recipe validation. No DOM dependency.
- `render.mjs`: font readiness, subject layers and one shared 1500 x 500 renderer
  for live preview and exports. No PowerShell font/layout parity claim.
- `app.mjs`: local image lifecycle, sheet draft/apply/undo, controls, gallery,
  source hash reconciliation, batch preview and sequential ZIP production.
- `detect.mjs` and `detect-worker.mjs`: bounded background-aware region suggestions,
  run off the main UI thread. Imported artwork never leaves the browser.
- `tools/build-web.mjs`: explicit public-file allowlist and SHA256 artifact
  manifest. Refuses unknown files or symlinks already in the output directory.

Browser recipes use `banner-lab-v1` and record generator/font versions, source
basenames and SHA256 hashes, integer crops (including pre-trim bounds), layered
assemblies, inclusion flags, cut settings, output dimensions, sampling, banner
settings and resolved seeds. They contain no source image bytes or absolute paths.
Reopening validates both the schema and original source hashes. Pending recipe
images are isolated until all sources match, preserving the current project.

CLI `version-banner-generator-v1` recipes remain unchanged. Browser import rejects
them with guidance to open the PNG and enter recorded values manually. Cross-browser
pixel-identical rendering and offline `file://` operation are not promised.

Limits: 20 MB/file, 4096 px/side, 8 megapixels/image, 8 sheets, 24 megapixels/project,
1,024 regions/sheet, 1,124 subjects/project, 32 layers/subject, 100 banners/batch and
128 MB/ZIP. PNG/JPEG dimensions are checked before decoding; APNG is rejected. Large
projects still depend on device memory. Batch settings are frozen during rendering;
errors/cancellation discard the ZIP. Edits after planning invalidate stale batches.

The original examples are code-generated character sprites. Refresh with
`python tools/make-demo-sheet.py` (Pillow required). Asset maintenance uses
`tools/fetch-web-assets.py` (network and fontTools required); neither is run by a
normal build. See `web/assets/README.md` before changing dependencies or fonts.

Optional private example QA accepts an array of local file paths through the
`BANNER_LAB_EXAMPLE_FILES` environment variable when running Playwright. No example
inputs are copied into the repository or public artifact. Any private screenshots
or generated banners stay under ignored `test-results/`; reports stay under
ignored `build/`. Public CI does not set that variable and uses synthetic inputs.

## GitHub Pages

The workflow `.github/workflows/banner-lab-pages.yml` runs checks for relevant
pull requests. Deployment is manual, restricted to `main`, and uploads **only
`site/dist`**. It does not publish on every push. The public app is at
<https://sssv-modkit-dev.github.io/version-banner-generator/>.

For the first release:

1. Review the source changes, bundled licences and `site/dist/artifact-manifest.json`.
   Confirm no private images, local recipes or research appear in that allowlist.
2. Approve the public release, commit/push the reviewed changes, and select
   **GitHub Actions** in repository Settings -> Pages.
3. Dispatch **Banner Lab checks and Pages** from `main`. The build and browser
   checks must pass before the Pages deploy job runs.
4. Confirm the URL from the deployment output; test demo, own sheet, PNG, ZIP and
   recipe replay at the live URL. Then add an Open Banner Lab README link.

This implements GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
pattern. No repository settings, commits, pushes or deployments are made by the
local build. Safari/touch interaction and the deployed origin remain release QA
items; the narrow-viewport check is not a physical-device test.
