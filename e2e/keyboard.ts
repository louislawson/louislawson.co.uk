import type { Page } from "@playwright/test";

// What the keyboard checks read from a page: the controls a Tab press reaches, in order, and the
// facts about each one that the spec judges. The judging stays in the spec.

export interface FocusFacts {
  /** Whether this is the first control of the walk, which coming back to ends it. */
  first: boolean;
  /** The control in a few words: its tag, classes, address and the text it shows. */
  name: string;
  /** Computed while the control has keyboard focus, so a :focus-visible rule applies. */
  outline: { style: string; width: number; color: string };
  boxShadow: string;
  /** The control's box in the window once the page has stopped scrolling. */
  top: number;
  /** The sticky bar: its bottom edge, and whether the control is part of it. */
  barBottom: number;
  inBar: boolean;
  /** Whether the control is the topmost thing at its top edge, so it lies over the bar and not under it. */
  onTop: boolean;
}

export interface TabWalk {
  /** The controls a Tab press reached, in order. */
  stops: FocusFacts[];
  /** The controls a visitor can see and tab to, counted from the page and not from the walk. */
  expected: string[];
}

/** The controls the browser puts in the tab order, as long as they are drawn. */
const TABBABLE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Waits until the page has stopped scrolling: the site scrolls smoothly, and a box read mid-scroll lies. */
export function scrollRest(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = Number.NaN;
        let still = 0;
        const frame = () => {
          still = scrollY === last ? still + 1 : 0;
          last = scrollY;
          if (still >= 6) resolve();
          else requestAnimationFrame(frame);
        };
        frame();
      }),
  );
}

/**
 * Presses Tab from the top of a settled page until the focus has been through every control and
 * comes round again (or leaves the page), and reports each stop. A page whose tab order never ends
 * is a finding, named here and not a timeout.
 */
export async function walkTabOrder(page: Page): Promise<TabWalk> {
  const expected = await page.evaluate((selector) => {
    // A walk starts afresh: the first stop of an earlier walk on this page is forgotten.
    delete (window as unknown as { __firstStop?: Element }).__firstStop;
    const name = (element: Element) => {
      const classes = [...element.classList].map((c) => `.${c}`).join("");
      const text = (
        element.getAttribute("aria-label") ??
        element.textContent ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const href = element.getAttribute("href");
      return `${element.tagName.toLowerCase()}${classes}${href ? `[href="${href}"]` : ""} “${text.slice(0, 40)}”`;
    };
    return [...document.querySelectorAll(selector)]
      .filter((element) =>
        element.checkVisibility({ visibilityProperty: true }),
      )
      .map(name);
  }, TABBABLE);

  const stops: FocusFacts[] = [];
  // Twice what is there: a loop that does not end is stopped, with the reason.
  const limit = expected.length * 2 + 10;
  for (let press = 0; ; press++) {
    if (press > limit) {
      throw new Error(
        `Tab did not come back to the start after ${press} presses (${expected.length} controls)`,
      );
    }
    await page.keyboard.press("Tab");
    await scrollRest(page);
    const facts = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const classes = [...element.classList].map((c) => `.${c}`).join("");
      const text = (
        element.getAttribute("aria-label") ??
        element.textContent ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const href = element.getAttribute("href");
      // The first stop is remembered on the page, so coming back to it is told from another
      // control that happens to be named the same.
      const marked = window as unknown as { __firstStop?: Element };
      const first = (marked.__firstStop ??= element) === element;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const bar = document.querySelector("[data-nav]");
      // What is drawn at the control's top edge: the control itself, or the bar over it.
      const hit = document.elementFromPoint(
        Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1),
        Math.min(Math.max(box.top + 0.5, 0), innerHeight - 1),
      );
      return {
        first,
        name: `${element.tagName.toLowerCase()}${classes}${href ? `[href="${href}"]` : ""} “${text.slice(0, 40)}”`,
        outline: {
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          color: style.outlineColor,
        },
        boxShadow: style.boxShadow,
        top: box.top,
        barBottom: bar ? bar.getBoundingClientRect().bottom : 0,
        inBar: !!bar?.contains(element),
        onTop: !!hit && element.contains(hit),
      };
    });
    // Coming back to the first control ends the round.
    if (!facts || (facts.first && stops.length > 0)) break;
    stops.push(facts);
  }
  return { stops, expected };
}

/**
 * Focuses each control while it lies half under the sticky bar, as it does when a visitor has
 * scrolled past it, and reports the ones that the browser leaves under the bar. A Tab walk alone
 * would miss them: the browser usually centres a control it scrolls to, so the bar's size shows
 * only when the control is nearly in view already, where the page's scroll padding decides.
 */
export function focusFromUnderBar(page: Page): Promise<string[]> {
  return page.evaluate(async (selector) => {
    const bar = document.querySelector("[data-nav]")!;
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    /** The site scrolls smoothly: wait until it has stopped. */
    const rest = async () => {
      let last = Number.NaN;
      for (let still = 0; still < 6;) {
        await frame();
        still = scrollY === last ? still + 1 : 0;
        last = scrollY;
      }
    };
    const problems: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      if (bar.contains(element)) continue;
      const barBottom = () => bar.getBoundingClientRect().bottom;
      // A control taller than the room under the bar cannot be wholly clear of it.
      if (element.getBoundingClientRect().height > innerHeight - barBottom()) {
        continue;
      }
      const wasAt = element.getBoundingClientRect().top + scrollY;
      scrollTo({ top: wasAt - barBottom() + 20, behavior: "instant" });
      await frame();
      element.focus();
      await rest();
      const box = element.getBoundingClientRect();
      // The skip link lies over the bar when it has focus: it is on top of it, not under it.
      const hit = document.elementFromPoint(
        Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1),
        Math.min(Math.max(box.top + 0.5, 0), innerHeight - 1),
      );
      if (hit && element.contains(hit)) continue;
      const { top } = box;
      if (top < barBottom() - 0.5) {
        const label = (
          element.getAttribute("aria-label") ??
          element.textContent ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ");
        problems.push(
          `${element.tagName.toLowerCase()} “${label.slice(0, 40)}” left ${Math.round(barBottom() - top)} px under the bar`,
        );
      }
    }
    scrollTo({ top: 0, behavior: "instant" });
    return problems;
  }, TABBABLE);
}
