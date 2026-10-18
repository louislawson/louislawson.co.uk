import { describe, expect, it } from "vitest";
import { initInspect, type InspectPage } from "./inspect";
import type { KeyEvent } from "./keys";

const press = (key: string, extra: Partial<KeyEvent> = {}): KeyEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...extra,
});

/** The few parts of the page inspect mode touches, as plain objects. */
function page(overrides: { shortcuts?: string } = {}) {
  const classes = new Set<string>();
  const attributes: Record<string, string> = {};
  const clicks: (() => void)[] = [];
  const keydown: ((
    event: KeyEvent & { target: null | { tagName: string } },
  ) => void)[] = [];
  const shortcutChanges: (() => void)[] = [];
  const state = { textContent: "" as string | null };
  const root = {
    dataset: { shortcuts: overrides.shortcuts } as Record<
      string,
      string | undefined
    >,
  };

  const env: InspectPage = {
    body: {
      classList: {
        toggle: (name) => {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
          return classes.has(name);
        },
      },
    },
    root,
    button: {
      setAttribute: (name, value) => void (attributes[name] = value),
      removeAttribute: (name) => void delete attributes[name],
      addEventListener: (_type, listener) => void clicks.push(listener),
    },
    state,
    onKeydown: (listener) => void keydown.push(listener),
    onShortcutsChange: (listener) => void shortcutChanges.push(listener),
  };
  // The button starts pending, and the script is what reveals it.
  attributes["data-pending"] = "";
  initInspect(env);

  return {
    classes,
    attributes,
    state,
    click: () => clicks[0]!(),
    press: (
      key: string,
      extra: Partial<KeyEvent> = {},
      target: null | { tagName: string } = null,
    ) =>
      keydown.forEach((listener) => listener({ ...press(key, extra), target })),
    changeShortcuts: (value: string) => {
      root.dataset.shortcuts = value;
      shortcutChanges.forEach((listener) => listener());
    },
  };
}

describe("inspect mode", () => {
  it("starts off, reveals its button, and says nothing until it is used", () => {
    const { classes, attributes, state } = page();
    expect(classes.has("inspecting")).toBe(false);
    expect(attributes["aria-pressed"]).toBe("false");
    // The button was pending, so it kept its place in the bar without showing, until now.
    expect(attributes["data-pending"]).toBeUndefined();
    // An announcement on load would be noise: the region is empty until the first change.
    expect(state.textContent).toBe("");
  });

  it("turns on and off with the button, and says which in the live region", () => {
    const { classes, attributes, state, click } = page();
    click();
    expect(classes.has("inspecting")).toBe(true);
    expect(attributes["aria-pressed"]).toBe("true");
    expect(state.textContent).toBe("Inspect mode is on.");

    click();
    expect(classes.has("inspecting")).toBe(false);
    expect(attributes["aria-pressed"]).toBe("false");
    expect(state.textContent).toBe("Inspect mode is off.");
  });
});

describe("the i key", () => {
  it("toggles inspect mode", () => {
    const { classes, attributes, state, press } = page({ shortcuts: "on" });
    press("i");
    expect(classes.has("inspecting")).toBe(true);
    expect(attributes["aria-pressed"]).toBe("true");
    expect(state.textContent).toBe("Inspect mode is on.");
    press("i");
    expect(classes.has("inspecting")).toBe(false);
  });

  it("works with Caps Lock on, and on a page the switch has not run on", () => {
    const { classes, press } = page({});
    press("I");
    expect(classes.has("inspecting")).toBe(true);
  });

  it("does nothing once the visitor has turned shortcuts off, and works again when they turn them on", () => {
    const { classes, press, changeShortcuts } = page({ shortcuts: "off" });
    press("i");
    expect(classes.has("inspecting")).toBe(false);
    changeShortcuts("on");
    press("i");
    expect(classes.has("inspecting")).toBe(true);
  });

  it("still works through the button when shortcuts are off", () => {
    const { classes, click } = page({ shortcuts: "off" });
    click();
    expect(classes.has("inspecting")).toBe(true);
  });

  it("does nothing with Control, Alt or Meta, while a key repeats or composes, or while typing in a field", () => {
    const { classes, press } = page({ shortcuts: "on" });
    press("i", { ctrlKey: true });
    press("i", { metaKey: true });
    press("i", { altKey: true });
    press("i", { repeat: true });
    press("i", { isComposing: true });
    press("i", {}, { tagName: "INPUT" });
    press("i", {}, { tagName: "TEXTAREA" });
    expect(classes.has("inspecting")).toBe(false);
  });

  it("ignores every other key, the number keys included", () => {
    const { classes, press } = page({ shortcuts: "on" });
    for (const key of ["1", "2", "a", "Escape", "Enter", " "]) press(key);
    expect(classes.has("inspecting")).toBe(false);
  });
});

describe("the shortcut hint", () => {
  it("is announced on the button while shortcuts are on, and not once they are off", () => {
    const { attributes, changeShortcuts } = page({ shortcuts: "on" });
    expect(attributes["aria-keyshortcuts"]).toBe("i");
    changeShortcuts("off");
    expect(attributes["aria-keyshortcuts"]).toBeUndefined();
    changeShortcuts("on");
    expect(attributes["aria-keyshortcuts"]).toBe("i");
  });

  it("is not announced when the visitor started with shortcuts off", () => {
    expect(
      page({ shortcuts: "off" }).attributes["aria-keyshortcuts"],
    ).toBeUndefined();
  });
});
