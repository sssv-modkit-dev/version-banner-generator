# Banner Lab: GitHub Pages implementation plan

Implementation record, 2026-10-30. Status entries below describe that review;
see [BANNER-LAB.md](BANNER-LAB.md) for current setup and release steps.

Status at that review: implemented. The sheet-to-batch app and manual Pages
workflow include default Simple View, automatic crop suggestions and mobile-first
ordering. The app is published on GitHub Pages; later releases still use manual
workflow dispatch. The current revision adds matte cleanup, dense browsing,
independent element styles and animated sprite remixes.
See [development and release notes](BANNER-LAB.md) for commands and limitations.

## Purpose

Let visitors make banners on the project's GitHub Pages site. They can try an
original demo sheet, open their own parts or
sprite sheets, define exact cuts with visible guides, choose styles or randomize
settings, and download one banner or a batch. No clone, installation, account or
modkit setup is needed.

Use the same public-lab pattern as the
[SSSV Parts Lab](https://sssv-modkit-dev.github.io/sssv-modkit/): independently
authored examples, useful controls on arrival, local processing of visitors'
inputs, and deployment of a dedicated static output directory.

## Existing work to reuse

| Existing work | Use in the lab |
| --- | --- |
| `tools/make-banner.py` | Reference layout: 1500 x 500, dark background, italic edition title, project/version labels, subject placement and restrained accent lines. |
| Three palettes and five matched quote conventions | Initial presets; keep random quote choices stable while editing. |
| PNG plus resolved JSON output | Basis for downloadable browser recipes and reproducible batches. |
| `assets/demo-prism.png` and `examples/make-demo.py` | Original demo subject and a reference composition. Add an original sheet with several cells. |
| `docs/ADAPTERS.md` | Preserve the generic image-input boundary; game-specific rendering remains separate. |
| `tools/smoke-test.py` | Retain CLI checks independently of new browser verification. |

The CLI compositor uses Python and a local Chromium browser and accepts one or more PNGs. The browser
implementation adds sheet slicing, recipe replay and arbitrary batches.
Browser output should preserve the design, but Windows and canvas typography
must not be advertised as pixel-identical.

## Design decisions

- Build a static app using HTML, CSS, JavaScript modules and Canvas 2D. Start
  without a UI framework; isolate rendering and data logic from the controls.
- Use one browser composition function for both the preview and exported PNGs.
  Display a scaled preview of the actual output canvas.
- Read files locally. No upload endpoint, remote image imports, telemetry or
  externally hosted fonts. Load app assets from the same site origin.
- Accept PNG/JPEG sheets and single images. Preserve PNG alpha. Animated
  formats, SVG inputs and model rendering are outside the first release. Flat-matte
  background removal is now supported, with manual colour/tolerance controls.
- Support uniform grids, uneven row/column cuts, and independent rectangular
  regions. Automatic detection now proposes editable crop rectangles on import.
- Treat every cell as an independent subject by default. Offer an explicit parts
  assembly mode for users who want several cells layered into one subject.
- Begin with the current banner style plus two restrained variations: subject on
  the left and a centered composition. Keep palette changes separate from image
  recolouring; the first release does not recolour sprites.
- Store settings in versioned JSON. User images remain in memory unless the user
  explicitly downloads a project bundle. Reloading a JSON recipe asks for its
  matching source images.
- Proposed source tree: `web/` for app code, `web/assets/` for reviewed demos and
  licensed fonts, `tests/web/` for meaningful checks, and `site/dist/` for generated
  publishable files. Ignore generated output in Git.

## Implementation checklist

Checked tasks are implemented and locally verified. Cross-device visual QA and
the public launch remain open; phase 8 remains follow-up work. Review each phase
in the browser.

### 1. Establish the browser foundation

- [x] **1.1 Define the data contract.**
  - Separate source images, sheet regions, subject assemblies, banner settings and
    batch jobs. Use stable IDs instead of filenames as references.
  - Define integer source-pixel rectangles, output dimensions, layer order,
    transforms, text, palette, quote style, sampling mode and resolved randomness.
  - Add a new browser format version; retain the meaning of existing CLI recipes.
    Document supported CLI recipe fields and reject unsupported imports clearly.
- [x] **1.2 Port the baseline compositor.**
  - Implement existing layout, palettes, matched quotes and title fitting.
  - Bundle a redistributable font with italic and required quote glyphs; include
    its licence and wait for font loading before preview/export.
  - Handle empty inputs, text overflow and font failures visibly.
- [x] **1.3 Build the app shell.**
  - Provide Sheet, Subject, Banner and Export steps, with a live banner preview.
  - Add Try demo, Open image, Reset and a concise local-file privacy explanation.
  - Supply an original multi-cell demo sheet covering varied sizes and transparency.

Acceptance: opening the local site produces a useful demo immediately; visitors
can edit its title and export a 1500 x 500 PNG matching the visible composition.

### 2. Build the sheet previewer and precise cutting controls

- [x] **2.1 Add local image import and inspection.**
  - Support file picker and drag/drop; show filename, dimensions, checkerboard,
    pixel coordinates, zoom, pan, fit-to-view and 1:1 view.
  - Validate decoded image dimensions and file size against documented limits.
    Fail gracefully on corrupt or oversized inputs; release replaced image resources.
- [x] **2.2 Add uniform-grid guides.**
  - Accept cell width/height or row/column count, outer margins and horizontal/
    vertical gutters. Show how partial edge cells will be treated.
  - Draw numbered cells and draggable guide handles; synchronize pointer edits
    with exact numeric inputs in source pixels, regardless of zoom.
- [x] **2.3 Add custom cuts.**
  - Add, move and remove vertical/horizontal cut lines for uneven grids.
  - Draw, resize and numerically edit independent crop rectangles for irregular
    atlases. Keep these distinct from lines that span the whole sheet.
  - Provide snapping, keyboard nudging, undo/redo and protection against zero-size
    or out-of-bounds crops. Report overlaps without silently changing them.
- [x] **2.4 Add a cell gallery.**
  - Show live crop thumbnails, IDs and optional user labels. Allow include/exclude,
    multi-select and explicit row-major ordering for batch inputs.
  - Skip fully transparent cells on request; retain nonempty edge pixels. Make
    alpha trimming optional and retain the original region and trim offset.
  - Save and reload cut settings; replacing a sheet requires checking its identity
    and dimensions before applying saved cuts.

Acceptance: a visitor can cut both a regular sprite sheet and an uneven atlas,
inspect exactly what each cut contains, and correct boundaries without resaving
the source image in another program.

### 3. Turn selected cells into banner subjects

- [x] **3.1 Support one-cell subjects.**
  - Select a gallery cell, fit it into the banner's subject area, and adjust scale,
    position, rotation and horizontal flip with reset controls.
  - Offer crisp nearest-neighbour sampling for pixel art and smooth sampling for
    rendered artwork. Preserve aspect ratio and transparency by default.
- [x] **3.2 Add explicit parts assembly.**
  - Add cells as layers on a transparent subject canvas with ordering, visibility,
    position, scale, rotation, flip and numeric controls.
  - Save a named assembly for reuse across banners. State that alignment is manual;
    the app does not infer anatomy, skeletons or compatible combinations.
  - Allow additional sheets and identify each layer's source unambiguously.

Acceptance: both a complete sprite and a manually assembled multi-part subject
can appear in the same banner workflow, with their transforms preserved on replay.

### 4. Add styles and controlled randomization

- [x] **4.1 Add the style controls.**
  - Provide the three layout presets, original palettes, custom accent/background
    colours, project label, release name, version and pinned quote style.
  - Show text safe areas and warn about clipping, overlap or unreadably small text.
- [x] **4.2 Add repeatable random choices.**
  - Let visitors choose eligible cells/assemblies, layouts, palettes, quote styles
    and optional editable name lists, then lock any individual setting.
  - Add a seed and explicit Shuffle action. Ordinary redraws must not reroll.
  - Resolve each generated result once and store every choice in its recipe.
    Never invent version numbers or treat an arbitrary cell label as known anatomy.

Acceptance: shuffling changes only enabled fields; the same seed, settings, source
files and generator version produce the same resolved choices and composition.

### 5. Export one banner or produce a batch

- [x] **5.1 Implement single exports and replay.**
  - Download the full-resolution PNG and resolved JSON recipe.
  - Record source hashes, cut rectangles, assembly transforms, style/font version,
    output size, sampling and resolved random values; exclude local paths.
  - Reopen recipes, request missing source files, verify hashes and report
    mismatches. Promise consistent settings, with browser rasterization differences
    documented rather than byte-identical PNGs across all browsers.
- [x] **5.2 Implement batch planning.**
  - Offer one banner per selected subject, N seeded random variations, and explicit
    combinations of subjects and chosen styles/palettes.
  - Allow one shared title or cell/assembly labels as names; show editable results
    before export. Keep future concepts labelled separately from real releases.
  - Calculate the output count before rendering. Show thumbnails, estimated cost,
    unique filenames and any duplicate-combination warning.
- [x] **5.3 Add batch downloads and size limits.**
  - Render sequentially or in a small bounded queue; show progress and Cancel.
    Freeze a settings snapshot so edits cannot change a running batch.
  - Package PNGs, per-banner recipes and a manifest in one ZIP using a reviewed,
    locally bundled dependency. Sanitize filenames and prevent ZIP path traversal
    or collisions from titles and imported labels.
  - Set initial limits of 100 banners per batch and 1500 x 500 output; tune image,
    decoded-pixel and ZIP memory budgets from measurements before public release.
    Avoid retaining every uncompressed output canvas simultaneously.
  - Report failures and omissions explicitly. Verify ZIP completion and clean up
    temporary canvases and object URLs on completion or cancellation.

Acceptance: users can export a selected sprite once, make one banner per selected
cell, or download a repeatable randomized batch without triggering many downloads.

### 6. Validate the full browser workflow

Local coverage includes Chromium and Firefox, narrow viewports, file-local network
checks, source-hash replay, all quote styles, pointer controls, PNG/ZIP integrity,
cancellation and a full 100-banner demo batch. Desktop screenshots and exported
PNGs were inspected separately. Safari and physical touch devices remain untested.

- [x] **6.1 Add focused automated checks.**
  - Verify slicing with tiny colour-coded fixtures: margins, gutters, uneven cuts,
    edge pixels, partial cells and transparent trimming.
  - Verify locked random fields, stable seeded choices, recipe round trips, layer
    transforms, batch counts and safe unique filenames.
  - Exercise browser import -> cuts -> preview -> PNG/ZIP export; inspect decoded
    PNG dimensions and representative pixels, recipe contents and ZIP entries.
  - Exercise missing sources, invalid JSON/format versions, huge images, corrupt
    files, cancelled batches and export/font failures.
- [ ] **6.2 Review visual and interaction quality.**
  - Inspect actual exported banners at full size and README display size: long
    titles, all quote conventions, transparency, pixel-art edges and mixed subjects.
  - Check keyboard navigation, labelled numeric alternatives to dragging, visible
    focus, contrast and progress/error announcements.
  - Verify desktop Chrome/Edge and Firefox, plus Safari/touch where available.
    Record measured limits and any unsupported browser behavior.
- [x] **6.3 Verify privacy and deployment behavior.**
  - Inspect network traffic after importing private test images: no image bytes,
    labels or recipes should leave the browser. Keep personal data out of URLs.
  - Test a local HTTP server and a project-subpath build; require relative asset
    URLs. Confirm no app dependency is fetched from a CDN.

Acceptance: checks pass, exported files receive a separate visual review, and
large batches remain cancellable within the published limits.

### 7. Prepare and publish GitHub Pages

- [x] **7.1 Build a dedicated public artifact.**
  - Package only app files, approved original demos, fonts/licences and required
    dependencies into `site/dist/`. Avoid publishing the repository root.
  - Check the output manifest for private inputs, generated user files, local
    paths and accidental development artifacts. Keep third-party image rights
    separate from the software licence.
- [x] **7.2 Add CI and the Pages workflow.**
  - Run browser checks before uploading the static artifact. Use a separate deploy
    job, the GitHub Pages environment and narrowly scoped deployment permissions.
  - Initially provide manual deployment; enable deployment on relevant main-branch
    changes after the first reviewed release. Follow the current official workflow
    rather than blindly copying action versions from the modkit.
- [ ] **7.3 Document and launch.**
  - Add Open Banner Lab to the README, a short cut-and-export walkthrough, supported
    formats/limits, browser recipe behavior and a note that files stay local.
  - Confirm the expected URL from repository Pages settings; the candidate is
    `https://sssv-modkit-dev.github.io/version-banner-generator/`.
  - Review the concrete publish artifact and deployment configuration with the
    owner before first publication, following the existing BOT-BRIEF requirement.
  - Smoke-test the live URL: fresh visit -> original demo -> own sheet -> custom
    cuts -> single export -> ZIP batch -> recipe replay. Verify subpath assets.

Acceptance: a visitor arriving from the README can finish the full workflow
without a checkout, installation or external account.

### 8. Follow-up after the first release

- [ ] Add an optional downloadable project ZIP containing explicitly selected source
  sheets and settings, with validated import and size limits.
- [ ] Add CSV/JSON-driven release names and versions for larger production runs.
- [x] Add automatic sprite-bound suggestions on import with manual correction.
  Transparent and common matte/printed backgrounds are supported heuristically;
  this is segmentation, not a guarantee of correct frame identity.
- [ ] Add constrained random part combinations after defining compatible groups
  and anchors; keep manual assemblies available.
- [ ] Add optional, explicit pixel recolouring or supplied masks as a separate
  feature with alpha/shading checks; do not infer anatomical colour regions.
- [ ] Consider extra output sizes, custom templates, multiple independent projects
  and opt-in browser persistence based on actual use.

## Suggested delivery checkpoints

| Checkpoint | Includes | Review result |
| --- | --- | --- |
| A: Browser composition | Phase 1 | Original subject -> editable preview -> PNG. |
| B: Sheet workbench | Phases 2-3 | Exact grid/custom cuts -> sprites or assemblies. |
| C: Batch tools | Phases 4-5 | Styles -> locked randomization -> repeatable ZIP batch. |
| D: Public release | Phases 6-7 | Verified app -> reviewed static artifact -> live Pages link. |

Keep phase 8 separate from the first release.

## References

- Local baseline: `README.md`, `BOT-BRIEF.md`, `docs/ADAPTERS.md`,
  `tools/make-banner.py` and `assets/demo-banner.json`.
- Modkit pattern inspected locally: `D:/LLM/sssv-modkit/site/README.md` and
  `.github/workflows/parts-lab-pages.yml`; these are references, not build inputs.
- GitHub: [Configure a Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
  and [Use a custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
