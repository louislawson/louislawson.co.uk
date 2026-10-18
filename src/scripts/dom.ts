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
