// The navigation's script: the mobile menu, the number keys, the shortcut hints and the current
// section. The links work without it (they are plain links to /#section), so everything here is an
// addition. Like shortcuts.ts, it takes its parts as arguments and runs under test without a browser.
import { plainKey, type KeyEvent, type KeyTarget } from "./keys";
import { shortcutsEnabled } from "./shortcuts";

export type { KeyEvent, KeyTarget };

/** The section number a keypress asks for: a plain 1 to 9, under the guards plainKey applies. */
export function shortcutNumber(
  event: KeyEvent,
  target: KeyTarget | null,
): number | undefined {
  const key = plainKey(event, target);
  return key !== undefined && /^[1-9]$/.test(key) ? Number(key) : undefined;
}

/**
 * Which section is current: the last one whose top has passed 35% of the way down the window, or
 * -1 before the first has. At the bottom of the page it is the last section there is, because a
 * short last section cannot scroll up to the line. `tops` are the sections in page order, with
 * undefined for one that is not on the page.
 */
export function currentSection(
  tops: readonly (number | undefined)[],
  viewportHeight: number,
  atBottom = false,
): number {
  const line = viewportHeight * 0.35;
  let current = -1;
  tops.forEach((top, index) => {
    if (top !== undefined && (atBottom || top < line)) current = index;
  });
  return current;
}

export interface NavLink {
  /** The number key that goes here: its position among the sections that are shown. */
  number: number;
  element: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    addEventListener(type: "click", listener: () => void): void;
    click(): void;
  };
  /** The section on this page, or null where there is none (every page but the home page). */
  section: {
    getBoundingClientRect(): { top: number };
    scrollIntoView(): void;
  } | null;
}

export interface NavPage {
  nav: { dataset: Record<string, string | undefined> };
  menu: {
    setAttribute(name: string, value: string): void;
    addEventListener(type: "click", listener: () => void): void;
    focus(): void;
  };
  links: NavLink[];
  /** <html>, where the footer switch keeps data-shortcuts. */
  root: { dataset: Record<string, string | undefined> };
  home: boolean;
  viewportHeight(): number;
  /** Whether the page is scrolled to its end. */
  atBottom(): boolean;
  onKeydown(
    listener: (event: KeyEvent & { target: KeyTarget | null }) => void,
  ): void;
  /** Called when the window scrolls, is resized or is turned. */
  onViewportChange(listener: () => void): void;
  /** Called when the window crosses the width where the links collapse into the menu. */
  onBreakpointChange(listener: () => void): void;
  /** Called when the visitor presses anywhere outside the navigation bar. */
  onOutsidePress(listener: () => void): void;
  /** Called when data-shortcuts on <html> changes. */
  onShortcutsChange(listener: () => void): void;
}

/** Wires up the navigation. Collapsing into a menu is the script's doing, so it starts here. */
export function initNav(page: NavPage): void {
  const { nav, menu, links, root } = page;

  const setOpen = (open: boolean) => {
    if (open) nav.dataset.open = "";
    else delete nav.dataset.open;
    menu.setAttribute("aria-expanded", String(open));
  };
  const isOpen = () => nav.dataset.open !== undefined;

  nav.dataset.collapsible = "";
  setOpen(false);
  menu.addEventListener("click", () => setOpen(!isOpen()));
  for (const link of links) {
    link.element.addEventListener("click", () => setOpen(false));
  }
  // An open menu does not outlast what it was open for: a window that has grown past the
  // breakpoint shows the links in the bar, and a press elsewhere is the visitor moving on.
  page.onBreakpointChange(() => setOpen(false));
  page.onOutsidePress(() => {
    if (isOpen()) setOpen(false);
  });

  // The hint is announced only while the shortcut works.
  const syncHints = () => {
    const enabled = shortcutsEnabled(root);
    for (const link of links) {
      if (enabled) {
        link.element.setAttribute("aria-keyshortcuts", String(link.number));
      } else {
        link.element.removeAttribute("aria-keyshortcuts");
      }
    }
  };
  syncHints();
  page.onShortcutsChange(syncHints);

  page.onKeydown((event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      menu.focus();
      return;
    }
    if (!shortcutsEnabled(root)) return;
    const number = shortcutNumber(event, event.target);
    if (number === undefined) return;
    const link = links.find((link) => link.number === number);
    if (!link) return;
    // Following the link is what a click does: a scroll on the home page, a visit to it from any
    // other page.
    link.element.click();
    // Chromium can drop the scroll of a link that a script follows when a smooth scroll is still
    // running (the hash and the history entry change all the same), and the page then stays at the
    // earlier section. The scroll is asked for again, to the same place under the same
    // scroll-padding, and it makes no difference where the browser did it.
    if (page.home) link.section?.scrollIntoView();
  });

  // The current section is shown on the home page only: that is where the sections are.
  if (page.home) {
    const update = () => {
      const current = currentSection(
        links.map((link) => link.section?.getBoundingClientRect().top),
        page.viewportHeight(),
        page.atBottom(),
      );
      links.forEach((link, index) => {
        if (index === current)
          link.element.setAttribute("aria-current", "location");
        else link.element.removeAttribute("aria-current");
      });
    };
    update();
    page.onViewportChange(update);
  }
}
