import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Deliberate allowlist: never recursively copy the checkout into the artifact.
const files = [
  "index.html",
  "help.html",
  "style.css",
  "app.mjs",
  "core.mjs",
  "render.mjs",
  "background.mjs",
  "theme.mjs",
  "detect.mjs",
  "detect-worker.mjs",
  ...[
    "mark.svg",
    "demo-sheet.png",
    "Lato-Regular.ttf",
    "Lato-BoldItalic.ttf",
    "LabQuotes.ttf",
    "Lato-OFL.txt",
    "NotoSansJP-OFL.txt",
    "fflate.mjs",
    "fflate-LICENSE.txt",
    "README.md",
  ].map((p) => `assets/${p}`),
];
const out = resolve(root, "site/dist");
await mkdir(out, { recursive: true });
async function list(path, prefix = "") {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error("Artifact contains a symlink.");
    if (entry.isDirectory())
      result.push(...(await list(resolve(path, entry.name), name + "/")));
    else result.push(name);
  }
  return result;
}
const allowed = new Set([...files, ".nojekyll", "artifact-manifest.json"]);
for (const file of await list(out))
  if (!allowed.has(file))
    throw new Error(
      `Unexpected artifact file: ${file}. Remove it before building.`,
    );
const manifest = [];
for (const file of files) {
  const bytes = await readFile(resolve(root, "web", file));
  await mkdir(dirname(resolve(out, file)), { recursive: true });
  await copyFile(resolve(root, "web", file), resolve(out, file));
  manifest.push({
    path: file,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(resolve(out, ".nojekyll"), "");
await writeFile(
  resolve(out, "artifact-manifest.json"),
  JSON.stringify(
    { format: "banner-lab-artifact-v1", files: manifest },
    null,
    2,
  ) + "\n",
);
console.log(
  `Built ${files.length} allowlisted files into site/dist (${manifest.reduce((n, f) => n + f.bytes, 0).toLocaleString()} bytes).`,
);
