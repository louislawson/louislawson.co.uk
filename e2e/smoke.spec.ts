import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Response } from "@playwright/test";
import { CONTEXTS, folderOf, originOf, pagesOf } from "./contexts.ts";

// The smoke checks: every page of both builds loads cleanly under the site's real headers, and a
// path that does not exist answers with the 404 page. They run on the desktop and the phone.

/** What went wrong while a page loaded: anything a visitor's browser would report. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) =>
    problems.push(`page error: ${error.message}`),
  );
  page.on("requestfailed", (request) =>
    problems.push(
      `request failed: ${request.url()} (${request.failure()?.errorText})`,
    ),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(`status ${response.status()}: ${response.url()}`);
    }
  });
  // The browser reports a blocked script, style or image as an event. The listener is added before
  // any of the page's own scripts run.
  void page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(
        `${event.violatedDirective} blocked ${event.blockedURI || "an inline resource"}`,
      );
    });
  });
  return {
    problems,
    async violations() {
      return page.evaluate(
        () => (window as unknown as { __violations: string[] }).__violations,
      );
    },
  };
}

for (const context of CONTEXTS) {
  const folder = folderOf(context);
  const origin = originOf(context);
  const pages = pagesOf(context);
  const config = JSON.parse(
    readFileSync(join(folder, "staticwebapp.config.json"), "utf-8"),
  ) as { globalHeaders: Record<string, string> };

  /** Every header the build's config sets for all pages arrives, so a dropped one is noticed. */
  const expectGlobalHeaders = (response: Response | null) => {
    expect(Object.keys(config.globalHeaders)).toContain(
      "Content-Security-Policy",
    );
    const received = response?.headers() ?? {};
    for (const [name, value] of Object.entries(config.globalHeaders)) {
      expect(received[name.toLowerCase()], name).toBe(value);
    }
  };

  test.describe(`${context.name} build`, () => {
    test("has the pages every build has", () => {
      expect(pages).toContain("/");
      expect(pages).toContain("/404.html");
    });

    for (const path of pages) {
      test.describe(path, () => {
        test("loads cleanly under the site's headers", async ({ page }) => {
          const watching = watch(page);
          const response = await page.goto(`${origin}${path}`);
          await page.waitForLoadState("networkidle");

          expect(response?.status()).toBe(200);
          // If the server stopped applying the config, nothing below would mean anything.
          expectGlobalHeaders(response);
          expect(await watching.violations()).toEqual([]);
          expect(watching.problems).toEqual([]);
        });

        test("has no horizontal scroll at 320 px", async ({ page }) => {
          await page.setViewportSize({ width: 320, height: 640 });
          await page.goto(`${origin}${path}`);
          await page.waitForLoadState("networkidle");

          const { content, visible } = await page.evaluate(() => ({
            content: Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ),
            visible: document.documentElement.clientWidth,
          }));
          expect(content).toBeLessThanOrEqual(visible);
        });
      });
    }

    test("answers a made-up path with status 404 and the 404 page", async ({
      page,
    }) => {
      const response = await page.goto(`${origin}/no-such-page-6f1c2e`);

      expect(response?.status()).toBe(404);
      expect(await response?.text()).toBe(
        readFileSync(join(folder, "404.html"), "utf-8"),
      );
      expectGlobalHeaders(response);
    });
  });
}
