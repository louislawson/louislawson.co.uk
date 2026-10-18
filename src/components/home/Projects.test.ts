import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Project } from "../../content/schema";
import type { Section } from "../../content/visibility";
import { INSPECT_LABELS } from "../inspect-labels";
import Projects from "./Projects.astro";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

const fields = {
  summary: "A summary.",
  featured: false,
  stack: ["A tool"],
  links: [] as Project["links"],
};

/** One real work project, which the tests change as they need. */
function work(over: Partial<Project> & { code: string }): Project {
  return {
    ...fields,
    title: `Title ${over.code}`,
    headline: "A short result",
    status: "complete",
    period: "2024 – 2025",
    order: Number(over.code.slice(1)),
    setup: `Setup ${over.code}.`,
    change: `Change ${over.code}.`,
    result: `Result ${over.code}.`,
    kind: "work",
    descriptor: "A UK financial-services organisation",
    ...over,
  } as Project;
}

/** A personal or open-source project, which an organisation names or not. */
function named(kind: "personal" | "open-source", org?: string): Project {
  return {
    ...fields,
    code: "R01",
    title: "Title R01",
    headline: "A short result",
    status: "complete",
    period: "2024 – 2025",
    order: 1,
    setup: "Setup R01.",
    change: "Change R01.",
    result: "Result R01.",
    kind,
    ...(org === undefined ? {} : { org }),
  } as Project;
}

const entries = (...projects: Project[]) =>
  projects.map((data) => ({ id: data.code.toLowerCase(), data }));

const three = entries(
  work({ code: "R01" }),
  work({ code: "R02" }),
  work({ code: "R03" }),
);
const four = entries(
  work({ code: "R01" }),
  work({ code: "R02" }),
  work({ code: "R03" }),
  work({ code: "R04" }),
);

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Projects, { props });
  return html.replace(/\s+/g, " ");
}

/** The text of an element with this class, with its tags taken out. */
const text = (html: string, className: string) =>
  [
    ...html.matchAll(
      new RegExp(
        `<(\\w+)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>(.*?)</\\1>`,
        "g",
      ),
    ),
  ].map((m) =>
    m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );

describe("<Projects>", () => {
  it("is a section with the id the navigation links to, headed projects, with the count", async () => {
    const html = await render({ projects: three, sections: all });
    expect(html).toMatch(/<section[^>]*\sid="projects"/);
    expect(html).toMatch(
      /<h2[^>]*>\s*projects<span[^>]*class="n"[^>]*>\(03\)</,
    );
  });

  it("has the fixed intro line, which makes no claims", async () => {
    const html = await render({ projects: three, sections: all });
    expect(html).toMatch(
      /<p[^>]*>\s*Each one written up as setup, change and result\.\s*<\/p>/,
    );
  });

  it("is labelled for inspect mode", async () => {
    const html = await render({ projects: three, sections: all });
    expect(html).toContain(`data-inspect="${INSPECT_LABELS.projects}"`);
  });

  it("is not rendered when the projects section is not shown, so the page and the nav agree", async () => {
    const html = await render({
      projects: three,
      sections: all.filter((s) => s.id !== "projects"),
    });
    expect(html.trim()).toBe("");
  });

  it("is not rendered when there are no projects", async () => {
    expect((await render({ projects: [], sections: all })).trim()).toBe("");
  });

  describe("the layout", () => {
    it.each([1, 2, 3])("is strips for %i projects", async (count) => {
      const html = await render({
        projects: three.slice(0, count),
        sections: all,
      });
      expect(html).toMatch(/class="[^"]*\bruns--strip\b/);
      expect(html).not.toMatch(/class="[^"]*\bruns--row\b/);
      expect(html.match(/<article\b/g)).toHaveLength(count);
      expect(html.match(/class="[^"]*\brun--strip\b/g)).toHaveLength(count);
    });

    it.each([4, 5])("is compact rows for %i projects", async (count) => {
      const many = entries(
        ...[1, 2, 3, 4, 5].map((n) => work({ code: `R0${n}` })),
      ).slice(0, count);
      const html = await render({ projects: many, sections: all });
      expect(html).toMatch(/class="[^"]*\bruns--row\b/);
      expect(html).not.toMatch(/class="[^"]*\bruns--strip\b/);
      expect(html.match(/class="[^"]*\brun--row\b/g)).toHaveLength(count);
    });

    it("counts the projects it is given: 4 are rows and 3 are strips, whatever else is on the page", async () => {
      expect(await render({ projects: four, sections: all })).toContain(
        "runs--row",
      );
      expect(await render({ projects: three, sections: all })).toContain(
        "runs--strip",
      );
    });

    it("keeps the order it is given", async () => {
      const html = await render({
        projects: entries(work({ code: "R03" }), work({ code: "R01" })),
        sections: all,
      });
      expect(text(html, "run__code")).toEqual(["R03", "R01"]);
    });
  });

  describe("a strip", () => {
    it("has the code, the title and the status on its top line", async () => {
      const html = await render({ projects: three.slice(0, 1), sections: all });
      const line =
        /<div[^>]*class="[^"]*\brun__line\b[^"]*"[^>]*>(.*?)<\/div>/.exec(
          html,
        )?.[1];
      expect(line).toBeDefined();
      expect(line!.indexOf("run__code")).toBeLessThan(
        line!.indexOf("run__title"),
      );
      expect(line!.indexOf("run__title")).toBeLessThan(line!.indexOf("status"));
      expect(html).toMatch(/<h3[^>]*class="[^"]*run__title/);
      expect(text(html, "run__code")).toEqual(["R01"]);
      expect(text(html, "run__title")).toEqual(["Title R01"]);
    });

    it("has setup, change and result under h4s, in that order", async () => {
      const html = await render({ projects: three.slice(0, 1), sections: all });
      const heads = [...html.matchAll(/<h4[^>]*>(.*?)<\/h4>/g)].map((m) =>
        m[1]!.trim(),
      );
      expect(heads).toEqual(["setup", "change", "result"]);
      // From the sheet to the end of its article: its three columns, as text.
      const sheet = /class="run__sheet"[^>]*>(.*?)<\/article>/
        .exec(html)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      expect(sheet).toBe(
        "setup Setup R01. change Change R01. result Result R01.",
      );
    });

    it("marks the result column, which the styles set apart", async () => {
      const html = await render({ projects: three.slice(0, 1), sections: all });
      expect(html).toMatch(
        /class="[^"]*\bres\b[^"]*"[^>]*>\s*<h4[^>]*>\s*result/,
      );
    });

    it("keeps the leader, the tag and the status together, so when the line wraps they go as one and the leader never trails the title", async () => {
      const featured = three.map((e, i) =>
        i === 0 ? { ...e, data: { ...e.data, featured: true } } : e,
      );
      const html = await render({
        projects: featured.slice(0, 1),
        sections: all,
      });
      const line = /class="run__line"[^>]*>(.*?)<p class="run__meta/.exec(
        html,
      )?.[1];
      expect(line).toBeDefined();
      const aside = /<div[^>]*class="run__aside"[^>]*>(.*)<\/div>/.exec(
        line!,
      )?.[1];
      expect(aside, "no run__aside").toBeDefined();
      expect(aside).toContain('class="leader"');
      expect(aside).toContain('class="tag"');
      expect(aside).toContain("run__status");
      // The title is outside it, in front of it.
      expect(line!.indexOf("run__title")).toBeLessThan(
        line!.indexOf("run__aside"),
      );
    });

    it("sets the $ and > prefixes of the sheet's headings as generated content with an empty alt text, so a screen reader does not read them", () => {
      const source = readFileSync(
        new URL("./Projects.astro", import.meta.url),
        "utf-8",
      );
      const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
      // A browser without the alt-text form ignores the second line and keeps the first.
      expect(style).toMatch(/content:\s*"\$ ";\s*content:\s*"\$ "\s*\/\s*"";/);
      expect(style).toMatch(/content:\s*"> ";\s*content:\s*"> "\s*\/\s*"";/);
    });

    it("has the meta line under the top line", async () => {
      const html = await render({ projects: three.slice(0, 1), sections: all });
      expect(text(html, "run__meta")).toEqual([
        "A UK financial-services organisation · 2024 – 2025",
      ]);
      expect(html.indexOf("run__meta")).toBeLessThan(
        html.indexOf("run__sheet"),
      );
    });
  });

  describe("a row", () => {
    it("has the code, the title, the headline and the status, and nothing of the sheet", async () => {
      const html = await render({ projects: four, sections: all });
      expect(text(html, "run__code")).toEqual(["R01", "R02", "R03", "R04"]);
      expect(text(html, "run__title")).toEqual([
        "Title R01",
        "Title R02",
        "Title R03",
        "Title R04",
      ]);
      expect(text(html, "headline")).toEqual(Array(4).fill("A short result"));
      expect(html.match(/class="[^"]*\bstatus\b/g)).toHaveLength(4);
      expect(html).not.toContain("<h4");
      expect(html).not.toContain("run__sheet");
      expect(html).not.toContain("run__meta");
    });
  });

  describe("the featured tag", () => {
    const featured = (list: typeof three) =>
      list.map((e, i) =>
        i === 1 ? { ...e, data: { ...e.data, featured: true } } : e,
      );

    it("is on the featured project in a strip, and on no other", async () => {
      const html = await render({ projects: featured(three), sections: all });
      expect(text(html, "tag")).toEqual(["featured"]);
      const second = html.split("<article")[2]!;
      expect(second).toContain('class="tag"');
    });

    it("is on the featured project in a row, and on no other", async () => {
      const html = await render({ projects: featured(four), sections: all });
      expect(text(html, "tag")).toEqual(["featured"]);
      const second = html.split("<article")[2]!;
      expect(second).toContain('class="tag"');
    });

    it.each([
      ["a strip", three],
      ["a row", four],
    ])(
      "sits beside the title and not inside the heading, in %s, so the heading is the title alone",
      async (_name, list) => {
        const marked = list.map((e, i) =>
          i === 0 ? { ...e, data: { ...e.data, featured: true } } : e,
        );
        const html = await render({ projects: marked, sections: all });
        const headings = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) =>
          m[1]!.replace(/<[^>]+>/g, "").trim(),
        );
        expect(headings[0]).toBe("Title R01");
        expect(text(html, "tag")).toEqual(["featured"]);
      },
    );

    it("is on nothing when no project is featured", async () => {
      expect(await render({ projects: three, sections: all })).not.toContain(
        'class="tag"',
      );
    });
  });

  describe("the meta line", () => {
    const meta = async (data: Project) =>
      text(
        await render({ projects: entries(data), sections: all }),
        "run__meta",
      );

    it("is the descriptor and the period for a work project", async () => {
      expect(
        await meta(work({ code: "R01", descriptor: "A public-sector body" })),
      ).toEqual(["A public-sector body · 2024 – 2025"]);
    });

    it("is the organisation and the period for a personal project that has one", async () => {
      expect(await meta(named("personal", "A named club"))).toEqual([
        "A named club · 2024 – 2025",
      ]);
    });

    it("says personal project, with the period, when there is no organisation", async () => {
      expect(await meta(named("personal"))).toEqual([
        "personal project · 2024 – 2025",
      ]);
    });

    it("is the organisation and the period for an open-source project that has one", async () => {
      expect(await meta(named("open-source", "A foundation"))).toEqual([
        "A foundation · 2024 – 2025",
      ]);
    });

    it("says open-source project, with the period, when there is no organisation", async () => {
      expect(await meta(named("open-source"))).toEqual([
        "open-source project · 2024 – 2025",
      ]);
    });
  });

  describe("the status", () => {
    const statuses = [
      "in-service",
      "commissioning",
      "complete",
      "archived",
    ] as const;
    const words = ["in service", "commissioning", "complete", "archived"];

    it.each(statuses.map((s, i) => [s, words[i]!] as const))(
      "is the word %s -> %s, with a marker, in a strip",
      async (status, word) => {
        const html = await render({
          projects: entries(work({ code: "R01", status })),
          sections: all,
        });
        expect(html).toMatch(
          new RegExp(`class="status status--${status}"[^>]*>\\s*${word}\\s*<`),
        );
      },
    );

    it("is the same word in a row", async () => {
      const html = await render({
        projects: entries(
          ...statuses.map((status, i) => work({ code: `R0${i + 1}`, status })),
        ),
        sections: all,
      });
      expect(text(html, "status")).toEqual(words);
    });

    it("is marked in-service only for in service, which is the one status that uses green", async () => {
      const html = await render({
        projects: entries(
          ...statuses.map((status, i) => work({ code: `R0${i + 1}`, status })),
        ),
        sections: all,
      });
      expect(html.match(/status--in-service/g)).toHaveLength(1);
    });
  });

  describe("the deploy context", () => {
    const placeholders = entries(
      work({
        code: "R01",
        title: "TODO: project title",
        setup: "TODO: where it started",
        status: "TODO: in-service, commissioning, complete or archived",
        descriptor: "TODO: anonymised descriptor",
      }),
    );

    it.each(["preview", "local"])(
      "hatches each placeholder on a %s build, with the hidden label for screen readers",
      async (context) => {
        const html = await render({
          projects: placeholders,
          sections: all,
          context,
        });
        expect(html.match(/class="ph"/g)!.length).toBeGreaterThanOrEqual(4);
        expect(html).toContain("Placeholder: ");
        expect(html).not.toContain("TODO:");
      },
    );

    it.each([
      ["a row", four],
      ["a strip", three],
    ])(
      "puts a placeholder status and a real one in the same cell of %s, so the layout places them alike",
      async (_name, list) => {
        const withPlaceholder = list.map((e, i) =>
          i === 0
            ? {
                ...e,
                data: {
                  ...e.data,
                  status:
                    "TODO: in-service, commissioning, complete or archived",
                },
              }
            : e,
        );
        const html = await render({
          projects: withPlaceholder,
          sections: all,
          context: "preview",
        });
        expect(html.match(/class="run__status"/g)).toHaveLength(list.length);
        expect(html).toMatch(/class="run__status"[^>]*>\s*<span class="ph"/);
        expect(html).toMatch(
          /class="run__status"[^>]*>\s*<span class="status status--complete"/,
        );
      },
    );

    it("places the status under the title on a phone whatever it holds, and drops the dotted leader there", () => {
      const source = readFileSync(
        new URL("./Projects.astro", import.meta.url),
        "utf-8",
      );
      const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
      const phone = [
        ...style.matchAll(
          /@media \(max-width: 760px\)\s*\{((?:[^{}]*\{[^}]*\}\s*)+)\}/g,
        ),
      ]
        .map((m) => m[1])
        .join("\n");
      expect(phone).toMatch(
        /\.run--row :global\(\.run__status\)[^{]*\{[^}]*grid-column:\s*2/,
      );
      expect(phone).toMatch(/\.leader\s*\{[^}]*display:\s*none/);
    });

    it("hatches a placeholder status instead of making a marker for it", async () => {
      const html = await render({
        projects: placeholders,
        sections: all,
        context: "preview",
      });
      expect(html).not.toMatch(/status--TODO/);
      expect(html).toMatch(/class="ph"/);
    });

    it("shows no hatch and no placeholder text on production", async () => {
      const html = await render({
        projects: placeholders,
        sections: all,
        context: "production",
      });
      expect(html).not.toContain('class="ph"');
      expect(html).not.toContain("Placeholder:");
      expect(html).not.toContain("TODO:");
    });

    it("shows a real project the same in both", async () => {
      const preview = await render({
        projects: three,
        sections: all,
        context: "preview",
      });
      const production = await render({
        projects: three,
        sections: all,
        context: "production",
      });
      expect(production).toBe(preview);
    });
  });

  it("has no links yet: a project's page arrives with the run sheets", async () => {
    for (const projects of [three, four]) {
      const html = await render({ projects, sections: all });
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href=");
      expect(html).not.toMatch(/read the run sheet/i);
    }
  });

  it("has no inline style and no script", async () => {
    const html = await render({ projects: three, sections: all });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
