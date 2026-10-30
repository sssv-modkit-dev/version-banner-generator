import test from "node:test";
import assert from "node:assert/strict";
import { detectCells } from "../../web/detect.mjs";
function fixture(w, h, bg) {
  const data = new Uint8ClampedArray(w * h * 4);
  if (bg) for (let i = 0; i < w * h; i++) data.set(bg, i * 4);
  return { data, w, h };
}
function box(f, x, y, w, h, color = [160, 40, 20, 255]) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) f.data.set(color, (j * f.w + i) * 4);
}
test("transparent irregular sprites stay separate, with nearby detached details", () => {
  const f = fixture(100, 80);
  box(f, 8, 10, 20, 30);
  box(f, 52, 12, 25, 28);
  box(f, 13, 7, 4, 2);
  box(f, 5, 58, 15, 15);
  const r = detectCells(f.data, f.w, f.h);
  assert.equal(r.rects.length, 3);
  assert.equal(r.kind, "transparency");
  assert.ok(r.rects[0].y <= 7);
});
test("flat opaque matte does not become a single full-sheet cell", () => {
  const f = fixture(100, 70, [24, 31, 43, 255]);
  box(f, 5, 20, 25, 30);
  box(f, 55, 20, 25, 30);
  const r = detectCells(f.data, f.w, f.h);
  assert.equal(r.rects.length, 2);
  assert.equal(r.kind, "flat matte");
});
test("printed checkerboard and pale grid lines do not connect subjects", () => {
  const f = fixture(100, 80, [254, 254, 254, 255]);
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < 100; x++)
      if ((Math.floor(x / 10) + Math.floor(y / 10)) % 2)
        f.data.set([237, 237, 237, 255], (y * 100 + x) * 4);
  box(f, 8, 12, 20, 40);
  box(f, 58, 12, 20, 40);
  box(f, 0, 60, 100, 1, [245, 220, 225, 255]);
  assert.equal(detectCells(f.data, 100, 80).rects.length, 2);
});
test("empty images have an honest fallback and all cuts fit the image", () => {
  const f = fixture(10, 10);
  const r = detectCells(f.data, 10, 10);
  assert.equal(r.confidence, "low");
  assert.deepEqual(r.rects, [{ x: 0, y: 0, w: 10, h: 10 }]);
});
test("disconnected details inside a silhouette do not create duplicate crops", () => {
  const f = fixture(100, 80, [255, 255, 255, 255]);
  box(f, 5, 10, 40, 2);
  box(f, 5, 10, 2, 50);
  box(f, 43, 10, 2, 50);
  box(f, 5, 58, 40, 2);
  box(f, 15, 20, 20, 20);
  box(f, 60, 10, 30, 50);
  assert.equal(detectCells(f.data, 100, 80).rects.length, 2);
});
