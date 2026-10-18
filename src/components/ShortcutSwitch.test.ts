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

  it("can be found by the script", async () => {
    const html = await render();
    expect(html).toContain("data-shortcuts-switch");
    expect(html).toContain("data-shortcuts-state");
  });
});
