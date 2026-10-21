import { statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CONTEXTS, folderOf, originOf } from "./contexts.ts";

// The trace panel and the ASCII wheel: the two parts of the home page that move or measure, which
// only a browser can run. The arithmetic behind them is covered by Vitest.

const replayButton = (page: Page) => page.locator("[data-trace-replay]");
const hops = (page: Page) => page.locator("[data-trace-hops] > li");

/** Counts every change to the wheel's text, from now on. */
function countWheelChanges(page: Page) {
  return page.evaluate(() => {
    const changes = { count: 0 };
    (window as unknown as { __wheelChanges: typeof changes }).__wheelChanges =
      changes;
    new MutationObserver((records) => {
      changes.count += records.length;
    }).observe(document.querySelector("[data-wheel]")!, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

const wheelChanges = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __wheelChanges: { count: number } })
        .__wheelChanges.count,
  );

for (const context of CONTEXTS) {
  const origin = originOf(context);

  test.describe(`${context.name} build`, () => {
    test.describe("trace", () => {
      test("shows real numbers, measured by the browser on the local server", async ({
        page,
      }) => {
        await page.goto(`${origin}/`);
        await page.waitForLoadState("networkidle");
        const trace = page.locator("[data-trace]");

        // The panel replaces the note that it needs JavaScript.
        await expect(page.locator("[data-trace-nojs]")).toBeHidden();
        await expect(hops(page)).toHaveCount(6);
        await expect(trace.locator("[data-trace-measured]")).toHaveText(
          "measured in your browser",
        );
        await expect(trace.locator("[data-trace-total]")).toHaveText(
          /^\d+ ms to (paint|ready)$/,
        );
        await expect(hops(page).nth(1)).toContainText(
          "DNS lookup for 127.0.0.1",
        );

        // What the panel says is what the browser's own Navigation Timing entry says, and the size
        // is the size of the file that was served.
        const entry = await page.evaluate(() => {
          const [nav] = performance.getEntriesByType(
            "navigation",
          ) as PerformanceNavigationTiming[];
          return {
            edge: Math.round(nav!.responseStart - nav!.requestStart),
            page: Math.round(nav!.responseEnd - nav!.responseStart),
          };
        });
        const bytes = statSync(join(folderOf(context), "index.html")).size;
        const shown = (name: string) =>
          hops(page).filter({ hasText: name }).first();
        // Whole numbers, so "1 ms" must not match inside "11 ms".
        const milliseconds = (ms: number) => new RegExp(`(^|\\D)${ms} ms`);
        await expect(shown("first byte")).toContainText(
          milliseconds(entry.edge),
        );
        await expect(shown("static HTML")).toContainText(
          milliseconds(entry.page),
        );
        await expect(shown("static HTML")).toContainText(
          `static HTML, ${Math.max(1, Math.round(bytes / 1024))} KB`,
        );
        const painted = shown("largest element");
        await expect(painted).toContainText(/\d+ ms/);
        await expect(painted).not.toContainText("…");
      });

      test("offers a replay, which keeps the numbers", async ({ page }) => {
        await page.goto(`${origin}/`);
        await page.waitForLoadState("networkidle");
        await expect(replayButton(page)).toBeVisible();
        // The largest paint arrives last; the replay is compared with the finished panel.
        await expect(page.locator("[data-trace-total]")).toHaveText(
          /^\d+ ms to paint$/,
        );
        const before = await page.locator("[data-trace-hops]").innerText();

        await replayButton(page).click();
        await expect(hops(page)).toHaveCount(6);
        expect(await page.locator("[data-trace-hops]").innerText()).toBe(
          before,
        );
      });
    });

    test.describe("reduced motion", () => {
      test("hides the trace's replay button, and still shows its numbers", async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(`${origin}/`);
        await page.waitForLoadState("networkidle");

        // The panel has run (its steps are shown) before the button can be called hidden.
        await expect(hops(page)).toHaveCount(6);
        await expect(page.locator("[data-trace-measured]")).toBeVisible();
        await expect(replayButton(page)).toBeHidden();
      });
    });
  });
}

// The garage section is left out of production while its entries are placeholders.
test.describe("preview build", () => {
  const origin = originOf(CONTEXTS.find(({ name }) => name === "preview")!);

  test("the wheel turns when motion is allowed", async ({ page }) => {
    await page.goto(`${origin}/`);
    await page.locator("[data-wheel]").scrollIntoViewIfNeeded();
    await countWheelChanges(page);
    await expect.poll(() => wheelChanges(page)).toBeGreaterThan(2);
  });

  test("the wheel does not animate under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/`);
    await page.waitForLoadState("networkidle");
    const wheel = page.locator("[data-wheel]");
    await wheel.scrollIntoViewIfNeeded();
    await expect(wheel).toBeInViewport();
    // Two frames, so that anything the page does as it settles is over before counting.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const still = await wheel.textContent();
    expect(still?.trim()).not.toBe("");

    await countWheelChanges(page);
    // At the wheel's frame rate (about 30 a second) this is some forty frames.
    await page.waitForTimeout(1500);
    expect(await wheelChanges(page)).toBe(0);
    expect(await wheel.textContent()).toBe(still);
  });
});
