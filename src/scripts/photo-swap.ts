// When a garage card swaps its dither for the full-colour photo. The rules are plain functions of the
// card's state and an event, like nav.ts and wheel.ts, so they run under test without a browser; the
// card's script feeds them the browser's events and does what they say.

export interface SwapState {
  /** The photo has been asked for: it is downloaded once, the first time it is wanted. */
  loaded: boolean;
  /** A mouse or pen is over the card. */
  hovered: boolean;
  /** The card's link has keyboard focus. */
  focused: boolean;
  /** A tap swapped the photo in, and it stays until the link loses focus. */
  pinned: boolean;
  /** A finger is in the middle of a tap. */
  touching: boolean;
}

export const INITIAL_SWAP: SwapState = {
  loaded: false,
  hovered: false,
  focused: false,
  pinned: false,
  touching: false,
};

export type SwapEvent =
  | {
      type: "pointerenter" | "pointerleave" | "pointerdown" | "pointercancel";
      pointerType: string;
    }
  | { type: "focus" | "blur" | "click" };

export interface SwapStep {
  state: SwapState;
  /** Whether the card shows the photo (true) or the dither (false) after this event. */
  showing: boolean;
  /** Ask for the photo now: it is wanted and has not been asked for yet. */
  load: boolean;
  /** Keep the link from opening the photo: this click only swaps it in place. */
  preventDefault: boolean;
}

export function isShowing(state: SwapState): boolean {
  return state.hovered || state.focused || state.pinned;
}

/** A mouse or a pen can hover. A finger cannot, and its tap is decided by the click. */
const hovers = (pointerType: string) => pointerType !== "touch";

/**
 * What an event does to a card. Hover, keyboard focus and a first tap show the photo. A click that
 * finds the photo already showing follows the link, which opens it; a click that finds the dither
 * only swaps the photo in place, which is what a first tap on a phone is.
 */
export function swapStep(state: SwapState, event: SwapEvent): SwapStep {
  let next = state;
  let preventDefault = false;
  switch (event.type) {
    case "pointerenter":
      if (hovers(event.pointerType)) next = { ...state, hovered: true };
      break;
    case "pointerleave":
      if (hovers(event.pointerType)) next = { ...state, hovered: false };
      break;
    case "pointerdown":
      if (!hovers(event.pointerType)) next = { ...state, touching: true };
      break;
    case "pointercancel":
      // The touch became a scroll or a pinch: there will be no click.
      if (!hovers(event.pointerType)) next = { ...state, touching: false };
      break;
    case "focus":
      // A tap can bring focus before its click, which would make the first tap open the photo.
      if (!state.touching) next = { ...state, focused: true };
      break;
    case "blur":
      next = { ...state, focused: false, pinned: false };
      break;
    case "click":
      if (!isShowing(state)) {
        preventDefault = true;
        next = { ...state, pinned: true, touching: false };
      } else {
        next = { ...state, touching: false };
      }
      break;
  }
  const showing = isShowing(next);
  const load = showing && !next.loaded;
  return {
    state: load ? { ...next, loaded: true } : next,
    showing,
    load,
    preventDefault,
  };
}
