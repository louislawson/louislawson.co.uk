import { describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  getStorage,
  initShortcutSwitch,
  loadShortcuts,
  saveShortcuts,
  shortcutsEnabled,
} from "./shortcuts";

/** A storage that remembers, or one that refuses, as a browser with blocked site data does. */
function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(STORAGE_KEY, initial);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const blockedStorage = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

describe("loadShortcuts", () => {
  it("is on unless the visitor turned it off", () => {
    expect(loadShortcuts(memoryStorage())).toBe(true);
    expect(loadShortcuts(memoryStorage("on"))).toBe(true);
    expect(loadShortcuts(memoryStorage("off"))).toBe(false);
  });

  it("is on for a value it does not know", () => {
    expect(loadShortcuts(memoryStorage("maybe"))).toBe(true);
    expect(loadShortcuts(memoryStorage(""))).toBe(true);
  });

  it("is on when storage is blocked or missing", () => {
    expect(loadShortcuts(blockedStorage)).toBe(true);
    expect(loadShortcuts(undefined)).toBe(true);
  });
});

describe("saveShortcuts", () => {
  it("remembers the choice", () => {
    const storage = memoryStorage();
    saveShortcuts(storage, false);
    expect(storage.values.get(STORAGE_KEY)).toBe("off");
    saveShortcuts(storage, true);
    expect(storage.values.get(STORAGE_KEY)).toBe("on");
  });

  it("does not throw when storage is blocked or missing", () => {
    expect(() => saveShortcuts(blockedStorage, false)).not.toThrow();
    expect(() => saveShortcuts(undefined, false)).not.toThrow();
  });
});

describe("getStorage", () => {
  it("is the window's localStorage", () => {
    const storage = memoryStorage();
    expect(getStorage({ localStorage: storage })).toBe(storage);
  });

  it("is nothing when reading localStorage throws, as it does with site data blocked", () => {
    const win = {
      get localStorage(): never {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(getStorage(win)).toBeUndefined();
  });
});

describe("the switch", () => {
  /** The few parts of the page the switch touches, as plain objects. */
  function page(
    storage: ReturnType<typeof memoryStorage> | typeof blockedStorage,
  ) {
    const clicks: (() => void)[] = [];
    const attributes: Record<string, string> = { "aria-pressed": "true" };
    const root = { dataset: {} as Record<string, string | undefined> };
    const button = {
      hidden: true,
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
      addEventListener: (_type: "click", listener: () => void) => {
        clicks.push(listener);
      },
    };
    const state = { textContent: "on" };
    initShortcutSwitch({ storage, root, button, state });
    return { root, button, state, attributes, click: () => clicks[0]!() };
  }

  it("shows on a first visit, with the button revealed", () => {
    const { root, button, state, attributes } = page(memoryStorage());
    expect(shortcutsEnabled(root)).toBe(true);
    expect(root.dataset.shortcuts).toBe("on");
    expect(state.textContent).toBe("on");
    expect(attributes["aria-pressed"]).toBe("true");
    // The button is hidden until the script runs, because without it there are no shortcuts.
    expect(button.hidden).toBe(false);
  });

  it("starts off for a visitor who turned it off", () => {
    const { root, state, attributes } = page(memoryStorage("off"));
    expect(shortcutsEnabled(root)).toBe(false);
    expect(root.dataset.shortcuts).toBe("off");
    expect(state.textContent).toBe("off");
    expect(attributes["aria-pressed"]).toBe("false");
  });

  it("turns off and on again, and remembers each choice", () => {
    const storage = memoryStorage();
    const { root, state, attributes, click } = page(storage);

    click();
    expect(shortcutsEnabled(root)).toBe(false);
    expect(state.textContent).toBe("off");
    expect(attributes["aria-pressed"]).toBe("false");
    expect(storage.values.get(STORAGE_KEY)).toBe("off");

    click();
    expect(shortcutsEnabled(root)).toBe(true);
    expect(state.textContent).toBe("on");
    expect(attributes["aria-pressed"]).toBe("true");
    expect(storage.values.get(STORAGE_KEY)).toBe("on");
  });

  it("still switches for the page when storage is blocked", () => {
    const { root, click } = page(blockedStorage);
    expect(shortcutsEnabled(root)).toBe(true);
    expect(() => click()).not.toThrow();
    expect(shortcutsEnabled(root)).toBe(false);
  });
});

describe("shortcutsEnabled", () => {
  it("is on for a page the switch has not run on", () => {
    expect(shortcutsEnabled({ dataset: {} })).toBe(true);
  });
});
