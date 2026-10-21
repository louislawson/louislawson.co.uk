import { describe, expect, it } from "vitest";
import { trackBarHeight } from "./bar-height";

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
