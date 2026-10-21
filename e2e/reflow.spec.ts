import type { Page } from "@playwright/test";
import { targetProblem } from "../src/e2e/target-size.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";
import { clippedText, horizontalExtent, targetsOf } from "./layout.ts";
import { settle } from "./settle.ts";
import { expect, test } from "./test.ts";

// Reflow and touch, on every page of both builds: the page fits the window at each width without a
// sideways scroll (WCAG 1.4.10), it still does when a visitor's own text spacing is applied
// (1.4.12), and every link and button is big enough to hit (2.5.8).

/** From a small phone, the narrowest width 1.4.10 asks for, to a wide desktop. */
const WIDTHS = [320, 375, 768, 1024, 1440];

const HEIGHT = 800;

// Each check loads its page five times, once per width. On a slow runner that can pass the default
// 30 s, and a timeout would read as a flaky test instead of a finding.
test.describe.configure({ timeout: 90_000 });

/** What a visitor's stylesheet may set under 1.4.12, in its own words: the four values and no more. */
const TEXT_SPACING = `
  *, *::before, *::after {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p { margin-block-end: 2em !important; }
`;

async function open(page: Page, url: string, path: string, width: number) {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(url);
  await settle(page, path);
}

/** What does not fit at this width: a sideways scroll, or text cut off where it is hidden. */
async function reflowProblems(page: Page, width: number, axes: ("x" | "y")[]) {
  const problems: string[] = [];
  const { content, visible } = await horizontalExtent(page);
  if (content > visible) {
    problems.push(
      `${width} px: the page is ${content} px wide in a ${visible} px window`,
    );
  }
  for (const clipped of await clippedText(page, axes)) {
    problems.push(`${width} px: ${clipped}`);
  }
  return problems;
}

for (const context of CONTEXTS) {
  const origin = originOf(context);
  const pages = pagesOf(context);

  test.describe(`${context.name} build`, () => {
    for (const path of pages) {
      test.describe(path, () => {
        test("fits every width without a sideways scroll or cut-off text", async ({
          page,
        }) => {
          const problems: string[] = [];
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            problems.push(...(await reflowProblems(page, width, ["x"])));
          }
          expect(problems).toEqual([]);
        });

        test("every link and button is 24 × 24 px or an inline link in a sentence", async ({
          page,
        }) => {
          const problems: string[] = [];
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            // Where the section links fold into a menu they are hidden until it is opened, and a
            // hidden link has no box to measure: open it, as a visitor does, and measure those too.
            const menu = page.locator("[data-nav-menu]");
            if (await menu.isVisible()) {
              await menu.click();
              await expect(menu).toHaveAttribute("aria-expanded", "true");
            }
            // The size rule passes a target with no box as one that is not on the page, so a section
            // link that had vanished would pass it. Once the menu is open, or where the links sit in
            // the bar, every one of them must be there.
            expect(
              await page
                .locator("#links a")
                .evaluateAll((links) =>
                  links
                    .filter((link) => link.getBoundingClientRect().width === 0)
                    .map((link) => link.textContent),
                ),
              `${width} px: section links with no box`,
            ).toEqual([]);
            const targets = await targetsOf(page);
            // A page with nothing to hit would pass for the wrong reason.
            expect(
              targets.length,
              `${width} px: targets found`,
            ).toBeGreaterThan(0);
            for (const target of targets) {
              const problem = targetProblem(target);
              if (problem) problems.push(`${width} px: ${problem}`);
            }
          }
          expect(problems).toEqual([]);
        });
      });
    }

    // The one place the site's CSP is switched off: the visitor's stylesheet that 1.4.12 imagines
    // (a browser extension or a user style) is not subject to the page's policy, and a test cannot
    // inject its styles under it. Nothing else in the suite sets bypassCSP.
    test.describe("with the text spacing of 1.4.12", () => {
      test.use({ bypassCSP: true });

      for (const path of pages) {
        test(`${path} fits every width without losing content`, async ({
          page,
        }) => {
          const problems: string[] = [];
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            await page.addStyleTag({ content: TEXT_SPACING });
            // The page was settled by open(); the new styles need only to be laid out.
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            // If the styles had not applied, nothing below would mean anything.
            const spaced = await page.evaluate(() => {
              const style = getComputedStyle(document.body);
              return {
                lineHeight: style.lineHeight,
                fontSize: style.fontSize,
                letterSpacing: style.letterSpacing,
                wordSpacing: style.wordSpacing,
              };
            });
            const fontSize = parseFloat(spaced.fontSize);
            expect(parseFloat(spaced.lineHeight)).toBeCloseTo(
              fontSize * 1.5,
              1,
            );
            expect(parseFloat(spaced.letterSpacing)).toBeCloseTo(
              fontSize * 0.12,
              1,
            );
            expect(parseFloat(spaced.wordSpacing)).toBeCloseTo(
              fontSize * 0.16,
              1,
            );
            problems.push(...(await reflowProblems(page, width, ["x", "y"])));
          }
          expect(problems).toEqual([]);
        });
      }
    });
  });
}
