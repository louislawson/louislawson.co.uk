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

    it("is in `order` when no project is featured, whatever order it arrives in", async () => {
      const html = await render({
        projects: entries(work({ code: "R03" }), work({ code: "R01" })),
        sections: all,
      });
      expect(text(html, "run__code")).toEqual(["R01", "R03"]);
    });

    it.each([
      ["strips", 3],
      ["rows", 4],
    ])(
      "leads with the featured project in %s, even when it is third by order",
      async (_name, count) => {
        const projects = entries(
          ...[1, 2, 3, 4]
            .slice(0, count)
            .map((n) => work({ code: `R0${n}`, featured: n === 3 })),
        );
        const html = await render({ projects, sections: all });
        expect(text(html, "run__code")).toEqual(
          count === 3 ? ["R03", "R01", "R02"] : ["R03", "R01", "R02", "R04"],
        );
        // And the tag is on that first one.
        expect(html.split("<article")[1]).toContain('class="tag"');
      },
    );

    it("counts the same projects whatever the order, so the layout does not change with it", async () => {
      const reordered = entries(
        work({ code: "R03", featured: true }),
        work({ code: "R01" }),
        work({ code: "R02" }),
      );
      expect(await render({ projects: reordered, sections: all })).toContain(
        "runs--strip",
      );
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
      // From the sheet to the line that ends the strip: its three columns, as text.
      const sheet = /class="run__sheet"[^>]*>(.*?)<span class="run__more"/
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

    it("is on the featured project in a strip, which leads, and on no other", async () => {
      // R02 is featured, and a featured project leads the list.
      const html = await render({ projects: featured(three), sections: all });
      expect(text(html, "tag")).toEqual(["featured"]);
      expect(text(html, "run__code")[0]).toBe("R02");
      expect(html.split("<article")[1]).toContain('class="tag"');
    });

    it("is on the featured project in a row, which leads, and on no other", async () => {
      const html = await render({ projects: featured(four), sections: all });
      expect(text(html, "tag")).toEqual(["featured"]);
      expect(text(html, "run__code")[0]).toBe("R02");
      expect(html.split("<article")[1]).toContain('class="tag"');
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

    it("is styled once, in the global styles, where the project page's meta row shares it", () => {
      const css = readFileSync(
        new URL("../../styles/global.css", import.meta.url),
        "utf-8",
      );
      const source = readFileSync(
        new URL("./Projects.astro", import.meta.url),
        "utf-8",
      );
      const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
      expect(css).toMatch(
        /\n\.tag\s*\{[^}]*border:\s*1px solid var\(--hivis\)/,
      );
      expect(style).not.toMatch(/\.tag\b/);
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
        status: "TODO: status",
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
                  status: "TODO: status",
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

  it("has no inline style and no script", async () => {
    const html = await render({ projects: three, sections: all });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});

describe("<Projects> links to the run sheets", () => {
  /** The anchors of the markup: their attributes and the text inside them. */
  const anchors = (html: string) =>
    [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map((m) => ({
      attributes: m[1]!,
      text: m[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    }));
  const href = (attributes: string) => /\shref="([^"]*)"/.exec(attributes)?.[1];

  /** Entries whose file names are not their codes, as R04's is not. */
  const filed = (...files: [string, string][]) =>
    files.map(([id, code]) => ({ id, data: work({ code }) }));

  const articles = (html: string) =>
    html
      .split("<article")
      .slice(1)
      .map((a) => a.split("</article>")[0]!);

  it.each([
    ["strips", 3],
    ["rows", 4],
  ])(
    "gives each entry in %s one link, to its page by its file name, named for its title",
    async (_name, count) => {
      const projects = filed(
        ["first-one", "R01"],
        ["second-one", "R02"],
        ["third-one", "R03"],
        ["this-website", "R04"],
      ).slice(0, count);
      const html = await render({ projects, sections: all });
      const entries = articles(html);
      expect(entries).toHaveLength(count);
      entries.forEach((entry, index) => {
        const found = anchors(entry);
        expect(found, `entry ${index}`).toHaveLength(1);
        expect(href(found[0]!.attributes)).toBe(
          `/projects/${projects[index]!.id}/`,
        );
        expect(found[0]!.text).toBe(
          `Read the run sheet: Title ${projects[index]!.data.code}`,
        );
      });
    },
  );

  it("is the only link in the section, so no entry has two ways to the same page", async () => {
    const html = await render({ projects: four, sections: all });
    expect(html.match(/<a\b/g)).toHaveLength(4);
    expect(html.match(/href="/g)).toHaveLength(4);
  });

  it.each([
    ["a strip", three],
    ["a row", four],
  ])(
    "covers the whole entry with the link in %s, which holds nothing visible of its own",
    async (_name, list) => {
      const html = await render({ projects: list, sections: all });
      for (const entry of articles(html)) {
        expect(entry).toMatch(
          /<a\b[^>]*class="hit"[^>]*><span class="vh"[^>]*>Read the run sheet: Title R0\d<\/span><\/a>/,
        );
        // Last in the entry: a screen reader reaches the title and the sheet first, then the link.
        expect(entry.trimEnd().endsWith("</a>")).toBe(true);
      }
    },
  );

  it("names a placeholder title by its hint, never by TODO:", async () => {
    const html = await render({
      projects: [
        {
          id: "r01",
          data: work({ code: "R01", title: "TODO: project title" }),
        },
      ],
      sections: all,
      context: "preview",
    });
    expect(anchors(html)[0]!.text).toBe("Read the run sheet: project title");
    expect(html).not.toContain("TODO:");
  });

  it("links a placeholder project in a preview, because its page exists there", async () => {
    const html = await render({
      projects: [
        {
          id: "r01-placeholder",
          data: work({
            code: "R01",
            title: "TODO: project title",
            status: "TODO: status",
          }),
        },
      ],
      sections: all,
      context: "preview",
    });
    expect(href(anchors(html)[0]!.attributes)).toBe(
      "/projects/r01-placeholder/",
    );
  });

  it("follows the order of the entries: the featured one leads, and its link with it", async () => {
    const projects = [
      { id: "first", data: work({ code: "R01" }) },
      { id: "second", data: work({ code: "R02", featured: true }) },
    ];
    const html = await render({ projects, sections: all });
    expect(anchors(html).map((a) => href(a.attributes))).toEqual([
      "/projects/second/",
      "/projects/first/",
    ]);
  });

  it("ends a strip with the line that says what the link is, and an arrow that is not read out", async () => {
    const html = await render({ projects: three, sections: all });
    expect(text(html, "run__more")).toEqual(
      Array(3).fill("read the run sheet"),
    );
    for (const entry of articles(html)) {
      expect(entry.indexOf("run__sheet")).toBeLessThan(
        entry.indexOf("run__more"),
      );
      expect(entry).toMatch(
        /class="run__more"[^>]*>read the run sheet <svg[^>]*aria-hidden="true"/,
      );
    }
  });

  it("gives a row the arrow, and not the line", async () => {
    const html = await render({ projects: four, sections: all });
    expect(html).not.toContain("run__more");
    expect(html).not.toContain("read the run sheet");
    for (const entry of articles(html)) {
      expect(entry).toMatch(
        /<span class="arr"[^>]*><svg[^>]*aria-hidden="true"/,
      );
    }
  });

  it("puts nothing in the link's name but the action and the title: no line, no arrow, no status", async () => {
    const html = await render({ projects: three, sections: all });
    expect(anchors(html)).toHaveLength(3);
    for (const { text: name } of anchors(html)) {
      expect(name).toMatch(/^Read the run sheet: Title R0\d$/);
    }
  });

  describe("the styles", () => {
    const source = readFileSync(
      new URL("./Projects.astro", import.meta.url),
      "utf-8",
    );
    const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "";
    /** The declarations of the rule with exactly this selector. */
    const rule = (selector: string) =>
      new RegExp(
        `(?:^|[}/])\\s*${selector.replace(/[.\\[\]()]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
      ).exec(style)?.[1];

    it("stretches the link over its entry, which both layouts position", () => {
      expect(rule(".hit")).toMatch(/position:\s*absolute/);
      expect(rule(".hit")).toMatch(/inset:\s*0\b/);
      expect(rule(".run--strip")).toMatch(/position:\s*relative/);
      expect(rule(".run--row")).toMatch(/position:\s*relative/);
    });

    it("keeps the keyboard focus ring on the stretched link, so it surrounds the whole entry", () => {
      // The ring is the global one on :focus-visible; nothing here may take it away or move it.
      expect(style).not.toMatch(/outline\s*:\s*(?:none|0)\b/);
      expect(style).not.toMatch(/:focus-visible[^{]*\{[^}]*outline/);
    });

    it("lights an entry under the pointer or the keyboard focus, as the mock does", () => {
      expect(style).toMatch(
        /\.run--strip:has\(:focus-visible\) \.run__title\s*\{[^}]*color:\s*var\(--hivis\)/,
      );
      expect(style).toMatch(
        /\.run--row:has\(:focus-visible\)\s*\{[^}]*background:\s*var\(--panel\)/,
      );
      expect(style).toMatch(
        /\.run--row:has\(:focus-visible\)::before\s*\{[^}]*scale\(1\)/,
      );
    });

    it("lights an entry under the pointer only where there is a pointer to hover with, so a tap leaves nothing lit", () => {
      const hover = [
        ...style.matchAll(
          /@media \(hover: hover\)\s*\{((?:[^{}]*\{[^}]*\}\s*)+)\}/g,
        ),
      ]
        .map((m) => m[1])
        .join("\n");
      expect(hover).toMatch(
        /\.run--strip:hover \.run__title\s*\{[^}]*color:\s*var\(--hivis\)/,
      );
      expect(hover).toMatch(
        /\.run--row:hover\s*\{[^}]*background:\s*var\(--panel\)/,
      );
      // Not outside the guard, and not on the pointer-free :focus-within, which a click also sets.
      const unguarded = style.replace(
        /@media \(hover: hover\)\s*\{(?:[^{}]*\{[^}]*\}\s*)+\}/g,
        "",
      );
      expect(unguarded).not.toMatch(/:hover/);
      expect(style).not.toContain(":focus-within");
    });

    it("has the arrow in a fifth column on a wide screen, and at the top right of the entry on a phone", () => {
      expect(rule(".run--row")).toMatch(
        /grid-template-columns:\s*3\.6rem minmax\(0, 1\.5fr\) minmax\(0, 1fr\) 9\.5rem 1\.5rem/,
      );
      expect(style).toMatch(
        /\.arr\s*\{[^}]*grid-column:\s*3[^}]*grid-row:\s*1/,
      );
    });
  });
});
