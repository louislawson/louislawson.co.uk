import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { site } from "../config/site";
import Base from "./Base.astro";

async function render(
  props: Record<string, unknown> = {},
  path = "/projects/example/",
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Base, {
    props: { title: "A page", ...props },
    slots: { default: "<p>the page</p>" },
    request: new Request(`http://localhost${path}`),
    partial: false,
  });
}

describe("the base layout", () => {
  it("starts the page with a skip link to the main content", async () => {
    const html = await render();
    const body = html.slice(html.indexOf("<body"));
    expect(body).toMatch(
      /^<body[^>]*>\s*<a [^>]*href="#main"[^>]*>Skip to content<\/a>/,
    );
  });

  it("puts the page in <main>, which the skip link can move focus to, and the footer after it", async () => {
    const html = await render();
    expect(html).toMatch(
      /<main id="main" tabindex="-1">\s*<p>the page<\/p>\s*<\/main>/,
    );
    expect(html.indexOf("<main")).toBeLessThan(html.indexOf("<footer"));
    expect(html.indexOf('href="#main"')).toBeLessThan(html.indexOf("<main"));
  });

  it("points the canonical URL at this page on the site URL", async () => {
    const html = await render();
    expect(html).toContain(
      `<link rel="canonical" href="${site.url}/projects/example/">`,
    );
  });

  it("can leave the canonical URL out, as the 404 page does", async () => {
    const html = await render({ canonical: false });
    expect(html).not.toContain('rel="canonical"');
  });

  it("keeps the noindex tag and the font preload it already had", async () => {
    const html = await render();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toMatch(/<link rel="preload"[^>]*as="font"/);
  });

  it("has no inline style attribute", async () => {
    expect(await render()).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
  });
});
