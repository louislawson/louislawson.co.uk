import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Response } from "@playwright/test";
import { expect, test, type Analytics } from "./test.ts";
import { CONTEXTS, folderOf, originOf, pagesOf } from "./contexts.ts";

// The smoke checks: every page of both builds loads cleanly under the site's real headers, and a
// path that does not exist answers with the 404 page. They run on the desktop and the phone.

/** What went wrong while a page loaded: anything a visitor's browser would report. */
function watch(page: Page, documentUrl?: string) {
  const problems: string[] = [];
  page.on("console", (message) => {
    // A page that is itself a 404 is reported by the browser as a console error at its own URL.
    if (message.type() === "error" && message.location().url !== documentUrl) {
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
    // A page's own status is asserted by each test, which a 404 page's would otherwise fail.
    if (response.status() >= 400 && !response.request().isNavigationRequest()) {
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

/** The one address the beacon is loaded from; its reports go to a host the stub never sees. */
const BEACON = "https://static.cloudflareinsights.com/beacon.min.js";

for (const context of CONTEXTS) {
  const folder = folderOf(context);
  const origin = originOf(context);
  const pages = pagesOf(context);
  const config = JSON.parse(
    readFileSync(join(folder, "staticwebapp.config.json"), "utf-8"),
  ) as { globalHeaders: Record<string, string> };

  /** Every header the build's config sets for all pages arrives, so a dropped one is noticed. */
  const expectGlobalHeaders = (response: Response | null) => {
    // The loop below compares with the build's own config, which the server also applies, so a
    // header the build stopped emitting would not show. These are named here instead.
    for (const name of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
    ]) {
      expect(Object.keys(config.globalHeaders), name).toContain(name);
    }
    // Every preview is noindex, whatever the launch switch says.
    if (context.name === "preview") {
      expect(config.globalHeaders["X-Robots-Tag"]).toBe("noindex");
    }
    const received = response?.headers() ?? {};
    for (const [name, value] of Object.entries(config.globalHeaders)) {
      expect(received[name.toLowerCase()], name).toBe(value);
    }
  };

  /**
   * Only the production build counts visits: it asks Cloudflare for the beacon (answered by the
   * fixture with an empty 204, never the network) and a preview or local build asks for nothing.
   * The policy lets it, so the page's own checks (no violation, no failed request) still hold.
   */
  const expectBeaconRequests = async (page: Page, analytics: Analytics) => {
    const tag = page.locator("script[data-cf-beacon]");
    if (context.name === "production") {
      expect(analytics.requests).toEqual([BEACON]);
      await expect(tag).toHaveCount(1);
      const token = JSON.parse(
        (await tag.getAttribute("data-cf-beacon")) ?? "",
      );
      expect(token).toEqual({ token: expect.stringMatching(/^[0-9a-f]{32}$/) });
    } else {
      expect(analytics.requests).toEqual([]);
      await expect(tag).toHaveCount(0);
    }
  };

  test.describe(`${context.name} build`, () => {
    test("has the pages every build has", () => {
      expect(pages).toContain("/");
      expect(pages).toContain("/404.html");
    });

    for (const path of pages) {
      test.describe(path, () => {
        test("loads cleanly under the site's headers", async ({
          page,
          analytics,
        }) => {
          const watching = watch(page);
          const response = await page.goto(`${origin}${path}`);
          await page.waitForLoadState("networkidle");

          expect(response?.status()).toBe(200);
          // If the server stopped applying the config, nothing below would mean anything.
          expectGlobalHeaders(response);
          expect(await watching.violations()).toEqual([]);
          expect(watching.problems).toEqual([]);
          await expectBeaconRequests(page, analytics);
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
      analytics,
    }) => {
      const url = `${origin}/no-such-page-6f1c2e`;
      const watching = watch(page, url);
      const response = await page.goto(url);
      await page.waitForLoadState("networkidle");

      expect(response?.status()).toBe(404);
      // Its styles and fonts load from a path other than the page's own, as a visitor sees them.
      expect(await watching.violations()).toEqual([]);
      expect(watching.problems).toEqual([]);
      expect(await response?.text()).toBe(
        readFileSync(join(folder, "404.html"), "utf-8"),
      );
      expectGlobalHeaders(response);
      await expectBeaconRequests(page, analytics);
    });
  });
}
