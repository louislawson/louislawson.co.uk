// The two browser events the shortcut scripts share, mapped to the plain shapes they take. The
// scripts themselves run under test without a browser; this is the thin part that needs one.
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
