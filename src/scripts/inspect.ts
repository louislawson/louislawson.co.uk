// Inspect mode: the button and the i key turn a class on <body>, and the CSS in global.css shows
// each labelled part of the page outlined, with how it is built and served, over a 12-column grid.
// Like the other scripts, this takes its parts as arguments and runs under test without a browser.
import { plainKey, type KeyEvent, type KeyTarget } from "./keys";
import { shortcutsEnabled } from "./shortcuts";

/** The class on <body> while inspect mode is on. */
export const INSPECTING = "inspecting";

export interface InspectPage {
  body: { classList: { toggle(name: string): boolean } };
  /** <html>, where the footer switch keeps data-shortcuts. */
  root: { dataset: Record<string, string | undefined> };
  button: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    addEventListener(type: "click", listener: () => void): void;
  };
  /**
   * The words at the start of the note in the live region. Changing them is what announces the
   * change: the region is always in the page, so a screen reader notices its text change, which it
   * would not for a part that goes from hidden to shown.
   */
  state: { textContent: string | null };
  onKeydown(
    listener: (event: KeyEvent & { target: KeyTarget | null }) => void,
  ): void;
  /** Called when data-shortcuts on <html> changes. */
  onShortcutsChange(listener: () => void): void;
}

/** Wires up the inspect button and the i key. */
export function initInspect(page: InspectPage): void {
  const { button, root } = page;

  const toggle = () => {
    const on = page.body.classList.toggle(INSPECTING);
    button.setAttribute("aria-pressed", String(on));
    page.state.textContent = on
      ? "Inspect mode is on."
      : "Inspect mode is off.";
  };

  button.setAttribute("aria-pressed", "false");
  // The button holds its place in the bar from the first paint and shows once this runs.
  button.removeAttribute("data-pending");
  button.addEventListener("click", toggle);

  // The hint is announced only while the shortcut works.
  const syncHint = () => {
    if (shortcutsEnabled(root)) button.setAttribute("aria-keyshortcuts", "i");
    else button.removeAttribute("aria-keyshortcuts");
  };
  syncHint();
  page.onShortcutsChange(syncHint);

  page.onKeydown((event) => {
    if (!shortcutsEnabled(root)) return;
    if (plainKey(event, event.target)?.toLowerCase() === "i") toggle();
  });
}
