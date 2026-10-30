import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/web",
  testMatch: "*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:8766/dist/",
    viewport: { width: 1440, height: 1080 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  webServer: {
    command: "python tools/serve-web.py --port 8766 --directory site",
    url: "http://127.0.0.1:8766/dist/",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
