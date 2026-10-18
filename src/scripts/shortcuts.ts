// The keyboard-shortcut switch in the footer (WCAG 2.1.4, Character Key Shortcuts): a visitor can
// turn the single-key shortcuts off. The choice is one attribute on <html>, data-shortcuts, that
// the navigation (1–5) and inspect mode (i) read, and CSS reads it to hide the number hints.
// Everything here takes its parts as arguments, so it runs under test without a browser.

export const STORAGE_KEY = "keyboard-shortcuts";

interface ReadableStorage {
  getItem(key: string): string | null;
}
interface WritableStorage {
  setItem(key: string, value: string): void;
}

/** Shortcuts are on unless the visitor turned them off. Blocked storage means on. */
export function loadShortcuts(storage: ReadableStorage | undefined): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Remembers the choice. Where storage is blocked, the choice lasts for the page and no longer. */
export function saveShortcuts(
  storage: WritableStorage | undefined,
  enabled: boolean,
): void {
  try {
    storage?.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Blocked site data: nothing to remember it in.
  }
}

/** Reading localStorage itself throws when site data is blocked. */
export function getStorage(win: {
  localStorage: ReadableStorage & WritableStorage;
}): (ReadableStorage & WritableStorage) | undefined {
  try {
    return win.localStorage;
  } catch {
    return undefined;
  }
}

/** For the scripts that act on a key: a page the switch has not run on counts as on. */
export function shortcutsEnabled(root: {
  dataset: Record<string, string | undefined>;
}): boolean {
  return root.dataset.shortcuts !== "off";
}

interface SwitchPage {
  storage: (ReadableStorage & WritableStorage) | undefined;
  /** <html>, where the state lives. */
  root: { dataset: Record<string, string | undefined> };
  button: {
    hidden: boolean | string;
    setAttribute(name: string, value: string): void;
    addEventListener(type: "click", listener: () => void): void;
  };
  /** The word "on" or "off" inside the button's label. */
  state: { textContent: string | null };
}

/** Wires the footer button: shows it, applies the remembered choice, and flips it on a click. */
export function initShortcutSwitch(page: SwitchPage): void {
  const apply = (enabled: boolean) => {
    page.root.dataset.shortcuts = enabled ? "on" : "off";
    page.button.setAttribute("aria-pressed", String(enabled));
    page.state.textContent = enabled ? "on" : "off";
  };

  apply(loadShortcuts(page.storage));
  // Without script there are no shortcuts, so the button stays hidden until this runs.
  page.button.hidden = false;
  page.button.addEventListener("click", () => {
    const enabled = !shortcutsEnabled(page.root);
    apply(enabled);
    saveShortcuts(page.storage, enabled);
  });
}
