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

/** A visitor who sets the browser's text size to twice the default (WCAG 1.4.4 asks for 200 %). */
const TEXT_200 = "html { font-size: 200% !important; }";

async function open(page: Page, url: string, path: string, width: number) {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(url);
  await settle(page, path);
}

/**
 * Adds a visitor's stylesheet to a settled page. The page runs under its own policy, as it does for
 * a visitor: the styles go in as a constructed stylesheet, which the policy does not block (an
 * inline <style> it would). Resolves once the page has laid them out.
 */
async function addStyles(page: Page, css: string) {
  await page.evaluate(async (css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
  }, css);
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

    // Text at twice the size on the narrowest window: the page must still fit it (1.4.4 with 1.4.10).
    test.describe("with text at 200 %", () => {
      for (const path of pages) {
        test(`${path} fits a 320 px window without losing content`, async ({
          page,
        }) => {
          await open(page, `${origin}${path}`, path, 320);
          const before = await page.evaluate(() =>
            parseFloat(getComputedStyle(document.documentElement).fontSize),
          );
          await addStyles(page, TEXT_200);
          // If the size had not doubled, nothing below would mean anything.
          expect(
            await page.evaluate(() =>
              parseFloat(getComputedStyle(document.documentElement).fontSize),
            ),
          ).toBe(before * 2);
          expect(await reflowProblems(page, 320, ["x"])).toEqual([]);
        });
      }
    });

    test.describe("with the text spacing of 1.4.12", () => {
      for (const path of pages) {
        test(`${path} fits every width without losing content`, async ({
          page,
        }) => {
          const problems: string[] = [];
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            await addStyles(page, TEXT_SPACING);
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
