import type { Page } from "@playwright/test";
import type { TargetFacts } from "../src/e2e/target-size.ts";

// What the layout checks measure in the browser. Each function reports plain facts about the page;
// the rules that judge them are in the spec, or in src/e2e/target-size.ts where Vitest tests them.

/** How wide the page's content is and how wide the window is: more of the first needs a sideways scroll. */
export function horizontalExtent(page: Page) {
  return page.evaluate(() => ({
    content: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
    visible: document.documentElement.clientWidth,
  }));
}

/**
 * Every element that hides what does not fit and has text running past its edge: its overflow is
 * `hidden` or `clip` on the axis, and a line of text a visitor reads lies outside its box. The text
 * is measured where it is drawn, not by the element's scroll size, which would also count what is
 * not text or not meant to be read:
 * - Text inside an `aria-hidden` element is decoration (the outline wordmark, the ASCII figures,
 *   which the site hides from assistive technology because they carry nothing a visitor needs), so
 *   it is not content that could be lost.
 * - An element a pixel wide or less is the screen-reader-only kind (`.vh`), cut off on purpose.
 * - Scrolling (`auto` or `scroll`) is not hiding, so it is not reported: the page-level check
 *   catches a scroll that makes the page wider.
 */
export function clippedText(page: Page, axes: ("x" | "y")[] = ["x"]) {
  return page.evaluate((axes) => {
    const HIDING = new Set(["hidden", "clip"]);
    // Sub-pixel rounding of a glyph's box must not read as a cut-off letter.
    const TOLERANCE = 1;
    const describe = (element: Element) => {
      const classes = [...element.classList].map((name) => `.${name}`).join("");
      const text = (element.textContent ?? "").trim().replace(/\s+/g, " ");
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes} “${text.slice(0, 40)}”`;
    };
    /** The boxes of the text a visitor reads in the element: none of it inside anything aria-hidden. */
    const readText = (element: Element) => {
      const boxes: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        if (node.parentElement?.closest('[aria-hidden="true"]')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          if (box.width > 0 && box.height > 0) boxes.push(box);
        }
      }
      return boxes;
    };
    const found: string[] = [];
    for (const element of document.body.querySelectorAll("*")) {
      if (element.clientWidth <= 1 || element.clientHeight <= 1) continue;
      const style = getComputedStyle(element);
      const hidesX = axes.includes("x") && HIDING.has(style.overflowX);
      const hidesY = axes.includes("y") && HIDING.has(style.overflowY);
      if (!hidesX && !hidesY) continue;
      const text = readText(element);
      if (text.length === 0) continue;
      // What the element shows is its padding box: inside the border, as far as it clips.
      const outer = element.getBoundingClientRect();
      const left = outer.left + element.clientLeft;
      const top = outer.top + element.clientTop;
      const right = left + element.clientWidth;
      const bottom = top + element.clientHeight;
      const overX = Math.max(
        ...text.map((box) => Math.max(box.right - right, left - box.left)),
      );
      const overY = Math.max(
        ...text.map((box) => Math.max(box.bottom - bottom, top - box.top)),
      );
      const sides = [
        hidesX &&
          overX > TOLERANCE &&
          `text runs ${Math.ceil(overX)} px past its ${element.clientWidth} px width`,
        hidesY &&
          overY > TOLERANCE &&
          `text runs ${Math.ceil(overY)} px past its ${element.clientHeight} px height`,
      ].filter(Boolean);
      if (sides.length) found.push(`${describe(element)}: ${sides.join(", ")}`);
    }
    return found;
  }, axes);
}

/**
 * Every link and button that a visitor can see, with the facts the size rule needs. A target that
 * is hidden until it has focus (the skip link) is measured while it has focus, as a keyboard user
 * meets it, and a target with no box at all is reported with none.
 */
export function targetsOf(page: Page): Promise<TargetFacts[]> {
  return page.evaluate(() => {
    const TARGETS = 'a[href], button, [role="button"], [role="link"]';
    const round = (value: number) => Math.round(value * 100) / 100;

    const nameOf = (element: Element) => {
      const classes = [...element.classList].map((name) => `.${name}`).join("");
      const label = (
        element.getAttribute("aria-label") ??
        element.textContent ??
        ""
      )
        .trim()
        .replace(/\s+/g, " ");
      const href = element.getAttribute("href");
      return `${element.tagName.toLowerCase()}${classes}${href ? `[href="${href}"]` : ""} “${label.slice(0, 40)}”`;
    };

    /** The words in the link's block that a visitor can see and that are not themselves a target. */
    const surroundingText = (element: Element) => {
      let block = element.parentElement;
      while (
        block &&
        ["inline", "contents"].includes(getComputedStyle(block).display)
      ) {
        block = block.parentElement;
      }
      if (!block) return "";
      let text = "";
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(TARGETS)) continue;
        const box = parent.getBoundingClientRect();
        if (box.width <= 1 || box.height <= 1) continue;
        text += node.textContent;
      }
      return text;
    };

    return [...document.querySelectorAll<HTMLElement>(TARGETS)].map(
      (element) => {
        let box = element.getBoundingClientRect();
        const hidden = box.width <= 1 && box.height <= 1 && box.width > 0;
        if (hidden) {
          element.focus({ preventScroll: true });
          box = element.getBoundingClientRect();
        }
        const facts = {
          name: nameOf(element),
          display: getComputedStyle(element).display,
          surroundingText: surroundingText(element),
          width: round(box.width),
          height: round(box.height),
        };
        if (hidden) element.blur();
        return facts;
      },
    );
  });
}
