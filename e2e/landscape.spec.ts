import type { Page } from "@playwright/test";
import { CONTEXTS, originOf } from "./contexts.ts";
import { expectArrived, sectionKeys } from "./sections.ts";
import { settle } from "./settle.ts";
import { expect, test } from "./test.ts";

// A phone held sideways is about 390 px tall, and a bar that stays at the top takes 58 px of it on
// every screen. At a height of 500 px or less the bar scrolls away with the page, and the scroll
// offset that keeps a section clear of the bar follows: a section lands a little below the top
// edge, not below a bar that is no longer there. Held upright the bar still stays, and so does its
// offset. The number keys and the links must still land on their sections either way.

test.use({ hasTouch: true, isMobile: true });

const LANDSCAPE = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };

/** The room above a section that the page keeps clear: 38 px, which the bar adds its height to. */
const BREATHING = 38;

const scrollPadding = (page: Page) =>
  page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  );

const navPosition = (page: Page) =>
  page.evaluate(
    () => getComputedStyle(document.querySelector("[data-nav]")!).position,
  );

async function open(page: Page, url: string, size: typeof LANDSCAPE) {
  await page.setViewportSize(size);
  await page.goto(url);
  await settle(page, "/");
}

/** Where a section sits once the page has arrived at it: at the offset, or the page ended first. */
async function expectLandedAtOffset(page: Page, id: string, note: string) {
  await expectArrived(page, id, note);
  const padding = await scrollPadding(page);
  const { top, atEnd } = await page.evaluate(
    (id) => ({
      top: document.getElementById(id)!.getBoundingClientRect().top,
      atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
    }),
    id,
  );
  if (!atEnd)
    expect(Math.abs(top - padding), `${note}: ${id} at ${top}`).toBeLessThan(3);
}

for (const context of CONTEXTS) {
  const origin = `${originOf(context)}/`;

  test.describe(`${context.name} build`, () => {
    test("held sideways, the bar scrolls away and the offset is the room alone", async ({
      page,
    }) => {
      await open(page, origin, LANDSCAPE);
      expect(await navPosition(page)).not.toBe("sticky");
      expect(await scrollPadding(page)).toBe(BREATHING);
      await page.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
      const barTop = await page.evaluate(
        () =>
          document.querySelector("[data-nav]")!.getBoundingClientRect().bottom,
      );
      expect(
        barTop,
        "the bar's bottom edge, scrolled away",
      ).toBeLessThanOrEqual(0);
    });

    test("held upright, the bar stays and the offset clears it", async ({
      page,
    }) => {
      await open(page, origin, PORTRAIT);
      expect(await navPosition(page)).toBe("sticky");
      expect(await scrollPadding(page)).toBeGreaterThan(BREATHING);
      await page.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
      const barTop = await page.evaluate(
        () => document.querySelector("[data-nav]")!.getBoundingClientRect().top,
      );
      expect(barTop, "the bar's top edge").toBe(0);
    });

    test("the number keys land on their sections", async ({ page }) => {
      await open(page, origin, LANDSCAPE);
      const sections = await sectionKeys(page);
      expect(sections.length, "sections to jump to").toBeGreaterThan(1);
      for (const { key, id } of [...sections, sections[0]!]) {
        await page.keyboard.press(key);
        await expectLandedAtOffset(page, id, `key ${key}`);
      }
    });

    test("the links in the menu land on their sections", async ({ page }) => {
      await open(page, origin, LANDSCAPE);
      const sections = await sectionKeys(page);
      expect(sections.length, "sections to jump to").toBeGreaterThan(1);
      for (const { key, id } of [...sections].reverse()) {
        const menu = page.locator("[data-nav-menu]");
        await menu.click();
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        // The menu hangs from the bar, which may have scrolled away: the bar is where the menu is.
        await page.locator(`a[data-number="${key}"]`).click();
        await expectLandedAtOffset(page, id, `link ${key}`);
      }
    });
  });
}
