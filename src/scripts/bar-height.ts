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

/** A control the keyboard focus has moved to: its box in the window, and a scroll to its start. */
export interface FocusedControl {
  top(): number;
  height(): number;
  /** Scrolls the control's top to the scroll offset, as a link to a section is. */
  scrollInto(): void;
}

export interface FocusPage {
  /**
   * Calls the listener each time the keyboard focus moves to a control outside the bar, after the
   * browser has asked for its own scroll to it.
   */
  onKeyboardFocus(listener: (control: FocusedControl) => unknown): void;
  /** The scroll offset in pixels the stylesheet computes: the bar and the room left under it. */
  scrollPadding(): number;
  viewportHeight(): number;
}

/**
 * The scroll offset brings a focused control out from under the bar, but only one that fits the
 * room below it. A browser centres a taller one in that room, which leaves its top, and its title,
 * under the bar (a run-sheet strip at a phone's width with a visitor's text spacing), and leaves
 * one that already fills the room where it is, even with its top above the window (Shift+Tab from
 * below). So a control taller than the room is scrolled to start at the offset, as a link to a
 * section is, wherever its top was.
 */
export function keepFocusClear(page: FocusPage): void {
  page.onKeyboardFocus((control) => {
    const offset = page.scrollPadding();
    const room = page.viewportHeight() - offset;
    if (control.height() > room && Math.abs(control.top() - offset) > TOLERANCE)
      control.scrollInto();
  });
}
