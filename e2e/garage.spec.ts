import type { Page } from "@playwright/test";
import { CONTEXTS, originOf } from "./contexts.ts";
import { settle } from "./settle.ts";
import { expect, test } from "./test.ts";

// The garage's cards sit in a row of up to three, flush with the wheel's panel above them. A garage
// with fewer entries reads as a set, and not as one card in a third of the row with two empty thirds:
// a card is at most 35 rem wide (the width the phone layout already stops at), and the cards that
// there are sit side by side from the left. Only the preview build shows the garage, and its entries
// are placeholders, so the cards are taken away in the page to see a smaller garage.

const preview = originOf(CONTEXTS[0]);

const CARD_MAX = 35 * 16;

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${preview}/`);
  await settle(page, "/");
}

/** The cards' boxes, and the wheel panel's right edge, which the row ends at. */
function boxes(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element) => {
      const { left, right, top, width } = element.getBoundingClientRect();
      return { left, right, top, width };
    };
    return {
      cards: [...document.querySelectorAll(".gcard")].map(rect),
      wheel: rect(document.querySelector(".garage-wheel")!),
    };
  });
}

test.describe("the garage's cards", () => {
  test("are three side by side, flush with the wheel's panel", async ({
    page,
  }) => {
    await open(page, 1440);
    const { cards, wheel } = await boxes(page);
    expect(cards, "cards").toHaveLength(3);
    expect(new Set(cards.map((card) => Math.round(card.top))).size).toBe(1);
    for (const card of cards) {
      expect(card.width).toBeCloseTo(cards[0]!.width, 0);
    }
    expect(cards[0]!.left).toBeCloseTo(wheel.left, 0);
    expect(cards[2]!.right).toBeCloseTo(wheel.right, 0);
  });

  for (const count of [1, 2]) {
    test(`${count} of them sit from the left at a card's own width, not a third of the row`, async ({
      page,
    }) => {
      await open(page, 1440);
      await page.evaluate((count) => {
        for (const card of [...document.querySelectorAll(".gcard")].slice(
          count,
        ))
          card.remove();
      }, count);
      const { cards, wheel } = await boxes(page);
      expect(cards, "cards").toHaveLength(count);
      expect(new Set(cards.map((card) => Math.round(card.top))).size).toBe(1);
      expect(cards[0]!.left).toBeCloseTo(wheel.left, 0);
      for (const card of cards) {
        // Wider than the third a fixed three-column grid gave, and no wider than a card may be.
        expect(card.width).toBeGreaterThan((wheel.right - wheel.left) / 3);
        expect(card.width).toBeLessThanOrEqual(CARD_MAX + 1);
      }
    });
  }

  test("stack in one column on a phone, as they did", async ({ page }) => {
    await open(page, 390);
    const { cards } = await boxes(page);
    expect(new Set(cards.map((card) => Math.round(card.left))).size).toBe(1);
    expect(new Set(cards.map((card) => Math.round(card.top))).size).toBe(
      cards.length,
    );
  });
});
