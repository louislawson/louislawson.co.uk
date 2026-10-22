import type { Page } from "@playwright/test";
import { touchProblem } from "../src/e2e/target-size.ts";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";
import { navBarRow } from "./layout.ts";
import { settle } from "./settle.ts";
import { expect, test } from "./test.ts";

// On a touch screen, the controls a phone's visitor reaches for are 44 × 44 px or more: the menu and
// the inspect button in the bar, the keyboard-shortcuts switch and the trace's replay. The context is a phone's (a touch screen, so `pointer: coarse`
// holds), and the rule is the one in src/e2e/target-size.ts, where Vitest tests it. With a mouse
// none of this changes, and reflow.spec.ts holds the page to the 24 px of WCAG 2.5.8 there.

test.use({ hasTouch: true, isMobile: true });

/** A small phone, a phone and a tablet held upright: below and above where the links fold. */
const WIDTHS = [320, 390, 1024];

const HEIGHT = 800;

test.describe.configure({ timeout: 90_000 });

/** The controls this spec holds to 44 px, by the page's own hooks, and where each must be. */
const CONTROLS = [
  { name: "inspect button", selector: "[data-inspect-toggle]", on: "all" },
  { name: "shortcuts switch", selector: "[data-shortcuts-switch]", on: "all" },
  { name: "menu button", selector: "[data-nav-menu]", on: "folded" },
  { name: "trace replay", selector: "[data-trace-replay]", on: "/" },
] as const;

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
            for (const control of CONTROLS) {
              const target = page.locator(control.selector);
              const folded = await page.locator("[data-nav-menu]").isVisible();
              const expected =
                control.on === "all" ||
                (control.on === "folded" && folded) ||
                control.on === path;
              if (!expected) continue;
              // A control that vanished must fail here, not pass for having no box.
              await expect(
                target,
                `${width} px: ${control.name}`,
              ).toBeVisible();
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
    // looks and measures the same as it did.
    test("the replay link's extra hit area moves nothing", async ({ page }) => {
      await open(page, `${origin}/`, "/", 390);
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
