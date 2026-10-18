import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { site } from "../config/site";
import type { Section } from "../content/visibility";
import Base from "./Base.astro";

const sections: Section[] = [
  { id: "projects", number: 1 },
  { id: "contact", number: 2 },
];

async function render(
  props: Record<string, unknown> = {},
  path = "/projects/example/",
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Base, {
    props: { title: "A page", sections, ...props },
    slots: { default: "<p>the page</p>" },
    request: new Request(`http://localhost${path}`),
    partial: false,
  });
}

describe("the base layout", () => {
  it("says the page is in British English, for the voice a screen reader picks", async () => {
    const html = await render();
    expect(html).toMatch(/<html lang="en-GB"/);
  });

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

  it("puts the navigation between the skip link and <main>, on every page", async () => {
    const html = await render();
    expect(html).toMatch(/<header class="nav"/);
    expect(html.indexOf('href="#main"')).toBeLessThan(html.indexOf("<header"));
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<main"));
  });

  it("links the navigation to the sections it is given, and no others", async () => {
    const html = await render();
    const header = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    expect([...header.matchAll(/href="(\/#[^"]+)"/g)].map((m) => m[1])).toEqual(
      ["/#projects", "/#contact"],
    );
  });

  it("has the inspect note after the footer, in every page", async () => {
    const html = await render();
    expect(html).toMatch(/<div[^>]*data-inspect-note/);
    expect(html.indexOf("<footer")).toBeLessThan(
      html.indexOf("data-inspect-note"),
    );
  });

  it("loads the saved shortcut choice in <head>, as a classic script file that blocks rendering", async () => {
    // So the number hints show or hide on the first paint, with no flash. A file, because the
    // content security policy allows no inline code; classic and not deferred, so it runs first.
    const html = await render();
    const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
    const tag = /<script\b[^>]*shortcuts-state[^>]*>/.exec(head)?.[0];
    expect(tag).toBeDefined();
    expect(tag).toMatch(/\ssrc="[^"]+\.js"/);
    expect(tag).not.toMatch(/\s(async|defer)\b/);
    expect(tag).not.toMatch(/type="module"/);
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
