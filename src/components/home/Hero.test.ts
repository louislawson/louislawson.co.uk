import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Section } from "../../content/visibility";
import { INSPECT_LABELS } from "../inspect-labels";
import Hero from "./Hero.astro";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

const real = {
  roleLine: "A role line",
  intro: "An introduction.",
  careerLine: "A career line.",
};

const placeholders = {
  roleLine: "TODO: role line, for example the job title and focus",
  intro: "TODO: a short introduction in the first person",
  careerLine: "TODO: career in years and sectors",
};

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Hero, { props });
  return html.replace(/\s+/g, " ");
}

/** The text of the first element with this class, tags removed. */
function paragraph(html: string, name: string): string | undefined {
  const match = new RegExp(
    `<p[^>]*class="[^"]*\\b${name}\\b[^"]*"[^>]*>(.*?)</p>`,
  ).exec(html);
  // A line break inside a block is a space the browser drops at the edge of the line.
  return match?.[1]?.trim();
}

/** The two actions: where each goes, and the text a screen reader gets. */
function actions(html: string) {
  const block =
    /<div[^>]*class="[^"]*hero__actions[^"]*"[^>]*>(.*?)<\/div>/.exec(
      html,
    )?.[1];
  return [...(block ?? "").matchAll(/<a([^>]*)>(.*?)<\/a>/g)].map(
    ([, attributes, inner]) => ({
      href: /href="([^"]*)"/.exec(attributes!)?.[1],
      hivis: /class="[^"]*\bbtn--hv\b/.test(attributes!),
      text: inner!.replace(/<[^>]+>/g, "").trim(),
      icon: inner!.includes("<svg"),
    }),
  );
}

describe("<Hero>", () => {
  it("is a region named by the name, an h1 on two lines with the caret after it", async () => {
    const html = await render({ profile: real, sections: all });
    expect(html).toMatch(/<section[^>]*aria-labelledby="name"/);
    expect(html).toMatch(
      /<h1[^>]*\sid="name"[^>]*>\s*Louis <br[^>]*>Lawson<span[^>]*class="caret"[^>]*><\/span>\s*<\/h1>/,
    );
    // The caret is decoration: the name is "Louis Lawson" and nothing more.
    expect(html).toMatch(/<span[^>]*class="caret"[^>]*aria-hidden="true"/);
  });

  it("reads as “Louis Lawson” with the tags taken out, so the region's name and a copy of the text have the space", async () => {
    const html = await render({ profile: real, sections: all });
    const h1 = /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? "";
    // A line break is not a space to every reader: textContent has none of it.
    expect(h1.replace(/<[^>]+>/g, "").trim()).toBe("Louis Lawson");
  });

  it("is the only h1, with the name as fixed text rather than profile data", async () => {
    const html = await render({ profile: placeholders, sections: all });
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain("Louis <br");
  });

  it("shows the role, the introduction and the career line as paragraphs, in that order", async () => {
    const html = await render({ profile: real, sections: all });
    expect(paragraph(html, "hero__role")).toBe("A role line");
    expect(paragraph(html, "hero__intro")).toBe("An introduction.");
    expect(paragraph(html, "hero__career")).toBe("A career line.");
    expect(html.indexOf("hero__role")).toBeLessThan(
      html.indexOf("hero__intro"),
    );
    expect(html.indexOf("hero__intro")).toBeLessThan(
      html.indexOf("hero__career"),
    );
  });

  it.each(["preview", "local"])(
    "hatches each placeholder on a %s build, with the hidden label for screen readers",
    async (context) => {
      const html = await render({
        profile: placeholders,
        sections: all,
        context,
      });
      for (const name of ["hero__role", "hero__intro", "hero__career"]) {
        const text = paragraph(html, name);
        expect(text, name).toMatch(/class="ph[ "]/);
        expect(text, name).toMatch(/>Placeholder: <\/span>/);
        expect(text, name).not.toContain("TODO:");
      }
    },
  );

  it("leaves out the paragraph of a placeholder on production, not an empty one", async () => {
    const html = await render({
      profile: placeholders,
      sections: all,
      context: "production",
    });
    expect(html).not.toContain("hero__role");
    expect(html).not.toContain("hero__intro");
    expect(html).not.toContain("hero__career");
    expect(html).not.toContain('class="ph');
    expect(html).not.toContain("Placeholder:");
  });

  it("leaves out the paragraph of a value that production already dropped", async () => {
    const html = await render({
      profile: { roleLine: undefined, intro: "Real.", careerLine: undefined },
      sections: all,
      context: "production",
    });
    expect(paragraph(html, "hero__intro")).toBe("Real.");
    expect(html).not.toContain("hero__role");
    expect(html).not.toContain("hero__career");
  });

  it("keeps the real paragraphs and drops only the placeholder one on production", async () => {
    const html = await render({
      profile: { ...real, intro: placeholders.intro },
      sections: all,
      context: "production",
    });
    expect(paragraph(html, "hero__role")).toBe("A role line");
    expect(html).not.toContain("hero__intro");
    expect(paragraph(html, "hero__career")).toBe("A career line.");
  });

  it("still shows the name and the actions when there is no text at all", async () => {
    const html = await render({
      profile: { roleLine: undefined, intro: undefined, careerLine: undefined },
      sections: all,
      context: "production",
    });
    expect(html).toContain("Louis <br");
    expect(actions(html)).toHaveLength(2);
  });

  it("has two actions: see projects in hi-vis with the arrow, and get in touch", async () => {
    const html = await render({ profile: real, sections: all });
    expect(actions(html)).toEqual([
      { href: "#projects", hivis: true, text: "see projects", icon: true },
      { href: "#contact", hivis: false, text: "get in touch", icon: false },
    ]);
  });

  it("links see projects only when the projects section is shown", async () => {
    const without = all.filter((section) => section.id !== "projects");
    const html = await render({ profile: real, sections: without });
    expect(actions(html).map((a) => a.href)).toEqual(["#contact"]);
  });

  it("links get in touch only when the contact section is shown", async () => {
    const without = all.filter((section) => section.id !== "contact");
    const html = await render({ profile: real, sections: without });
    expect(actions(html).map((a) => a.href)).toEqual(["#projects"]);
  });

  it("has no actions block when neither section is shown", async () => {
    const html = await render({ profile: real, sections: [] });
    expect(html).not.toContain("hero__actions");
  });

  it("puts nothing between the action's text and its arrow but the flex gap, and the arrow is decoration", async () => {
    const html = await render({ profile: real, sections: all });
    expect(html).toMatch(/see projects ?<svg[^>]*aria-hidden="true"/);
  });

  it("labels the name for inspect mode", async () => {
    const html = await render({ profile: real, sections: all });
    expect(html).toMatch(
      new RegExp(`<h1[^>]*data-inspect="${INSPECT_LABELS.hero}"`),
    );
  });

  it("is static HTML: no script, no inline style", async () => {
    const html = await render({ profile: placeholders, sections: all });
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    const source = readFileSync(
      new URL("./Hero.astro", import.meta.url),
      "utf-8",
    );
    expect(source).not.toMatch(/<script/);
  });

  it("holds the caret still under reduced motion, not just cut short", () => {
    const source = readFileSync(
      new URL("./Hero.astro", import.meta.url),
      "utf-8",
    );
    const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
    expect(style).toMatch(/\.caret\s*\{[^}]*animation:[^;}]*blink/);
    const reduced =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(
        style,
      )?.[1];
    expect(reduced, "no reduced-motion rule").toBeDefined();
    expect(reduced).toMatch(/\.caret\s*\{[^}]*animation:\s*none/);
  });
});
