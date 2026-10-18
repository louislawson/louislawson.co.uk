import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Section from "./Section.astro";

async function render(
  props: Record<string, unknown> = {},
  body = "<p>the content</p>",
): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Section, {
    props: {
      id: "projects",
      title: "projects",
      intro: "An intro line.",
      inspect: "a label for inspect mode",
      ...props,
    },
    slots: { default: body },
  });
  return html.replace(/\s+/g, " ");
}

describe("<Section>", () => {
  it("is a region named by its heading, with the id the navigation links to", async () => {
    const html = await render();
    expect(html).toMatch(/^<section\b/);
    expect(html).toMatch(/<section[^>]*\sid="projects"/);
    expect(html).toMatch(/<section[^>]*aria-labelledby="projects-title"/);
    expect(html).toMatch(/<h2[^>]*\sid="projects-title"/);
  });

  it("has the title as an h2, and the intro as a paragraph beside it", async () => {
    const html = await render();
    expect(html).toMatch(/<h2[^>]*>\s*projects\s*<\/h2>/);
    expect(html).toMatch(/<p[^>]*>\s*An intro line\.\s*<\/p>/);
    expect(html.indexOf("<h2")).toBeLessThan(html.indexOf("An intro line."));
  });

  it("puts what is slotted after the heading", async () => {
    const html = await render();
    expect(html).toContain("<p>the content</p>");
    expect(html.indexOf("An intro line.")).toBeLessThan(
      html.indexOf("the content"),
    );
  });

  it("is labelled for inspect mode with the label it is given", async () => {
    const html = await render();
    expect(html).toMatch(
      /^<section[^>]*data-inspect="a label for inspect mode"/,
    );
  });

  it("shows a count after the title, as it is given", async () => {
    const html = await render({ count: "(02)" });
    // Hugging the title, as the mock sets it: a space would widen the gap.
    expect(html).toMatch(/projects<span[^>]*class="n"[^>]*>\(02\)<\/span>/);
  });

  it("hides the drawn count from assistive technology and gives it the same count in words", async () => {
    const html = await render({ count: "(02)" });
    expect(html).toMatch(/class="n"[^>]*aria-hidden="true"/);
    const heading = /<h2[^>]*>(.*?)<\/h2>/.exec(html)?.[1] ?? "";
    // What a screen reader gets: the title and the number, once.
    const name = heading
      .replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>.*?<\/\1>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expect(name).toBe("projects (02)");
  });

  it("has no count when none is given", async () => {
    const html = await render();
    expect(html).not.toContain('class="n"');
  });

  it("has no inline style and no inline script", async () => {
    const html = await render({ count: "(02)" });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toMatch(/<script/);
  });
});
