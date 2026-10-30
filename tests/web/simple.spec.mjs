import { test, expect } from "@playwright/test";
import { basename } from "node:path";

async function open(page) {
  await page.goto("./");
  await expect(page.locator("#notice")).toContainText(
    "Original demo sheet loaded",
  );
}
test("simple first impression has two tabs, quick edits and lossless advanced switching", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await expect(page.locator("body")).toHaveAttribute("data-view", "simple");
  await expect(page.locator(".steps button:visible")).toHaveCount(2);
  await expect(page.locator("#cut-mode")).toBeHidden();
  await expect(page.locator("#sheet-viewport")).toBeHidden();
  await page.locator("#quick-name").fill("My next release");
  await page.locator("#quick-project").fill("MY PROJECT");
  await page.locator("#quick-palette").selectOption("orange");
  await page.locator("#advanced-view").click();
  await page.locator("[data-tab=style]").click();
  await expect(page.locator("#release-name")).toHaveValue("My next release");
  await expect(page.locator("#palette")).toHaveValue("orange");
  await page.locator("#simple-view").click();
  await expect(page.locator("#quick-project")).toHaveValue("MY PROJECT");
  await page.locator("#quick-shuffle").click();
  await expect(page.locator("#quick-name")).toHaveValue("My next release");
  const download = page.waitForEvent("download");
  await page.locator("#export-png").click();
  const output = await download;
  await output.saveAs(testInfo.outputPath("simple.png"));
  await page.screenshot({
    path: testInfo.outputPath("simple-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("phone view keeps the preview first, with touch-size controls and no page overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const preview = await page.locator(".preview-section").boundingBox(),
    controls = await page.locator(".quick-import").boundingBox();
  expect(preview.y).toBeLessThan(controls.y);
  expect(preview.y + preview.height).toBeLessThan(520);
  expect((await page.locator(".sheet-section").boundingBox()).y).toBeLessThan(
    (await page.locator(".quick-settings").boundingBox()).y,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await page.locator("#quick-name").boundingBox()).height,
  ).toBeGreaterThanOrEqual(44);
  await page.locator("#quick-name").fill("Pocket release");
  await page.locator("#advanced-view").click();
  await page.locator("[data-tab=style]").click();
  await expect(page.locator("#release-name")).toHaveValue("Pocket release");
  await page.locator("#simple-view").click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("simple-phone.png"),
    fullPage: true,
  });
});
test("automatic upload detection uses separate crops and selects the new image", async ({
  page,
}) => {
  await open(page);
  const bytes = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 100;
    const x = c.getContext("2d");
    x.fillStyle = "#f00";
    x.fillRect(10, 10, 30, 60);
    x.fillStyle = "#00f";
    x.fillRect(90, 12, 40, 60);
    return [
      ...Uint8Array.from(atob(c.toDataURL().split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
    ];
  });
  await page.locator("#quick-file").setInputFiles({
    name: "two-sprites.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes),
  });
  await expect(page.locator("#notice")).toContainText("Found 2 candidates");
  await expect(page.locator(".cell-card")).toHaveCount(2);
  await expect(page.locator("#quick-source-info")).toContainText(
    "two-sprites.png",
  );
  await expect(page.locator("#quick-name")).toHaveValue("My release");
  await page.locator("#adjust-cuts").click();
  await expect(page.locator("#cut-mode")).toHaveValue("rects");
  await expect(page.locator("#region-select option")).toHaveCount(3);
  await expect(page.locator("#subject-select")).toHaveValue(
    await page.locator(".cell-card.active").getAttribute("data-subject"),
  );
});
test("JPEG detection and recipe replay preserve the original source identity", async ({
  page,
}, testInfo) => {
  await open(page);
  const bytes = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 100;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 180, 100);
    ctx.fillStyle = "#783522";
    ctx.fillRect(10, 15, 45, 65);
    ctx.fillRect(105, 15, 45, 65);
    return [
      ...Uint8Array.from(
        atob(c.toDataURL("image/jpeg", 0.95).split(",")[1]),
        (c) => c.charCodeAt(0),
      ),
    ];
  });
  const input = {
    name: "local-example.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(bytes),
  };
  await page.locator("#quick-file").setInputFiles(input);
  await expect(page.locator("#notice")).toContainText("Found 2 candidates");
  await page.locator("#advanced-view").click();
  const wait = page.waitForEvent("download");
  await page.locator("#save-recipe").click();
  await (await wait).saveAs(testInfo.outputPath("jpeg-recipe.json"));
  await page.reload();
  await expect(page.locator("#notice")).toContainText("Original demo sheet");
  await page
    .locator("#recipe-file")
    .setInputFiles(testInfo.outputPath("jpeg-recipe.json"));
  await expect(page.locator("#notice")).toContainText("local-example.jpg");
  await page.locator("#quick-file").setInputFiles(input);
  await expect(page.locator("#notice")).toContainText("Recipe restored");
  await expect(page.locator(".cell-card")).toHaveCount(2);
});
test("touch emulation can choose a sprite, change view and prepare a batch", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Mobile emulation uses Chromium.",
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8766/dist/");
    await expect(page.locator("#notice")).toContainText("Original demo sheet");
    await page.locator(".cell-card > button").nth(1).tap();
    await expect(page.locator("#preview-detail")).toContainText(
      "Amberish Orbit",
    );
    await page.locator("#advanced-view").tap();
    await expect(page.locator("#cut-mode")).toBeVisible();
    await page.locator("#simple-view").tap();
    await page.locator("[data-tab=batch]").tap();
    await page.locator("#batch-count").fill("3");
    await page.locator("#plan-batch").tap();
    await expect(page.locator(".batch-item")).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("multiple sheets reveal the newly selected sprite across paginated views", async ({
  page,
}) => {
  await open(page);
  const make = async (count) =>
    page.evaluate((count) => {
      const c = document.createElement("canvas");
      c.width = count * 30;
      c.height = 70;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#b54932";
      for (let i = 0; i < count; i++) ctx.fillRect(i * 30 + 5, 10, 15, 45);
      return [
        ...Uint8Array.from(atob(c.toDataURL().split(",")[1]), (c) =>
          c.charCodeAt(0),
        ),
      ];
    }, count);
  const first = await make(14),
    last = await make(1);
  await page.locator("#quick-file").setInputFiles([
    { name: "many.png", mimeType: "image/png", buffer: Buffer.from(first) },
    { name: "last.png", mimeType: "image/png", buffer: Buffer.from(last) },
  ]);
  await expect(page.locator("#notice")).toContainText(
    "last.png opened locally",
  );
  await expect(page.locator("#quick-source-info")).toContainText("last.png");
  await expect(page.locator("#cell-count")).toHaveText("15");
  await expect(page.locator(".cell-card.active")).toHaveCount(1);
  await page.locator("#advanced-view").click();
  await page.locator("#simple-view").click();
  await expect(page.locator(".cell-card.active")).toHaveCount(1);
  await page.locator("#quick-detect").click();
  await expect(page.locator("#notice")).toContainText("Found 1 candidate");
  await expect(page.locator("#cell-count")).toHaveText("15");
  await expect(page.locator(".cell-card.active")).toHaveCount(1);
});

// Owner-only inputs are passed at runtime. Never copy them into fixtures or builds.
const privateFiles = JSON.parse(process.env.BANNER_LAB_EXAMPLE_FILES || "[]");
for (const file of privateFiles)
  test(`local example: ${basename(file)}`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Private example review on Chromium.",
    );
    const requests = [];
    page.on("request", (r) => requests.push(r));
    await open(page);
    await page.locator("#quick-file").setInputFiles(file);
    await expect(page.locator("#notice")).toContainText("opened locally", {
      timeout: 30_000,
    });
    await expect(page.locator("#notice")).not.toHaveClass(/error/);
    const info = await page.locator("#quick-source-info").innerText(),
      summary = await page.locator("#detection-summary").innerText();
    expect(
      Number(await page.locator("#cell-count").textContent()),
    ).toBeGreaterThan(1);
    await page.screenshot({
      path: testInfo.outputPath("private-review.png"),
      fullPage: true,
    });
    await testInfo.attach("detection-summary", {
      body: JSON.stringify({ file: basename(file), info, summary }),
      contentType: "application/json",
    });
    expect(
      requests.every(
        (r) =>
          r.url().startsWith("http://127.0.0.1:8766/") &&
          r.method() === "GET" &&
          !r.postData(),
      ),
    ).toBe(true);
    const wait = page.waitForEvent("download");
    await page.locator("#export-png").click();
    const output = await wait;
    await output.saveAs(testInfo.outputPath("private-banner.png"));
  });
