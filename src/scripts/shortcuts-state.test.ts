import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { STORAGE_KEY, loadShortcuts } from "./shortcuts";

// shortcuts-state.js is a classic script that <head> loads before the first paint, so <html> has
// data-shortcuts before anything shows. A classic script cannot import loadShortcuts(), so this
// runs the real file against every kind of storage and holds it to the same answer.
const source = readFileSync(
  new URL("./shortcuts-state.js", import.meta.url),
  "utf-8",
);

type Storage = { getItem(key: string): string | null } | "blocked-getter";

/** Runs the script in a page with this storage, and returns what it put on <html>. */
function runWith(storage: Storage): string | undefined {
  const dataset: Record<string, string | undefined> = {};
  const page: Record<string, unknown> = {
    document: { documentElement: { dataset } },
  };
  if (storage === "blocked-getter") {
    // Reading localStorage itself throws when site data is blocked.
    Object.defineProperty(page, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  } else {
    page.localStorage = storage;
  }
  runInNewContext(source, page);
  return dataset.shortcuts;
}

const stored = (value: string | null) => ({
  getItem: (key: string) => (key === STORAGE_KEY ? value : null),
});
const blockedMethods = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

describe("shortcuts-state.js", () => {
  it.each([
    ["nothing stored", stored(null)],
    ["on stored", stored("on")],
    ["off stored", stored("off")],
    ["a value it does not know", stored("maybe")],
    ["an empty value", stored("")],
    ["storage that throws when read", blockedMethods],
    ["localStorage that throws when reached", "blocked-getter" as const],
  ])("gives the same answer as loadShortcuts for %s", (_name, storage) => {
    const expected =
      storage === "blocked-getter"
        ? loadShortcuts(undefined)
        : loadShortcuts(storage);
    expect(runWith(storage)).toBe(expected ? "on" : "off");
  });

  it("turns shortcuts off only for a visitor who did", () => {
    expect(runWith(stored("off"))).toBe("off");
    expect(runWith(stored(null))).toBe("on");
  });

  it("is a few lines, because it blocks the first paint", () => {
    const lines = source.split("\n").filter((line) => line.trim() !== "");
    expect(lines.length).toBeLessThanOrEqual(14);
    // A classic script: a module could not be run before the first paint, and an import would
    // need a request of its own.
    expect(source).not.toMatch(/^\s*(import|export)\b/m);
  });
});
