import type { Page } from "@playwright/test";
import { expect } from "./test.ts";

// Waiting for a page to come to rest, so that a check reads the finished page and not a half-built
// one. The accessibility scans and the layout checks both need it.

/**
 * Waits for the animations and transitions that end (the trace's replay, a fade, a colour change)
 * to finish, so a scan does not read a half-faded line at the wrong contrast. The caret's blink
 * never ends and holds no text, so it is left running. Two frames first, so that a transition set
 * off a moment ago has started and can be seen.
 */
export async function animationsEnd(page: Page) {
  await page.evaluate(async () => {
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    // Animations that start others end in a few rounds; a page that never stops starting them is
    // a finding, named here, not a timeout.
    for (let round = 0; ; round++) {
      const running = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity &&
            (animation.playState === "running" || animation.pending),
        );
      if (running.length === 0) return;
      if (round >= 10) {
        throw new Error(
          `animations still starting after ${round} rounds: ${running
            .map((animation) => animation.id || animation.constructor.name)
            .join(", ")}`,
        );
      }
      // One that is cancelled (restarted, or its element removed) ends too: that is not an error.
      await Promise.allSettled(running.map((animation) => animation.finished));
    }
  });
}

/**
 * Waits until nothing on the page is still arriving or moving, so a check sees the finished page: a
 * panel not yet built would not be scanned at all. The home page must show its trace panel, so a
 * page that never builds it fails here and is not checked empty.
 */
export async function settle(page: Page, path: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // The trace panel fills in after the load event, from the browser's own timings.
  if (path === "/") {
    await expect(page.locator("[data-trace-total]")).not.toHaveText("");
  }
  // Content made by scripts as parts come into view is made on the way down, so go down and back.
  // Two frames a step: an IntersectionObserver's callback runs after the frame it was seen in.
  await page.evaluate(async () => {
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    const step = Math.max(1, innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: "instant" });
      await frame();
      await frame();
    }
    scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle");
  await animationsEnd(page);
}
