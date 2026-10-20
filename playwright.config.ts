import { defineConfig, devices } from "@playwright/test";
import { CONTEXTS, folderOf } from "./e2e/contexts.ts";

// The tests run against the two builds that `npm run build:e2e` writes to dist-e2e/, each served by
// e2e/serve.ts so that the site's own staticwebapp.config.json (CSP, headers, the 404 page) applies.
// The servers never build: a missing folder is an error, not a reason to build here.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  // test-results/ and playwright-report/ are ignored by git, Prettier and ESLint.
  outputDir: "test-results",
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  webServer: CONTEXTS.map((context) => ({
    name: context.name,
    command: `node e2e/serve.ts ${folderOf(context).replaceAll("\\", "/")} ${context.port}`,
    url: `http://127.0.0.1:${context.port}/`,
    // Never attach to a server already on the port: it may be a stale one, with an old config.
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  })),
  use: { trace: "on-first-retry" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15"] },
      // The phone runs the smoke checks only.
      testMatch: "smoke.spec.ts",
    },
  ],
});
