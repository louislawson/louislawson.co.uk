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

  describe("review cases", () => {
    it("lets the keyboard work after a touch that ended with neither a click nor a cancel, such as a long press", () => {
      const { last } = play([
        touch("pointerdown"),
        { type: "keydown" },
        { type: "focus" },
      ]);
      expect(last.showing).toBe(true);
    });

    it("lets the keyboard work after a mouse press that follows a touch", () => {
      const { last } = play([
        touch("pointerdown"),
        mouse("pointerdown"),
        { type: "focus" },
      ]);
      expect(last.showing).toBe(true);
    });

    it("lets go of a tapped photo when a press lands anywhere else, because a phone's browser may never blur a link", () => {
      const { last } = play([
        touch("pointerdown"),
        { type: "click" },
        { type: "outside" },
      ]);
      expect(last.showing).toBe(false);
    });

    it("keeps the photo of a link that still has keyboard focus when a press lands elsewhere and focus has not moved", () => {
      const { last } = play([{ type: "focus" }, { type: "outside" }]);
      expect(last.showing).toBe(true);
    });

    it("ends a touch left half-finished when a press lands elsewhere, so the keyboard still works on this card", () => {
      const { last } = play([
        touch("pointerdown"),
        { type: "outside" },
        { type: "focus" },
      ]);
      expect(last.showing).toBe(true);
    });

    it("takes a click that says it is a touch as a tap even if no pointerdown was seen", () => {
      const { prevents } = play([{ type: "click", pointerType: "touch" }]);
      expect(prevents).toEqual([true]);
    });

    it("follows the link on a click that is not a touch and has no hover or focus, as a screen reader's activation is", () => {
      const { prevents, last } = play([{ type: "click", pointerType: "" }]);
      expect(prevents).toEqual([false]);
      expect(last.showing).toBe(false);
    });

    it("does not take a pointer that does not say what it is as one that can hover", () => {
      const { last } = play([{ type: "pointerenter", pointerType: "" }]);
      expect(last.showing).toBe(false);
      expect(last.load).toBe(false);
    });
  });

  describe("the photo's loading", () => {
    // The photo is made when it is first wanted and covers the dither only once it can paint, so
    // the card is never blank. If it fails it is tried again the next time it is wanted afresh, and
    // not by every key and press on the page while it is still wanted.
    it("is wanted but not visible while it loads: the dither stays", () => {
      const { last } = play([mouse("pointerenter")]);
      expect(last.showing).toBe(true);
      expect(last.visible).toBe(false);
    });

    it("is visible once it has loaded and is wanted", () => {
      const { last } = play([mouse("pointerenter"), { type: "photoload" }]);
      expect(last.visible).toBe(true);
    });

    it("is not visible when it loads after it stopped being wanted, and is when it is wanted again", () => {
      const { last, loads } = play([
        mouse("pointerenter"),
        mouse("pointerleave"),
        { type: "photoload" },
      ]);
      expect(last.visible).toBe(false);
      const again = play([mouse("pointerenter")], last.state);
      expect(again.last.visible).toBe(true);
      expect(again.loads).toEqual([false]);
      expect(loads.filter(Boolean)).toHaveLength(1);
    });

    it("is never visible when it failed", () => {
      const { last } = play([mouse("pointerenter"), { type: "photoerror" }]);
      expect(last.showing).toBe(true);
      expect(last.visible).toBe(false);
    });

    it("is not tried again by a key, a press elsewhere or a click while it is still wanted", () => {
      const { loads } = play([
        mouse("pointerenter"),
        { type: "photoerror" },
        { type: "keydown" },
        { type: "outside" },
        { type: "click", pointerType: "" },
        { type: "keydown" },
      ]);
      expect(loads).toEqual([true, false, false, false, false, false]);
    });

    it("is tried again when it is next wanted afresh", () => {
      const { loads, last } = play([
        mouse("pointerenter"),
        { type: "photoerror" },
        mouse("pointerleave"),
        mouse("pointerenter"),
      ]);
      expect(loads).toEqual([true, false, false, true]);
      expect(last.visible).toBe(false);
      const loaded = play([{ type: "photoload" }], last.state);
      expect(loaded.last.visible).toBe(true);
    });

    it("is tried again for keyboard focus after it failed for a hover", () => {
      const { loads } = play([
        mouse("pointerenter"),
        { type: "photoerror" },
        mouse("pointerleave"),
        { type: "focus" },
      ]);
      expect(loads).toEqual([true, false, false, true]);
    });

    it("is tried only once for each time it is wanted afresh, however often it then fails", () => {
      const { loads } = play([
        mouse("pointerenter"),
        { type: "photoerror" },
        mouse("pointerleave"),
        mouse("pointerenter"),
        { type: "photoerror" },
        { type: "keydown" },
        { type: "keydown" },
      ]);
      expect(loads).toEqual([true, false, false, true, false, false, false]);
    });

    it("is tried again for a tap after it failed, and the tap swaps in place", () => {
      const { loads, prevents } = play([
        touch("pointerdown"),
        { type: "click" },
        { type: "photoerror" },
        { type: "blur" },
        touch("pointerdown"),
        { type: "click" },
      ]);
      expect(loads).toEqual([false, true, false, false, false, true]);
      expect(prevents[5]).toBe(true);
    });
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
