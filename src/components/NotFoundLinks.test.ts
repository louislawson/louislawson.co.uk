import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import NotFoundLinks from "./NotFoundLinks.astro";

async function render(sections: { id: string; number: number }[]) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(NotFoundLinks, {
    props: { sections },
  });
  return html.replace(/\s+/g, " ");
}

/** The link targets and their text, in order. */
function links(html: string): [string, string][] {
  return [...html.matchAll(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(
    ([, href, inner]) => [href!, inner!.replace(/<[^>]+>/g, "").trim()],
  );
}

describe("<NotFoundLinks>", () => {
  it("links to the home page and to each section that is shown, in order", async () => {
    const html = await render([
      { id: "projects", number: 1 },
      { id: "certifications", number: 2 },
      { id: "contact", number: 3 },
    ]);
    expect(links(html)).toEqual([
      ["/", "home"],
      ["/#projects", "projects"],
      ["/#certifications", "certs"],
      ["/#contact", "contact"],
    ]);
  });

  it("links to the home page alone when no section is shown", async () => {
    expect(links(await render([]))).toEqual([["/", "home"]]);
  });

  it("is a labelled navigation list", async () => {
    const html = await render([{ id: "projects", number: 1 }]);
    expect(html).toMatch(/<nav[^>]*aria-label="[^"]+"/);
    expect(html).toContain("<ul");
  });

  it("has no inline style and no script", async () => {
    const html = await render([{ id: "projects", number: 1 }]);
    expect(html).not.toContain("style=");
    expect(html).not.toContain("<script");
  });
});
