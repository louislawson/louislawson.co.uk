import type { Page, TestInfo } from "@playwright/test";
import type AxeBuilder from "@axe-core/playwright";
import { expect, expectNoViolations, test } from "./axe.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";

// An axe scan of every page of both builds, and of the home page again with inspect mode on. The
// markup is covered by the Container API tests; axe needs the page as a visitor sees it, with its
// styles applied and its scripts run, because contrast and visibility are decided by the browser.

/**
 * Waits until nothing on the page is still arriving or moving, so axe sees the finished page: a
 * half-faded line would be read at the wrong contrast, and a panel not yet built not at all.
 */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // The trace panel fills in after the load event, from the browser's own timings. It is on the
  // home page only, so a page without it has nothing to wait for.
  const total = page.locator("[data-trace-total]");
  if ((await total.count()) > 0) {
    await expect(total).not.toHaveText("");
  }
  // Content made by scripts as parts come into view is made on the way down, so go down and back.
  await page.evaluate(async () => {
    const step = Math.max(1, innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle");
  // The trace's replay and any fade-in are animations that end; the caret's blink never
  // does, and holds no text, so it is left running.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    ),
  );
}

/**
 * Scans the page twice. The first scan is the page as it is: every rule, in the tags of axe.ts.
 *
 * The second checks colour contrast only, with the project entries' stretched links hidden. A
 * stretched link (.hit) is an empty, transparent link laid over its whole entry, and axe will not
 * decide the contrast of any text that another element lies over (it reports "bgOverlap" and
 * leaves the check undecided), so every project's code, title and status went unchecked. Hiding the
 * link changes no colour, and it is hidden for this scan only, so it is still in the first scan,
 * where its name, its target and its size are checked.
 */
async function scan(
  page: Page,
  makeAxeBuilder: () => AxeBuilder,
  testInfo: TestInfo,
) {
  await expectNoViolations(makeAxeBuilder(), testInfo);
  await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(".hit { display: none; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
  await expectNoViolations(
    makeAxeBuilder().withRules("color-contrast"),
    testInfo,
    "accessibility-scan-results-contrast",
  );
}

for (const context of CONTEXTS) {
  const origin = originOf(context);

  test.describe(`${context.name} build`, () => {
    for (const path of pagesOf(context)) {
      test(`${path} has no accessibility violations`, async ({
        page,
        makeAxeBuilder,
      }, testInfo) => {
        await page.goto(`${origin}${path}`);
        await settle(page);
        await scan(page, makeAxeBuilder, testInfo);
      });
    }

    test("the home page has no accessibility violations with inspect mode on", async ({
      page,
      makeAxeBuilder,
    }, testInfo) => {
      await page.goto(`${origin}/`);
      await settle(page);
      await page.keyboard.press("i");
      await expect(page.locator("body")).toHaveClass(/\binspecting\b/);
      await scan(page, makeAxeBuilder, testInfo);
    });
  });
}
