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

  it("has no meta tags for sharing unless the page gives its meta", async () => {
    const html = await render();
    expect(html).not.toMatch(/<meta[^>]*\b(?:property="og:|name="twitter:)/);
    expect(html).not.toMatch(/<meta[^>]*image:/);
    expect(html).not.toMatch(/<meta[^>]*name="description"/);
  });

  describe("with meta", () => {
    const meta = {
      description: "About the page.",
      image: "/og/home.png",
      imageAlt: "Louis Lawson",
      type: "website",
    };

    /** The content of the first meta tag with this name or property. */
    function content(html: string, key: string): string | undefined {
      const tag = new RegExp(
        `<meta[^>]*\\b(?:name|property)="${key}"[^>]*>`,
      ).exec(html)?.[0];
      return tag && /content="([^"]*)"/.exec(tag)?.[1];
    }

    it("puts the tags in <head>, with the page's title and address", async () => {
      const html = await render({ meta, title: "A page · Louis Lawson" });
      const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
      expect(content(head, "description")).toBe("About the page.");
      expect(content(head, "og:title")).toBe("A page · Louis Lawson");
      expect(content(head, "og:description")).toBe("About the page.");
      expect(content(head, "og:image")).toBe(`${site.url}/og/home.png`);
      expect(content(head, "og:image:width")).toBe("1200");
      expect(content(head, "og:image:height")).toBe("630");
      expect(content(head, "og:image:alt")).toBe("Louis Lawson");
      expect(content(head, "twitter:image:alt")).toBe("Louis Lawson");
      expect(content(head, "og:url")).toBe(`${site.url}/projects/example/`);
      expect(content(head, "og:type")).toBe("website");
      expect(content(head, "og:locale")).toBe("en_GB");
      expect(content(head, "twitter:card")).toBe("summary_large_image");
    });

    it("gives the same address as the canonical", async () => {
      const html = await render({ meta });
      const canonical = /rel="canonical" href="([^"]+)"/.exec(html)?.[1];
      expect(content(html, "og:url")).toBe(canonical);
    });

    it("leaves the description tags out when there is no description", async () => {
      const html = await render({ meta: { ...meta, description: undefined } });
      expect(content(html, "description")).toBeUndefined();
      expect(content(html, "og:description")).toBeUndefined();
      expect(content(html, "og:image")).toBeDefined();
    });

    it("keeps a description inside its attribute, whatever it holds", async () => {
      const html = await render({
        meta: { ...meta, description: 'A "quoted" line" /><script>x</script>' },
      });
      // The quote is escaped, so the value cannot end the attribute and start a tag of its own.
      expect(html).toContain('content="A &quot;quoted&quot; line&quot; />');
      expect(html).not.toMatch(/<script>x<\/script>(?![^<]*")/);
      expect(html.match(/<meta[^>]*name="description"/g)).toHaveLength(1);
    });
  });

  it("has no inline style attribute", async () => {
    expect(await render()).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
  });
});
