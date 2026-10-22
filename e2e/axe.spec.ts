import type { Page, TestInfo } from "@playwright/test";
import type AxeBuilder from "@axe-core/playwright";
import { expect, expectNoViolations, test } from "./axe.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";
import { animationsEnd, settle } from "./settle.ts";

// An axe scan of every page of both builds, and of the home page again with inspect mode on. The
// markup is covered by the Container API tests; axe needs the page as a visitor sees it, with its
// styles applied and its scripts run, because contrast and visibility are decided by the browser.

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

    // On a phone the section links fold into a menu that hangs over the page. It is hidden until it
    // is opened, so the scans above never see it: its links, their names and their colours are
    // scanned here, open, on the pages that have sections (a page of the build with none has no
    // menu). The rule sets are the same as for every other scan.
    for (const path of ["/", "/projects/this-website/"]) {
      test(`${path} has no accessibility violations with the phone menu open`, async ({
        page,
        makeAxeBuilder,
      }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${origin}${path}`);
        await settle(page, path);
        const menu = page.locator("[data-nav-menu]");
        await menu.click();
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        // If the links had not appeared, there would be nothing in the menu to scan.
        await expect(page.locator("#links a").first()).toBeVisible();
        await animationsEnd(page);
        await scan(page, makeAxeBuilder, testInfo, path === "/");
      });
    }
  });
}
