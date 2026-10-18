import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ShortcutSwitch from "./ShortcutSwitch.astro";

async function render(): Promise<string> {
  const container = await AstroContainer.create();
  return (await container.renderToString(ShortcutSwitch)).replace(/\s+/g, " ");
}

describe("<ShortcutSwitch>", () => {
  it('is a button that reads "keyboard shortcuts: on" and is pressed', async () => {
    const html = await render();
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"/);
    expect(html).toMatch(/keyboard shortcuts: <span[^>]*>on<\/span>/);
  });

  it("is hidden until the script runs, because without it there are no shortcuts to switch", async () => {
    const html = await render();
    expect(html).toMatch(/<button[^>]*\shidden[\s>]/);
  });

  it("has a square marker that assistive technology skips, and no inline style", async () => {
    const html = await render();
    expect(html).toMatch(/<span[^>]*aria-hidden="true"/);
    expect(html).not.toContain("style=");
  });

  it("keeps its accessible name the same whatever the state, because aria-pressed carries the state", async () => {
    // A toggle button's label must not change with its state (WAI-ARIA Authoring Practices), or a
    // screen reader says "keyboard shortcuts: off, toggle button, not pressed". The word stays on
    // screen; it is hidden from assistive technology.
    const html = await render();
    const name = html
      .replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>.*?<\/\1>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expect(name).toBe("keyboard shortcuts:");
    expect(name).not.toMatch(/\b(on|off)\b/);
  });

  it("still shows the state as a word, after the colon", async () => {
    const html = await render();
    expect(html).toMatch(
      /keyboard shortcuts: <span[^>]*aria-hidden="true"[^>]*>on<\/span>/,
    );
  });

  it("can be found by the script", async () => {
    const html = await render();
    expect(html).toContain("data-shortcuts-switch");
    expect(html).toContain("data-shortcuts-state");
  });
});
