import {
  FORMAT,
  ENGINE,
  LIMITS,
  PALETTES,
  clone,
  assert,
  dimensions,
  pngDimensions,
  imageDimensions,
  gridRects,
  cutRects,
  alphaBounds,
  rectValid,
  initialState,
  randomize,
  batchJobs,
  safeName,
  validateState,
} from "./core.mjs";
import {
  canvas,
  loadFonts,
  drawSubject,
  renderBanner,
  pngBlob,
  download,
  jsonBlob,
} from "./render.mjs";
import { Zip, ZipPassThrough } from "./assets/fflate.mjs";

const $ = (id) => document.getElementById(id),
  images = new Map();
let state = initialState(),
  sourceId = "",
  draft = null,
  selectedRect = -1,
  selectedLayer = 0,
  zoom = 1,
  drag = null;
let history = [],
  future = [],
  pendingRecipe = null,
  pendingImages = new Map(),
  jobs = [],
  busy = false,
  cancelled = false,
  shuffleIndex = 0,
  renderOK = false,
  ready = false;
let view = "simple",
  currentTab = "create",
  galleryPage = 0,
  demoOnly = true,
  loading = false,
  sheetFrame = 0;
const neutral = { x: 0, y: 0, scale: 1, rotation: 0, flip: false };
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
}
function guard(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      notice(e.message, true);
    }
  };
}
function on(id, event, fn) {
  $(id).addEventListener(event, guard(fn));
}
function numeric(id) {
  const input = $(id);
  assert(
    input.value !== "" && input.checkValidity(),
    `Check the value for ${input.labels?.[0]?.textContent.trim() || id}.`,
  );
  return Number(input.value);
}
function source() {
  return state.sources.find((s) => s.id === sourceId);
}
function subject() {
  return state.subjects.find((s) => s.id === state.activeSubjectId);
}
function option(select, value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  select.append(o);
}
function setOptions(select, items, selected) {
  select.replaceChildren();
  for (const [value, label] of items) option(select, value, label);
  select.value = selected;
}
function switchTab(name) {
  if (view === "simple" && !["create", "batch"].includes(name))
    setView("advanced");
  currentTab = name;
  document.body.dataset.simpleTab = name;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.tab === name)),
    );
  document
    .querySelectorAll("[data-panel]")
    .forEach((p) => (p.hidden = p.dataset.panel !== name));
}
function setView(next) {
  view = next;
  document.body.dataset.view = next;
  $("simple-view").setAttribute("aria-pressed", String(next === "simple"));
  $("advanced-view").setAttribute("aria-pressed", String(next === "advanced"));
  $("gallery-title").textContent =
    next === "simple" ? "Choose a sprite" : "Sheet & subjects";
  $("gallery-eyebrow").textContent =
    next === "simple" ? "PICK YOUR FAVOURITE" : "THE CUTTING ROOM";
  if (next === "simple" && !["create", "batch"].includes(currentTab))
    switchTab("create");
  if (next === "advanced" && currentTab === "create") switchTab("sheet");
  revealSubject();
  paintGallery();
  requestAnimationFrame(fitSheet);
}
function revealSubject() {
  galleryPage = Math.floor(
    Math.max(
      0,
      state.subjects.findIndex((s) => s.id === state.activeSubjectId),
    ) / (view === "simple" ? 12 : 24),
  );
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
function defaultSheet(s) {
  return {
    mode: "grid",
    grid: {
      w: s.width,
      h: s.height,
      marginX: 0,
      marginY: 0,
      gapX: 0,
      gapY: 0,
      partial: false,
    },
    xs: [],
    ys: [],
    rects: [],
    skip: true,
    trim: true,
  };
}
function snapshot() {
  return clone({
    sheets: state.sheets,
    subjects: state.subjects,
    activeSubjectId: state.activeSubjectId,
  });
}
function remember() {
  history.push(snapshot());
  if (history.length > 30) history.shift();
  future = [];
  updateHistory();
}
function updateHistory() {
  $("undo").disabled = !history.length;
  $("redo").disabled = !future.length;
}
function restoreSnapshot(value) {
  Object.assign(state, value);
  draft = clone(state.sheets[sourceId]);
  syncCutUI();
  syncSubjects();
  drawSheet();
  paintGallery();
  paint();
  invalidateBatch();
}
function invalidateBatch() {
  if (jobs.length) {
    jobs = [];
    $("batch-section").hidden = true;
  }
}
function readDraft() {
  assert(source(), "Open a sheet first.");
  const next = clone(draft);
  next.mode = $("cut-mode").value;
  next.skip = $("skip-empty").checked;
  next.trim = $("trim").checked;
  if (next.mode === "grid")
    next.grid = {
      w: numeric("cell-w"),
      h: numeric("cell-h"),
      marginX: numeric("margin-x"),
      marginY: numeric("margin-y"),
      gapX: numeric("gap-x"),
      gapY: numeric("gap-y"),
      partial: $("partial").checked,
    };
  if (next.mode === "cuts") {
    const parse = (id) =>
      $(id).value.trim()
        ? $(id)
            .value.split(",")
            .map((v) => {
              assert(v.trim() !== "", "Remove empty cut values.");
              return Number(v.trim());
            })
        : [];
    next.xs = parse("cuts-x");
    next.ys = parse("cuts-y");
  }
  draft = next;
  return next;
}
function rectangles(sheet = draft) {
  const s = source();
  if (!s) return [];
  if (sheet.mode === "grid") return gridRects(s.width, s.height, sheet.grid);
  if (sheet.mode === "cuts")
    return cutRects(s.width, s.height, sheet.xs, sheet.ys);
  return sheet.rects;
}
function syncCutUI() {
  if (!draft) return;
  $("cut-mode").value = draft.mode;
  for (const mode of ["grid", "cuts", "rects"])
    $(
      mode === "cuts"
        ? "cut-fields"
        : mode === "rects"
          ? "rect-fields"
          : "grid-fields",
    ).hidden = draft.mode !== mode;
  const ids = {
    w: "cell-w",
    h: "cell-h",
    marginX: "margin-x",
    marginY: "margin-y",
    gapX: "gap-x",
    gapY: "gap-y",
  };
  for (const [key, id] of Object.entries(ids)) $(id).value = draft.grid[key];
  $("partial").checked = draft.grid.partial;
  $("cuts-x").value = draft.xs.join(", ");
  $("cuts-y").value = draft.ys.join(", ");
  $("skip-empty").checked = draft.skip;
  $("trim").checked = draft.trim;
  setOptions(
    $("region-select"),
    [
      [-1, "New region"],
      ...draft.rects.map((r, i) => [
        i,
        `${i + 1} · ${r.x}, ${r.y} · ${r.w} × ${r.h}`,
      ]),
    ],
    String(selectedRect),
  );
  const r = draft.rects[selectedRect];
  if (r)
    for (const key of ["x", "y", "w", "h"]) $(`rect-${key}`).value = r[key];
  const s = source();
  $("columns").value = Math.floor(
    (s.width - 2 * draft.grid.marginX + draft.grid.gapX) /
      (draft.grid.w + draft.grid.gapX),
  );
  $("rows").value = Math.floor(
    (s.height - 2 * draft.grid.marginY + draft.grid.gapY) /
      (draft.grid.h + draft.grid.gapY),
  );
}
function syncDragFields() {
  $("cell-w").value = draft.grid.w;
  $("cell-h").value = draft.grid.h;
  $("cuts-x").value = draft.xs.join(", ");
  $("cuts-y").value = draft.ys.join(", ");
  const r = draft.rects[selectedRect];
  if (r)
    for (const key of ["x", "y", "w", "h"]) $(`rect-${key}`).value = r[key];
  if (!sheetFrame)
    sheetFrame = requestAnimationFrame(() => {
      sheetFrame = 0;
      drawSheet();
    });
}
function selectSource(id) {
  sourceId = id;
  draft = clone(state.sheets[id]);
  selectedRect = -1;
  setOptions(
    $("source-select"),
    state.sources.map((s) => [s.id, s.name]),
    id,
  );
  const s = source();
  $("source-info").textContent =
    `${s.width} × ${s.height} px · ${state.sources.length} / 8 sheets`;
  syncCutUI();
  fitSheet();
  syncQuickUI();
}
function syncQuickUI() {
  $("quick-project").value = state.banner.project;
  $("quick-name").value = state.banner.name;
  $("quick-version").value = state.banner.version;
  $("quick-palette").value = state.banner.palette;
  const s = source();
  if (s)
    $("quick-source-info").textContent =
      `${s.name} · ${s.width} × ${s.height} · ${state.subjects.filter((v) => v.kind === "cell" && v.layers[0].sourceId === s.id).length} sprites`;
  const message =
    state.sheets[sourceId]?.detection?.message ||
    "Original demo · six ready-to-use sprites.";
  $("detection-summary").textContent = message;
  $("advanced-detection").textContent = message;
}
function layerFrom(sourceId, rect, originalRect = rect) {
  return {
    sourceId,
    rect: clone(rect),
    originalRect: clone(originalRect),
    ...neutral,
    visible: true,
  };
}
async function applyCuts(record = true) {
  readDraft();
  const s = source(),
    rects = rectangles();
  assert(rects.length, "Draw at least one region.");
  assert(rects.length <= LIMITS.cells, `Maximum ${LIMITS.cells} regions.`);
  assert(
    rects.every((r) => rectValid(r, s.width, s.height)),
    "A region extends beyond the image.",
  );
  const cropCanvas = canvas(s.width, s.height),
    ctx = cropCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(images.get(s.id), 0, 0);
  const cells = [];
  for (let i = 0; i < rects.length; i++) {
    const original = rects[i];
    let rect = clone(original);
    if (draft.skip || draft.trim) {
      const pixels = ctx.getImageData(rect.x, rect.y, rect.w, rect.h),
        bounds = alphaBounds(pixels.data, rect.w, rect.h);
      if (!bounds && draft.skip) continue;
      if (bounds && draft.trim)
        rect = {
          x: rect.x + bounds.x,
          y: rect.y + bounds.y,
          w: bounds.w,
          h: bounds.h,
        };
    }
    const id = `${s.id}-cell-${i}`,
      old = state.subjects.find((v) => v.id === id);
    cells.push({
      id,
      name: old?.name || `Cell ${String(i + 1).padStart(2, "0")}`,
      kind: "cell",
      include: old?.include ?? true,
      layers: [layerFrom(s.id, rect, original)],
    });
  }
  cropCanvas.width = 1;
  cropCanvas.height = 1;
  assert(
    cells.length,
    "No visible cells. Adjust cuts or disable skipping transparent cells.",
  );
  const others = state.subjects.filter(
    (v) => v.kind === "assembly" || v.layers[0].sourceId !== s.id,
  );
  assert(
    others.length + cells.length <= LIMITS.cells + 100,
    "Too many subjects in this project.",
  );
  if (record) remember();
  state.sheets[s.id] = clone(draft);
  state.subjects = [...others, ...cells];
  if (!state.subjects.some((s) => s.id === state.activeSubjectId))
    state.activeSubjectId = cells[0].id;
  const overlaps = rects.some((a, i) =>
    rects
      .slice(i + 1)
      .some(
        (b) =>
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y,
      ),
  );
  invalidateBatch();
  syncSubjects();
  paintGallery();
  paint();
  drawSheet();
  notice(
    `${cells.length} subjects cut from ${s.name}. ${overlaps ? "Some crop regions overlap; shared pixels appear in both subjects." : "Select a thumbnail to compose a banner."}`,
  );
}
function syncSubjects() {
  setOptions(
    $("subject-select"),
    state.subjects.map((s) => [s.id, s.name]),
    state.activeSubjectId,
  );
  const s = subject();
  if (!s) return;
  $("subject-name").value = s.name;
  $("include-subject").checked = s.include;
  $("assembly-fields").hidden = s.kind !== "assembly";
  $("delete-assembly").disabled = s.kind !== "assembly";
  selectedLayer = Math.min(selectedLayer, s.layers.length - 1);
  setOptions(
    $("layer-select"),
    s.layers.map((l, i) => [
      i,
      `${i + 1} · ${state.sources.find((v) => v.id === l.sourceId)?.name} · ${l.rect.w} × ${l.rect.h}`,
    ]),
    String(selectedLayer),
  );
  syncLayer();
}
function syncLayer() {
  const l = subject()?.layers[selectedLayer];
  if (!l) return;
  for (const k of ["x", "y", "scale", "rotation"]) $(`layer-${k}`).value = l[k];
  $("layer-flip").checked = l.flip;
  $("layer-visible").checked = l.visible;
}
function syncBannerUI() {
  syncQuickUI();
  const b = state.banner;
  for (const [id, key] of Object.entries({
    project: "project",
    "release-name": "name",
    version: "version",
    layout: "layout",
    palette: "palette",
    accent: "accent",
    background: "background",
    quote: "quote",
    "subject-x": "x",
    "subject-y": "y",
    "subject-scale": "scale",
    "subject-rotation": "rotation",
  }))
    $(id).value = b[key];
  $("subject-flip").checked = b.flip;
  for (const id of ["remove-background", "quick-remove-background"])
    $(id).checked = b.removeBackground === true;
  $("smooth").checked = b.smooth;
  $("seed").value = state.random.seed;
  $("name-pool").value = state.random.names.join("\n");
  document
    .querySelectorAll("[data-random]")
    .forEach((el) => (el.checked = state.random.enabled[el.dataset.random]));
  for (const [id, key] of [
    ["layout-pool", "layouts"],
    ["palette-pool", "palettes"],
    ["quote-pool", "quotes"],
  ])
    $(id)
      .querySelectorAll("input")
      .forEach((el) => (el.checked = state.random[key].includes(el.value)));
}
function paint() {
  if (!ready) return;
  const boxes =
    state.banner.layout === "center"
      ? [
          [90, 315, 1320, 125],
          [650, 95, 200, 200],
        ]
      : state.banner.layout === "left"
        ? [
            [510, 80, 890, 310],
            [70, 70, 360, 360],
          ]
        : [
            [70, 80, 890, 310],
            [1050, 70, 360, 360],
          ];
  for (const [i, id] of ["text-guide", "subject-guide"].entries())
    ["x", "y", "width", "height"].forEach((key, j) =>
      $(id).setAttribute(key, boxes[i][j]),
    );
  try {
    const warnings = renderBanner($("banner"), state, images);
    $("warnings").hidden = !warnings.length;
    $("warnings").textContent = warnings.join(" ");
    renderOK = true;
    $("preview-detail").textContent =
      `${subject().name} · ${state.banner.layout === "center" ? "Centered" : state.banner.layout === "left" ? "Reversed" : "Classic"} layout · ${state.banner.quote} quotes`;
  } catch (e) {
    renderOK = false;
    $("warnings").hidden = false;
    $("warnings").textContent = e.message;
  }
  $("export-png").disabled = !renderOK;
  syncQuickUI();
}
function thumbnail(target, s, width = 128, height = 108) {
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  drawSubject(
    ctx,
    s,
    images,
    width / 2,
    height / 2,
    neutral,
    state.banner.smooth,
    Math.min(width, height) / 400,
    state.banner.removeBackground === true,
  );
}
function paintGallery() {
  $("gallery").replaceChildren();
  $("cell-count").textContent = state.subjects.length;
  const active = subject();
  const pageSize = view === "simple" ? 12 : 24,
    pageCount = Math.max(1, Math.ceil(state.subjects.length / pageSize));
  galleryPage = Math.min(galleryPage, pageCount - 1);
  $("gallery-page").textContent = `${galleryPage + 1} / ${pageCount}`;
  $("gallery-prev").disabled = galleryPage === 0;
  $("gallery-next").disabled = galleryPage === pageCount - 1;
  for (const s of state.subjects.slice(
    galleryPage * pageSize,
    (galleryPage + 1) * pageSize,
  )) {
    const card = document.createElement("div");
    card.className = `cell-card${s.id === state.activeSubjectId ? " active" : ""}`;
    card.dataset.subject = s.id;
    const button = document.createElement("button");
    button.title = `Use ${s.name}`;
    button.setAttribute("aria-pressed", String(s.id === state.activeSubjectId));
    const c = canvas(128, 108);
    thumbnail(c, s);
    button.append(c, document.createTextNode(s.name));
    button.addEventListener("click", () => {
      state.activeSubjectId = s.id;
      selectedLayer = 0;
      syncSubjects();
      paintGallery();
      paint();
      invalidateBatch();
    });
    card.append(button);
    const label = document.createElement("label");
    label.className = "check";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = s.include;
    check.addEventListener("change", () => {
      s.include = check.checked;
      syncSubjects();
      invalidateBatch();
    });
    label.append(check, document.createTextNode("In batch"));
    card.append(label);
    if (active?.kind === "assembly" && s.kind === "cell") {
      const add = document.createElement("button");
      add.className = "add-layer";
      add.textContent = "+ Layer";
      add.addEventListener(
        "click",
        guard(() => {
          assert(active.layers.length < 32, "Maximum 32 layers.");
          active.layers.push(clone(s.layers[0]));
          selectedLayer = active.layers.length - 1;
          syncSubjects();
          paint();
          paintGallery();
          invalidateBatch();
        }),
      );
      card.append(add);
    }
    $("gallery").append(card);
  }
}
function setZoom(value) {
  zoom = Math.max(0.1, Math.min(4, value));
  $("zoom").value = zoom;
  drawSheet();
}
function fitSheet() {
  const s = source();
  if (!s) return;
  setZoom(
    Math.min(
      ($("sheet-viewport").clientWidth - 2) / s.width,
      ($("sheet-viewport").clientHeight - 2) / s.height,
      1,
    ),
  );
}
function drawSheet() {
  const s = source();
  if (!s || !draft) return;
  const c = $("sheet");
  const width = Math.round(s.width * zoom),
    height = Math.round(s.height * zoom);
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  const ctx = c.getContext("2d");
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
  ctx.clearRect(0, 0, s.width, s.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(images.get(s.id), 0, 0);
  let rects = [];
  try {
    rects = rectangles();
  } catch (e) {
    $("coordinates").textContent = e.message;
    return;
  }
  ctx.lineWidth = 1.2 / zoom;
  ctx.font = `${Math.max(10, 11 / zoom)}px Lab`;
  ctx.textBaseline = "top";
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    ctx.strokeStyle = i === selectedRect ? "#ffcb85" : "#c8edaa";
    ctx.fillStyle = i === selectedRect ? "#e3b78e25" : "#10141618";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(
      r.x + 0.5 / zoom,
      r.y + 0.5 / zoom,
      r.w - 1 / zoom,
      r.h - 1 / zoom,
    );
    ctx.fillStyle = "#101416df";
    ctx.fillRect(r.x + 2 / zoom, r.y + 2 / zoom, 26 / zoom, 17 / zoom);
    ctx.fillStyle = "#dcefcf";
    ctx.fillText(String(i + 1), r.x + 5 / zoom, r.y + 4 / zoom);
  }
  if (draft.mode === "cuts") {
    ctx.fillStyle = "#ffcb85";
    for (const x of draft.xs)
      ctx.fillRect(x - 3 / zoom, 0, 6 / zoom, 12 / zoom);
    for (const y of draft.ys)
      ctx.fillRect(0, y - 3 / zoom, 12 / zoom, 6 / zoom);
  }
  if (draft.mode === "grid") {
    ctx.fillStyle = "#ffcb85";
    const g = draft.grid;
    ctx.fillRect(g.marginX + g.w - 3 / zoom, 0, 6 / zoom, 14 / zoom);
    ctx.fillRect(0, g.marginY + g.h - 3 / zoom, 14 / zoom, 6 / zoom);
  }
  if (draft.mode === "rects" && rects[selectedRect]) {
    const r = rects[selectedRect];
    ctx.fillStyle = "#ffcb85";
    ctx.fillRect(
      r.x + r.w - 6 / zoom,
      r.y + r.h - 6 / zoom,
      8 / zoom,
      8 / zoom,
    );
  }
}
function pointerPixel(event) {
  const bounds = $("sheet").getBoundingClientRect(),
    s = source();
  return {
    x: Math.max(
      0,
      Math.min(
        s.width,
        Math.round(((event.clientX - bounds.left) * s.width) / bounds.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        s.height,
        Math.round(((event.clientY - bounds.top) * s.height) / bounds.height),
      ),
    ),
  };
}
on("sheet", "pointerdown", (e) => {
  if (!source()) return;
  e.preventDefault();
  $("sheet").setPointerCapture(e.pointerId);
  const p = pointerPixel(e);
  readDraft();
  drag = {
    start: p,
    base: clone(draft),
    kind: "none",
    scroll: [$("sheet-viewport").scrollLeft, $("sheet-viewport").scrollTop],
    client: [e.clientX, e.clientY],
  };
  if (e.shiftKey) {
    drag.kind = "pan";
    return;
  }
  const near = (v, n) =>
    Math.abs(v - n) < (e.pointerType === "touch" ? 16 : 8) / zoom;
  if (draft.mode === "cuts") {
    const xi = draft.xs.findIndex((x) => near(p.x, x)),
      yi = draft.ys.findIndex((y) => near(p.y, y));
    if (xi >= 0) {
      drag.kind = "x";
      drag.index = xi;
    } else if (yi >= 0) {
      drag.kind = "y";
      drag.index = yi;
    }
  } else if (draft.mode === "grid") {
    if (near(p.x, draft.grid.marginX + draft.grid.w)) drag.kind = "grid-x";
    else if (near(p.y, draft.grid.marginY + draft.grid.h)) drag.kind = "grid-y";
  } else {
    const index = e.altKey
      ? -1
      : draft.rects.findLastIndex(
          (r) =>
            p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
        );
    selectedRect = index;
    if (index < 0) {
      drag.kind = "draw";
    } else {
      const r = draft.rects[index];
      drag.kind =
        near(p.x, r.x + r.w) && near(p.y, r.y + r.h) ? "resize" : "move";
      drag.index = index;
    }
    syncCutUI();
    drawSheet();
  }
});
on("sheet", "pointermove", (e) => {
  if (!source()) return;
  const p = pointerPixel(e);
  $("coordinates").textContent =
    `X ${p.x} · Y ${p.y} · ${Math.round(zoom * 100)}%`;
  if (!drag) return;
  const s = source();
  if (drag.kind === "pan") {
    $("sheet-viewport").scrollLeft =
      drag.scroll[0] - (e.clientX - drag.client[0]);
    $("sheet-viewport").scrollTop =
      drag.scroll[1] - (e.clientY - drag.client[1]);
    return;
  }
  draft = clone(drag.base);
  if (drag.kind === "x")
    draft.xs[drag.index] = Math.max(1, Math.min(s.width - 1, p.x));
  if (drag.kind === "y")
    draft.ys[drag.index] = Math.max(1, Math.min(s.height - 1, p.y));
  if (drag.kind === "grid-x")
    draft.grid.w = Math.max(1, p.x - draft.grid.marginX);
  if (drag.kind === "grid-y")
    draft.grid.h = Math.max(1, p.y - draft.grid.marginY);
  if (drag.kind === "draw") {
    const r = {
      x: Math.min(p.x, drag.start.x),
      y: Math.min(p.y, drag.start.y),
      w: Math.abs(p.x - drag.start.x),
      h: Math.abs(p.y - drag.start.y),
    };
    if (r.w && r.h) {
      draft.rects.push(r);
      selectedRect = draft.rects.length - 1;
    }
  }
  if (drag.kind === "move" || drag.kind === "resize") {
    const r = draft.rects[drag.index];
    if (drag.kind === "move") {
      r.x = Math.max(0, Math.min(s.width - r.w, r.x + p.x - drag.start.x));
      r.y = Math.max(0, Math.min(s.height - r.h, r.y + p.y - drag.start.y));
    } else {
      r.w = Math.max(1, Math.min(s.width - r.x, p.x - r.x));
      r.h = Math.max(1, Math.min(s.height - r.y, p.y - r.y));
    }
  }
  syncDragFields();
});
on("sheet", "pointerup", () => {
  if (drag && drag.kind !== "none" && drag.kind !== "pan")
    notice("Cuts adjusted. Apply cuts to update your subjects.");
  drag = null;
  syncCutUI();
  drawSheet();
});
on("sheet", "pointercancel", () => {
  if (drag) {
    draft = drag.base;
    syncCutUI();
    drawSheet();
  }
  drag = null;
});
on("sheet-viewport", "keydown", (e) => {
  if (
    draft?.mode !== "rects" ||
    selectedRect < 0 ||
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
  )
    return;
  e.preventDefault();
  const r = draft.rects[selectedRect],
    s = source(),
    n = e.shiftKey ? 10 : 1;
  r.x = Math.max(
    0,
    Math.min(
      s.width - r.w,
      r.x + (e.key === "ArrowRight" ? n : e.key === "ArrowLeft" ? -n : 0),
    ),
  );
  r.y = Math.max(
    0,
    Math.min(
      s.height - r.h,
      r.y + (e.key === "ArrowDown" ? n : e.key === "ArrowUp" ? -n : 0),
    ),
  );
  syncCutUI();
  drawSheet();
});

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function decodeImage(bytes) {
  const size = imageDimensions(bytes);
  let offset = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (size.type === "image/png" && offset + 12 <= bytes.length) {
    const length = view.getUint32(offset),
      type = view.getUint32(offset + 4);
    assert(
      type !== 0x6163544c,
      "Animated PNGs are not supported. Export a static PNG first.",
    );
    assert(length <= bytes.length - offset - 12, "Invalid PNG chunk.");
    offset += length + 12;
  }
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: size.type }),
  );
  assert(
    (bitmap.width === size.width && bitmap.height === size.height) ||
      (size.type === "image/jpeg" &&
        bitmap.width === size.height &&
        bitmap.height === size.width),
    "Invalid decoded image dimensions.",
  );
  dimensions(bitmap.width, bitmap.height);
  return bitmap;
}
async function detectImage(image) {
  const c = canvas(image.width, image.height),
    ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
  c.width = 1;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./detect-worker.mjs", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "Detection took too long. Open Advanced View and use a grid or rectangles.",
        ),
      );
    }, 20000);
    worker.onmessage = ({ data }) => {
      finish();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "Automatic detection could not run. Use Advanced View to define cuts.",
        ),
      );
    };
    worker.postMessage(
      { pixels: pixels.buffer, width: image.width, height: image.height },
      [pixels.buffer],
    );
  });
}
async function detectCurrent() {
  assert(source(), "Open an image first.");
  assert(!busy, "Wait for the current export.");
  notice("Finding separate sprites on this device…");
  const id = sourceId,
    result = await detectImage(images.get(id));
  assert(id === sourceId, "Sheet changed during detection. Try again.");
  draft = {
    ...clone(state.sheets[id]),
    mode: "rects",
    rects: result.rects,
    detection: {
      kind: result.kind,
      confidence: result.confidence,
      message: result.message,
    },
    skip: false,
    trim: false,
  };
  selectedRect = -1;
  syncCutUI();
  await applyCuts();
  state.activeSubjectId = state.subjects.find(
    (s) => s.kind === "cell" && s.layers[0].sourceId === id,
  ).id;
  revealSubject();
  syncSubjects();
  paintGallery();
  paint();
  notice(result.message);
}
async function withImageWork(fn) {
  assert(!loading && !busy, "Wait for the current import or export.");
  loading = true;
  const controls = [
    ...document.querySelectorAll("button,input,select,textarea"),
  ].filter((e) => !e.disabled);
  controls.forEach((e) => (e.disabled = true));
  try {
    await fn();
  } finally {
    loading = false;
    controls.forEach((e) => (e.disabled = false));
    updateHistory();
    paintGallery();
    paint();
    syncSubjects();
  }
}
async function processFiles(files) {
  return withImageWork(async () => {
    for (const file of files) await addFile(file);
  });
}
async function addFile(file) {
  assert(
    !busy,
    "Wait for the batch to finish or cancel it before opening images.",
  );
  assert(file.size <= LIMITS.file, "Image exceeds the 20 MB file limit.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    size = imageDimensions(bytes),
    hash = await sha256(bytes);
  if (pendingRecipe) {
    const expected = pendingRecipe.sources.find((s) => s.sha256 === hash);
    assert(
      expected,
      "This image does not match any source hash in the recipe. Choose the original file.",
    );
    assert(
      (size.width === expected.width && size.height === expected.height) ||
        (size.type === "image/jpeg" &&
          size.width === expected.height &&
          size.height === expected.width),
      "Source dimensions do not match.",
    );
    const image = await decodeImage(bytes),
      old = pendingImages.get(expected.id);
    if (old && ![...images.values()].includes(old)) old.close?.();
    pendingImages.set(expected.id, image);
    await finishRecipe();
    return;
  }
  const existing = state.sources.find((s) => s.sha256 === hash);
  if (existing) {
    selectSource(existing.id);
    notice("This image is already open. Switched to its sheet.");
    return;
  }
  assert(
    state.sources.length < LIMITS.sources,
    "Maximum 8 source sheets. Reset to start another project.",
  );
  assert(
    state.sources.reduce((n, s) => n + s.width * s.height, 0) +
      size.width * size.height <=
      LIMITS.totalPixels,
    "Project exceeds 24 megapixels. Reset before opening this image.",
  );
  const image = await decodeImage(bytes),
    id = `src-${hash.slice(0, 16)}`;
  notice("Finding separate sprites on this device…");
  let result;
  try {
    result = await detectImage(image);
  } catch (error) {
    result = {
      rects: [{ x: 0, y: 0, w: image.width, h: image.height }],
      confidence: "low",
      kind: "unavailable",
      message: error.message,
    };
  }
  if (demoOnly) {
    for (const old of images.values()) old.close?.();
    images.clear();
    state.sources = [];
    state.sheets = {};
    state.subjects = [];
    state.activeSubjectId = "";
    demoOnly = false;
    if (state.banner.name === "Ceruleanish Facet Prism")
      state.banner.name = "My release";
  }
  images.set(id, image);
  const s = {
    id,
    name: file.name.replace(/[\\/]/g, "-").slice(0, 255),
    sha256: hash,
    width: image.width,
    height: image.height,
    type: size.type,
  };
  state.sources.push(s);
  state.sheets[id] = {
    ...defaultSheet(s),
    mode: "rects",
    rects: result.rects,
    skip: false,
    trim: false,
    detection: {
      kind: result.kind,
      confidence: result.confidence,
      message: result.message,
    },
  };
  if (
    result.kind === "transparency" &&
    result.rects.length > 8 &&
    result.rects.map((r) => r.h).sort((a, b) => a - b)[
      Math.floor(result.rects.length / 2)
    ] < 110
  )
    state.banner.smooth = false;
  selectSource(id);
  await applyCuts(false);
  state.activeSubjectId = state.subjects.find(
    (v) => v.kind === "cell" && v.layers[0].sourceId === id,
  ).id;
  revealSubject();
  syncBannerUI();
  syncSubjects();
  paintGallery();
  paint();
  history = [];
  future = [];
  updateHistory();
  notice(`${s.name} opened locally. ${result.message}`);
}
async function finishRecipe() {
  const missing = pendingRecipe.sources.filter((s) => !pendingImages.has(s.id));
  if (missing.length) {
    notice(
      `Recipe is ready. Open the original image file(s): ${missing.map((s) => s.name).join(", ")}. Source hashes will be checked.`,
    );
    return;
  }
  const next = pendingRecipe;
  pendingRecipe = null;
  const keep = new Set(pendingImages.values());
  for (const image of new Set(images.values()))
    if (!keep.has(image)) image.close?.();
  images.clear();
  for (const [id, image] of pendingImages) images.set(id, image);
  pendingImages = new Map();
  state = next;
  demoOnly = false;
  revealSubject();
  history = [];
  future = [];
  updateHistory();
  invalidateBatch();
  selectSource(state.sources[0].id);
  syncBannerUI();
  syncSubjects();
  paintGallery();
  paint();
  notice("Recipe restored with matching local images.");
}
async function demo() {
  demoOnly = true;
  galleryPage = 0;
  clearPendingRecipe();
  for (const image of new Set(images.values())) image.close?.();
  images.clear();
  state = initialState();
  history = [];
  future = [];
  updateHistory();
  shuffleIndex = 0;
  invalidateBatch();
  const response = await fetch("./assets/demo-sheet.png");
  assert(response.ok, "Demo sheet failed to load.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const image = await decodeImage(bytes),
    hash = await sha256(bytes),
    id = `src-${hash.slice(0, 16)}`,
    s = {
      id,
      name: "demo-sheet.png",
      sha256: hash,
      width: image.width,
      height: image.height,
    };
  images.set(id, image);
  state.sources = [s];
  state.sheets[id] = {
    ...defaultSheet(s),
    grid: {
      w: 240,
      h: 240,
      marginX: 0,
      marginY: 0,
      gapX: 0,
      gapY: 0,
      partial: false,
    },
  };
  selectSource(id);
  await applyCuts(false);
  const labels = [
    "Ceruleanish Facet Prism",
    "Amberish Orbit",
    "Jadeish Crown",
    "Rose Arc",
    "Glacier Spark",
    "Violet Bloom",
  ];
  state.subjects.forEach((s, i) => (s.name = labels[i]));
  syncBannerUI();
  syncSubjects();
  paintGallery();
  paint();
  notice(
    "Original demo sheet loaded. Try cutting guides, select a subject, or bring your own PNG.",
  );
}

on("image-file", "change", async (e) => {
  try {
    await processFiles([...e.target.files]);
  } finally {
    e.target.value = "";
  }
});
for (const event of ["dragenter", "dragover"])
  $("dropzone").addEventListener(event, (e) => {
    e.preventDefault();
    $("dropzone").classList.add("over");
  });
$("dropzone").addEventListener("dragleave", () =>
  $("dropzone").classList.remove("over"),
);
on("dropzone", "drop", async (e) => {
  e.preventDefault();
  $("dropzone").classList.remove("over");
  await processFiles([...e.dataTransfer.files]);
});
on("quick-file", "change", async (e) => {
  try {
    await processFiles([...e.target.files]);
  } finally {
    e.target.value = "";
  }
});
for (const event of ["dragenter", "dragover"])
  $("quick-dropzone").addEventListener(event, (e) => {
    e.preventDefault();
    $("quick-dropzone").classList.add("over");
  });
$("quick-dropzone").addEventListener("dragleave", () =>
  $("quick-dropzone").classList.remove("over"),
);
on("quick-dropzone", "drop", async (e) => {
  e.preventDefault();
  $("quick-dropzone").classList.remove("over");
  await processFiles([...e.dataTransfer.files]);
});
on("simple-view", "click", () => setView("simple"));
on("advanced-view", "click", () => setView("advanced"));
on("adjust-cuts", "click", () => {
  setView("advanced");
  switchTab("sheet");
  $("cut-mode").focus();
});
on("quick-detect", "click", () => withImageWork(detectCurrent));
on("auto-detect", "click", () => withImageWork(detectCurrent));
on("gallery-prev", "click", () => {
  galleryPage = Math.max(0, galleryPage - 1);
  paintGallery();
});
on("gallery-next", "click", () => {
  galleryPage++;
  paintGallery();
});
for (const [id, key] of [
  ["quick-project", "project"],
  ["quick-name", "name"],
  ["quick-version", "version"],
  ["quick-palette", "palette"],
])
  on(id, id === "quick-palette" ? "change" : "input", (e) => {
    state.banner[key] = e.target.value;
    if (key === "palette") state.banner.accent = PALETTES[e.target.value];
    syncBannerUI();
    paint();
    invalidateBatch();
  });
on("quick-shuffle", "click", () => {
  const temporary = clone(state);
  temporary.random.enabled = {
    subject: true,
    palette: true,
    layout: false,
    quote: false,
    name: false,
  };
  const next = randomize(
    temporary,
    `${state.random.seed}:quick:${shuffleIndex++}`,
  );
  state.banner = next.banner;
  state.activeSubjectId = next.activeSubjectId;
  state.resolvedSeed = next.resolvedSeed;
  galleryPage = Math.floor(
    state.subjects.findIndex((s) => s.id === state.activeSubjectId) / 12,
  );
  syncBannerUI();
  syncSubjects();
  paintGallery();
  paint();
  invalidateBatch();
});
on("demo", "click", demo);
on("reset", "click", demo);
function clearPendingRecipe() {
  const active = new Set(images.values());
  for (const image of new Set(pendingImages.values()))
    if (!active.has(image)) image.close?.();
  pendingImages = new Map();
  pendingRecipe = null;
}
on("recipe-file", "change", async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    assert(file.size <= 2_000_000, "Recipe exceeds 2 MB.");
    const next = validateState(JSON.parse(await file.text()));
    clearPendingRecipe();
    for (const s of next.sources) {
      const existing = state.sources.find((v) => v.sha256 === s.sha256);
      if (existing && images.has(existing.id))
        pendingImages.set(s.id, images.get(existing.id));
    }
    pendingRecipe = next;
    await finishRecipe();
  } finally {
    e.target.value = "";
  }
});
on("source-select", "change", (e) => selectSource(e.target.value));
on("cut-mode", "change", () => {
  readDraft();
  syncCutUI();
  drawSheet();
});
for (const id of [
  "cell-w",
  "cell-h",
  "margin-x",
  "margin-y",
  "gap-x",
  "gap-y",
  "partial",
  "cuts-x",
  "cuts-y",
  "skip-empty",
  "trim",
])
  on(id, "change", () => {
    readDraft();
    drawSheet();
  });
on("from-count", "click", () => {
  const s = source(),
    cols = numeric("columns"),
    rows = numeric("rows");
  assert(
    Number.isInteger(cols) && Number.isInteger(rows),
    "Counts must be integers.",
  );
  readDraft();
  const g = draft.grid;
  g.w = Math.floor((s.width - 2 * g.marginX - (cols - 1) * g.gapX) / cols);
  g.h = Math.floor((s.height - 2 * g.marginY - (rows - 1) * g.gapY) / rows);
  rectangles();
  syncCutUI();
  drawSheet();
  notice(
    "Grid size set from counts. Any remainder is excluded unless partial edges are enabled. Apply cuts to update subjects.",
  );
});
on("region-select", "change", (e) => {
  selectedRect = Number(e.target.value);
  syncCutUI();
  drawSheet();
});
on("update-rect", "click", () => {
  const r = Object.fromEntries(
      ["x", "y", "w", "h"].map((k) => [k, numeric(`rect-${k}`)]),
    ),
    s = source();
  assert(
    rectValid(r, s.width, s.height),
    "Region must fit inside the source image.",
  );
  if (selectedRect < 0) {
    assert(
      draft.rects.length < LIMITS.cells,
      `Maximum ${LIMITS.cells} regions.`,
    );
    draft.rects.push(r);
    selectedRect = draft.rects.length - 1;
  } else draft.rects[selectedRect] = r;
  syncCutUI();
  drawSheet();
  notice("Region updated. Apply cuts to update subjects.");
});
on("delete-rect", "click", () => {
  if (selectedRect >= 0) draft.rects.splice(selectedRect, 1);
  selectedRect = -1;
  syncCutUI();
  drawSheet();
});
on("apply-cuts", "click", () => applyCuts());
on("undo", "click", () => {
  if (history.length) {
    future.push(snapshot());
    restoreSnapshot(history.pop());
    updateHistory();
    notice("Previous cuts restored.");
  }
});
on("redo", "click", () => {
  if (future.length) {
    history.push(snapshot());
    restoreSnapshot(future.pop());
    updateHistory();
  }
});
on("zoom", "input", (e) => setZoom(Number(e.target.value)));
on("fit", "click", fitSheet);
on("actual-size", "click", () => setZoom(1));
on("subject-select", "change", (e) => {
  state.activeSubjectId = e.target.value;
  revealSubject();
  selectedLayer = 0;
  syncSubjects();
  paintGallery();
  paint();
  invalidateBatch();
});
on("subject-name", "input", (e) => {
  subject().name = e.target.value;
  paintGallery();
  paint();
  invalidateBatch();
});
on("subject-name", "change", syncSubjects);
on("include-subject", "change", (e) => {
  subject().include = e.target.checked;
  paintGallery();
  invalidateBatch();
});
for (const id of ["select-all", "select-none"])
  on(id, "click", () => {
    state.subjects.forEach((s) => (s.include = id === "select-all"));
    syncSubjects();
    paintGallery();
    invalidateBatch();
  });
on("new-assembly", "click", () => {
  assert(state.subjects.length < LIMITS.cells + 100, "Too many subjects.");
  const s = subject(),
    id = `assembly-${crypto.randomUUID()}`;
  state.subjects.push({
    id,
    name: "My assembly",
    kind: "assembly",
    include: true,
    layers: clone(s.layers),
  });
  state.activeSubjectId = id;
  revealSubject();
  selectedLayer = 0;
  syncSubjects();
  paintGallery();
  paint();
  invalidateBatch();
});
on("delete-assembly", "click", () => {
  assert(subject().kind === "assembly", "Select an assembly first.");
  state.subjects = state.subjects.filter((s) => s.id !== state.activeSubjectId);
  state.activeSubjectId = state.subjects[0].id;
  syncSubjects();
  paintGallery();
  paint();
  invalidateBatch();
});
on("layer-select", "change", (e) => {
  selectedLayer = Number(e.target.value);
  syncLayer();
});
for (const key of ["x", "y", "scale", "rotation", "flip", "visible"])
  on(`layer-${key}`, "change", (e) => {
    const l = subject().layers[selectedLayer];
    l[key] =
      e.target.type === "checkbox" ? e.target.checked : numeric(`layer-${key}`);
    paint();
    paintGallery();
    invalidateBatch();
  });
for (const id of ["layer-back", "layer-front", "layer-remove"])
  on(id, "click", () => {
    const layers = subject().layers;
    if (id === "layer-remove") {
      assert(layers.length > 1, "Keep at least one layer.");
      layers.splice(selectedLayer, 1);
      selectedLayer = Math.max(0, selectedLayer - 1);
    } else {
      const next = selectedLayer + (id === "layer-front" ? 1 : -1);
      if (next < 0 || next >= layers.length) return;
      [layers[next], layers[selectedLayer]] = [
        layers[selectedLayer],
        layers[next],
      ];
      selectedLayer = next;
    }
    syncSubjects();
    paint();
    paintGallery();
    invalidateBatch();
  });
const bannerFields = {
  project: "project",
  "release-name": "name",
  version: "version",
  layout: "layout",
  palette: "palette",
  accent: "accent",
  background: "background",
  quote: "quote",
  "subject-x": "x",
  "subject-y": "y",
  "subject-scale": "scale",
  "subject-rotation": "rotation",
  "subject-flip": "flip",
  smooth: "smooth",
};
for (const [id, key] of Object.entries(bannerFields))
  on(id, ["text", "color"].includes($(id).type) ? "input" : "change", (e) => {
    state.banner[key] =
      e.target.type === "checkbox"
        ? e.target.checked
        : e.target.type === "number"
          ? numeric(id)
          : e.target.value;
    if (key === "palette") {
      state.banner.accent = PALETTES[state.banner.palette];
      $("accent").value = state.banner.accent;
    }
    paint();
    if (key === "smooth") paintGallery();
    invalidateBatch();
  });
for (const id of ["remove-background", "quick-remove-background"])
  on(id, "change", (e) => {
    state.banner.removeBackground = e.target.checked;
    syncBannerUI();
    paintGallery();
    paint();
    invalidateBatch();
  });
const normalizeAngle = angle => ((angle + 180) % 360 + 360) % 360 - 180;
for (const button of document.querySelectorAll("[data-orient]"))
  button.addEventListener("click", guard(() => {
    const b = state.banner, action = button.dataset.orient;
    if (action === "rotate") b.rotation = normalizeAngle(b.rotation + 90);
    else {
      b.rotation = normalizeAngle((action === "vertical" ? 180 : 0) - b.rotation);
      b.flip = !b.flip;
    }
    syncBannerUI();
    paint();
    invalidateBatch();
  }));
on("reset-transform", "click", () => {
  Object.assign(state.banner, neutral);
  syncBannerUI();
  paint();
  invalidateBatch();
});
on("show-guides", "change", (e) => {
  $("safe-guides").toggleAttribute("hidden", !e.target.checked);
});
on("seed", "input", (e) => {
  state.random.seed = e.target.value;
  shuffleIndex = 0;
  invalidateBatch();
});
on("name-pool", "change", (e) => {
  const names = e.target.value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  assert(
    names.length <= 100 && names.every((n) => n.length <= 160),
    "Use up to 100 names of at most 160 characters.",
  );
  state.random.names = names;
  invalidateBatch();
});
document.querySelectorAll("[data-random]").forEach((el) =>
  el.addEventListener("change", () => {
    state.random.enabled[el.dataset.random] = el.checked;
    invalidateBatch();
  }),
);
for (const [id, key] of [
  ["layout-pool", "layouts"],
  ["palette-pool", "palettes"],
  ["quote-pool", "quotes"],
])
  on(id, "change", () => {
    state.random[key] = [...$(id).querySelectorAll("input:checked")].map(
      (el) => el.value,
    );
    invalidateBatch();
  });
on("shuffle", "click", () => {
  state = randomize(state, `${state.random.seed}:shuffle:${shuffleIndex++}`);
  revealSubject();
  syncBannerUI();
  syncSubjects();
  paintGallery();
  paint();
  invalidateBatch();
  notice(`Shuffled enabled fields. Resolved seed: ${state.resolvedSeed}`);
});
on("save-recipe", "click", () => {
  assert(!pendingRecipe, "Finish opening recipe sources first.");
  download(
    jsonBlob(validateState(state)),
    `${safeName(state.banner.name)}.banner.json`,
  );
  notice(
    "Recipe downloaded. Keep the original source PNGs to reopen it later.",
  );
});
on("export-png", "click", async () => {
  assert(renderOK, "Fix the preview warning before exporting.");
  await loadFonts();
  const c = canvas(1500, 500);
  renderBanner(c, validateState(state), images);
  download(await pngBlob(c), `${safeName(state.banner.name)}.png`);
  c.width = 1;
  notice(
    "Full-resolution PNG downloaded. Save its recipe to preserve your settings.",
  );
});
on("plan-batch", "click", async () => {
  assert(!busy, "Wait for the current batch.");
  validateState(state);
  jobs = batchJobs(
    state,
    $("batch-mode").value,
    numeric("batch-count"),
    $("batch-labels").checked,
  );
  $("batch-gallery").replaceChildren();
  const signatures = new Set();
  for (const job of jobs) {
    const card = document.createElement("div");
    card.className = "batch-item";
    const c = canvas(1500, 500);
    renderBanner(c, job.state, images);
    const small = canvas(450, 150);
    small.getContext("2d").drawImage(c, 0, 0, 450, 150);
    c.width = 1;
    const label = document.createElement("label");
    label.append(document.createTextNode("Release name"));
    const input = document.createElement("input");
    input.maxLength = 160;
    input.value = job.state.banner.name;
    input.addEventListener(
      "input",
      guard(() => {
        job.state.banner.name = input.value;
        const full = canvas(1500, 500);
        renderBanner(full, job.state, images);
        small.getContext("2d").drawImage(full, 0, 0, 450, 150);
        full.width = 1;
      }),
    );
    label.append(input);
    const p = document.createElement("p");
    p.textContent = `${job.filename}.png · ${job.state.banner.layout} / ${job.state.banner.palette}`;
    card.append(small, label, p);
    $("batch-gallery").append(card);
    signatures.add(
      JSON.stringify([job.state.activeSubjectId, job.state.banner]),
    );
  }
  $("batch-summary").textContent =
    `${jobs.length} banners · ${signatures.size} distinct compositions · PNG + JSON + manifest. ZIP limited to 128 MB. Titles can be edited below; filenames retain their preview IDs.`;
  $("batch-section").hidden = false;
  $("batch-progress").hidden = true;
  $("batch-status").textContent = "";
  $("batch-section").scrollIntoView({ behavior: "smooth", block: "nearest" });
  notice(
    "Batch prepared. Review the thumbnails and titles, then download the ZIP.",
  );
});
for (const id of ["batch-mode", "batch-count", "batch-labels"]) {
  on(id, id === "batch-count" ? "input" : "change", invalidateBatch);
}
on("close-batch", "click", () => {
  assert(!busy, "Cancel the running batch first.");
  jobs = [];
  $("batch-section").hidden = true;
});
on("cancel-batch", "click", () => {
  cancelled = true;
  $("batch-status").textContent = "Cancelling…";
});
on("export-batch", "click", async () => {
  assert(!busy && jobs.length, "Preview a batch first.");
  const frozen = clone(jobs);
  frozen.forEach((job) => validateState(job.state));
  await loadFonts();
  busy = true;
  cancelled = false;
  // Freeze the editor, while keeping cancellation available. Never expose partial ZIPs.
  const disabled = [
    ...document.querySelectorAll("button,input,select,textarea"),
  ].filter((el) => el.id !== "cancel-batch" && !el.disabled);
  disabled.forEach((el) => (el.disabled = true));
  $("cancel-batch").hidden = false;
  $("cancel-batch").disabled = false;
  $("batch-progress").hidden = false;
  $("batch-progress").max = frozen.length;
  $("batch-progress").value = 0;
  const chunks = [];
  let bytes = 0,
    zipError = null;
  const zip = new Zip((error, data) => {
    if (error) {
      zipError = error;
      return;
    }
    bytes += data.length;
    if (bytes > LIMITS.zip) {
      zipError = new Error("ZIP exceeded 128 MB. Export fewer banners.");
      return;
    }
    chunks.push(data);
  });
  const append = (name, data) => {
    if (zipError) throw zipError;
    const file = new ZipPassThrough(name);
    zip.add(file);
    file.push(data, true);
    if (zipError) throw zipError;
  };
  const encoder = new TextEncoder();
  const manifest = {
    format: "banner-lab-batch-v1",
    engine: ENGINE,
    count: frozen.length,
    outputs: [],
  };
  const c = canvas(1500, 500);
  try {
    for (let i = 0; i < frozen.length; i++) {
      assert(!cancelled, "Batch cancelled. No partial download was created.");
      const job = frozen[i];
      renderBanner(c, job.state, images);
      const blob = await pngBlob(c);
      assert(!cancelled, "Batch cancelled. No partial download was created.");
      append(`${job.filename}.png`, new Uint8Array(await blob.arrayBuffer()));
      append(
        `${job.filename}.json`,
        encoder.encode(JSON.stringify(job.state, null, 2)),
      );
      manifest.outputs.push({
        png: `${job.filename}.png`,
        recipe: `${job.filename}.json`,
      });
      $("batch-progress").value = i + 1;
      $("batch-status").textContent = `${i + 1} / ${frozen.length} banners`;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert(!cancelled, "Batch cancelled. No partial download was created.");
    append("manifest.json", encoder.encode(JSON.stringify(manifest, null, 2)));
    zip.end();
    if (zipError) throw zipError;
    download(
      new Blob(chunks, { type: "application/zip" }),
      "banner-lab-batch.zip",
    );
    notice(`${frozen.length} banners and their recipes downloaded in one ZIP.`);
    $("batch-status").textContent = "ZIP complete";
  } finally {
    zip.terminate();
    chunks.length = 0;
    c.width = 1;
    busy = false;
    disabled.forEach((el) => (el.disabled = false));
    $("cancel-batch").hidden = true;
    paint();
    updateHistory();
    syncSubjects();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
await guard(async () => {
  await loadFonts();
  ready = true;
  await demo();
})();
