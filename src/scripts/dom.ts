// The browser events and measurements the page scripts share, mapped to the plain shapes they take. The
// scripts themselves run under test without a browser; this is the thin part that needs one.
import type { FocusedControl } from "./bar-height";
import type { KeyEvent, KeyTarget } from "./keys";

/** Calls `listener` for each keydown anywhere on the page. */
export function onKeydown(
  listener: (event: KeyEvent & { target: KeyTarget | null }) => void,
): void {
  document.addEventListener("keydown", (event) =>
    listener({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
      isComposing: event.isComposing,
      target: event.target as HTMLElement | null,
    }),
  );
}

/** Calls `listener` whenever data-shortcuts on <html> changes: the footer switch was used. */
export function onShortcutsChange(listener: () => void): void {
  new MutationObserver(listener).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-shortcuts"],
  });
}

/**
 * Calls `listener` each time the keyboard focus moves to a control outside `bar`. It waits a frame,
 * so the browser has asked for its own scroll to the control first and a scroll the listener asks
 * for takes its place, and skips a control the focus has already left. A click focuses without
 * :focus-visible, so a pointer never scrolls the page.
 */
export function onKeyboardFocus(
  bar: HTMLElement,
  listener: (control: FocusedControl) => void,
): void {
  document.addEventListener("focusin", (event) => {
    const control = event.target;
    if (!(control instanceof HTMLElement) || bar.contains(control)) return;
    if (!control.matches(":focus-visible")) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== control) return;
      listener({
        top: () => control.getBoundingClientRect().top,
        height: () => control.getBoundingClientRect().height,
        scrollInto: () => control.scrollIntoView({ block: "start" }),
      });
    });
  });
}

/** Calls `listener` with the element's height now and each time it changes. */
export function onHeightChange(
  element: HTMLElement,
  listener: (height: number) => void,
): void {
  new ResizeObserver(() =>
    listener(Math.ceil(element.getBoundingClientRect().height)),
  ).observe(element);
}

/**
 * Resolves once the document has loaded and the page has not scrolled for ten frames: the browser's
 * own scroll to an address's #section starts after the load and may be smooth. A page that keeps
 * scrolling (the visitor is reading) is given up on after three seconds of frames.
 */
export function scrollSettled(): Promise<void> {
  const loaded =
    document.readyState === "complete"
      ? Promise.resolve()
      : new Promise<void>((resolve) =>
          addEventListener("load", () => resolve(), { once: true }),
        );
  return loaded.then(
    () =>
      new Promise<void>((resolve) => {
        let last = Number.NaN;
        let still = 0;
        let frames = 0;
        const frame = () => {
          frames += 1;
          still = scrollY === last ? still + 1 : 0;
          last = scrollY;
          if (still >= 10 || frames >= 180) resolve();
          else requestAnimationFrame(frame);
        };
        frame();
      }),
  );
}
