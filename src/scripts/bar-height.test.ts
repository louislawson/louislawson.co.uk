import { describe, expect, it } from "vitest";
import {
  keepFocusClear,
  trackBarHeight,
  type FocusedControl,
} from "./bar-height";

// The sticky bar's real height is the page's scroll offset. These run without a browser: the page's
// parts are the arguments.

/**
 * A page whose bar reports heights by `change`. The offset is the bar's height and the 38 px the
 * stylesheet leaves under it. `held` keeps the browser's own scroll to the section from ending until
 * `arrive` is called.
 */
function page(options: { landingTop?: number | null; held?: boolean } = {}) {
  const { landingTop = null, held = false } = options;
  let height = 58;
  let top = landingTop;
  const log: string[] = [];
  let listener: (height: number) => unknown = () => {
    throw new Error("nothing is listening");
  };
  let arrive = () => {};
  const arrived = held
    ? new Promise<void>((resolve) => {
        arrive = resolve;
      })
    : Promise.resolve();
  trackBarHeight({
    setHeight: (next) => {
      height = next;
      log.push(`height ${next}`);
    },
    onChange: (next) => {
      listener = next;
    },
    scrollPadding: () => height + 38,
    landing: () =>
      top === null
        ? null
        : { top: () => top!, scrollInto: () => log.push("scrolled to it") },
    settled: () => arrived,
  });
  return {
    log,
    change: async (next: number) => {
      await listener(next);
    },
    moveLanding: (to: number) => {
      top = to;
    },
    arrive: () => arrive(),
  };
}

describe("trackBarHeight", () => {
  it("sets the height each time the bar reports one", async () => {
    const bar = page();
    await bar.change(59);
    await bar.change(97);
    expect(bar.log).toEqual(["height 59", "height 97"]);
  });

  it("brings a section the page landed on from under the bar, once the real height is known", async () => {
    // A link to /#projects scrolled with the offset the stylesheet started with (96), and the bar
    // turned out taller: the section sits at 96 where the offset is now 135.
    const bar = page({ landingTop: 96 });
    await bar.change(97);
    expect(bar.log).toEqual(["height 97", "scrolled to it"]);
  });

  it("looks for the section only once the browser has finished its own scroll to it", async () => {
    // The first height arrives before the browser has scrolled at all: the section is far down.
    const bar = page({ landingTop: 1200, held: true });
    const reported = bar.change(97);
    bar.moveLanding(96);
    bar.arrive();
    await reported;
    expect(bar.log).toEqual(["height 97", "scrolled to it"]);
  });

  it("leaves a section that already clears the bar where it is", async () => {
    // Rounding: a 59 px bar against the 58 px the stylesheet starts with.
    const bar = page({ landingTop: 96 });
    await bar.change(59);
    expect(bar.log).toEqual(["height 59"]);
  });

  it("scrolls to the landing section only for the first height, not once the visitor is reading", async () => {
    const bar = page({ landingTop: 96 });
    await bar.change(97);
    bar.moveLanding(10);
    await bar.change(103);
    expect(bar.log).toEqual(["height 97", "scrolled to it", "height 103"]);
  });

  it("leaves the visitor's place where the browser restored it, far from the section the address names", async () => {
    const bar = page({ landingTop: -600 });
    await bar.change(97);
    expect(bar.log).toEqual(["height 97"]);
  });

  it("does nothing more where the page landed on no section", async () => {
    const bar = page({ landingTop: null });
    await bar.change(97);
    expect(bar.log).toEqual(["height 97"]);
  });
});

/**
 * A window 800 px tall whose scroll offset is 135 px (a 97 px bar and the 38 px under it), so the
 * room below the bar is 665 px. `focus` moves the keyboard focus to a control at `top`, `height` tall.
 */
function focusPage() {
  const log: string[] = [];
  let listener: (control: FocusedControl) => unknown = () => {
    throw new Error("nothing is listening");
  };
  keepFocusClear({
    onKeyboardFocus: (next) => {
      listener = next;
    },
    scrollPadding: () => 135,
    viewportHeight: () => 800,
  });
  return {
    log,
    focus: (top: number, height: number) =>
      listener({
        top: () => top,
        height: () => height,
        scrollInto: () => log.push(`scrolled to the control at ${top}`),
      }),
  };
}

describe("keepFocusClear", () => {
  it("brings the top of a control taller than the room below the bar out from under it", () => {
    // A run-sheet strip at a phone's width with a visitor's text spacing: the browser does not
    // scroll to a control that already fills the room, so its title stays under the bar.
    const page = focusPage();
    page.focus(47, 842);
    expect(page.log).toEqual(["scrolled to the control at 47"]);
  });

  it("brings a tall control's top into view when it lies above the window, as after Shift+Tab", () => {
    const page = focusPage();
    page.focus(-400, 1230);
    expect(page.log).toEqual(["scrolled to the control at -400"]);
  });

  it("leaves a control that fits the room to the browser, which the scroll offset already guides", () => {
    const page = focusPage();
    page.focus(47, 150);
    expect(page.log).toEqual([]);
  });

  it("brings a tall control's top to the offset from lower down too, where the browser would centre it", () => {
    // Centred in the room, a control taller than the room has its top under the bar.
    const page = focusPage();
    page.focus(1366, 842);
    page.focus(400, 842);
    expect(page.log).toEqual([
      "scrolled to the control at 1366",
      "scrolled to the control at 400",
    ]);
  });

  it("leaves a tall control whose top is already at the offset, allowing for rounding", () => {
    const page = focusPage();
    page.focus(135, 842);
    page.focus(134, 842);
    page.focus(136, 842);
    expect(page.log).toEqual([]);
  });
});
