import { describe, expect, it } from "vitest";
import {
  INITIAL_SWAP,
  isShowing,
  swapStep,
  type SwapEvent,
  type SwapState,
} from "./photo-swap";

/** Plays the events in order, returning the last step and every step's `load` and `preventDefault`. */
function play(events: SwapEvent[], from: SwapState = INITIAL_SWAP) {
  let state = from;
  const steps = events.map((event) => {
    const step = swapStep(state, event);
    state = step.state;
    return step;
  });
  return {
    state,
    last: steps[steps.length - 1]!,
    loads: steps.map((s) => s.load),
    prevents: steps.map((s) => s.preventDefault),
  };
}

const mouse = (type: "pointerenter" | "pointerleave" | "pointerdown") =>
  ({ type, pointerType: "mouse" }) as const;
const touch = (type: "pointerenter" | "pointerleave" | "pointerdown") =>
  ({ type, pointerType: "touch" }) as const;

describe("a card's photo swap", () => {
  it("starts on the dither, with nothing loaded", () => {
    expect(isShowing(INITIAL_SWAP)).toBe(false);
    expect(INITIAL_SWAP.loaded).toBe(false);
  });

  describe("with a mouse", () => {
    it("shows the photo, and asks for it, when the pointer comes in", () => {
      const { last } = play([mouse("pointerenter")]);
      expect(last.showing).toBe(true);
      expect(last.load).toBe(true);
    });

    it("goes back to the dither when the pointer leaves", () => {
      const { last } = play([mouse("pointerenter"), mouse("pointerleave")]);
      expect(last.showing).toBe(false);
    });

    it("asks for the photo only once, however often the pointer comes in", () => {
      const { loads } = play([
        mouse("pointerenter"),
        mouse("pointerleave"),
        mouse("pointerenter"),
        mouse("pointerleave"),
        mouse("pointerenter"),
      ]);
      expect(loads.filter(Boolean)).toHaveLength(1);
    });

    it("treats a pen as a mouse", () => {
      const { last } = play([{ type: "pointerenter", pointerType: "pen" }]);
      expect(last.showing).toBe(true);
    });

    it("follows the link, and does not stop it, when it is clicked over the photo", () => {
      const { prevents } = play([mouse("pointerenter"), { type: "click" }]);
      expect(prevents).toEqual([false, false]);
    });
  });

  describe("with the keyboard", () => {
    it("shows the photo, and asks for it, on focus", () => {
      const { last } = play([{ type: "focus" }]);
      expect(last.showing).toBe(true);
      expect(last.load).toBe(true);
    });

    it("goes back to the dither on blur", () => {
      const { last } = play([{ type: "focus" }, { type: "blur" }]);
      expect(last.showing).toBe(false);
    });

    it("keeps the photo while the pointer has left but the link still has focus", () => {
      const { last } = play([
        { type: "focus" },
        mouse("pointerenter"),
        mouse("pointerleave"),
      ]);
      expect(last.showing).toBe(true);
    });

    it("follows the link when it is activated with Enter, which arrives as a click on a link that has focus", () => {
      const { prevents } = play([{ type: "focus" }, { type: "click" }]);
      expect(prevents).toEqual([false, false]);
    });
  });

  describe("with a finger", () => {
    it("does not swap on the pointer coming in: a tap is decided by the click", () => {
      const { last } = play([touch("pointerenter")]);
      expect(last.showing).toBe(false);
      expect(last.load).toBe(false);
    });

    it("swaps the photo in place on the first tap, and keeps the link from opening it", () => {
      const { last, prevents } = play([
        touch("pointerenter"),
        touch("pointerdown"),
        { type: "click" },
      ]);
      expect(last.showing).toBe(true);
      expect(last.load).toBe(true);
      expect(prevents[2]).toBe(true);
    });

    it("opens the photo on the second tap", () => {
      const { prevents } = play([
        touch("pointerdown"),
        { type: "click" },
        touch("pointerdown"),
        { type: "click" },
      ]);
      expect(prevents).toEqual([false, true, false, false]);
    });

    it("does not let the focus a tap may bring decide for it, so the first tap still swaps in place", () => {
      const { prevents, last } = play([
        touch("pointerdown"),
        { type: "focus" },
        { type: "click" },
      ]);
      expect(prevents[2]).toBe(true);
      expect(last.showing).toBe(true);
    });

    it("goes back to the dither when the link loses focus", () => {
      const { last } = play([
        touch("pointerdown"),
        { type: "click" },
        { type: "blur" },
      ]);
      expect(last.showing).toBe(false);
    });

    it("asks for the photo once across the taps", () => {
      const { loads } = play([
        touch("pointerdown"),
        { type: "click" },
        { type: "blur" },
        touch("pointerdown"),
        { type: "click" },
      ]);
      expect(loads.filter(Boolean)).toHaveLength(1);
    });
  });

  it("does not stay mid-tap after a touch that turned into a scroll, so the keyboard still works", () => {
    const { last } = play([
      touch("pointerdown"),
      { type: "pointercancel", pointerType: "touch" },
      { type: "focus" },
    ]);
    expect(last.showing).toBe(true);
  });

  it("never asks for the photo until something asks to see it", () => {
    const { loads } = play([
      touch("pointerenter"),
      mouse("pointerleave"),
      { type: "blur" },
    ]);
    expect(loads).toEqual([false, false, false]);
  });
});
