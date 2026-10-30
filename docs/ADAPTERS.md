# Game-adapter boundary

The core accepts a transparent PNG, project name, release name, version, accent
palette and quote style. It lays them out and exports a PNG and resolved recipe.
It does not parse ROMs, infer anatomy or change the supplied image colours.

An adapter owns local asset discovery, integrity checks, decoding and rendering.
Store a preset with the source identity, verified part/material selections,
camera/framing, lighting and protected colour regions. Render directly at a useful
resolution, rather than enlarging a tiny icon when a higher-resolution export is
available. Return a local transparent PNG to the compositor.

Prefer the project's existing renderer. Cached renders are a useful first adapter;
if using raster masks, constrain them to the exact reviewed input and preserve
alpha and shading. A bear's blue-fur mask must not become a generic head detector.

Keep adapter-specific assets and research private by default. Use explicit file
allowlists when exporting a standalone integration. Do not copy the original
project's repository or history wholesale.

Verify head identity visually. A label alone does not prove a complete assembly,
correct camera orientation or in-game appearance. Treat model inspection, live
browser rendering and game validation as separate evidence. For browser tests,
follow the project's documented localhost setup and respect access restrictions.

The compositor currently has no dynamic adapter loader. A small wrapper can render
the PNG, then invoke `tools/make-banner.ps1` with explicit arguments. Keep the
interface simple until real integrations justify a plugin system.
