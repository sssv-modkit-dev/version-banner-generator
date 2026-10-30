import { removeFlatBackground } from "./background.mjs";
import { caption, assert } from "./core.mjs";
import { elementStyle } from "./theme.mjs";
export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
const transparentSources = new WeakMap();
export function preparedSource(source, settings = {}) {
  if (!settings.removeBackground) return source;
  const key = `${settings.backgroundTolerance ?? 12}:${settings.backgroundColor || "auto"}`;
  let cache = transparentSources.get(source);
  if (!cache) transparentSources.set(source, cache = new Map());
  if (cache.has(key)) return cache.get(key);
  const c = canvas(source.width, source.height), ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, c.width, c.height);
  const removed = removeFlatBackground(pixels.data, c.width, c.height, settings.backgroundTolerance ?? 12, settings.backgroundColor);
  if (removed) ctx.putImageData(pixels, 0, 0);
  const result = removed ? c : source;
  // Bound retained full-resolution canvases while allowing an original/clean comparison.
  cache.clear();
  cache.set(key, result);
  return result;
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
  removeBackground = false,
  settings = {},
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
      natural = settings.artworkSizing === "natural" && fit >= 0.5,
      factor = Math.min(320 / r.w, 320 / r.h, natural ? 2 : Infinity) * layer.scale;
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.flip ? -1 : 1, 1);
    ctx.drawImage(
      preparedSource(source, { ...settings, removeBackground }),
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
  const projectStyle = elementStyle(b, "project"),
    titleStyle = elementStyle(b, "title"), subtitleStyle = elementStyle(b, "subtitle");
  const font = (style, size = style.size) => `${style.face === "display" ? "italic 700 " : ""}${size}px Lab, LabQuotes`;
  ctx.fillStyle = projectStyle.color;
  ctx.font = font(projectStyle);
  assert(
    ctx.measureText(b.project).width <= max,
    "Project name is too wide. Shorten it.",
  );
  ctx.fillText(b.project, tx, center ? 78 : 125);
  const title = caption(b);
  let size = titleStyle.size * (center ? 0.8 : 1);
  do {
    ctx.font = font(titleStyle, size);
    if (ctx.measureText(title).width <= max) break;
    size--;
  } while (size >= 16);
  assert(size >= 16, "Title is too wide. Shorten it.");
  ctx.fillStyle = titleStyle.color;
  ctx.fillText(title, tx, center ? 360 : 255);
  ctx.fillStyle = subtitleStyle.color;
  ctx.font = font(subtitleStyle);
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
    b.removeBackground === true,
    b,
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
export function renderCutout(subject, images, settings) {
  const points = [], angle = settings.rotation * Math.PI / 180;
  for (const l of subject.layers) {
    if (!l.visible) continue;
    const factor = Math.min(320 / l.rect.w, 320 / l.rect.h,
      settings.artworkSizing === "natural" ? 2 : Infinity) * l.scale;
    const a = l.rotation * Math.PI / 180;
    for (const x of [-l.rect.w * factor / 2, l.rect.w * factor / 2])
      for (const y of [-l.rect.h * factor / 2, l.rect.h * factor / 2]) {
        const lx = (l.flip ? -x : x),
          px = l.x + lx * Math.cos(a) - y * Math.sin(a),
          py = l.y + lx * Math.sin(a) + y * Math.cos(a),
          fx = settings.flip ? -px : px;
        points.push([fx * Math.cos(angle) - py * Math.sin(angle), fx * Math.sin(angle) + py * Math.cos(angle)]);
      }
  }
  assert(points.length, "Show at least one artwork layer.");
  const minX = Math.floor(Math.min(...points.map(p => p[0]))) - 1,
    minY = Math.floor(Math.min(...points.map(p => p[1]))) - 1,
    w = Math.ceil(Math.max(...points.map(p => p[0]))) - minX + 1,
    h = Math.ceil(Math.max(...points.map(p => p[1]))) - minY + 1;
  assert(w <= 4096 && h <= 4096 && w * h <= 8_388_608, "This cutout is too large. Move layers closer or reduce their scale.");
  const c = canvas(w, h);
  drawSubject(c.getContext("2d"), subject, images, -minX, -minY,
    { x: 0, y: 0, scale: 1, rotation: settings.rotation, flip: settings.flip },
    settings.smooth, 1, settings.removeBackground === true, settings);
  return c;
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
