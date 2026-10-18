import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import InspectNote from "./InspectNote.astro";

async function render(): Promise<string> {
  const container = await AstroContainer.create();
  return (await container.renderToString(InspectNote)).replace(/\s+/g, " ");
}

describe("<InspectNote>", () => {
  it("is a polite status that is read whole, so a change to its first words announces the note", async () => {
    const html = await render();
    expect(html).toMatch(/<div[^>]*role="status"/);
    expect(html).toMatch(/<div[^>]*aria-live="polite"/);
    expect(html).toMatch(/<div[^>]*aria-atomic="true"/);
  });

  it("is not a landmark, so a screen reader's list of landmarks has no empty, unnamed region in it", async () => {
    const html = await render();
    expect(html).not.toContain("<aside");
    expect(html).not.toMatch(/role="(complementary|region|note)"/);
  });

  it("is always in the page, because a screen reader notices a region's text change, not a hidden one appearing", async () => {
    const html = await render();
    expect(html).toMatch(/<div[^>]*data-inspect-note/);
    // Nothing hides it from assistive technology: no hidden attribute, no aria-hidden.
    expect(html).not.toMatch(/<div[^>]*\shidden/);
    expect(html).not.toMatch(/<div[^>]*aria-hidden/);
  });

  it("starts with no words in it, so nothing is announced on load", async () => {
    const html = await render();
    expect(html).toMatch(/<[a-z]+[^>]*data-inspect-state[^>]*><\/[a-z]+>/);
  });

  it("explains what the outlines are, in the page's own words", async () => {
    const html = await render();
    expect(html).toContain(
      "Every outlined part says how it is built and served.",
    );
  });

  it("names the i key only while the shortcuts are on, so it never promises a key that does nothing", async () => {
    const html = await render();
    expect(html).toMatch(/class="note__key"[^>]*>[^<]*<b[^>]*>i<\/b>/);
    // And the button always works: the note says so.
    expect(html).toContain("inspect button");
  });

  it("has no inline style and no inline script", async () => {
    const html = await render();
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
  });
});
