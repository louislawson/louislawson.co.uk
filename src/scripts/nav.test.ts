import { describe, expect, it } from "vitest";
import {
  currentSection,
  initNav,
  shortcutNumber,
  type KeyEvent,
  type NavPage,
} from "./nav";

const plain = (key: string, extra: Partial<KeyEvent> = {}): KeyEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...extra,
});

describe("shortcutNumber", () => {
  it("is the number for a plain digit key", () => {
    for (let n = 1; n <= 9; n++) {
      expect(shortcutNumber(plain(String(n)), null)).toBe(n);
    }
  });

  it("is nothing for a key that is not a digit from 1 to 9", () => {
    for (const key of ["0", "a", "i", "Enter", "Escape", "+", " ", "10"]) {
      expect(shortcutNumber(plain(key), null), key).toBeUndefined();
    }
  });

  it("is nothing while Control, Alt or Meta is held, so the browser's own shortcuts still work", () => {
    expect(shortcutNumber(plain("1", { ctrlKey: true }), null)).toBeUndefined();
    expect(shortcutNumber(plain("1", { metaKey: true }), null)).toBeUndefined();
    expect(shortcutNumber(plain("1", { altKey: true }), null)).toBeUndefined();
  });

  it("does not count Shift as a modifier, because the key says what was typed", () => {
    // On a QWERTY keyboard Shift+1 types "!", which is no digit. On an AZERTY keyboard the top
    // row types a digit only with Shift, and then the key is "1": refusing Shift would lock those
    // visitors out of the shortcuts the nav advertises.
    expect(
      shortcutNumber(plain("!", { shiftKey: true }), null),
    ).toBeUndefined();
    expect(shortcutNumber(plain("1", { shiftKey: true }), null)).toBe(1);
  });

  it("is nothing while an input method is composing text", () => {
    expect(
      shortcutNumber(plain("1", { isComposing: true }), null),
    ).toBeUndefined();
  });

  it("is nothing while a key is held down and repeating", () => {
    expect(shortcutNumber(plain("2", { repeat: true }), null)).toBeUndefined();
  });

  it("is nothing while the visitor is typing in a field", () => {
    for (const tagName of [
      "INPUT",
      "TEXTAREA",
      "SELECT",
      "input",
      "textarea",
    ]) {
      expect(shortcutNumber(plain("2"), { tagName }), tagName).toBeUndefined();
    }
    expect(
      shortcutNumber(plain("2"), { tagName: "DIV", isContentEditable: true }),
    ).toBeUndefined();
  });

  it("is the number when the focus is on a link, a button or the page", () => {
    expect(shortcutNumber(plain("2"), { tagName: "A" })).toBe(2);
    expect(shortcutNumber(plain("2"), { tagName: "BUTTON" })).toBe(2);
    expect(shortcutNumber(plain("2"), { tagName: "BODY" })).toBe(2);
  });
});

describe("currentSection", () => {
  // The current section is the last one whose top has passed 35% of the way down the window.
  const vh = 800;

  it("is none before the first section reaches that line", () => {
    expect(currentSection([500, 900, 1400], vh)).toBe(-1);
  });

  it("is the last section that has passed the line", () => {
    expect(currentSection([100, 900, 1400], vh)).toBe(0);
    expect(currentSection([-400, 200, 900], vh)).toBe(1);
    expect(currentSection([-1200, -600, -100], vh)).toBe(2);
  });

  it("skips a section that is not on the page", () => {
    expect(currentSection([-400, undefined, 100, 900], vh)).toBe(2);
    expect(currentSection([undefined, undefined], vh)).toBe(-1);
  });

  it("is none when there are no sections", () => {
    expect(currentSection([], vh)).toBe(-1);
  });

  it("is the last section on the page at the bottom, even if it never reached the line", () => {
    // A short last section, such as contact, cannot scroll up to the line: the page has ended.
    expect(currentSection([-1200, -200, 600], vh, true)).toBe(2);
    expect(currentSection([-1200, -200, 600], vh, false)).toBe(1);
  });

  it("is the last section that is on the page at the bottom", () => {
    expect(currentSection([-1200, 600, undefined], vh, true)).toBe(1);
    expect(currentSection([undefined, undefined], vh, true)).toBe(-1);
    expect(currentSection([], vh, true)).toBe(-1);
  });
});

/** The parts of the page the navigation touches, as plain objects. */
function page(
  overrides: { home?: boolean; shortcuts?: string; missing?: number[] } = {},
) {
  const keydown: ((event: KeyEvent & { target: null }) => void)[] = [];
  const viewport: (() => void)[] = [];
  const breakpoint: (() => void)[] = [];
  const outsidePress: (() => void)[] = [];
  const shortcutChanges: (() => void)[] = [];
  const menuAttributes: Record<string, string> = {};
  const menuClicks: (() => void)[] = [];
  const state = {
    menuFocused: 0,
    atBottom: false,
    tops: [900, 1800, 2700] as (number | undefined)[],
  };

  const missing = overrides.missing ?? [];
  const makeLink = (number: number) => {
    const attributes: Record<string, string> = {};
    const listeners: (() => void)[] = [];
    const self = {
      number,
      attributes,
      clicks: 0,
      element: {
        setAttribute: (name: string, value: string) =>
          void (attributes[name] = value),
        removeAttribute: (name: string) => void delete attributes[name],
        addEventListener: (_type: "click", listener: () => void) =>
          void listeners.push(listener),
        // A real click runs the link's listeners, such as the one that closes the menu.
        click() {
          self.clicks++;
          listeners.forEach((listener) => listener());
        },
      },
      // A section that is not on the page is null, from start-up, as it is in the page.
      section: missing.includes(number)
        ? null
        : {
            getBoundingClientRect: () => ({ top: state.tops[number - 1] ?? 0 }),
          },
    };
    return self;
  };
  const links = [1, 2, 3].map(makeLink);
  const link = (n: number) => links[n - 1]!;

  const root = {
    dataset: { shortcuts: overrides.shortcuts } as Record<
      string,
      string | undefined
    >,
  };
  const nav = { dataset: {} as Record<string, string | undefined> };

  const env: NavPage = {
    nav,
    menu: {
      setAttribute: (name, value) => void (menuAttributes[name] = value),
      addEventListener: (_type, listener) => void menuClicks.push(listener),
      focus: () => void state.menuFocused++,
    },
    links: links.map(({ number, element, section }) => ({
      number,
      element,
      section,
    })),
    root,
    home: overrides.home ?? true,
    viewportHeight: () => 800,
    atBottom: () => state.atBottom,
    onKeydown: (listener) => void keydown.push(listener),
    onViewportChange: (listener) => void viewport.push(listener),
    onBreakpointChange: (listener) => void breakpoint.push(listener),
    onOutsidePress: (listener) => void outsidePress.push(listener),
    onShortcutsChange: (listener) => void shortcutChanges.push(listener),
  };
  initNav(env);

  return {
    nav,
    root,
    menuAttributes,
    state,
    link,
    clickMenu: () => menuClicks[0]!(),
    press: (key: string, extra: Partial<KeyEvent> = {}) =>
      keydown.forEach((listener) =>
        listener({ ...plain(key, extra), target: null }),
      ),
    scrollTo: (tops: (number | undefined)[], atBottom = false) => {
      state.tops = tops;
      state.atBottom = atBottom;
      viewport.forEach((listener) => listener());
    },
    /** The window is resized or turned: the same listener, with no scroll. */
    resizeTo: (tops: (number | undefined)[]) => {
      state.tops = tops;
      viewport.forEach((listener) => listener());
    },
    crossBreakpoint: () => breakpoint.forEach((listener) => listener()),
    pressOutside: () => outsidePress.forEach((listener) => listener()),
    changeShortcuts: (value: string) => {
      root.dataset.shortcuts = value;
      shortcutChanges.forEach((listener) => listener());
    },
  };
}

describe("the navigation menu", () => {
  it("collapses into a menu only once the script has run, and starts closed", () => {
    const { nav, menuAttributes } = page();
    expect(nav.dataset.collapsible).toBe("");
    expect(nav.dataset.open).toBeUndefined();
    expect(menuAttributes["aria-expanded"]).toBe("false");
  });

  it("opens and closes with the menu button, and says which", () => {
    const { nav, menuAttributes, clickMenu } = page();
    clickMenu();
    expect(nav.dataset.open).toBe("");
    expect(menuAttributes["aria-expanded"]).toBe("true");
    clickMenu();
    expect(nav.dataset.open).toBeUndefined();
    expect(menuAttributes["aria-expanded"]).toBe("false");
  });

  it("closes when a link is followed", () => {
    const { nav, menuAttributes, clickMenu, link } = page();
    clickMenu();
    link(2).element.click();
    expect(nav.dataset.open).toBeUndefined();
    expect(menuAttributes["aria-expanded"]).toBe("false");
  });

  it("closes on Escape and gives the focus back to the menu button", () => {
    const { nav, state, clickMenu, press } = page();
    clickMenu();
    press("Escape");
    expect(nav.dataset.open).toBeUndefined();
    expect(state.menuFocused).toBe(1);
  });

  it("leaves the focus alone on Escape when the menu is already closed", () => {
    const { state, press } = page();
    press("Escape");
    expect(state.menuFocused).toBe(0);
  });

  it("closes when the window crosses the breakpoint, so no stale open menu waits on the other side", () => {
    const { nav, menuAttributes, clickMenu, crossBreakpoint } = page();
    clickMenu();
    crossBreakpoint();
    expect(nav.dataset.open).toBeUndefined();
    expect(menuAttributes["aria-expanded"]).toBe("false");
  });

  it("closes when the visitor presses outside the bar, without taking the focus", () => {
    const { nav, menuAttributes, state, clickMenu, pressOutside } = page();
    clickMenu();
    pressOutside();
    expect(nav.dataset.open).toBeUndefined();
    expect(menuAttributes["aria-expanded"]).toBe("false");
    expect(state.menuFocused).toBe(0);
  });

  it("leaves a closed menu closed on an outside press", () => {
    const { nav, menuAttributes, pressOutside } = page();
    pressOutside();
    expect(nav.dataset.open).toBeUndefined();
    expect(menuAttributes["aria-expanded"]).toBe("false");
  });
});

describe("the number keys", () => {
  it("follow the link with that number", () => {
    const { link, press } = page({ shortcuts: "on" });
    press("2");
    expect(link(2).clicks).toBe(1);
    expect(link(1).clicks).toBe(0);
    press("3");
    expect(link(3).clicks).toBe(1);
  });

  it("do nothing for a number there is no link for, because that section is hidden", () => {
    const { link, press } = page({ shortcuts: "on" });
    press("4");
    press("9");
    expect([link(1).clicks, link(2).clicks, link(3).clicks]).toEqual([0, 0, 0]);
  });

  it("work on a page the switch has not run on, which counts as on", () => {
    const { link, press } = page({});
    press("1");
    expect(link(1).clicks).toBe(1);
  });

  it("do nothing once the visitor has turned shortcuts off, and work again when they turn them on", () => {
    const { link, press, changeShortcuts } = page({ shortcuts: "off" });
    press("1");
    expect(link(1).clicks).toBe(0);
    changeShortcuts("on");
    press("1");
    expect(link(1).clicks).toBe(1);
  });

  it("do nothing with a modifier held", () => {
    const { link, press } = page({ shortcuts: "on" });
    press("1", { ctrlKey: true });
    press("1", { metaKey: true });
    expect(link(1).clicks).toBe(0);
  });
});

describe("the shortcut hints", () => {
  it("are announced on each link while shortcuts are on", () => {
    const { link } = page({ shortcuts: "on" });
    expect(link(1).attributes["aria-keyshortcuts"]).toBe("1");
    expect(link(2).attributes["aria-keyshortcuts"]).toBe("2");
    expect(link(3).attributes["aria-keyshortcuts"]).toBe("3");
  });

  it("are not announced once shortcuts are off, and are again when they come back", () => {
    const { link, changeShortcuts } = page({ shortcuts: "on" });
    changeShortcuts("off");
    expect(link(1).attributes["aria-keyshortcuts"]).toBeUndefined();
    expect(link(3).attributes["aria-keyshortcuts"]).toBeUndefined();
    changeShortcuts("on");
    expect(link(2).attributes["aria-keyshortcuts"]).toBe("2");
  });

  it("are not announced when the visitor started with shortcuts off", () => {
    const { link } = page({ shortcuts: "off" });
    expect(link(1).attributes["aria-keyshortcuts"]).toBeUndefined();
  });
});

describe("the current section", () => {
  it("is marked with aria-current on the home page, and moves as the page scrolls", () => {
    const { link, scrollTo } = page({ home: true });
    // Nothing has passed the line yet.
    expect(link(1).attributes["aria-current"]).toBeUndefined();

    scrollTo([100, 900, 1700]);
    expect(link(1).attributes["aria-current"]).toBe("true");
    expect(link(2).attributes["aria-current"]).toBeUndefined();

    scrollTo([-500, 150, 1000]);
    expect(link(1).attributes["aria-current"]).toBeUndefined();
    expect(link(2).attributes["aria-current"]).toBe("true");
  });

  it("is marked from the first paint, not only after a scroll", () => {
    // The tops at start-up are already past the line for the second section.
    const attributes: Record<string, string>[] = [];
    const links = [1, 2].map((number, index) => {
      const attrs: Record<string, string> = {};
      attributes.push(attrs);
      return {
        number,
        element: {
          setAttribute: (name: string, value: string) =>
            void (attrs[name] = value),
          removeAttribute: (name: string) => void delete attrs[name],
          addEventListener: () => undefined,
          click: () => undefined,
        },
        section: {
          getBoundingClientRect: () => ({ top: index === 0 ? -600 : 100 }),
        },
      };
    });
    initNav({
      nav: { dataset: {} },
      menu: {
        setAttribute: () => undefined,
        addEventListener: () => undefined,
        focus: () => undefined,
      },
      links,
      root: { dataset: {} },
      home: true,
      viewportHeight: () => 800,
      atBottom: () => false,
      onKeydown: () => undefined,
      onViewportChange: () => undefined,
      onBreakpointChange: () => undefined,
      onOutsidePress: () => undefined,
      onShortcutsChange: () => undefined,
    });
    expect(attributes[0]!["aria-current"]).toBeUndefined();
    expect(attributes[1]!["aria-current"]).toBe("true");
  });

  it("marks the last section at the bottom of the page, where a short one cannot reach the line", () => {
    const { link, scrollTo } = page({ home: true });
    scrollTo([-1500, -600, 650], false);
    expect(link(2).attributes["aria-current"]).toBe("true");
    expect(link(3).attributes["aria-current"]).toBeUndefined();

    scrollTo([-1500, -600, 650], true);
    expect(link(3).attributes["aria-current"]).toBe("true");
    expect(link(2).attributes["aria-current"]).toBeUndefined();
  });

  it("is worked out again when the window is resized or turned, with no scroll", () => {
    const { link, resizeTo } = page({ home: true });
    resizeTo([100, 900, 1700]);
    expect(link(1).attributes["aria-current"]).toBe("true");
    resizeTo([-500, 150, 1000]);
    expect(link(2).attributes["aria-current"]).toBe("true");
    expect(link(1).attributes["aria-current"]).toBeUndefined();
  });

  it("is never marked on another page", () => {
    const { link, scrollTo } = page({ home: false });
    scrollTo([-500, 150, 1000]);
    expect(link(2).attributes["aria-current"]).toBeUndefined();
  });

  it("ignores a link whose section is not on the page", () => {
    const { link, scrollTo } = page({ home: true, missing: [2, 3] });
    scrollTo([-500, 0, 0]);
    expect(link(1).attributes["aria-current"]).toBe("true");
    expect(link(2).attributes["aria-current"]).toBeUndefined();
  });
});
