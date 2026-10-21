// The sticky bar's real height is the page's scroll offset: the bar takes a second row where its
// contents do not fit (a phone, a visitor's own text spacing), and a section or a focused control
// must land below it as drawn. Like nav.ts, this takes its parts as arguments and runs under test
// without a browser.

export interface BarHeightPage {
  /** Publishes the bar's height to the stylesheet, which offsets the scroll by it. */
  setHeight(height: number): void;
  /** Calls the listener with the bar's height now and each time it changes. */
  onChange(listener: (height: number) => unknown): void;
  /** The scroll offset in pixels the stylesheet now computes, read after setHeight. */
  scrollPadding(): number;
  /** The section the address names (the part after #), or null where it names none. */
  landing(): { top(): number; scrollInto(): void } | null;
  /** Resolves once the browser's own scroll to that section, which may be smooth, has ended. */
  settled(): Promise<void>;
}

/** How far short of the offset a section may sit before it counts as under the bar: rounding. */
const TOLERANCE = 2;

/**
 * Keeps the stylesheet's scroll offset at the bar's measured height. A link from outside the page
 * (/#projects) is scrolled to by the browser, with the offset the stylesheet had when that began,
 * before this script has measured anything. If that left the section under the bar, the first
 * measurement waits for the browser to arrive and then scrolls the rest of the way. Later
 * measurements do not: by then the visitor may be reading somewhere else.
 */
export function trackBarHeight(page: BarHeightPage): void {
  let first = true;
  page.onChange(async (height) => {
    page.setHeight(height);
    if (!first) return;
    first = false;
    const landing = page.landing();
    if (!landing) return;
    await page.settled();
    // Only a section that sits where the offset puts one, a little short of it. One far above is
    // not a landing: the browser restored the visitor's own place on a reload.
    const top = landing.top();
    if (top >= 0 && top < page.scrollPadding() - TOLERANCE)
      landing.scrollInto();
  });
}
