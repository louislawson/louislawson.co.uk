import type { Page } from "@playwright/test";
import { touchProblem } from "../src/e2e/target-size.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";
import { horizontalExtent, navBarRow } from "./layout.ts";
import { settle } from "./settle.ts";
import { expect, test } from "./test.ts";

// On a touch screen, the controls a phone's visitor reaches for are 44 × 44 px or more: the menu and
// the inspect button in the bar, the keyboard-shortcuts switch, the trace's replay and the footer's
// link to the repository. The context is a phone's (a touch screen, so `pointer: coarse` holds),
// and the rule is the one in src/e2e/target-size.ts, where Vitest tests it. With a mouse none of
// this changes, and reflow.spec.ts holds the page to the 24 px of WCAG 2.5.8 there.

test.use({ hasTouch: true, isMobile: true });

/** A small phone, a phone and a tablet held upright: below and above where the links fold. */
const WIDTHS = [320, 390, 1024];

const HEIGHT = 800;

test.describe.configure({ timeout: 90_000 });

/** Where a control is: on every page, only where the links fold into a menu, or on the home page. */
type Where = (page: { folded: boolean; path: string }) => boolean;

/** The controls this spec holds to 44 px, by the page's own hooks, and where each must be. */
const CONTROLS: { name: string; selector: string; where: Where }[] = [
  {
    name: "inspect button",
    selector: "[data-inspect-toggle]",
    where: () => true,
  },
  {
    name: "shortcuts switch",
    selector: "[data-shortcuts-switch]",
    where: () => true,
  },
  {
    name: "footer repository link",
    selector: "footer a[href]",
    where: () => true,
  },
  {
    name: "menu button",
    selector: "[data-nav-menu]",
    where: ({ folded }) => folded,
  },
  {
    name: "trace replay",
    selector: "[data-trace-replay]",
    where: ({ path }) => path === "/",
  },
];

async function open(page: Page, url: string, path: string, width: number) {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(url);
  await settle(page, path);
}

for (const context of CONTEXTS) {
  const origin = originOf(context);

  test.describe(`${context.name} build`, () => {
    for (const path of pagesOf(context)) {
      test.describe(path, () => {
        test("the screen is a touch screen", async ({ page }) => {
          await open(page, `${origin}${path}`, path, 390);
          // If the emulation had not given a coarse pointer, nothing below would mean anything.
          expect(
            await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
          ).toBe(true);
        });

        test("the controls a finger reaches for are 44 × 44 px or more", async ({
          page,
        }) => {
          const problems: string[] = [];
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            const folded = await page.locator("[data-nav-menu]").isVisible();
            for (const control of CONTROLS) {
              const target = page.locator(control.selector);
              if (!control.where({ folded, path })) continue;
              // A control that vanished must fail here, not pass for having no box.
              await expect(
                target,
                `${width} px: ${control.name}`,
              ).toBeVisible();
              // A link that wraps is drawn in two boxes, and the box around both would pass for
              // either: it stays on one line.
              expect(
                await target.evaluate((link) => link.getClientRects().length),
                `${width} px: ${control.name} on one line`,
              ).toBe(1);
              const box = (await target.boundingBox())!;
              const problem = touchProblem({
                name: control.name,
                width: Math.round(box.width * 100) / 100,
                height: Math.round(box.height * 100) / 100,
              });
              if (problem) problems.push(`${width} px: ${problem}`);
            }
          }
          expect(problems).toEqual([]);
        });

        test("the page still fits the window, with no sideways scroll", async ({
          page,
        }) => {
          for (const width of WIDTHS) {
            await open(page, `${origin}${path}`, path, width);
            const { content, visible } = await horizontalExtent(page);
            expect(
              content,
              `${width} px: the page's width`,
            ).toBeLessThanOrEqual(visible);
          }
        });

        // 320 px is also a 1280 px window at 400 % zoom. The bigger controls must still fit the row
        // the 6.7 check holds the bar to, and the bar's height stays what it is set to.
        test("the bar is still one row at the set height at 320 px", async ({
          page,
        }) => {
          await open(page, `${origin}${path}`, path, 320);
          const bar = await navBarRow(page);
          expect(bar.middles.length, "controls in the bar").toBeGreaterThan(1);
          expect(
            new Set(bar.middles).size,
            `middles ${bar.middles}; widths ${bar.widths} (gap ${bar.gap}) in a ${bar.room} px row`,
          ).toBe(1);
          expect(bar.height).toBe(bar.set);
        });
      });
    }

    // The replay link's larger hit area is padding that a negative margin takes back, so the panel
    // looks and measures the same as it did, and the area lies inside the panel and over no other
    // control: nothing clips it and nothing is covered by it.
    test("the replay link's extra hit area moves nothing and covers nothing", async ({
      page,
    }) => {
      await open(page, `${origin}/`, "/", 390);
      const area = await page.evaluate(() => {
        const link = document.querySelector("[data-trace-replay]")!;
        const box = link.getBoundingClientRect();
        const inside = (outer: DOMRect) =>
          box.left >= outer.left &&
          box.right <= outer.right &&
          box.top >= outer.top &&
          box.bottom <= outer.bottom;
        // An ancestor that clips cuts the area at its padding box.
        const clippedBy = [];
        for (let a = link.parentElement; a; a = a.parentElement) {
          const { overflowX, overflowY } = getComputedStyle(a);
          if (overflowX !== "visible" || overflowY !== "visible") {
            if (!inside(a.getBoundingClientRect())) clippedBy.push(a.className);
          }
        }
        const covered = [
          ...document.querySelectorAll('a[href], button, [role="button"]'),
        ]
          .filter(
            (other) =>
              other !== link && other.getBoundingClientRect().width > 0,
          )
          .filter((other) => {
            const o = other.getBoundingClientRect();
            return (
              o.left < box.right &&
              o.right > box.left &&
              o.top < box.bottom &&
              o.bottom > box.top
            );
          })
          .map((other) => other.className || other.tagName);
        return {
          insidePanel: inside(
            document.querySelector(".trace")!.getBoundingClientRect(),
          ),
          clippedBy,
          covered,
        };
      });
      expect(area).toEqual({ insidePanel: true, clippedBy: [], covered: [] });
      const sums = await page
        .locator("[data-trace-replay]")
        .evaluate((link) => {
          const style = getComputedStyle(link);
          const sum = (padding: string, margin: string) =>
            parseFloat(style.getPropertyValue(padding)) +
            parseFloat(style.getPropertyValue(margin));
          return {
            top: sum("padding-top", "margin-top"),
            bottom: sum("padding-bottom", "margin-bottom"),
            left: sum("padding-left", "margin-left"),
            right: sum("padding-right", "margin-right"),
          };
        });
      expect(sums).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    });
  });
}
