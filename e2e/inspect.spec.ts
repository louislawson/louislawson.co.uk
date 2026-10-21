import type { Page } from "@playwright/test";
import { expect, test } from "./test.ts";
import { CONTEXTS, originOf } from "./contexts.ts";

// Inspect mode: the i key and the button, the labels it draws, the status it announces, and the
// room it leaves under the bar on a phone. The labels are drawn by CSS from data-inspect, so only a
// browser can say whether they show.

/** What a labelled part's ::after draws, as the browser resolves it: `none` while the mode is off. */
const drawnLabels = (page: Page) =>
  page.locator("[data-inspect]").evaluateAll((parts) =>
    parts.map((part) => ({
      text: part.getAttribute("data-inspect"),
      drawn: getComputedStyle(part, "::after").content,
    })),
  );

const inspectButton = (page: Page) =>
  page.getByRole("button", { name: /inspect/ });

for (const context of CONTEXTS) {
  const origin = originOf(context);

  test.describe(`${context.name} build`, () => {
    test("the i key turns inspect mode on and off, and the labels appear", async ({
      page,
    }) => {
      await page.goto(`${origin}/`);
      await expect(inspectButton(page)).toBeVisible();
      await expect(inspectButton(page)).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      const before = await drawnLabels(page);
      expect(before.length).toBeGreaterThan(0);
      expect(before.every((label) => label.drawn === "none")).toBe(true);

      await page.keyboard.press("i");
      await expect(page.locator("body")).toHaveClass(/\binspecting\b/);
      await expect(inspectButton(page)).toHaveAttribute("aria-pressed", "true");
      const on = await drawnLabels(page);
      expect(on).toHaveLength(before.length);
      for (const { text, drawn } of on) {
        // The browser writes the string back with its quotes and backslashes escaped.
        expect(drawn).toBe(`"${text?.replace(/[\\"]/g, "\\$&")}"`);
      }

      await page.keyboard.press("i");
      await expect(page.locator("body")).not.toHaveClass(/\binspecting\b/);
      await expect(inspectButton(page)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect((await drawnLabels(page)).every((l) => l.drawn === "none")).toBe(
        true,
      );
    });

    test("the button does the same as the key", async ({ page }) => {
      await page.goto(`${origin}/`);
      await inspectButton(page).click();
      await expect(page.locator("body")).toHaveClass(/\binspecting\b/);
      await inspectButton(page).click();
      await expect(page.locator("body")).not.toHaveClass(/\binspecting\b/);
    });

    test("the status region announces the change, and says nothing on load", async ({
      page,
    }) => {
      await page.goto(`${origin}/`);
      // The region is always in the page: the words at its start are what changes, and what a
      // screen reader reads out.
      const status = page.getByRole("status");
      const state = page.locator("[data-inspect-state]");
      await expect(state).toHaveText("");

      await page.keyboard.press("i");
      await expect(state).toHaveText("Inspect mode is on.");
      await expect(status).toContainText("Inspect mode is on.");
      await page.keyboard.press("i");
      await expect(state).toHaveText("Inspect mode is off.");
      await expect(status).toContainText("Inspect mode is off.");
    });

    test("the key is ignored when the shortcuts are off, and in a field", async ({
      page,
    }) => {
      await page.goto(`${origin}/`);
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "probe-input";
        document.body.append(input);
      });
      await page.locator("#probe-input").focus();
      await page.keyboard.press("i");
      await expect(page.locator("#probe-input")).toHaveValue("i");
      await page.locator("#probe-input").blur();
      for (const chord of ["Control+i", "Alt+i", "Meta+i"]) {
        await page.keyboard.press(chord);
      }
      await expect(page.locator("body")).not.toHaveClass(/\binspecting\b/);

      await page.getByRole("button", { name: "keyboard shortcuts:" }).click();
      await page.keyboard.press("i");
      await expect(page.locator("[data-inspect-state]")).toHaveText("");
      await expect(page.locator("body")).not.toHaveClass(/\binspecting\b/);
      // The button still works: switching the shortcuts off does not switch inspect mode off.
      await inspectButton(page).click();
      await expect(page.locator("body")).toHaveClass(/\binspecting\b/);
    });

    test.describe("at phone width", () => {
      const pages = ["/", "/projects/this-website/", "/404.html"];

      for (const width of [320, 375]) {
        for (const path of pages) {
          test(`the bar's label stays clear of the first content at ${width} px on ${path}`, async ({
            page,
          }) => {
            await page.setViewportSize({ width, height: 700 });
            await page.goto(`${origin}${path}`);
            await page.keyboard.press("i");
            await expect(page.locator("body")).toHaveClass(/\binspecting\b/);

            // The label is a pseudo-element, so it has no box to ask for: it sits below the bar
            // (bottom: -4px, then moved down by its own height), and the browser resolves its height.
            const { barLabelBottom, contentTop } = await page.evaluate(() => {
              const bar = document.querySelector<HTMLElement>("[data-nav]")!;
              const label = getComputedStyle(bar, "::after");
              const barLabelBottom =
                bar.getBoundingClientRect().top +
                bar.clientTop +
                bar.clientHeight +
                4 +
                parseFloat(label.height);
              // The first content, and the labels of the parts that carry one, which sit above them.
              const main = document.querySelector("main")!;
              const tops = [
                main.firstElementChild!.getBoundingClientRect().top,
              ];
              for (const part of main.querySelectorAll("[data-inspect]")) {
                const height = parseFloat(
                  getComputedStyle(part, "::after").height,
                );
                tops.push(part.getBoundingClientRect().top - 4 - height);
              }
              return { barLabelBottom, contentTop: Math.min(...tops) };
            });
            expect(Number.isFinite(barLabelBottom + contentTop)).toBe(true);
            expect(barLabelBottom).toBeLessThanOrEqual(contentTop);
          });
        }
      }
    });
  });
}
