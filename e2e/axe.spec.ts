import type { Page, TestInfo } from "@playwright/test";
import type AxeBuilder from "@axe-core/playwright";
import { expect, expectNoViolations, test } from "./axe.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";

// An axe scan of every page of both builds, and of the home page again with inspect mode on. The
// markup is covered by the Container API tests; axe needs the page as a visitor sees it, with its
// styles applied and its scripts run, because contrast and visibility are decided by the browser.

/**
 * Waits for the animations and transitions that end (the trace's replay, a fade, a colour change)
 * to finish, so a scan does not read a half-faded line at the wrong contrast. The caret's blink
 * never ends and holds no text, so it is left running. Two frames first, so that a transition set
 * off a moment ago has started and can be seen.
 */
async function animationsEnd(page: Page) {
  await page.evaluate(async () => {
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    for (;;) {
      const running = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity &&
            (animation.playState === "running" || animation.pending),
        );
      if (running.length === 0) return;
      // One that is cancelled (restarted, or its element removed) ends too: that is not an error.
      await Promise.allSettled(running.map((animation) => animation.finished));
    }
  });
}

/**
 * Waits until nothing on the page is still arriving or moving, so axe sees the finished page: a
 * panel not yet built would not be scanned at all. The home page must show its trace panel, so a
 * page that never builds it fails here and is not scanned empty.
 */
async function settle(page: Page, path: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // The trace panel fills in after the load event, from the browser's own timings.
  if (path === "/") {
    await expect(page.locator("[data-trace-total]")).not.toHaveText("");
  }
  // Content made by scripts as parts come into view is made on the way down, so go down and back.
  // Two frames a step: an IntersectionObserver's callback runs after the frame it was seen in.
  await page.evaluate(async () => {
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    const step = Math.max(1, innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: "instant" });
      await frame();
      await frame();
    }
    scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle");
  await animationsEnd(page);
}

/**
 * Scans the page twice. The first scan is the page as it is: every rule, in the tags of axe.ts.
 *
 * The second checks colour contrast only, with the project entries' stretched links hidden. A
 * stretched link (.hit) is an empty, transparent link laid over its whole entry, and axe will not
 * decide the contrast of any text that another element lies over (it reports "bgOverlap" and
 * leaves the check undecided), so every project's code, title and status went unchecked. Hiding the
 * link changes no colour, and it is hidden for this scan only, so it is still in the first scan,
 * where its name, its target and its size are checked. If the stretched link is renamed, this hides
 * nothing and the text is undecided again, so a page that lists projects must have one to hide.
 */
async function scan(
  page: Page,
  makeAxeBuilder: () => AxeBuilder,
  testInfo: TestInfo,
  listsProjects: boolean,
) {
  await expectNoViolations(makeAxeBuilder(), testInfo);
  if (listsProjects) {
    await expect(
      page.locator(".hit"),
      "stretched links to hide",
    ).not.toHaveCount(0);
  }
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
        await settle(page, path);
        await scan(page, makeAxeBuilder, testInfo, path === "/");
      });
    }

    test("the home page has no accessibility violations with inspect mode on", async ({
      page,
      makeAxeBuilder,
    }, testInfo) => {
      await page.goto(`${origin}/`);
      await settle(page, "/");
      await page.keyboard.press("i");
      await expect(page.locator("body")).toHaveClass(/\binspecting\b/);
      // The labels and the layout change with the mode, some of it in transitions.
      await animationsEnd(page);
      await scan(page, makeAxeBuilder, testInfo, true);
    });
  });
}
