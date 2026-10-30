// Geometry-only suggestions. Background classification never edits source pixels.
import { LIMITS, dimensions } from "./core.mjs";

export function detectCells(data, width, height) {
  dimensions(width, height);
  const total = width * height,
    samples = new Map();
  let transparent = 0;
  for (let i = 0; i < total; i++) if (data[i * 4 + 3] < 32) transparent++;
  const alpha = transparent > total * 0.005;
  // Quantized border colours distinguish flat mattes from busy artwork.
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 32) return;
    const key = [0, 1, 2]
      .map((c) => Math.round(data[i + c] / 16) * 16)
      .join(",");
    samples.set(key, (samples.get(key) || 0) + 1);
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 256))) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 256))) {
    sample(0, y);
    sample(width - 1, y);
  }
  const ranked = [...samples].sort((a, b) => b[1] - a[1]);
  const borderTotal = [...samples.values()].reduce((a, b) => a + b, 0);
  const bg = (ranked[0]?.[0] || "256,256,256").split(",").map(Number);
  const light =
    bg.every((c) => c >= 224) && Math.max(...bg) - Math.min(...bg) < 32;
  const flat = ranked[0]?.[1] > borderTotal * 0.25;
  const mask = new Uint8Array(total);
  let foreground = 0;
  for (let p = 0; p < total; p++) {
    const i = p * 4,
      r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    // Pale printed grids and light checkerboards are segmentation backgrounds,
    // while darker outlines/colour remain foreground. Alpha always takes priority.
    const background = alpha
      ? data[i + 3] < 24
      : light
        ? Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 64
        : flat &&
          Math.max(
            Math.abs(r - bg[0]),
            Math.abs(g - bg[1]),
            Math.abs(b - bg[2]),
          ) < 23;
    if (!background && data[i + 3] >= 24) {
      mask[p] = 1;
      foreground++;
    }
  }
  const kind = alpha
    ? "transparency"
    : light
      ? "light matte / printed grid"
      : flat
        ? "flat matte"
        : "unclear background";
  const fallback = (message) => ({
    rects: [{ x: 0, y: 0, w: width, h: height }],
    kind,
    confidence: "low",
    message,
    omitted: 0,
  });
  if (!foreground || (!alpha && !flat && !light) || foreground > total * 0.87)
    return fallback(
      "No clear separation found. Kept the whole image; use Advanced View to define cuts.",
    );

  // Eight-connected components retain diagonal pixel-art outlines.
  const queue = new Int32Array(total),
    components = [];
  for (let p = 0; p < total; p++) {
    if (!mask[p]) continue;
    let head = 0,
      tail = 1,
      x0 = p % width,
      x1 = x0,
      y0 = Math.floor(p / width),
      y1 = y0;
    queue[0] = p;
    mask[p] = 0;
    while (head < tail) {
      const q = queue[head++],
        x = q % width,
        y = Math.floor(q / width);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const n = ny * width + nx;
          if (mask[n]) {
            mask[n] = 0;
            queue[tail++] = n;
          }
        }
    }
    if (tail >= 4)
      components.push({
        x: x0,
        y: y0,
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
        area: tail,
      });
    if (components.length > 30_000)
      return fallback(
        "This image has too much fine texture for reliable separation. Use Advanced View for cuts.",
      );
  }
  if (!components.length)
    return fallback("No separate subjects found. Kept the whole image.");
  const byArea = components.slice().sort((a, b) => b.area - a.area);
  // Ignore annotations/noise relative to substantial artwork, without assuming a grid.
  const reference =
    byArea[Math.min(4, Math.floor(byArea.length * 0.08))] || byArea[0];
  const minArea = Math.max(12, reference.area * 0.014);
  const minHeight = Math.max(3, reference.h * 0.19);
  const large = components.filter(
    (c) => c.area >= minArea && c.h >= minHeight && c.w >= 3,
  );
  if (!large.length)
    return fallback("No clear subjects found. Kept the whole image.");
  const substantial = new Set(large),
    small = components.filter((c) => !substantial.has(c));
  // Disconnected facial details can lie inside an enclosing hair/body outline.
  // Unite strongly overlapping boxes so those details do not become extra crops.
  large.sort((a, b) => b.area - a.area);
  for (let i = 0; i < large.length; i++)
    for (let j = i + 1; j < large.length; j++) {
      const a = large[i],
        b = large[j],
        intersection =
          Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
          Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (intersection / Math.min(a.w * a.h, b.w * b.h) > 0.72) {
        const x = Math.min(a.x, b.x),
          y = Math.min(a.y, b.y),
          right = Math.max(a.x + a.w, b.x + b.w),
          bottom = Math.max(a.y + a.h, b.y + b.h);
        Object.assign(a, {
          x,
          y,
          w: right - x,
          h: bottom - y,
          area: a.area + b.area,
        });
        large.splice(j--, 1);
      }
    }
  // Attach nearby disconnected details to a substantial object, never merge two
  // substantial neighbours merely because they share a row.
  const gap = (a, b) =>
    Math.hypot(
      Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w),
      Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h),
    );
  for (const detail of small) {
    let nearest = null,
      best = Infinity;
    for (const body of large) {
      const d = gap(detail, body);
      if (d < best) {
        best = d;
        nearest = body;
      }
    }
    if (
      nearest &&
      best <=
        Math.max(2, Math.min(8, Math.min(nearest.w, nearest.h) * 0.075)) &&
      detail.area < nearest.area * 0.25
    ) {
      const x = Math.min(nearest.x, detail.x),
        y = Math.min(nearest.y, detail.y),
        right = Math.max(nearest.x + nearest.w, detail.x + detail.w),
        bottom = Math.max(nearest.y + nearest.h, detail.y + detail.h);
      Object.assign(nearest, { x, y, w: right - x, h: bottom - y });
    }
  }
  const omitted = Math.max(0, large.length - LIMITS.cells);
  let rects = large
    .sort((a, b) => b.area - a.area)
    .slice(0, LIMITS.cells)
    .map((c) => {
      const pad = alpha ? 1 : 2,
        x = Math.max(0, c.x - pad),
        y = Math.max(0, c.y - pad);
      return {
        x,
        y,
        w: Math.min(width, c.x + c.w + pad) - x,
        h: Math.min(height, c.y + c.h + pad) - y,
      };
    });
  // Row bands tolerate uneven sprite heights while retaining stable reading order.
  rects.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows = [];
  for (const r of rects) {
    const cy = r.y + r.h / 2;
    let row = rows.find(
      (row) => Math.abs(cy - row.cy) < Math.min(row.height, r.h) * 0.48,
    );
    if (!row) {
      row = { cy, height: r.h, rects: [] };
      rows.push(row);
    }
    row.rects.push(r);
  }
  rects = rows
    .sort((a, b) => a.cy - b.cy)
    .flatMap((row) => row.rects.sort((a, b) => a.x - b.x));
  const confidence = alpha ? "high" : "suggested";
  return {
    rects,
    kind,
    confidence,
    omitted,
    message: `Found ${rects.length} candidate${rects.length === 1 ? "" : "s"} using ${kind}. ${omitted ? `${omitted} smaller candidates omitted (${LIMITS.cells} limit). ` : ""}${alpha ? "Check detached effects and close neighbours." : "Backgrounds and captions remain in the source; check the suggested crops."}`,
  };
}
