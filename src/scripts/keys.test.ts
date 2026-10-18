import { describe, expect, it } from "vitest";
import { plainKey, type KeyEvent } from "./keys";

const press = (key: string, extra: Partial<KeyEvent> = {}): KeyEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...extra,
});

// The one rule for every single-key shortcut on the site: the number keys and the i key.
describe("plainKey", () => {
  it("is the key that was pressed", () => {
    expect(plainKey(press("i"), null)).toBe("i");
    expect(plainKey(press("3"), null)).toBe("3");
    expect(plainKey(press("Escape"), null)).toBe("Escape");
  });

  it("is nothing while Control, Alt or Meta is held, so the browser's own shortcuts still work", () => {
    expect(plainKey(press("i", { ctrlKey: true }), null)).toBeUndefined();
    expect(plainKey(press("i", { metaKey: true }), null)).toBeUndefined();
    expect(plainKey(press("i", { altKey: true }), null)).toBeUndefined();
  });

  it("does not count Shift as a modifier, because the key says what was typed", () => {
    // AZERTY's top row types a digit only with Shift, and then the key is "1".
    expect(plainKey(press("1", { shiftKey: true }), null)).toBe("1");
    expect(plainKey(press("!", { shiftKey: true }), null)).toBe("!");
  });

  it("is nothing while a key repeats or an input method is composing", () => {
    expect(plainKey(press("i", { repeat: true }), null)).toBeUndefined();
    expect(plainKey(press("i", { isComposing: true }), null)).toBeUndefined();
  });

  it("is nothing while the visitor is typing in a field", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(plainKey(press("i"), { tagName }), tagName).toBeUndefined();
    }
    expect(
      plainKey(press("i"), { tagName: "DIV", isContentEditable: true }),
    ).toBeUndefined();
  });

  it("is the key when the focus is on a link, a button or the page", () => {
    for (const tagName of ["A", "BUTTON", "BODY"]) {
      expect(plainKey(press("i"), { tagName }), tagName).toBe("i");
    }
  });
});
