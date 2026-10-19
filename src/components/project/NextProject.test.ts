import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import NextProject from "./NextProject.astro";

const next = (over: Partial<Project> = {}) => ({
  id: "this-website",
  data: { code: "R04", title: "This website", ...over } as Project,
});

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(NextProject, { props });
  return html.replace(/\s+/g, " ");
}

describe("<NextProject>", () => {
  it("is a link to the next project's page, saying so, with its code and title", async () => {
    const html = await render({ next: next() });
    const link = /<a\b([^>]*)>(.*?)<\/a>/.exec(html);
    expect(link, "no link").not.toBeNull();
    expect(link![1]).toContain('href="/projects/this-website/"');
    expect(link![1]).toMatch(/class="[^"]*\bnext\b/);
    expect(
      link![2]!
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe("next project · R04 This website");
    expect(html).toMatch(/<small[^>]*>next project · R04<\/small>/);
    expect(html).toMatch(/<strong[^>]*>This website<\/strong>/);
  });

  it("ends in a right arrow, drawn, and hidden from assistive technology", async () => {
    const html = await render({ next: next() });
    expect(html).toMatch(/<svg[^>]*width="32"[^>]*aria-hidden="true"/);
    expect(html).toContain("M13 6l6 6-6 6");
  });

  it("is nothing when there is no next project, so a lone project links to nothing", async () => {
    expect((await render({ next: undefined })).trim()).toBe("");
  });

  it("hatches a placeholder title on a preview, and shows none on production", async () => {
    const placeholder = next({ title: "TODO: project title" });
    const preview = await render({ next: placeholder, context: "preview" });
    expect(preview).toContain('class="ph"');
    expect(preview).not.toContain("TODO:");
    // The link still goes to the page: a preview builds every project's page.
    expect(preview).toContain('href="/projects/this-website/"');
    const production = await render({
      next: placeholder,
      context: "production",
    });
    expect(production).not.toContain('class="ph"');
    expect(production).not.toContain("TODO:");
  });

  it("has no inline style and no script", async () => {
    const html = await render({ next: next() });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
