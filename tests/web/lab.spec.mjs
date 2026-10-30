import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "../../web/assets/fflate.mjs";

const demo = resolve("web/assets/demo-sheet.png");
async function open(page) {
  await page.goto("./");
  await expect(page.locator("#notice")).toContainText(
    "Original demo sheet loaded",
  );
  await page.locator("#advanced-view").click();
}
async function save(page, button, testInfo, name) {
  const promise = page.waitForEvent("download");
  await page.locator(button).click();
  const file = await promise;
  const path = testInfo.outputPath(name);
  await file.saveAs(path);
  return readFile(path);
}
async function recipe(page, testInfo) {
  return JSON.parse(
    (await save(page, "#save-recipe", testInfo, "recipe.json")).toString(),
  );
}
test("demo, typography, PNG exports and network privacy under a project subpath", async ({
  page,
}, testInfo) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );
  await open(page);
  await expect(page.locator(".cell-card")).toHaveCount(6);
  const color = await page
    .locator("#banner")
    .evaluate((c) => [...c.getContext("2d").getImageData(0, 0, 1, 1).data]);
  expect(color).toEqual([17, 27, 41, 255]);
  await page.locator("[data-tab=style]").click();
  await page.locator("#show-guides").check();
  await expect(page.locator("#safe-guides")).toBeVisible();
  await page.locator("#show-guides").uncheck();
  for (const quote of ["english", "french", "spanish", "german", "japanese"]) {
    await page.locator("#quote").selectOption(quote);
    await expect(page.locator("#warnings")).toBeHidden();
  }
  const png = await save(page, "#export-png", testInfo, "banner.png");
  expect(png.readUInt32BE(16)).toBe(1500);
  expect(png.readUInt32BE(20)).toBe(500);
  await page.screenshot({
    path: testInfo.outputPath("lab.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    requests.every(
      (r) =>
        r.url.startsWith("http://127.0.0.1:8766/") &&
        r.method === "GET" &&
        r.body === null,
    ),
  ).toBe(true);
});
test("grid and exact custom cuts, undo, rectangle move/resize and source hash replay", async ({
  page,
}, testInfo) => {
  await open(page);
  await page.locator("#cut-mode").selectOption("cuts");
  await page.locator("#cuts-x").fill("200, 500");
  await page.locator("#cuts-y").fill("230");
  await page.locator("#apply-cuts").click();
  let s = await recipe(page, testInfo);
  expect(s.sheets[s.sources[0].id].xs).toEqual([200, 500]);
  await page.locator("#undo").click();
  expect(await page.locator("#cut-mode").inputValue()).toBe("grid");
  await page.locator("#redo").click();
  expect(await page.locator("#cut-mode").inputValue()).toBe("cuts");
  await page.locator("#cut-mode").selectOption("rects");
  for (const [id, value] of [
    ["rect-x", "40"],
    ["rect-y", "45"],
    ["rect-w", "160"],
    ["rect-h", "150"],
  ])
    await page.locator("#" + id).fill(value);
  await page.locator("#update-rect").click();
  await page.locator("#apply-cuts").click();
  await expect(page.locator(".cell-card")).toHaveCount(1);
  s = await recipe(page, testInfo);
  const id = s.sources[0].id;
  expect(s.subjects[0].layers[0].originalRect).toEqual({
    x: 40,
    y: 45,
    w: 160,
    h: 150,
  });
  await page.locator("#rect-x").fill("719");
  await page.locator("#update-rect").click();
  await expect(page.locator("#notice")).toContainText("must fit");
  const file = testInfo.outputPath("recipe.json");
  await page.reload();
  await expect(page.locator("#notice")).toContainText("Original demo sheet");
  await page.locator("#advanced-view").click();
  await page.locator("#recipe-file").setInputFiles(file);
  await expect(page.locator("#notice")).toContainText("Recipe restored");
  expect((await recipe(page, testInfo)).sheets[id].rects[0].x).toBe(40);
});
test("local PNG import, missing-source replay, invalid files and assembly layers", async ({
  page,
}, testInfo) => {
  const requests = [];
  page.on("request", (r) => requests.push(r));
  await open(page);
  // Create an independently-sized transparent input in the browser; no image service.
  const bytes = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 40;
    const x = c.getContext("2d");
    x.fillStyle = "#ff0000";
    x.fillRect(1, 2, 20, 25);
    return [
      ...Uint8Array.from(atob(c.toDataURL().split(",")[1]), (ch) =>
        ch.charCodeAt(0),
      ),
    ];
  });
  const file = {
    name: "private-sheet.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes),
  };
  await page.locator("#image-file").setInputFiles(file);
  await expect(page.locator("#notice")).toContainText("opened locally");
  await page.locator("[data-tab=subject]").click();
  await page.locator("#new-assembly").click();
  await expect(page.locator("#assembly-fields")).toBeVisible();
  await page.locator(".add-layer").first().click();
  await expect(page.locator("#layer-select option")).toHaveCount(2);
  await page.locator("#layer-x").fill("70");
  await page.locator("#layer-x").blur();
  const s = await recipe(page, testInfo);
  expect(s.subjects.find((v) => v.kind === "assembly").layers[1].x).toBe(70);
  await page.reload();
  await expect(page.locator("#notice")).toContainText("Original demo sheet");
  await page.locator("#advanced-view").click();
  await page
    .locator("#recipe-file")
    .setInputFiles(testInfo.outputPath("recipe.json"));
  await expect(page.locator("#notice")).toContainText("private-sheet.png");
  await page.locator("#image-file").setInputFiles({
    name: "wrong.png",
    mimeType: "image/png",
    buffer: Buffer.from("not png"),
  });
  await expect(page.locator("#notice")).toContainText("Choose a PNG");
  await page.locator("#image-file").setInputFiles(file);
  await expect(page.locator("#notice")).toContainText("Recipe restored");
  await expect(page.locator("#subject-name")).toHaveValue("My assembly");
  expect(
    requests.every(
      (r) =>
        r.url().startsWith("http://127.0.0.1:8766/") &&
        r.method() === "GET" &&
        !r.postData(),
    ),
  ).toBe(true);
});
test("seeded random locks, ZIP integrity, edited titles and cancellation", async ({
  page,
}, testInfo) => {
  await open(page);
  await page.locator("[data-tab=style]").click();
  await page.locator("#seed").fill("repeatable");
  await page.locator("[data-random=quote]").uncheck();
  await page.locator("#shuffle").click();
  expect((await recipe(page, testInfo)).banner.quote).toBe("french");
  await page.locator("[data-tab=batch]").click();
  await page.locator("#batch-mode").selectOption("random");
  await page.locator("#batch-count").fill("3");
  await page.locator("#plan-batch").click();
  await expect(page.locator(".batch-item")).toHaveCount(3);
  await page.locator(".batch-item input").first().fill("Edited / release");
  const zip = await save(page, "#export-batch", testInfo, "banners.zip"),
    files = unzipSync(zip),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(manifest.count).toBe(3);
  expect(Object.keys(files)).toHaveLength(7);
  const first = manifest.outputs[0];
  expect(JSON.parse(strFromU8(files[first.recipe])).banner.name).toBe(
    "Edited / release",
  );
  expect(
    new DataView(
      files[first.png].buffer,
      files[first.png].byteOffset,
    ).getUint32(16),
  ).toBe(1500);
  await page.locator("#batch-count").fill("100");
  await page.locator("#plan-batch").click();
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.locator("#export-batch").click();
  await page.locator("#cancel-batch").click();
  await expect(page.locator("#notice")).toContainText("Batch cancelled");
  expect(downloads).toBe(0);
  await expect(page.locator("#export-batch")).toBeEnabled();
});
test("touch-width layout fits and malformed recipe cannot execute markup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#recipe-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"banner-lab-v1","engine":"unknown"}'),
  });
  await expect(page.locator("#notice")).toContainText("Unsupported generator");
  await expect(page.locator("#export-png")).toBeEnabled();
});
test("pointer guides and free-rectangle handles use source coordinates at scaled zoom", async ({
  page,
}, testInfo) => {
  await open(page);
  await page.locator("#cut-mode").selectOption("cuts");
  await page.locator("#cuts-x").fill("240, 480");
  await page.locator("#cuts-y").fill("240");
  const box = await page.locator("#sheet").boundingBox(),
    z = box.width / 720;
  await page.mouse.move(box.x + 240 * z, box.y + 40 * z);
  await page.mouse.down();
  await page.mouse.move(box.x + 270 * z, box.y + 40 * z);
  await page.mouse.up();
  expect(await page.locator("#cuts-x").inputValue()).toContain("270");
  await page.locator("#cut-mode").selectOption("rects");
  await page.mouse.move(box.x + 20 * z, box.y + 20 * z);
  await page.mouse.down();
  await page.mouse.move(box.x + 200 * z, box.y + 200 * z);
  await page.mouse.up();
  // Browsers may quantize physical pointer coordinates by one pixel at this zoom.
  const drawnWidth = Number(await page.locator("#rect-w").inputValue());
  expect(drawnWidth).toBeGreaterThanOrEqual(179);
  expect(drawnWidth).toBeLessThanOrEqual(181);
  await page.locator("#rect-w").fill("180");
  await page.locator("#rect-x").fill("20");
  await page.locator("#update-rect").click();
  await page.locator("#sheet-viewport").focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await page.locator("#rect-x").inputValue())).toBe(21);
  await page.locator("#apply-cuts").click();
  const s = await recipe(page, testInfo);
  expect(s.subjects[0].layers[0].originalRect.x).toBe(21);
});
test("font failures block export and oversized PNG headers fail before decoding", async ({
  page,
}) => {
  await page.route("**/*.ttf", (route) => route.abort());
  await page.goto("./");
  await expect(page.locator("#notice")).toContainText(
    "Bundled fonts could not load",
  );
  await expect(page.locator("#export-png")).toBeDisabled();
  await page.unroute("**/*.ttf");
  await open(page);
  const bytes = Buffer.from(await readFile(demo));
  bytes.writeUInt32BE(99999, 16);
  await page
    .locator("#image-file")
    .setInputFiles({
      name: "oversized.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await expect(page.locator("#notice")).toContainText("Image exceeds");
  await expect(page.locator(".cell-card")).toHaveCount(6);
});
test("100-banner cap completes sequentially with a valid archive", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Capacity measurement on Chromium; workflow checks cover both engines.",
  );
  await open(page);
  await page.locator("[data-tab=batch]").click();
  await page.locator("#batch-mode").selectOption("random");
  await page.locator("#batch-count").fill("100");
  await page.locator("#plan-batch").click();
  const started = Date.now();
  const zip = await save(page, "#export-batch", testInfo, "capacity.zip");
  const files = unzipSync(zip);
  expect(JSON.parse(strFromU8(files["manifest.json"])).count).toBe(100);
  expect(Object.keys(files)).toHaveLength(201);
  expect(zip.length).toBeLessThan(128_000_000);
  await testInfo.attach("capacity-measurement", {
    body: JSON.stringify({
      banners: 100,
      bytes: zip.length,
      elapsedMs: Date.now() - started,
    }),
    contentType: "application/json",
  });
});
