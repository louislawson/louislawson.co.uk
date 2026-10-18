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

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Skills, { props });
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

    it("says where it was seen, as plain codes, when it has runs", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      expect(text(html, "seen")).toEqual(["seen in R01 R04"]);
      // Plain text: a project's page arrives with PR 5.1, and these become links then.
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href=");
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
        [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) =>
          m[1]!.replace(/<[^>]+>/g, "").trim(),
        ),
      ).toEqual(["Internal developer platforms", "Policy as code"]);
      expect(html).not.toContain("<a ");
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
      expect(html.match(/<li\b/g)).toHaveLength(5);
    });

    it("is left out, heading and all, when there is nothing in it", async () => {
      const html = await render({
        skills: [platform],
        exploring: [],
        sections: all,
      });
      expect(html).not.toContain("exploring next");
      expect(html).not.toContain("<ul");
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
      expect(html).toContain("what I'm exploring next");
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
