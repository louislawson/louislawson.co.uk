import type { Page } from "@playwright/test";
import { targetProblem } from "../src/e2e/target-size.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";
import {
  addStyles,
  clippedText,
  horizontalExtent,
  navBarRow,
  splitWords,
  targetsOf,
  TEXT_SPACING,
} from "./layout.ts";
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

/** A visitor who sets the browser's text size to twice the default (WCAG 1.4.4 asks for 200 %). */
const TEXT_200 = "html { font-size: 200% !important; }";

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

        // 320 px is also a 1280 px window at 400 % zoom (1.4.10). With the browser's default text the
        // brand, the menu and the inspect button fit the row; a bar that wraps there costs 40 px of
        // the screen on every page. Only a visitor's own text spacing is meant to make it wrap.
        test("the bar is one row at the set height at 320 px", async ({
          page,
        }) => {
          await open(page, `${origin}${path}`, path, 320);
          const bar = await navBarRow(page);
          expect(bar.set, "the set height").toBe(58);
          expect(bar.middles.length, "controls in the bar").toBeGreaterThan(1);
          expect(
            new Set(bar.middles).size,
            `middles ${bar.middles}; widths ${bar.widths} (gap ${bar.gap}) in a ${bar.room} px row`,
          ).toBe(1);
          expect(bar.height).toBe(bar.set);
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
          expect(await reflowProblems(page, 320, ["x", "y"])).toEqual([]);
        });
      }
    });

    // The name is the page's one display line, and a word of it is never broken in two. The size
    // is capped against the window's width as well as the text's size, so that twice the text on
    // the narrowest window gives the name a size that fits, and the sizes a visitor with the
    // default text sees are not the cap's to change.
    test.describe("the hero name", () => {
      test("is never split mid-word, at any width or with text at 200 %", async ({
        page,
      }) => {
        const problems: string[] = [];
        for (const width of WIDTHS) {
          await open(page, `${origin}/`, "/", width);
          for (const word of await splitWords(page, ".hero__name")) {
            problems.push(`${width} px: “${word}” is split`);
          }
        }
        await open(page, `${origin}/`, "/", 320);
        await addStyles(page, TEXT_200);
        for (const word of await splitWords(page, ".hero__name")) {
          problems.push(`320 px at 200 %: “${word}” is split`);
        }
        // The caret belongs to the name's last word: it sits on that word's line, not alone below.
        const caretBesideName = await page.evaluate(() => {
          const name = document.querySelector(".hero__name")!;
          const mark = name.querySelector(".caret")!;
          const caret = mark.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(mark.previousSibling!);
          const word = range.getBoundingClientRect();
          const middle = (caret.top + caret.bottom) / 2;
          return middle >= word.top && middle <= word.bottom;
        });
        if (!caretBesideName) {
          problems.push("320 px at 200 %: the caret is not beside the name");
        }
        expect(problems).toEqual([]);
      });

      test("is the size the clamp gives where the cap is not needed", async ({
        page,
      }) => {
        // clamp(2.9rem, 1rem + 7vw, 7.4rem) at the browser's default 16 px, for text at 100 %.
        const clamp = (width: number) =>
          Math.min(Math.max(2.9 * 16, 16 + 0.07 * width), 7.4 * 16);
        for (const width of WIDTHS) {
          await open(page, `${origin}/`, "/", width);
          const size = await page
            .locator(".hero__name")
            .evaluate((name) => parseFloat(getComputedStyle(name).fontSize));
          expect(size, `${width} px`).toBeCloseTo(clamp(width), 1);
        }
      });
    });

    // A hyphen is a place to break a line, and a phrase such as "load-time" left at the end of a row
    // reads badly. The words of the footer's row stay whole at every width.
    test.describe("the footer", () => {
      for (const path of pages) {
        test(`${path} never breaks a word of its row`, async ({ page }) => {
          const problems: string[] = [];
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            for (const word of await splitWords(page, ".foot__row")) {
              problems.push(`${width} px: “${word}” is split`);
            }
          }
          expect(problems).toEqual([]);
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
