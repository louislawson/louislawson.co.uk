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
  | {
      type: "click";
      /** What made the click, when the browser says: "touch" for a tap, "" for a keyboard or an assistive technology. */
      pointerType?: string | undefined;
    }
  | {
      /** `keydown` is any key on the page; `outside` is a press that landed outside this card. */
      type: "focus" | "blur" | "keydown" | "outside";
    };

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

/** Only a mouse or a pen can hover. A pointer that does not say what it is is not taken for one. */
const hovers = (pointerType: string) =>
  pointerType === "mouse" || pointerType === "pen";
const isTouch = (pointerType: string | undefined) => pointerType === "touch";

/**
 * What an event does to a card. Hover, keyboard focus and a first tap show the photo. A click that
 * finds the photo already showing follows the link, which opens it. A click that finds the dither
 * and is a tap only swaps the photo in place, which is what a first tap on a phone is; any other
 * click on the dither, such as a screen reader's or a keyboard's, follows the link.
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
      // A press with a mouse or a pen ends whatever a touch left behind.
      if (isTouch(event.pointerType)) next = { ...state, touching: true };
      else if (hovers(event.pointerType)) next = { ...state, touching: false };
      break;
    case "pointercancel":
      // The touch became a scroll or a pinch: there will be no click.
      if (isTouch(event.pointerType)) next = { ...state, touching: false };
      break;
    case "keydown":
      // The keyboard is in use. A touch that ended with no click, such as a long press, is over.
      next = { ...state, touching: false };
      break;
    case "focus":
      // A tap can bring focus before its click, which would make the first tap open the photo.
      if (!state.touching) next = { ...state, focused: true };
      break;
    case "blur":
      next = { ...state, focused: false, pinned: false };
      break;
    case "outside":
      // A phone's browser may never blur a tapped link, so a press elsewhere lets the photo go.
      next = { ...state, pinned: false };
      break;
    case "click":
      if (!isShowing(state) && (state.touching || isTouch(event.pointerType))) {
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
