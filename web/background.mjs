// Remove only a dominant flat matte connected to the image border.
// Enclosed matching colours (eyes, clothing, highlights) stay intact.
export function removeFlatBackground(data, width, height) {
  const total = width * height, counts = new Map();
  const keyAt = (p) => {
    const i = p * 4;
    return [0, 1, 2].map(c => Math.round(data[i + c] / 16)).join(",");
  };
  let border = 0;
  const sample = p => {
    border++;
    if (data[p * 4 + 3] < 240) return;
    const key = keyAt(p);
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (let x = 0; x < width; x++) { sample(x); sample((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { sample(y * width); sample(y * width + width - 1); }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < border * 0.7) return 0;
  const colour = best[0].split(",").map(v => v * 16);
  const seen = new Uint8Array(total), queue = new Int32Array(total);
  let head = 0, tail = 0, removed = 0;
  const visit = p => {
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (data[i + 3] !== 0 && colour.some((v, c) => Math.abs(data[i + c] - v) > 24)) return;
    queue[tail++] = p;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % width;
    if (data[p * 4 + 3]) removed++;
    data[p * 4 + 3] = 0;
    if (x) visit(p - 1);
    if (x + 1 < width) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < total) visit(p + width);
  }
  return removed;
}
