import test from "node:test";
import assert from "node:assert/strict";
import {
  gridRects,
  cutRects,
  alphaBounds,
  initialState,
  randomize,
  batchJobs,
  validateState,
  safeName,
  pngDimensions,
  imageDimensions,
  caption,
  QUOTES,
} from "../../web/core.mjs";

function fixture() {
  const s = initialState();
  s.sources = [
    { id: "s", name: "sheet.png", sha256: "a".repeat(64), width: 8, height: 8 },
  ];
  s.sheets = {
    s: {
      mode: "grid",
      grid: {
        w: 4,
        h: 4,
        marginX: 0,
        marginY: 0,
        gapX: 0,
        gapY: 0,
        partial: false,
      },
      rects: [],
      xs: [],
      ys: [],
    },
  };
  s.subjects = ["one", "two"].map((id) => ({
    id,
    name: id,
    include: true,
    kind: "cell",
    layers: [
      {
        sourceId: "s",
        rect: { x: 0, y: 0, w: 4, h: 4 },
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        flip: false,
        visible: true,
      },
    ],
  }));
  s.activeSubjectId = "one";
  return s;
}
test("grid excludes gutters and margins and treats partial edges explicitly", () => {
  const g = {
    w: 3,
    h: 2,
    marginX: 1,
    marginY: 1,
    gapX: 1,
    gapY: 1,
    partial: false,
  };
  assert.deepEqual(gridRects(10, 8, g), [
    { x: 1, y: 1, w: 3, h: 2 },
    { x: 5, y: 1, w: 3, h: 2 },
    { x: 1, y: 4, w: 3, h: 2 },
    { x: 5, y: 4, w: 3, h: 2 },
  ]);
  assert.equal(gridRects(11, 9, { ...g, partial: true }).length, 9);
  assert.throws(() => gridRects(1000, 1000, { ...g, w: 1, h: 1 }), /1024/);
  assert.throws(() => gridRects(8, 8, { ...g, w: 0 }), /positive/);
});
test("uneven cuts are normalized and ordered row-major", () => {
  assert.deepEqual(cutRects(10, 5, [7, 3, 3], [2]), [
    { x: 0, y: 0, w: 3, h: 2 },
    { x: 3, y: 0, w: 4, h: 2 },
    { x: 7, y: 0, w: 3, h: 2 },
    { x: 0, y: 2, w: 3, h: 3 },
    { x: 3, y: 2, w: 4, h: 3 },
    { x: 7, y: 2, w: 3, h: 3 },
  ]);
  assert.throws(() => cutRects(10, 5, [0], []), /inside/);
  assert.throws(() => cutRects(10, 5, [1.5], []), /integer/);
});
test("alpha trimming retains faint and boundary pixels and recognizes emptiness", () => {
  const data = new Uint8ClampedArray(4 * 3 * 4);
  assert.equal(alphaBounds(data, 4, 3), null);
  data[3] = 1;
  data[(2 * 4 + 3) * 4 + 3] = 255;
  assert.deepEqual(alphaBounds(data, 4, 3), { x: 0, y: 0, w: 4, h: 3 });
});
test("random choices are stable and locks preserve exact custom values", () => {
  const s = fixture();
  s.banner.accent = "#abcdef";
  s.random.enabled.palette = false;
  s.random.enabled.quote = false;
  assert.deepEqual(randomize(s, "x"), randomize(s, "x"));
  assert.equal(randomize(s, "y").banner.accent, "#abcdef");
  assert.equal(randomize(s, "y").banner.quote, "french");
  assert.equal(s.activeSubjectId, "one");
  assert.equal(s.resolvedSeed, undefined);
});
test("batch counts, excluded subjects, resolved recipes and filenames are bounded", () => {
  const s = fixture();
  assert.equal(batchJobs(s, "combinations", 1).length, 18);
  s.subjects[1].include = false;
  assert.equal(batchJobs(s, "subjects", 1).length, 1);
  assert.equal(batchJobs(s, "random", 12).length, 12);
  assert.throws(() => batchJobs(s, "random", 101), /1–100/);
  const jobs = batchJobs(s, "random", 12);
  assert.equal(new Set(jobs.map((j) => j.filename)).size, 12);
  assert.deepEqual(jobs, batchJobs(s, "random", 12));
  assert.equal(safeName("../../evil\\a: b"), "evil-a-b");
  assert.equal(safeName("日本語"), "banner");
});
test("recipe validation checks references, budgets and transforms without trusting JSON", () => {
  const s = fixture();
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))), s);
  for (const mutate of [
    (v) => (v.subjects[0].layers[0].rect.x = 9),
    (v) => (v.subjects[0].layers[0].sourceId = "missing"),
    (v) => (v.banner.scale = Infinity),
    (v) => (v.sources[0].name = "C:\\private.png"),
    (v) => v.sources.push({ ...v.sources[0] }),
    (v) => (v.random.layouts = ["unknown"]),
    (v) => (v.sources[0].width = 5000),
    (v) => (v.banner.quote = "toString"),
  ]) {
    const invalid = structuredClone(s);
    mutate(invalid);
    assert.throws(() => validateState(invalid));
  }
  assert.throws(
    () => validateState({ format: "version-banner-generator-v1" }),
    /CLI recipes/,
  );
});
test("quote conventions remain matched", () => {
  for (const [key, quotes] of Object.entries(QUOTES)) {
    assert.equal(
      caption({ ...fixture().banner, quote: key, name: "Test" }),
      quotes[0] + "Test" + quotes[1] + " edition",
    );
  }
});
test("PNG dimensions are checked before decoding", () => {
  const bytes = new Uint8Array(24),
    v = new DataView(bytes.buffer);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  v.setUint32(8, 13);
  v.setUint32(12, 0x49484452);
  v.setUint32(16, 8);
  v.setUint32(20, 4);
  assert.deepEqual(pngDimensions(bytes), { width: 8, height: 4 });
  v.setUint32(16, 99999);
  assert.throws(() => pngDimensions(bytes), /exceeds/);
});
test("JPEG marker dimensions are bounded before image allocation", () => {
  const bytes = new Uint8Array(23),
    v = new DataView(bytes.buffer);
  bytes.set([255, 216, 255, 194]);
  v.setUint16(4, 17);
  bytes[6] = 8;
  v.setUint16(7, 80);
  v.setUint16(9, 120);
  assert.deepEqual(imageDimensions(bytes), {
    width: 120,
    height: 80,
    type: "image/jpeg",
  });
  v.setUint16(9, 9999);
  assert.throws(() => imageDimensions(bytes), /exceeds/);
  assert.throws(
    () => imageDimensions(new Uint8Array([255, 216, 255])),
    /dimensions/,
  );
});
