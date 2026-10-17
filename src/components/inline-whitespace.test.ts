import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import InlineProse from "./__fixtures__/InlineProse.astro";

// Phase 4 is prose with inline links, placeholders, key hints and icons, so a space that a line
// break stood for has to survive the build (compressHTML in astro.config.mjs).
describe("prose with inline elements", () => {
  /** The rendered HTML as a browser lays it out: any run of whitespace is one space. */
  async function render(): Promise<string> {
    const container = await AstroContainer.create();
    const html = await container.renderToString(InlineProse);
    return html.replace(/\s+/g, " ");
  }

  it("keeps the space on both sides of a placeholder written on one line", async () => {
    const html = await render();
    expect(html).toMatch(/Text <span[^>]*class="ph[ "]/);
    expect(html).toMatch(/<\/span> more<\/p>/);
  });

  it("keeps the space where a line break separates text from a link, a placeholder or a key hint", async () => {
    const html = await render();
    expect(html).toContain(
      'with a <a href="/somewhere">link</a> in the middle, a <span',
    );
    expect(html).toContain("</span> placeholder, and a <kbd>1</kbd> key hint.");
  });

  it("adds no space of its own around a placeholder, so punctuation can follow it", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(InlineProse);
    // The fixture puts a space after the placeholder on one line; a stray one inside the
    // component would show as two.
    expect(html).not.toMatch(/<\/span>\s{2,}more/);
    expect(html).not.toMatch(/ph[^>]*>\s+<span/);
  });
});
