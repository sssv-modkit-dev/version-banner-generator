import { applyTheme, ELEMENTS } from "./theme.mjs";
export const FORMAT = "banner-lab-v1";
export const ENGINE = "1.0.0";
export const LIMITS = Object.freeze({
  side: 4096,
  pixels: 8_388_608,
  totalPixels: 24_000_000,
  file: 20_000_000,
  sources: 8,
  cells: 1024,
  batch: 100,
  zip: 128_000_000,
});
export const PALETTES = {
  blue: "#8dc4ed",
  orange: "#efb16b",
  green: "#91cbb1",
};
export const QUOTES = {
  english: ["“", "”"],
  french: ["«\u202f", "\u202f»"],
  spanish: ["«", "»"],
  german: ["„", "“"],
  japanese: ["「", "」"],
};
export const LAYOUTS = ["right", "left", "center"];
export const clone = (value) => structuredClone(value);
export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
export function dimensions(width, height) {
  assert(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= LIMITS.side &&
      height <= LIMITS.side &&
      width * height <= LIMITS.pixels,
    "Image exceeds 4096 px per side or 8 megapixels.",
  );
}
export function pngDimensions(bytes) {
  assert(
    bytes.length >= 24 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v),
    "Choose a PNG image.",
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert(
    view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452,
    "Invalid PNG header.",
  );
  const width = view.getUint32(16),
    height = view.getUint32(20);
  dimensions(width, height);
  return { width, height };
}
export function rectValid(r, width, height) {
  return (
    r &&
    ["x", "y", "w", "h"].every((k) => Number.isInteger(r[k])) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w > 0 &&
    r.h > 0 &&
    r.x + r.w <= width &&
    r.y + r.h <= height
  );
}
export function imageDimensions(bytes) {
  if (bytes[0] === 137) return { ...pngDimensions(bytes), type: "image/png" };
  assert(bytes[0] === 255 && bytes[1] === 216, "Choose a PNG or JPEG image.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    assert(bytes[offset] === 255, "Invalid JPEG marker.");
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    assert(offset + 2 <= bytes.length, "Truncated JPEG.");
    const length = view.getUint16(offset);
    assert(
      length >= 2 && offset + length <= bytes.length,
      "Invalid JPEG segment.",
    );
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      assert(length >= 8, "Invalid JPEG frame.");
      const height = view.getUint16(offset + 3),
        width = view.getUint16(offset + 5);
      dimensions(width, height);
      return { width, height, type: "image/jpeg" };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions could not be read.");
}
export function gridRects(width, height, grid) {
  const { w, h, marginX, marginY, gapX, gapY, partial } = grid;
  assert(
    [w, h].every((v) => Number.isInteger(v) && v > 0) &&
      [marginX, marginY, gapX, gapY].every(
        (v) => Number.isInteger(v) && v >= 0,
      ),
    "Grid sizes must be positive integers; margins and gutters must be nonnegative integers.",
  );
  const result = [];
  for (let y = marginY; y < height - marginY; y += h + gapY) {
    for (let x = marginX; x < width - marginX; x += w + gapX) {
      const rw = Math.min(w, width - marginX - x),
        rh = Math.min(h, height - marginY - y);
      if (partial || (rw === w && rh === h))
        result.push({ x, y, w: rw, h: rh });
      assert(
        result.length <= LIMITS.cells,
        `Too many cells (maximum ${LIMITS.cells}). Increase the cell size.`,
      );
    }
  }
  assert(
    result.length > 0,
    "The grid contains no complete cells. Adjust its dimensions or include partial edges.",
  );
  return result;
}
export function cutRects(width, height, xs, ys) {
  const lines = (values, max) => {
    assert(
      values.length <= 128 &&
        values.every((v) => Number.isInteger(v) && v > 0 && v < max),
      "Cut lines must be integer pixels inside the image.",
    );
    return [0, ...new Set(values.slice().sort((a, b) => a - b)), max];
  };
  const x = lines(xs, width),
    y = lines(ys, height),
    out = [];
  assert(
    (x.length - 1) * (y.length - 1) <= LIMITS.cells,
    `Too many cells (maximum ${LIMITS.cells}).`,
  );
  for (let j = 0; j < y.length - 1; j++)
    for (let i = 0; i < x.length - 1; i++)
      out.push({ x: x[i], y: y[j], w: x[i + 1] - x[i], h: y[j + 1] - y[j] });
  return out;
}
export function alphaBounds(data, width, height) {
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
export function rng(seed) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function initialState() {
  return {
    format: FORMAT,
    engine: ENGINE,
    font: "Lato+LabQuotes-v1",
    width: 1500,
    height: 500,
    sources: [],
    sheets: {},
    subjects: [],
    activeSubjectId: "",
    banner: {
      project: "MY MODKIT",
      name: "Prism",
      version: "CONCEPT",
      layout: "right",
      palette: "blue",
      accent: PALETTES.blue,
      background: "#111b29",
      quote: "french",
      smooth: true,
      removeBackground: true,
      backgroundTolerance: 12,
      backgroundColor: null,
      artworkSizing: "natural",
      elementStyles: {},
      scale: 1,
      x: 0,
      y: 0,
      rotation: 0,
      flip: false,
    },
    random: {
      seed: "banner-lab",
      enabled: {
        subject: true,
        layout: true,
        palette: true,
        quote: true,
        name: false,
      },
      layouts: [...LAYOUTS],
      palettes: Object.keys(PALETTES),
      quotes: Object.keys(QUOTES),
      names: [],
    },
  };
}
export function randomize(state, seed) {
  const next = clone(state),
    r = rng(seed),
    choose = (a) => a[Math.floor(r() * a.length)],
    cfg = state.random;
  const subjects = state.subjects.filter((s) => s.include);
  if (cfg.enabled.subject && subjects.length)
    next.activeSubjectId = choose(subjects).id;
  for (const [field, pool] of [
    ["layout", cfg.layouts],
    ["palette", cfg.palettes],
    ["quote", cfg.quotes],
    ["name", cfg.names],
  ]) {
    if (cfg.enabled[field] && pool.length) next.banner[field] = choose(pool);
  }
  if (cfg.enabled.palette && cfg.palettes.length)
    applyTheme(next.banner, next.banner.palette);
  next.resolvedSeed = String(seed);
  return next;
}
export function batchJobs(state, mode, count, useLabels = false) {
  const subjects = state.subjects.filter((s) => s.include);
  assert(subjects.length, "Include at least one subject in the batch.");
  let jobs = [];
  if (mode === "random") {
    assert(
      Number.isInteger(count) && count > 0 && count <= LIMITS.batch,
      "Choose 1–100 variations.",
    );
    jobs = Array.from({ length: count }, (_, i) =>
      randomize(state, `${state.random.seed}:${i}`),
    );
  } else {
    const combos = mode === "combinations";
    const layouts = combos ? state.random.layouts : [state.banner.layout],
      palettes = combos ? state.random.palettes : [state.banner.palette];
    assert(
      layouts.length && palettes.length,
      "Select at least one layout and palette.",
    );
    assert(
      subjects.length * layouts.length * palettes.length <= LIMITS.batch,
      "This combination exceeds 100 banners. Select fewer subjects or styles.",
    );
    for (const subject of subjects)
      for (const layout of layouts)
        for (const palette of palettes) {
          const job = clone(state);
          job.activeSubjectId = subject.id;
          job.banner.layout = layout;
          job.banner.palette = palette;
          if (combos) applyTheme(job.banner, palette);
          jobs.push(job);
        }
  }
  if (useLabels)
    for (const job of jobs)
      job.banner.name = job.subjects.find(
        (s) => s.id === job.activeSubjectId,
      ).name;
  return jobs.map((state, i) => ({
    state,
    filename: `${String(i + 1).padStart(3, "0")}-${safeName(state.banner.name)}`,
  }));
}
export function safeName(value) {
  return (
    String(value)
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "banner"
  );
}
export function caption(banner) {
  const q = QUOTES[banner.quote];
  return `${q[0]}${banner.name}${q[1]} edition`;
}
export function validateState(input) {
  assert(
    input && input.format === FORMAT,
    input?.format === "version-banner-generator-v1"
      ? "CLI recipes cannot be replayed here: open their image and enter the recorded settings. Browser recipes use banner-lab-v1."
      : "Unsupported recipe format.",
  );
  assert(
    input.engine === ENGINE &&
      input.font === "Lato+LabQuotes-v1" &&
      input.width === 1500 &&
      input.height === 500,
    "Unsupported generator, font or output version.",
  );
  const s = clone(input),
    b = s.banner,
    rand = s.random;
  const text = (v, max) => typeof v === "string" && v.length <= max;
  const num = (v, min, max) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  assert(
    b &&
      text(b.project, 120) &&
      text(b.name, 160) &&
      b.name.trim() &&
      text(b.version, 100),
    "Invalid or overlong banner text.",
  );
  assert(
    LAYOUTS.includes(b.layout) &&
      Object.hasOwn(PALETTES, b.palette) &&
      Object.hasOwn(QUOTES, b.quote) &&
      /^#[0-9a-f]{6}$/i.test(b.accent) &&
      /^#[0-9a-f]{6}$/i.test(b.background),
    "Invalid banner style.",
  );
  const transform = (v) =>
    num(v.x, -1000, 1000) &&
    num(v.y, -1000, 1000) &&
    num(v.scale, 0.1, 4) &&
    num(v.rotation, -180, 180) &&
    typeof v.flip === "boolean";
  assert(
    (b.backgroundTolerance === undefined || num(b.backgroundTolerance, 0, 80)) &&
    (b.backgroundColor == null || /^#[0-9a-f]{6}$/i.test(b.backgroundColor)) &&
    (b.artworkSizing === undefined || ["natural", "fill"].includes(b.artworkSizing)),
    "Invalid artwork cleanup or sizing settings.",
  );
  if (b.elementStyles !== undefined) {
    assert(b.elementStyles && typeof b.elementStyles === "object" && !Array.isArray(b.elementStyles), "Invalid element styling.");
    for (const [key, style] of Object.entries(b.elementStyles))
      assert(ELEMENTS.includes(key) && style &&
        /^#[0-9a-f]{6}$/i.test(style.color) && num(style.size, 12, 96) &&
        ["plain", "display"].includes(style.face), "Invalid element styling.");
  }
  assert(
    transform(b) && typeof b.smooth === "boolean" &&
      (b.removeBackground === undefined || typeof b.removeBackground === "boolean"),
    "Invalid subject transform.",
  );
  assert(
    Array.isArray(s.sources) &&
      s.sources.length > 0 &&
      s.sources.length <= LIMITS.sources,
    "A recipe needs 1–8 sources.",
  );
  let total = 0;
  const ids = new Set();
  for (const source of s.sources) {
    assert(
      text(source.id, 100) &&
        source.id &&
        !ids.has(source.id) &&
        /^[a-f0-9]{64}$/.test(source.sha256) &&
        text(source.name, 255) &&
        !/[\\/]/.test(source.name),
      "Invalid source identity.",
    );
    dimensions(source.width, source.height);
    total += source.width * source.height;
    ids.add(source.id);
  }
  assert(
    total <= LIMITS.totalPixels,
    "Sources exceed the 24 megapixel project budget.",
  );
  assert(
    Array.isArray(s.subjects) &&
      s.subjects.length > 0 &&
      s.subjects.length <= LIMITS.cells + 100,
    "Invalid subject count.",
  );
  const subjectIds = new Set();
  for (const subject of s.subjects) {
    assert(
      text(subject.id, 100) &&
        subject.id &&
        !subjectIds.has(subject.id) &&
        text(subject.name, 160) &&
        typeof subject.include === "boolean" &&
        ["cell", "assembly"].includes(subject.kind),
      "Invalid subject.",
    );
    subjectIds.add(subject.id);
    assert(
      Array.isArray(subject.layers) &&
        subject.layers.length > 0 &&
        subject.layers.length <= 32,
      "Subjects need 1–32 layers.",
    );
    for (const layer of subject.layers) {
      const source = s.sources.find((v) => v.id === layer.sourceId);
      assert(
        source &&
          rectValid(layer.rect, source.width, source.height) &&
          transform(layer) &&
          typeof layer.visible === "boolean",
        "Invalid layer or crop.",
      );
      if (layer.originalRect)
        assert(
          rectValid(layer.originalRect, source.width, source.height),
          "Invalid original crop.",
        );
    }
  }
  assert(subjectIds.has(s.activeSubjectId), "The selected subject is missing.");
  assert(
    rand &&
      text(rand.seed, 160) &&
      rand.enabled &&
      ["subject", "layout", "palette", "quote", "name"].every(
        (k) => typeof rand.enabled[k] === "boolean",
      ),
    "Invalid randomizer.",
  );
  for (const [key, allowed] of [
    ["layouts", LAYOUTS],
    ["palettes", Object.keys(PALETTES)],
    ["quotes", Object.keys(QUOTES)],
  ])
    assert(
      Array.isArray(rand[key]) &&
        rand[key].length <= allowed.length &&
        rand[key].every((v) => allowed.includes(v)),
      "Invalid random pool.",
    );
  assert(
    Array.isArray(rand.names) &&
      rand.names.length <= 100 &&
      rand.names.every((n) => text(n, 160) && n.trim()),
    "Invalid random names.",
  );
  assert(
    s.sheets && typeof s.sheets === "object" && !Array.isArray(s.sheets),
    "Invalid sheets.",
  );
  for (const [id, sheet] of Object.entries(s.sheets)) {
    const source = s.sources.find((v) => v.id === id);
    assert(source, "Unknown sheet source.");
    assert(
      ["grid", "cuts", "rects"].includes(sheet.mode),
      "Invalid sheet mode.",
    );
    if (sheet.mode === "grid")
      gridRects(source.width, source.height, sheet.grid);
    if (sheet.mode === "cuts") {
      assert(
        Array.isArray(sheet.xs) && Array.isArray(sheet.ys),
        "Invalid cut lines.",
      );
      cutRects(source.width, source.height, sheet.xs, sheet.ys);
    }
    assert(
      Array.isArray(sheet.rects) &&
        sheet.rects.length <= LIMITS.cells &&
        sheet.rects.every((r) => rectValid(r, source.width, source.height)),
      "Invalid sheet rectangles.",
    );
  }
  return s;
}
