import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import Measured from "./Measured.astro";

const project = (over: Partial<Project> = {}): { data: Project } => ({
  data: {
    code: "R04",
    title: "This website",
    summary: "A summary.",
    headline: "A short result",
    status: "commissioning",
    period: "2026",
    featured: false,
    order: 4,
    setup: "Setup.",
    change: "Change.",
    result: "Result.",
    kind: "open-source",
    stack: ["Astro", "Terraform", "GitHub Actions"],
    links: [],
    ...over,
  } as Project,
});

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Measured, { props });
  return html.replace(/\s+/g, " ");
}

describe("<Measured>", () => {
  it("is a region headed measured, which the prompt hash does not become part of", async () => {
    const html = await render({ project: project() });
    expect(html).toMatch(/<section[^>]*aria-labelledby="measured"/);
    expect(html).toMatch(/<h2[^>]*\sid="measured"[^>]*>\s*measured\s*<\/h2>/);
    const css = readFileSync(
      new URL("../../styles/global.css", import.meta.url),
      "utf-8",
    );
    // The # is decoration, set where the project page's sections share it: the second line gives
    // it an empty alt text.
    expect(css).toMatch(/content:\s*"# ";\s*content:\s*"# "\s*\/\s*"";/);
  });

  describe("the tools", () => {
    it("are the stack, in its order, as a list named for what it is", async () => {
      const html = await render({ project: project() });
      expect(html).toMatch(/<ul[^>]*class="stack"[^>]*aria-label="Tools used"/);
      const items = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) =>
        m[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      expect(items).toEqual(["Astro", "Terraform", "GitHub Actions"]);
    });

    it("hatch a placeholder tool on a preview, and leave it out on production", async () => {
      const mixed = project({ stack: ["Astro", "TODO: tools used"] });
      const preview = await render({ project: mixed, context: "preview" });
      expect(preview.match(/<li\b/g)).toHaveLength(2);
      expect(preview).toContain('class="ph"');
      expect(preview).not.toContain("TODO:");
      const production = await render({
        project: mixed,
        context: "production",
      });
      expect(production.match(/<li\b/g)).toHaveLength(1);
      expect(production).not.toContain('class="ph"');
      expect(production).not.toContain("TODO:");
    });
  });

  describe("the links", () => {
    const links = [
      { label: "Source", url: "https://github.com/example/repo" },
      { label: "Write-up", url: "https://example.com/post" },
    ];

    it("follow the tools as buttons named by their label, in order, with the external mark", async () => {
      const html = await render({ project: project({ links }) });
      const anchors = [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)];
      expect(anchors).toHaveLength(2);
      expect(anchors.map((m) => /href="([^"]+)"/.exec(m[1]!)?.[1])).toEqual(
        links.map((link) => link.url),
      );
      expect(anchors.map((m) => m[2]!.replace(/<[^>]+>/g, "").trim())).toEqual([
        "Source",
        "Write-up",
      ]);
      for (const m of anchors) {
        expect(m[1]).toMatch(/class="[^"]*\bbtn\b/);
        // The external arrow: drawn, and hidden from assistive technology.
        expect(m[2]).toMatch(/<svg[^>]*aria-hidden="true"/);
        expect(m[2]).toContain("M7 17L17 7");
      }
      expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf("<a "));
    });

    it("are not there when the project has none", async () => {
      const html = await render({ project: project() });
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("btn");
    });

    it("hatch a placeholder link on a preview as a button that is not a link, and omit it on production", async () => {
      const placeholder = project({
        links: [
          { label: "TODO: link label", url: "TODO: link address" },
          { label: "Source", url: "TODO: link address" },
          { label: "Write-up", url: "https://example.com/post" },
        ],
      });
      const preview = await render({
        project: placeholder,
        context: "preview",
      });
      expect(preview.match(/<a\b/g)).toHaveLength(1);
      expect(preview.match(/<span [^>]*class="btn"/g)).toHaveLength(2);
      expect(preview).toContain('class="ph"');
      expect(preview).not.toContain("TODO:");

      const production = await render({
        project: placeholder,
        context: "production",
      });
      expect(production.match(/<a\b/g)).toHaveLength(1);
      expect(production).not.toContain('class="ph"');
      expect(production).not.toContain("TODO:");
      expect(production.match(/class="btn/g)).toHaveLength(1);
    });
  });

  it("shows a real project the same in both contexts", async () => {
    const real = project({
      links: [{ label: "Source", url: "https://example.com/repo" }],
    });
    expect(await render({ project: real, context: "production" })).toBe(
      await render({ project: real, context: "preview" }),
    );
  });

  it("has no inline style and no script", async () => {
    const html = await render({
      project: project({
        links: [{ label: "Source", url: "https://example.com/repo" }],
      }),
    });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
