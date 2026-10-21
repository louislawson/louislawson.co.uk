import type { Page } from "@playwright/test";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";
import {
  type FocusFacts,
  focusFromUnderBar,
  walkTabOrder,
} from "./keyboard.ts";
import { addStyles, TEXT_SPACING } from "./layout.ts";
import { settle } from "./settle.ts";
import { expect, test } from "./test.ts";

// The keyboard on every page of both builds: each control shows where the focus is (WCAG 2.4.7),
// the sticky bar never covers it (2.4.11), the indicators survive forced colours, and the entries
// of a list are a list to a screen reader (1.3.1).

// Each check walks a whole page with the Tab key, and some walk it three times.
test.describe.configure({ timeout: 120_000 });

const HEIGHT = 800;

async function open(page: Page, url: string, path: string, width: number) {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(url);
  await settle(page, path);
}

/** A ring a visitor can see: an outline with a style, a width and a colour, or a shadow. */
function indicatorProblem(stop: FocusFacts) {
  const { style, width, color } = stop.outline;
  const outline = style !== "none" && width > 0 && color !== "transparent";
  const shadow = stop.boxShadow !== "none";
  return outline || shadow
    ? null
    : `${stop.name}: no focus indicator (outline ${style} ${width}px ${color}, box-shadow ${stop.boxShadow})`;
}

for (const context of CONTEXTS) {
  const origin = originOf(context);
  const pages = pagesOf(context);

  test.describe(`${context.name} build`, () => {
    for (const path of pages) {
      test.describe(path, () => {
        test("every control shows a focus indicator", async ({ page }) => {
          await open(page, `${origin}${path}`, path, 1280);
          const { stops, expected } = await walkTabOrder(page);
          // A walk that went nowhere, or skipped controls, would pass for the wrong reason.
          expect(stops.length, "controls reached by Tab").toBeGreaterThan(0);
          expect(stops.map((stop) => stop.name).sort()).toEqual(
            [...expected].sort(),
          );
          expect(
            stops.map(indicatorProblem).filter((problem) => problem),
          ).toEqual([]);
        });

        test("the bar never covers the focused control", async ({ page }) => {
          const problems: string[] = [];
          const variants = [
            { label: "1280 px", width: 1280, spacing: false },
            { label: "320 px", width: 320, spacing: false },
            {
              label: "320 px with the spacing of 1.4.12",
              width: 320,
              spacing: true,
            },
          ];
          for (const { label, width, spacing } of variants) {
            await open(page, `${origin}${path}`, path, width);
            if (spacing) await addStyles(page, TEXT_SPACING);
            const { stops } = await walkTabOrder(page);
            expect(stops.length, `${label}: controls reached`).toBeGreaterThan(
              0,
            );
            problems.push(
              ...(await focusFromUnderBar(page)).map(
                (problem) => `${label}: ${problem}`,
              ),
            );
            for (const stop of stops) {
              // The bar's own controls are in the bar: nothing of it lies under itself.
              if (stop.inBar || stop.onTop) continue;
              if (stop.top < stop.barBottom - 0.5) {
                problems.push(
                  `${label}: ${stop.name} starts ${Math.round(stop.barBottom - stop.top)} px under the bar (top ${Math.round(stop.top)}, bar ends ${Math.round(stop.barBottom)})`,
                );
              }
            }
          }
          expect(problems).toEqual([]);
        });

        test("forced colours keep the focus ring, the status squares and the placeholders", async ({
          page,
        }) => {
          await page.emulateMedia({ forcedColors: "active" });
          await open(page, `${origin}${path}`, path, 1280);
          expect(
            await page.evaluate(
              () => matchMedia("(forced-colors: active)").matches,
            ),
          ).toBe(true);

          const { stops } = await walkTabOrder(page);
          expect(stops.length, "controls reached by Tab").toBeGreaterThan(0);
          // Forced colours drop a shadow, so the ring has to be an outline.
          expect(
            stops
              .filter(
                (stop) =>
                  stop.outline.style === "none" || !(stop.outline.width > 0),
              )
              .map(
                (stop) =>
                  `${stop.name}: outline ${stop.outline.style} ${stop.outline.width}px`,
              ),
          ).toEqual([]);

          const marks = await page.evaluate(() => {
            const canvas = getComputedStyle(document.body).backgroundColor;
            const drawn = (
              style: CSSStyleDeclaration,
              side: "outline" | "border",
            ) => {
              const [width, kind, color] =
                side === "outline"
                  ? [style.outlineWidth, style.outlineStyle, style.outlineColor]
                  : [
                      style.borderTopWidth,
                      style.borderTopStyle,
                      style.borderTopColor,
                    ];
              return (
                parseFloat(width) > 0 && kind !== "none" && color !== canvas
              );
            };
            return {
              squares: [...document.querySelectorAll(".status")].map(
                (element) =>
                  drawn(getComputedStyle(element, "::before"), "border"),
              ),
              placeholders: [...document.querySelectorAll(".ph")].map(
                (element) => drawn(getComputedStyle(element), "outline"),
              ),
            };
          });
          expect(
            marks.squares.filter((drawn) => !drawn),
            "status squares with no border",
          ).toEqual([]);
          expect(
            marks.placeholders.filter((drawn) => !drawn),
            "placeholders with no outline",
          ).toEqual([]);
          // The home page lists projects with a status; a preview shows placeholders as well.
          if (path === "/") {
            expect(
              marks.squares.length,
              "status squares on the page",
            ).toBeGreaterThan(0);
            if (context.name === "preview") {
              expect(
                marks.placeholders.length,
                "placeholders on the page",
              ).toBeGreaterThan(0);
            }
          }
        });
      });
    }

    // The entries of the three lists on the home page are list items, so a screen reader announces
    // "list, 4 items" and a visitor can move through them item by item.
    test("the project entries, the skills and the certifications are lists", async ({
      page,
    }) => {
      await open(page, `${origin}/`, "/", 1280);
      const lists = await page.evaluate(() => {
        const rows = {
          projects: ".run",
          skills: ".skill",
          certifications: ".cert",
        };
        return Object.entries(rows).map(([section, selector]) => {
          const found = [
            ...document.querySelectorAll(`#${section} ${selector}`),
          ];
          return {
            section,
            rows: found.length,
            notItems: found.filter((row) => row.tagName !== "LI").length,
            outsideList: found.filter(
              (row) => !["UL", "OL"].includes(row.parentElement?.tagName ?? ""),
            ).length,
            // One list holds all of them, not one list each.
            lists: new Set(found.map((row) => row.parentElement)).size,
          };
        });
      });
      for (const list of lists) {
        // A production build leaves out the sections that hold nothing real yet.
        if (context.name === "preview") {
          expect(
            list.rows,
            `${list.section}: rows on the page`,
          ).toBeGreaterThan(0);
        }
        if (list.rows === 0) continue;
        expect(list.notItems, `${list.section}: rows that are not <li>`).toBe(
          0,
        );
        expect(list.outsideList, `${list.section}: rows outside a <ul>`).toBe(
          0,
        );
        expect(list.lists, `${list.section}: lists holding the rows`).toBe(1);
      }
      // As the browser's accessibility tree has it.
      for (const list of lists.filter((entry) => entry.rows > 0)) {
        await expect(
          page.locator(`#${list.section}`).getByRole("listitem"),
          `${list.section}: list items`,
        ).toHaveCount(
          list.section === "skills"
            ? list.rows + (await page.locator("#skills .explore li").count())
            : list.rows,
        );
      }
    });
  });
}
