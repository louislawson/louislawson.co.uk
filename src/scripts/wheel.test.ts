import { describe, expect, it } from "vitest";
import {
  FIRST_TICK,
  FRAME_MS,
  HEIGHT,
  RAMP,
  WIDTH,
  frame,
  frameDue,
  initWheel,
  shouldRun,
  type WheelPage,
} from "./wheel";

const lines = (text: string) => text.replace(/\n$/, "").split("\n");
const glyphs = (text: string) => text.replace(/[ \n]/g, "").length;

describe("frame(t)", () => {
  it("is a grid of 64 columns by 30 rows, each row ended by a line break", () => {
    const rows = lines(frame(FIRST_TICK));
    expect(WIDTH).toBe(64);
    expect(HEIGHT).toBe(30);
    expect(rows).toHaveLength(30);
    for (const row of rows) expect(row).toHaveLength(64);
    expect(frame(FIRST_TICK).endsWith("\n")).toBe(true);
  });

  it("uses only spaces and the characters of the ramp", () => {
    for (const t of [0, FIRST_TICK, 400]) {
      for (const char of frame(t).replace(/\n/g, "")) {
        expect(" " + RAMP, `tick ${t}`).toContain(char);
      }
    }
  });

  it("is the same text every time it is asked for the same tick, so the build and the browser agree", () => {
    for (const t of [0, 1, FIRST_TICK, 250]) expect(frame(t)).toBe(frame(t));
  });

  it("draws a wheel and not an empty box, at any tick", () => {
    for (const t of [0, 7, FIRST_TICK, 120, 999]) {
      const count = glyphs(frame(t));
      // A tyre, a rim, five spokes and a hub: well over a few cells, well under the whole grid.
      expect(count, `tick ${t}`).toBeGreaterThan(300);
      expect(count, `tick ${t}`).toBeLessThan(WIDTH * HEIGHT * 0.8);
    }
  });

  it("has the hub at the middle of the grid", () => {
    const row = lines(frame(FIRST_TICK))[HEIGHT / 2]!;
    expect(row.slice(WIDTH / 2 - 3, WIDTH / 2 + 3).trim()).not.toBe("");
  });

  it("stays inside the grid: nothing is drawn against the left or right edge", () => {
    for (const t of [0, FIRST_TICK, 120, 300]) {
      const rows = lines(frame(t));
      expect(
        rows
          .map((r) => r[0])
          .join("")
          .trim(),
        `tick ${t}`,
      ).toBe("");
      expect(
        rows
          .map((r) => r[WIDTH - 1])
          .join("")
          .trim(),
        `tick ${t}`,
      ).toBe("");
    }
  });

  it("moves: the wheel rolls and turns from one tick to the next", () => {
    expect(frame(FIRST_TICK + 1)).not.toBe(frame(FIRST_TICK));
    expect(frame(0)).not.toBe(frame(100));
  });
});

describe("frameDue", () => {
  it("is due once more than the frame time has passed since the last frame", () => {
    expect(FRAME_MS).toBe(33);
    expect(frameDue(1000 + FRAME_MS + 1, 1000)).toBe(true);
    expect(frameDue(5000, 1000)).toBe(true);
  });

  it("is not due sooner, which holds the loop to about 30 frames a second", () => {
    expect(frameDue(1000, 1000)).toBe(false);
    expect(frameDue(1016, 1000)).toBe(false);
    expect(frameDue(1000 + FRAME_MS, 1000)).toBe(false);
  });
});

describe("shouldRun", () => {
  const base = { reducedMotion: false, onScreen: true, tabHidden: false };

  it("runs when the wheel is on screen in a visible tab", () => {
    expect(shouldRun(base)).toBe(true);
  });

  it("does not run under reduced motion", () => {
    expect(shouldRun({ ...base, reducedMotion: true })).toBe(false);
  });

  it("does not run off-screen", () => {
    expect(shouldRun({ ...base, onScreen: false })).toBe(false);
  });

  it("does not run in a hidden tab", () => {
    expect(shouldRun({ ...base, tabHidden: true })).toBe(false);
  });
});

/** A page that records what the loop asks of it, and lets a test play the browser's part. */
function fakePage(options: { reducedMotion?: boolean; hidden?: boolean } = {}) {
  const queue = new Map<number, (now: number) => void>();
  let nextHandle = 1;
  let report: ((onScreen: boolean) => void) | undefined;
  let visibilityChanged: (() => void) | undefined;
  const state = {
    reducedMotion: options.reducedMotion ?? false,
    hidden: options.hidden ?? false,
  };
  const drawn: string[] = [];
  const page: WheelPage = {
    reducedMotion: () => state.reducedMotion,
    tabHidden: () => state.hidden,
    watchOnScreen: (listener) => {
      report = listener;
    },
    watchTab: (listener) => {
      visibilityChanged = listener;
    },
    requestFrame: (callback) => {
      const handle = nextHandle++;
      queue.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      queue.delete(handle);
    },
    draw: (text) => {
      drawn.push(text);
    },
  };
  return {
    page,
    drawn,
    state,
    pending: () => queue.size,
    onScreen: (value: boolean) => report?.(value),
    tab: (hidden: boolean) => {
      state.hidden = hidden;
      visibilityChanged?.();
    },
    /** The browser paints once: every callback asked for so far runs at this time. */
    paint: (now: number) => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(now);
    },
    watching: () => report !== undefined || visibilityChanged !== undefined,
  };
}

describe("initWheel", () => {
  it("draws nothing and asks for nothing until the wheel is on screen", () => {
    const fake = fakePage();
    initWheel(fake.page);
    expect(fake.pending()).toBe(0);
    expect(fake.drawn).toEqual([]);
  });

  it("starts at the tick after the one the build drew, so the first moving frame follows the still one", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.paint(1000);
    expect(fake.drawn).toEqual([frame(FIRST_TICK + 1)]);
  });

  it("draws about once every 33ms and skips the paints in between", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.paint(1000);
    fake.paint(1016);
    fake.paint(1032);
    expect(fake.drawn).toHaveLength(1);
    fake.paint(1034);
    expect(fake.drawn).toEqual([frame(FIRST_TICK + 1), frame(FIRST_TICK + 2)]);
  });

  it("keeps asking for the next paint while it runs", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    for (let now = 1000; now < 1200; now += 16) {
      fake.paint(now);
      expect(fake.pending()).toBe(1);
    }
  });

  it("stops when the wheel leaves the screen, and cancels the paint it asked for", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.paint(1000);
    fake.onScreen(false);
    expect(fake.pending()).toBe(0);
    const count = fake.drawn.length;
    fake.paint(2000);
    expect(fake.drawn).toHaveLength(count);
  });

  it("carries on from the tick it stopped at when it comes back", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.paint(1000);
    fake.onScreen(false);
    fake.onScreen(true);
    fake.paint(9000);
    expect(fake.drawn).toEqual([frame(FIRST_TICK + 1), frame(FIRST_TICK + 2)]);
  });

  it("stops in a hidden tab and starts again when the tab is shown", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.paint(1000);
    fake.tab(true);
    expect(fake.pending()).toBe(0);
    fake.tab(false);
    expect(fake.pending()).toBe(1);
  });

  it("does not start in a hidden tab, even when the wheel is on screen", () => {
    const fake = fakePage({ hidden: true });
    initWheel(fake.page);
    fake.onScreen(true);
    expect(fake.pending()).toBe(0);
    fake.tab(false);
    expect(fake.pending()).toBe(1);
  });

  it("does not start a second loop when it is stopped and started again before a paint", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.onScreen(false);
    fake.onScreen(true);
    fake.tab(true);
    fake.tab(false);
    expect(fake.pending()).toBe(1);
    fake.paint(1000);
    fake.paint(1034);
    expect(fake.drawn).toHaveLength(2);
  });

  it("ignores a repeat of the same report", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.onScreen(true);
    expect(fake.pending()).toBe(1);
  });

  describe("under reduced motion", () => {
    it("does nothing: no listener, no paint requested, nothing drawn", () => {
      const fake = fakePage({ reducedMotion: true });
      initWheel(fake.page);
      fake.onScreen(true);
      fake.tab(false);
      fake.paint(1000);
      expect(fake.watching()).toBe(false);
      expect(fake.pending()).toBe(0);
      expect(fake.drawn).toEqual([]);
    });
  });

  it("stops if reduced motion is switched on while it runs", () => {
    const fake = fakePage();
    initWheel(fake.page);
    fake.onScreen(true);
    fake.paint(1000);
    fake.state.reducedMotion = true;
    fake.paint(1100);
    expect(fake.drawn).toHaveLength(1);
    expect(fake.pending()).toBe(0);
  });
});
