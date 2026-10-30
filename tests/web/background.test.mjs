import { test } from "node:test";
import assert from "node:assert/strict";
import { removeFlatBackground } from "../../web/background.mjs";

test("flat matte removal preserves enclosed matching colours and subject RGB", () => {
  const w = 12, data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 3; y < 9; y++) for (let x = 3; x < 9; x++) {
    const i = (y * w + x) * 4;
    data[i] = 180; data[i + 1] = 30; data[i + 2] = 50;
  }
  data.set([255,255,255,255], (5 * w + 5) * 4);
  assert.equal(removeFlatBackground(data, w, w), 108);
  assert.equal(data[3], 0);
  assert.deepEqual([...data.slice((3*w+3)*4, (3*w+3)*4+4)], [180,30,50,255]);
  assert.equal(data[(5*w+5)*4+3], 255);
});

test("transparent and ambiguous images retain their alpha", () => {
  for (const transparent of [true, false]) {
    const data = new Uint8ClampedArray(20 * 20 * 4);
    for (let p = 0; p < 400; p++) data.set([p % 256, (p*17)%256, (p*31)%256, transparent ? 128 : 255], p*4);
    const before = data.slice();
    assert.equal(removeFlatBackground(data, 20, 20), 0);
    assert.deepEqual(data, before);
  }
});
