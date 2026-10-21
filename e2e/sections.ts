import { expect, type Page } from "@playwright/test";

// What the specs that follow the navigation to a section share: which sections it lists, and
// whether the page has come to rest on one.

export const hashOf = (page: Page) => page.evaluate(() => location.hash);

/** The sections the navigation lists, in order: the key that goes to each and its id. */
export function sectionKeys(page: Page) {
  return page.locator("a[data-number]").evaluateAll((links) =>
    links.map((link) => ({
      key: link.getAttribute("data-number") ?? "",
      id: new URL((link as HTMLAnchorElement).href).hash.slice(1),
    })),
  );
}

/**
 * Waits for the page to arrive at a section. The scroll is smooth, so it takes a moment: this
 * returns once the section is in view and the page has stopped moving.
 */
export async function expectArrived(page: Page, id: string, note = id) {
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const { top, bottom } = document
            .getElementById(id)!
            .getBoundingClientRect();
          return top < innerHeight && bottom > 0;
        }, id),
      { message: `${note}: ${id} comes into view` },
    )
    .toBe(true);
  // Several frames with no movement.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = -1;
        let still = 0;
        const frame = () => {
          still = scrollY === last ? still + 1 : 0;
          last = scrollY;
          if (still >= 5) resolve();
          else requestAnimationFrame(frame);
        };
        frame();
      }),
  );
  // At rest, the section sits under the bar, or the page ended before it could get that far.
  const { top, atEnd } = await page.evaluate(
    (id) => ({
      top: document.getElementById(id)!.getBoundingClientRect().top,
      atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
    }),
    id,
  );
  expect(atEnd || top < 200, `${note}: ${id} at ${top}`).toBe(true);
}
