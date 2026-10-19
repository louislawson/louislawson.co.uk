import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import { projectPageLabel } from "../inspect-labels";
import ProjectHead from "./ProjectHead.astro";

const fields = {
  code: "R04",
  title: "This website",
  summary: "A summary.",
  headline: "A short result",
  status: "commissioning",
  period: "2026",
  featured: false,
  order: 4,
  setup: "Where it started.",
  change: "What changed.",
  result: "What is different now.",
  stack: ["A tool"],
  links: [] as Project["links"],
};

const work = (over: Partial<Project> = {}): Project =>
  ({
    ...fields,
    kind: "work",
    descriptor: "A UK financial-services organisation",
    ...over,
  }) as Project;

const named = (
  kind: "personal" | "open-source",
  org?: string,
  over: Partial<Project> = {},
): Project =>
  ({
    ...fields,
    kind,
    ...(org === undefined ? {} : { org }),
    ...over,
  }) as Project;

const entry = (data: Project, id = "this-website") => ({
  id,
  filePath: `src/content/projects/${id}.md`,
  data,
});

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(ProjectHead, { props });
  return html.replace(/\s+/g, " ");
}

/** The text of the first element of this tag and class, with its tags taken out. */
const textOf = (html: string, tag: string, className: string) =>
  new RegExp(
    `<${tag}[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>(.*?)</${tag}>`,
  )
    .exec(html)?.[1]
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("<ProjectHead>", () => {
  it("is a region named by the page's heading", async () => {
    const html = await render({ project: entry(work()) });
    expect(html).toMatch(/<section[^>]*aria-labelledby="title"/);
    expect(html).toMatch(/<h1[^>]*\sid="title"/);
  });

  describe("the way back", () => {
    it("is a link to the projects on the home page, named all projects, with a left arrow", async () => {
      const html = await render({ project: entry(work()) });
      const back = /<a [^>]*class="back"[^>]*>(.*?)<\/a>/.exec(html);
      expect(back, "no back link").not.toBeNull();
      expect(back![0]).toContain('href="/#projects"');
      expect(back![1]!.replace(/<[^>]+>/g, "").trim()).toBe("all projects");
      // The left arrow, drawn as the icon is, and hidden from assistive technology.
      expect(back![1]).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(back![1]).toContain("M11 6l-6 6 6 6");
    });

    it("is no command: the mock's cd ../projects is a fake one", async () => {
      expect(await render({ project: entry(work()) })).not.toContain("cd ");
    });
  });

  describe("the heading", () => {
    it("is the title, in the one h1", async () => {
      const html = await render({ project: entry(work()) });
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(/<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1]?.trim()).toBe(
        "This website",
      );
    });

    it("carries the inspect label, naming the page's own file", async () => {
      const project = entry(work(), "this-website");
      const html = await render({ project });
      expect(html).toMatch(/<h1[^>]*\sdata-inspect="([^"]*)"/);
      expect(/<h1[^>]*\sdata-inspect="([^"]*)"/.exec(html)![1]).toBe(
        projectPageLabel(project),
      );
      expect(html.match(/data-inspect=/g)).toHaveLength(1);
    });
  });

  describe("the meta row", () => {
    const meta = async (data: Project) =>
      textOf(await render({ project: entry(data) }), "p", "p-meta");

    it("is the code, the status, the period and what kind of organisation, for a work project", async () => {
      expect(await meta(work())).toBe(
        "R04 commissioning 2026 A UK financial-services organisation",
      );
    });

    it("is the organisation, for a personal project that has one", async () => {
      expect(await meta(named("personal", "A named club"))).toBe(
        "R04 commissioning 2026 A named club",
      );
    });

    it("says personal project, for one that has no organisation", async () => {
      expect(await meta(named("personal"))).toBe(
        "R04 commissioning 2026 personal project",
      );
    });

    it("is the organisation, for an open-source project that has one", async () => {
      expect(await meta(named("open-source", "A foundation"))).toBe(
        "R04 commissioning 2026 A foundation",
      );
    });

    it("says open-source project, for one that has no organisation", async () => {
      expect(await meta(named("open-source"))).toBe(
        "R04 commissioning 2026 open-source project",
      );
    });

    it("puts the featured tag after the code, on the featured project alone", async () => {
      expect(await meta(work({ featured: true }))).toBe(
        "R04 featured commissioning 2026 A UK financial-services organisation",
      );
      const html = await render({ project: entry(work()) });
      expect(html).not.toContain('class="tag"');
    });

    it("shows the code in hi-vis and each status as its word with a marker", async () => {
      const html = await render({ project: entry(work()) });
      expect(textOf(html, "span", "p-meta__code")).toBe("R04");
      expect(html).toMatch(
        /class="status status--commissioning"[^>]*>\s*commissioning\s*</,
      );
      const inService = await render({
        project: entry(work({ status: "in-service" })),
      });
      expect(inService).toMatch(
        /class="status status--in-service"[^>]*>\s*in service\s*</,
      );
    });
  });

  describe("the run sheet", () => {
    it("is setup, change and result as three columns under h2s, in that order", async () => {
      const html = await render({ project: entry(work()) });
      const heads = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) =>
        m[1]!.trim(),
      );
      expect(heads).toEqual(["setup", "change", "result"]);
      const sheet = /class="p-sheet"[^>]*>(.*)<\/div> <\/section>/
        .exec(html)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      expect(sheet).toBe(
        "setup Where it started. change What changed. result What is different now.",
      );
    });

    it("marks the result column, which the styles set apart", async () => {
      const html = await render({ project: entry(work()) });
      expect(html).toMatch(
        /class="[^"]*\bres\b[^"]*"[^>]*>\s*<h2[^>]*>\s*result/,
      );
    });

    it("sets the $ and > prompts as generated content with an empty alt text, so a screen reader does not read them", () => {
      const source = readFileSync(
        new URL("./ProjectHead.astro", import.meta.url),
        "utf-8",
      );
      const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
      expect(style).toMatch(/content:\s*"\$ ";\s*content:\s*"\$ "\s*\/\s*"";/);
      expect(style).toMatch(/content:\s*"> ";\s*content:\s*"> "\s*\/\s*"";/);
    });
  });

  describe("the deploy context", () => {
    const placeholders = entry(
      work({
        title: "TODO: project title",
        status: "TODO: status",
        period: "TODO: period",
        descriptor: "TODO: descriptor",
        setup: "TODO: where it started",
        change: "TODO: what you changed",
        result: "TODO: what is different now",
      }),
      "r01-placeholder",
    );

    it.each(["preview", "local"])(
      "hatches each placeholder on a %s build, with the hidden label for screen readers",
      async (context) => {
        const html = await render({ project: placeholders, context });
        // The title, the status, the period, the descriptor and the three columns.
        expect(html.match(/class="ph"/g)).toHaveLength(7);
        expect(html).toContain("Placeholder: ");
        expect(html).not.toContain("TODO:");
        expect(html).not.toMatch(/status--TODO/);
      },
    );

    it("shows no hatch and no placeholder text on production", async () => {
      const html = await render({
        project: placeholders,
        context: "production",
      });
      expect(html).not.toContain('class="ph"');
      expect(html).not.toContain("Placeholder:");
      expect(html).not.toContain("TODO:");
    });

    it("shows a real project the same in both", async () => {
      const preview = await render({
        project: entry(work()),
        context: "preview",
      });
      const production = await render({
        project: entry(work()),
        context: "production",
      });
      expect(production).toBe(preview);
    });
  });

  it("has no inline style and no script", async () => {
    const html = await render({ project: entry(work({ featured: true })) });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
