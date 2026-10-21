import { expect, test, type Page } from "@playwright/test";
import { CONTEXTS, originOf } from "./contexts.ts";
import { expectArrived, hashOf, sectionKeys } from "./sections.ts";

// A second jump to a section, started while the smooth scroll of the first is still running, has to
// win: the page comes to rest on the second section, whatever the gap between the two. And the jump
// stays what a link is: a hash, a history entry, a place for Tab to continue from, a landing spot
// under the bar, and instant under reduced motion. The key rules are covered by Vitest.

/** Gaps between the two jumps, in ms: back to back, inside the scroll, and after it has ended. */
const GAPS = [0, 100, 250, 500];

/**
 * How many times a pair of jumps is tried at each gap. A browser that drops the second jump does so
 * at random, in roughly one pair in ten for the number keys in Chromium, so a single pair would pass
 * most of the time with the bug still there. With twelve at each of four gaps, in both builds, one
 * of the tests fails almost every time it is there.
 */
const ROUNDS = 12;
// Real clicks on the links were never seen to drop a jump (none in 140 pairs), so there are fewer.
const CLICK_ROUNDS = 4;

/**
 * The first section and one further down. The third where there is one, as in the report of the
 * bug (1 then 3), and otherwise the last, so that a build with two sections is tested too.
 */
async function twoSections(page: Page) {
  const sections = await sectionKeys(page);
  expect(sections.length, "needs two sections").toBeGreaterThan(1);
  return {
    from: sections[0]!,
    to: sections[Math.min(2, sections.length - 1)]!,
  };
}

/**
 * Jumps to one section and then, `gap` ms later, to another, again and again on the same page: each
 * pair must come to rest on the second section with its hash. `jump` follows a section, by key or
 * by click.
 */
async function expectSecondJumpWins(
  page: Page,
  gap: number,
  rounds: number,
  jump: (section: { key: string; id: string }) => Promise<void>,
) {
  const { from, to } = await twoSections(page);
  for (let round = 1; round <= rounds; round++) {
    await page.evaluate(() => {
      scrollTo({ top: 0, behavior: "instant" });
      history.replaceState(null, "", "/");
    });
    await jump(from);
    if (gap > 0) await page.waitForTimeout(gap);
    await jump(to);

    await expect
      .poll(() => hashOf(page), { message: `round ${round}: the hash` })
      .toBe(`#${to.id}`);
    await expectArrived(page, to.id, `round ${round}`);
  }
}

/** The scroll padding the page asks for, which is where a jump lands a section's top. */
const scrollPadding = (page: Page) =>
  page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  );

/** Whether Tab now reaches the first thing that can take focus at or after the start of a section. */
async function tabContinuesFrom(page: Page, id: string) {
  await page.keyboard.press("Tab");
  return page.evaluate((id) => {
    const section = document.getElementById(id)!;
    const next = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].find(
      (element) =>
        element.checkVisibility() &&
        !element.matches(":disabled") &&
        section.compareDocumentPosition(element) &
          (Node.DOCUMENT_POSITION_FOLLOWING |
            Node.DOCUMENT_POSITION_CONTAINED_BY),
    );
    return {
      reached: document.activeElement === next,
      focused: document.activeElement?.outerHTML.slice(0, 80),
      expected: next?.outerHTML.slice(0, 80),
    };
  }, id);
}

/** Every distinct scroll position the page passes through from now until `ms` after `act`. */
async function scrollPositionsDuring(
  page: Page,
  act: () => Promise<void>,
  ms: number,
) {
  await page.evaluate(() => {
    const seen = new Set<number>();
    (window as unknown as { __seen: Set<number> }).__seen = seen;
    const frame = () => {
      seen.add(scrollY);
      requestAnimationFrame(frame);
    };
    frame();
  });
  await act();
  await page.waitForTimeout(ms);
  return page.evaluate(() => [
    ...(window as unknown as { __seen: Set<number> }).__seen,
  ]);
}

for (const context of CONTEXTS) {
  const origin = originOf(context);
  const home = `${origin}/`;

  test.describe(`${context.name} build`, () => {
    for (const gap of GAPS) {
      test(`two number keys ${gap} ms apart come to rest on the second section`, async ({
        page,
      }) => {
        test.setTimeout(60_000);
        await page.goto(home);
        await expectSecondJumpWins(page, gap, ROUNDS, ({ key }) =>
          page.keyboard.press(key),
        );
      });

      test(`two clicks on the navigation ${gap} ms apart come to rest on the second section`, async ({
        page,
      }) => {
        test.setTimeout(60_000);
        await page.goto(home);
        await expectSecondJumpWins(page, gap, CLICK_ROUNDS, ({ id }) =>
          page.locator(`nav a[href="/#${id}"]`).click(),
        );
      });
    }

    test("a jump leaves the hash and a history entry, and Back returns to the section before", async ({
      page,
    }) => {
      await page.goto(home);
      const { from, to } = await twoSections(page);

      await page.keyboard.press(from.key);
      await expectArrived(page, from.id);
      await page.keyboard.press(to.key);
      await expectArrived(page, to.id);
      expect(await hashOf(page)).toBe(`#${to.id}`);

      await page.goBack();
      expect(await hashOf(page)).toBe(`#${from.id}`);
      await expectArrived(page, from.id);

      await page.goBack();
      expect(await hashOf(page)).toBe("");
    });

    test("jumps in quick succession each leave a history entry", async ({
      page,
    }) => {
      await page.goto(home);
      const { from, to } = await twoSections(page);

      await page.keyboard.press(from.key);
      await page.waitForTimeout(100);
      await page.keyboard.press(to.key);
      await expectArrived(page, to.id);

      await page.goBack();
      expect(await hashOf(page)).toBe(`#${from.id}`);
      await page.goBack();
      expect(await hashOf(page)).toBe("");
    });

    test("the next Tab continues from the section a key reached", async ({
      page,
    }) => {
      await page.goto(home);
      const { to } = await twoSections(page);

      await page.keyboard.press(to.key);
      await expectArrived(page, to.id);
      const result = await tabContinuesFrom(page, to.id);
      expect(result.reached, `${result.focused} for ${result.expected}`).toBe(
        true,
      );
    });

    test("the next Tab continues from the section a click reached", async ({
      page,
    }) => {
      await page.goto(home);
      const { to } = await twoSections(page);

      await page.locator(`nav a[href="/#${to.id}"]`).click();
      await expectArrived(page, to.id);
      const result = await tabContinuesFrom(page, to.id);
      expect(result.reached, `${result.focused} for ${result.expected}`).toBe(
        true,
      );
    });

    test("the next Tab continues from the section the second of two quick keys reached", async ({
      page,
    }) => {
      await page.goto(home);
      const { from, to } = await twoSections(page);

      await page.keyboard.press(from.key);
      await page.waitForTimeout(100);
      await page.keyboard.press(to.key);
      await expectArrived(page, to.id);
      const result = await tabContinuesFrom(page, to.id);
      expect(result.reached, `${result.focused} for ${result.expected}`).toBe(
        true,
      );
    });

    test("a jump lands the section's top at the scroll padding, under the bar", async ({
      page,
    }) => {
      await page.goto(home);
      const padding = await scrollPadding(page);
      expect(padding).toBeGreaterThan(0);

      for (const { key, id } of await sectionKeys(page)) {
        await page.keyboard.press(key);
        await expectArrived(page, id);
        const { top, atEnd } = await page.evaluate(
          (id) => ({
            top: document.getElementById(id)!.getBoundingClientRect().top,
            atEnd:
              scrollY + innerHeight >=
              document.documentElement.scrollHeight - 2,
          }),
          id,
        );
        // The last sections may not reach the line: the page ends first.
        if (!atEnd) expect(top, id).toBeCloseTo(padding, 0);
      }
    });

    test("a jump is smooth when motion is allowed", async ({ page }) => {
      await page.goto(home);
      const [first] = await sectionKeys(page);
      const positions = await scrollPositionsDuring(
        page,
        () => page.keyboard.press(first!.key),
        800,
      );
      // The start, the end and some of the way between.
      expect(positions.length).toBeGreaterThan(3);
    });

    test("a jump is instant under reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(home);
      const [first] = await sectionKeys(page);
      const positions = await scrollPositionsDuring(
        page,
        () => page.keyboard.press(first!.key),
        800,
      );
      // The start and the end, with nothing between.
      expect(positions).toHaveLength(2);
      await expect.poll(() => hashOf(page)).toBe(`#${first!.id}`);
      await expectArrived(page, first!.id);
    });

    test("a number key on a project page lands on the section of the home page", async ({
      page,
    }) => {
      await page.goto(`${origin}/projects/this-website/`);
      const [first] = await sectionKeys(page);
      await page.keyboard.press(first!.key);
      await expect(page).toHaveURL(`${home}#${first!.id}`);
      await expectArrived(page, first!.id);
    });
  });
}
