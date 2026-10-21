import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Section } from "../../content/visibility";
import { INSPECT_LABELS } from "../inspect-labels";
import Skills from "./Skills.astro";

const all: Section[] = [
  { id: "projects", number: 1 },
  { id: "skills", number: 2 },
  { id: "certifications", number: 3 },
  { id: "garage", number: 4 },
  { id: "contact", number: 5 },
];

interface SkillRow {
  group: string;
  context: string;
  tools: string[];
  runs: string[];
}

const platform: SkillRow = {
  group: "Platform",
  context: "Designing and running production platforms.",
  tools: ["Azure", "AKS", "Front Door"],
  runs: ["R01", "R04"],
};
const scripting: SkillRow = {
  group: "Scripting",
  context: "The glue between all of the above.",
  tools: ["PowerShell", "Bash"],
  runs: [],
};

/** The projects the rows point to: R01 and R04, whose file names are not their codes. */
const linked = [
  { id: "first-one", data: { code: "R01", title: "First one" } },
  { id: "this-website", data: { code: "R04", title: "This website" } },
];

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Skills, {
    props: { projects: linked, ...props },
  });
  return html.replace(/\s+/g, " ");
}

/** The text of every element with this class, tags taken out. */
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

describe("<Skills>", () => {
  it("is a section with the id the navigation links to, headed skills, with no count", async () => {
    const html = await render({
      skills: [platform],
      exploring: [],
      sections: all,
    });
    expect(html).toMatch(/<section[^>]*\sid="skills"/);
    expect(html).toMatch(/<h2[^>]*>\s*skills\s*<\/h2>/);
    expect(html).not.toContain('class="n"');
  });

  it("has the fixed intro line, which makes no claims", async () => {
    const html = await render({
      skills: [platform],
      exploring: [],
      sections: all,
    });
    expect(html).toMatch(
      // The apostrophe is escaped in the markup, as any text with one is.
      /<p[^>]*>\s*Where I(?:'|&#39;)ve used each one, and the projects that show it\.\s*<\/p>/,
    );
  });

  it("is labelled for inspect mode", async () => {
    const html = await render({
      skills: [platform],
      exploring: [],
      sections: all,
    });
    expect(html).toContain(`data-inspect="${INSPECT_LABELS.skills}"`);
  });

  it("is not rendered when the skills section is not shown, so the nav and the page agree", async () => {
    const html = await render({
      skills: [platform],
      exploring: ["Something"],
      sections: all.filter((s) => s.id !== "skills"),
    });
    expect(html.trim()).toBe("");
  });

  it("is not rendered when there are neither skills nor things being explored", async () => {
    expect(
      (await render({ skills: [], exploring: [], sections: all })).trim(),
    ).toBe("");
  });

  describe("a skill row", () => {
    it("has the group as an h3, then the context, then the tools", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      expect(html).toMatch(/<h3[^>]*>\s*Platform\s*<\/h3>/);
      expect(text(html, "ctx")).toEqual([
        "Designing and running production platforms.",
      ]);
      expect(html.indexOf("<h3")).toBeLessThan(html.indexOf('class="ctx"'));
      expect(html.indexOf('class="ctx"')).toBeLessThan(
        html.indexOf('class="tools"'),
      );
    });

    it("reads context first: the group, the context, the tools, and only then where it was seen", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      const at = (needle: string) => html.indexOf(needle);
      expect(at("<h3")).toBeLessThan(at('class="ctx"'));
      expect(at('class="ctx"')).toBeLessThan(at('class="tools"'));
      // The evidence comes last in the markup, so a screen reader reaches it after the context.
      // The styles put it at the top right on a wide screen.
      expect(at('class="tools"')).toBeLessThan(at('class="seen"'));
    });

    it("joins the tools with a slash and a space on each side", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      expect(text(html, "tools")).toEqual(["Azure / AKS / Front Door"]);
    });

    it("shows a single tool with no slash", async () => {
      const html = await render({
        skills: [{ ...platform, tools: ["Azure"] }],
        exploring: [],
        sections: all,
      });
      expect(text(html, "tools")).toEqual(["Azure"]);
    });

    it("says where it was seen, as the codes, when it has runs", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      expect(text(html, "seen")).toEqual(["seen in R01 R04"]);
    });

    describe("the seen-in links", () => {
      const anchors = (html: string) =>
        [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map((m) => ({
          href: /\shref="([^"]*)"/.exec(m[1]!)?.[1],
          name: /\saria-label="([^"]*)"/.exec(m[1]!)?.[1],
          text: m[2]!.replace(/<[^>]+>/g, "").trim(),
        }));

      it("makes each code a link to its run sheet, by the project's file name, showing the code alone", async () => {
        const html = await render({
          skills: [platform],
          exploring: [],
          sections: all,
        });
        expect(anchors(html)).toEqual([
          {
            href: "/projects/first-one/",
            name: "R01, First one",
            text: "R01",
          },
          {
            href: "/projects/this-website/",
            name: "R04, This website",
            text: "R04",
          },
        ]);
      });

      it("starts the name with the words the link shows, so a voice control user who says them reaches it", async () => {
        const html = await render({
          skills: [platform],
          exploring: [],
          sections: all,
        });
        for (const { name, text: shown } of anchors(html)) {
          expect(name!.startsWith(shown)).toBe(true);
        }
      });

      it("names a placeholder title by its hint, never by TODO:", async () => {
        const html = await render({
          skills: [platform],
          projects: [
            {
              id: "first-one",
              data: { code: "R01", title: "TODO: project title" },
            },
            ...linked.slice(1),
          ],
          exploring: [],
          sections: all,
          context: "preview",
        });
        expect(anchors(html)[0]!.name).toBe("R01, project title");
        expect(html).not.toContain("TODO:");
      });

      it("links only the codes of projects it was given, so no link is dead", async () => {
        const html = await render({
          skills: [platform],
          projects: linked.slice(1),
          exploring: [],
          sections: all,
        });
        expect(anchors(html).map((a) => a.text)).toEqual(["R04"]);
        // The other code is still said, as text.
        expect(text(html, "seen")).toEqual(["seen in R01 R04"]);
      });

      it("keeps the codes against their tags and one space apart, which compressHTML would otherwise widen", async () => {
        const container = await AstroContainer.create();
        const raw = await container.renderToString(Skills, {
          props: {
            skills: [platform],
            projects: linked,
            exploring: [],
            sections: all,
          },
        });
        expect(raw).toMatch(
          /seen in\s+<span class="codes"[^>]*><a [^>]*>R01<\/a> <a [^>]*>R04<\/a><\/span>/,
        );
      });

      it("has no link in a row without runs", async () => {
        const html = await render({
          skills: [scripting],
          exploring: [],
          sections: all,
        });
        expect(html).not.toContain("<a ");
      });
    });

    it("has no seen-in line when it has no runs", async () => {
      const html = await render({
        skills: [scripting],
        exploring: [],
        sections: all,
      });
      expect(html).not.toContain('class="seen"');
      // The words are not in the row's text (the inspect label's own wording is an attribute).
      expect(text(html, "skill")).not.toEqual([]);
      expect(text(html, "skill").join(" ")).not.toContain("seen in");
      // The rest of the row is there.
      expect(text(html, "ctx")).toEqual(["The glue between all of the above."]);
    });

    it("has the seen-in line only on the rows that have runs", async () => {
      const html = await render({
        skills: [platform, scripting],
        exploring: [],
        sections: all,
      });
      expect(html.match(/class="skill"/g)).toHaveLength(2);
      expect(text(html, "seen")).toEqual(["seen in R01 R04"]);
    });

    it("keeps the order of the rows it is given", async () => {
      const html = await render({
        skills: [scripting, platform],
        exploring: [],
        sections: all,
      });
      expect(
        [...html.matchAll(/<h3[^>]*>\s*(.*?)\s*<\/h3>/g)].map((m) => m[1]),
      ).toEqual(["Scripting", "Platform"]);
    });
  });

  describe("the rows as a list", () => {
    it("are list items in one list a screen reader announces as one, though the styles remove the markers", async () => {
      const html = await render({
        skills: [platform, scripting],
        exploring: [],
        sections: all,
      });
      expect(html).toMatch(/<ul[^>]*class="skills"[^>]*role="list"/);
      expect(html.match(/<ul\b/g)).toHaveLength(1);
      expect(html.match(/<li class="skill"/g)).toHaveLength(2);
      expect(html).not.toMatch(/<div class="skill"/);
    });

    it("leaves the exploring list as a second list, after the rows", async () => {
      const html = await render({
        skills: [platform],
        exploring: ["One"],
        sections: all,
      });
      expect(html.match(/<ul\b/g)).toHaveLength(2);
      expect(html.indexOf('class="skills"')).toBeLessThan(
        html.indexOf('class="explore"'),
      );
    });
  });

  describe("what I'm exploring next", () => {
    it("is under an h3 after the rows, as plain items with no links", async () => {
      const html = await render({
        skills: [platform],
        exploring: ["Internal developer platforms", "Policy as code"],
        sections: all,
      });
      expect(html).toMatch(/<h3[^>]*>\s*what I'm exploring next\s*<\/h3>/);
      expect(html.indexOf('class="skill"')).toBeLessThan(
        html.indexOf("what I'm exploring next"),
      );
      expect(
        [
          ...html
            .slice(html.indexOf('class="explore"'))
            .matchAll(/<li[^>]*>(.*?)<\/li>/g),
        ].map((m) => m[1]!.replace(/<[^>]+>/g, "").trim()),
      ).toEqual(["Internal developer platforms", "Policy as code"]);
      // The rows above it link to run sheets; this list links to nothing.
      const list = html.slice(html.indexOf('class="explore"'));
      expect(list).not.toContain("<a ");
    });

    it("is a list a screen reader announces as one, though the styles remove the markers", async () => {
      const html = await render({
        skills: [],
        exploring: ["One", "Two"],
        sections: all,
      });
      expect(html).toMatch(/<ul[^>]*role="list"/);
    });

    it("shows up to five items", async () => {
      const five = ["One", "Two", "Three", "Four", "Five"];
      const html = await render({
        skills: [platform],
        exploring: five,
        sections: all,
      });
      expect(
        html.slice(html.indexOf('class="explore"')).match(/<li\b/g),
      ).toHaveLength(5);
    });

    it("is left out, heading and all, when there is nothing in it", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      expect(html).not.toContain("exploring next");
      expect(html).not.toContain('class="explore"');
      expect(html.match(/<ul\b/g)).toHaveLength(1);
      // The rows are still there.
      expect(html).toContain('class="skill"');
    });

    it("is the whole section when there are no skill rows, which is enough to show it", async () => {
      const html = await render({
        skills: [],
        exploring: ["Something to explore"],
        sections: all,
      });
      expect(html).toMatch(/<section[^>]*\sid="skills"/);
      expect(html).not.toContain('class="skill"');
      // No empty list for the rows that are not there: the one list is the exploring one.
      expect(html).not.toContain('class="skills"');
      expect(html.match(/<ul\b/g)).toHaveLength(1);
      expect(html).toContain("what I'm exploring next");
    });

    it("has no intro line when there are no rows, because the line is about the rows", async () => {
      // "Where I've used each one, and the projects that show it" over a list of what is next
      // would say something the section does not show.
      const html = await render({
        skills: [],
        exploring: ["Something to explore"],
        sections: all,
      });
      expect(html).not.toContain("Where I");
      const head = /<div class="shead"[^>]*>(.*?)<\/div>/.exec(html)?.[1];
      expect(head, "no head").toBeDefined();
      expect(head).not.toContain("<p");
      // With a row, the intro is there as before.
      const withRow = await render({
        skills: [platform],
        exploring: ["Something to explore"],
        sections: all,
      });
      expect(withRow).toContain("projects that show it");
    });
  });

  describe("the deploy context", () => {
    const placeholderRow: SkillRow = {
      group: "TODO: skill group",
      context: "TODO: one anonymised line",
      tools: ["TODO: tools", "Real tool"],
      runs: [],
    };

    it.each(["preview", "local"])(
      "hatches each placeholder on a %s build, a tool among real ones included",
      async (context) => {
        const html = await render({
          skills: [placeholderRow],
          exploring: ["TODO: something to explore"],
          sections: all,
          context,
        });
        // The group, the context, one tool and the exploring item.
        expect(html.match(/class="ph"/g)).toHaveLength(4);
        expect(html).toContain("Placeholder: ");
        expect(html).not.toContain("TODO:");
        // The tools still read as one line, with the real one beside the hatched.
        expect(text(html, "tools")[0]).toBe("Placeholder: tools / Real tool");
      },
    );

    it("shows no hatch and no placeholder text on production", async () => {
      const html = await render({
        skills: [placeholderRow],
        exploring: ["TODO: something to explore"],
        sections: all,
        context: "production",
      });
      expect(html).not.toContain('class="ph"');
      expect(html).not.toContain("Placeholder:");
      expect(html).not.toContain("TODO:");
    });

    it.each([
      [["TODO: tools", "Real tool"], "Real tool"],
      [["Real tool", "TODO: tools"], "Real tool"],
      [["One", "TODO: tools", "Two"], "One / Two"],
    ])(
      "joins only the tools it shows on production (%j), so a placeholder leaves no stray slash",
      async (tools, expected) => {
        const html = await render({
          skills: [{ ...platform, tools }],
          exploring: [],
          sections: all,
          context: "production",
        });
        expect(text(html, "tools")).toEqual([expected]);
      },
    );

    it("shows a real row and a real item the same in both", async () => {
      const props = {
        skills: [platform, scripting],
        exploring: ["Policy as code"],
        sections: all,
      };
      expect(await render({ ...props, context: "production" })).toBe(
        await render({ ...props, context: "preview" }),
      );
    });
  });

  it("has no inline style and no script", async () => {
    const html = await render({
      skills: [platform],
      exploring: ["One"],
      sections: all,
    });
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i);
    expect(html).not.toContain("<script");
  });
});
