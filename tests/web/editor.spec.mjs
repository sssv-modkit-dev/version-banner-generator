import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

async function open(page) {
  await page.goto("./");
  await expect(page.locator("#notice")).toContainText("Original demo sheet loaded");
}

test("dense gallery supports search, all sprites, layered compositions and cutout PNGs", async ({page}, testInfo) => {
  await open(page);
  const bytes = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
    const x = c.getContext("2d"); x.fillStyle = "#181f2b"; x.fillRect(0,0,c.width,c.height);
    x.fillStyle = "#f4a467";
    for (let row=0;row<8;row++) for(let col=0;col<32;col++) x.fillRect(col*32+8,row*32+6,16,20);
    return Array.from(Uint8Array.from(atob(c.toDataURL().split(",")[1]), c=>c.charCodeAt(0)));
  });
  await page.locator("#quick-file").setInputFiles({name:"many-sprites.png",mimeType:"image/png",buffer:Buffer.from(bytes)});
  await expect(page.locator("#notice")).toContainText("Found 256 candidates");
  await expect(page.locator(".cell-card")).toHaveCount(96);
  await expect(page.locator("#gallery-page")).toContainText("1 / 3");
  await expect(page.locator("#demo-remixes")).toBeHidden();
  await page.locator("#gallery-size").selectOption("1124");
  await expect(page.locator(".cell-card")).toHaveCount(256);
  await page.locator("#gallery-search").fill("Cell 250");
  await expect(page.locator(".cell-card")).toHaveCount(1);
  await page.locator("#gallery-search").fill("");
  await page.locator("#gallery-action").selectOption("add");
  await page.locator(".cell-card > button:first-child").nth(1).click();
  await expect(page.locator("#artwork-detail")).toContainText("2 layers");
  await page.locator("#edit-layers").click();
  await expect(page.locator("#layer-select option")).toHaveCount(2);
  const wait = page.waitForEvent("download"); await page.locator("#export-subject").click();
  const path = testInfo.outputPath("cutout.png"); await (await wait).saveAs(path);
  const cutout = await readFile(path);
  const alpha = await page.evaluate(async bytes => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], {type:"image/png"}));
    const c=document.createElement("canvas"); c.width=image.width; c.height=image.height;
    const ctx=c.getContext("2d"); ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,c.width,c.height).data;
    let transparent=false,opaque=false;
    for(let i=3;i<data.length;i+=4) { transparent ||= data[i]===0; opaque ||= data[i]===255; }
    return {transparent,opaque};
  }, [...cutout]);
  expect(alpha).toEqual({transparent:true,opaque:true});
});

test("element styles are independent while themes coordinate defaults and recipes replay them", async ({page},testInfo) => {
  await open(page); await page.locator("#quick-style").click();
  await page.locator("#element-color").fill("#ff2255");
  await page.locator("#element-size").fill("70"); await page.locator("#element-size").press("Tab");
  await page.locator("#style-element").selectOption("project");
  await page.locator("#element-color").fill("#22ff55");
  await page.locator("#palette").selectOption("orange");
  await expect(page.locator("#element-color")).toHaveValue("#22ff55");
  await page.locator("#style-element").selectOption("title");
  await expect(page.locator("#element-color")).toHaveValue("#ff2255");
  await expect(page.locator("#element-size")).toHaveValue("70");
  const wait=page.waitForEvent("download"); await page.locator("#save-recipe").click();
  const path=testInfo.outputPath("styled.json"); await (await wait).saveAs(path);
  await page.locator("#reset").click(); await expect(page.locator("#notice")).toContainText("Original demo sheet loaded");
  await page.locator("#recipe-file").setInputFiles(path); await expect(page.locator("#notice")).toContainText("Recipe restored");
  await page.locator("[data-tab=style]").click();
  await expect(page.locator("#element-color")).toHaveValue("#ff2255");
  await page.locator("#element-reset").click();
  await expect(page.locator("#element-color")).toHaveValue("#ffbe78");
});

test("sprite demo remixes animate, pause and become editable layered subjects", async ({page}) => {
  await open(page);
  await expect(page.locator(".demo-sheet-strip")).toBeVisible();
  await expect(page.locator(".remix-card")).toHaveCount(3);
  await page.locator("#demo-remixes").scrollIntoViewIfNeeded();
  const first = await page.locator(".remix-card canvas").first().evaluate(c => c.toDataURL());
  await expect.poll(() => page.locator(".remix-card canvas").first().evaluate(c => c.toDataURL())).not.toBe(first);
  await page.locator("#demo-motion").click(); await expect(page.locator("#demo-motion")).toHaveText("Play motion");
  await page.locator("#remix-demo").click();
  await page.locator(".remix-card").first().click();
  await expect(page.locator("#artwork-detail")).toContainText("3 layers");
  await expect(page.locator("#quick-name")).toHaveValue("Orbital nonsense");
  await page.locator("#edit-layers").click(); await expect(page.locator("#layer-select option")).toHaveCount(3);
});
