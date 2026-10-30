import { caption, assert } from "./core.mjs";
export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load("16px Lab"),
      document.fonts.load("italic 700 60px Lab"),
      document.fonts.load("60px LabQuotes"),
    ]);
  } catch {
    throw new Error("Bundled fonts could not load. Reload the page before exporting.");
  }
  assert(
    document.fonts.check("16px Lab") &&
      document.fonts.check("italic 700 60px Lab") &&
      document.fonts.check("60px LabQuotes"),
    "Bundled fonts could not load. Reload the page before exporting.",
  );
}
export function drawSubject(
  ctx,
  subject,
  images,
  cx,
  cy,
  transform,
  smooth = true,
  fit = 1,
) {
  ctx.save();
  ctx.translate(cx + transform.x, cy + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(
    transform.scale * (transform.flip ? -1 : 1) * fit,
    transform.scale * fit,
  );
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = "high";
  const warnings = [];
  for (const layer of subject.layers) {
    if (!layer.visible) continue;
    const source = images.get(layer.sourceId);
    assert(
      source,
      "Missing source image. Open the matching PNG to replay this recipe.",
    );
    const r = layer.rect,
      factor = Math.min(320 / r.w, 320 / r.h) * layer.scale;
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.flip ? -1 : 1, 1);
    ctx.drawImage(
      source,
      r.x,
      r.y,
      r.w,
      r.h,
      (-r.w * factor) / 2,
      (-r.h * factor) / 2,
      r.w * factor,
      r.h * factor,
    );
    ctx.restore();
    const radius = Math.hypot(r.w * factor, r.h * factor) / 2;
    if (Math.abs(layer.x) + radius > 250 || Math.abs(layer.y) + radius > 250)
      warnings.push(
        "Some layers extend beyond the subject guide. Check the exported composition.",
      );
  }
  ctx.restore();
  return warnings;
}
export function renderBanner(target, state, images) {
  target.width = 1500;
  target.height = 500;
  const ctx = target.getContext("2d"),
    b = state.banner,
    subject = state.subjects.find((s) => s.id === state.activeSubjectId);
  assert(subject, "Select a subject.");
  ctx.fillStyle = b.background;
  ctx.fillRect(0, 0, 1500, 500);
  const center = b.layout === "center",
    left = b.layout === "left";
  const tx = center ? 750 : left ? 510 : 70,
    max = center ? 1320 : 890;
  ctx.textAlign = center ? "center" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = b.accent;
  ctx.fillRect(center ? 734 : tx, center ? 35 : 76, 32, 3);
  ctx.font = "21px Lab, LabQuotes";
  assert(
    ctx.measureText(b.project).width <= max,
    "Project name is too wide. Shorten it.",
  );
  ctx.fillText(b.project, tx, center ? 78 : 125);
  const title = caption(b);
  let size = center ? 48 : 60;
  do {
    ctx.font = `italic 700 ${size}px Lab, LabQuotes`;
    if (ctx.measureText(title).width <= max) break;
    size--;
  } while (size >= 16);
  assert(size >= 16, "Title is too wide. Shorten it.");
  ctx.fillText(title, tx, center ? 360 : 255);
  ctx.fillStyle = "#a7b4c5";
  ctx.font = "21px Lab, LabQuotes";
  assert(
    ctx.measureText(b.version).width <= max,
    "Version label is too wide. Shorten it.",
  );
  ctx.fillText(b.version, tx, center ? 413 : 339);
  ctx.fillStyle = "#304052";
  ctx.fillRect(center ? 90 : tx, center ? 450 : 382, max, 1);
  ctx.fillStyle = b.accent;
  ctx.fillRect(center ? 718 : tx, center ? 450 : 382, 64, 2);
  const warnings = drawSubject(
    ctx,
    subject,
    images,
    center ? 750 : left ? 250 : 1230,
    center ? 197 : 250,
    b,
    b.smooth,
    center ? 0.55 : 1,
  );
  if (size < 28)
    warnings.push(
      "The title is small. A shorter release name will read better.",
    );
  if (Math.abs(b.x) > 80 || Math.abs(b.y) > 60 || b.scale > 1.2)
    warnings.push(
      "The subject may overlap text or leave the banner. Check its position and scale.",
    );
  return [...new Set(warnings)];
}
export function pngBlob(target) {
  return new Promise((resolve, reject) =>
    target.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("PNG export failed. Try a smaller project.")),
      "image/png",
    ),
  );
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function jsonBlob(value) {
  return new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
}
